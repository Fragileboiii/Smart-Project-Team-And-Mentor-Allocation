import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import {
  getTeamById, getTeamMembers, listTeams,
  isStudentInAnyCycleTeam, countTeamMembers, getTeamByStudentAndCycle,
} from '../repositories/teamRepository';
import { getStudentSkills } from '../repositories/studentRepository';
import { writeAuditLog } from '../utils/audit';
import { sendEmail } from '../utils/email';
import { AppError } from '../middleware/errorHandler';

async function getActiveCycleId(): Promise<string> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM project_cycles WHERE is_active=true LIMIT 1'
  );
  if (!rows[0]) throw new AppError('No active project cycle found', 404);
  return rows[0].id;
}

async function getStudentId(userId: string): Promise<string> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM students WHERE user_id=?', [userId]
  );
  if (!rows[0]) throw new AppError('Student profile not found', 404);
  return rows[0].id;
}

export async function listTeamsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const cycleId = req.query.cycleId as string | undefined;
    const teams = await listTeams(cycleId);
    return res.json(teams);
  } catch (e) { next(e); }
}

const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  projectTopic: z.string().optional(),
  projectDomain: z.string().optional(),
});

export async function createTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createTeamSchema.parse(req.body);
    const cycleId = await getActiveCycleId();
    const studentId = await getStudentId(req.user!.id);

    const already = await isStudentInAnyCycleTeam(studentId, cycleId);
    if (already) throw new AppError('You are already in a team for this cycle', 409);

    const [settings] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name='max_team_size'"
    );
    const maxSize = parseInt(settings[0]?.value || '4');

    const teamId = uuidv4();
    await pool.execute(
      `INSERT INTO teams (id,cycle_id,name,description,project_topic,project_domain,leader_id,status)
       VALUES (?,?,?,?,?,?,?,'forming')`,
      [teamId, cycleId, body.name, body.description || null, body.projectTopic || null, body.projectDomain || null, studentId]
    );
    await pool.execute(
      'INSERT INTO team_members (id,team_id,student_id) VALUES (?,?,?)',
      [uuidv4(), teamId, studentId]
    );

    await writeAuditLog(req.user!.id, 'CREATE_TEAM', 'team', teamId, null, body, req.ip);
    return res.status(201).json({ teamId, message: 'Team created' });
  } catch (e) { next(e); }
}

export async function getTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await getTeamById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const members = await getTeamMembers(req.params.id);
    return res.json({ ...team, members });
  } catch (e) { next(e); }
}

const inviteSchema = z.object({ inviteeId: z.string(), message: z.string().optional() });

export async function sendInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { inviteeId, message } = inviteSchema.parse(req.body);
    const team = await getTeamById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const inviterId = await getStudentId(req.user!.id);
    if (team.leader_id !== inviterId) throw new AppError('Only the team leader can send invitations', 403);

    const [settings] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name='max_team_size'"
    );
    const maxSize = parseInt(settings[0]?.value || '4');
    const currentCount = await countTeamMembers(team.id);
    if (currentCount >= maxSize) throw new AppError('Team is full (max ' + maxSize + ' members)', 409);

    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM team_invitations WHERE team_id=? AND invitee_id=? AND status='pending'",
      [team.id, inviteeId]
    );
    if (existing.length) throw new AppError('Invitation already pending', 409);

    await pool.execute(
      'INSERT INTO team_invitations (id,team_id,invitee_id,inviter_id,message) VALUES (?,?,?,?,?)',
      [uuidv4(), team.id, inviteeId, inviterId, message || null]
    );
    // Notify invitee by email (fire-and-forget)
    pool.execute('SELECT u.email FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=?', [inviteeId])
      .then(([rows]: any) => { if (rows[0]) sendEmail(rows[0].email, 'Team Invitation - SmartAlloc', 'You have been invited to join team ' + team.name + '.').catch(() => {}); })
      .catch(() => {});
    return res.status(201).json({ message: 'Invitation sent' });
  } catch (e) { next(e); }
}

const respondSchema = z.object({ accept: z.boolean() });

export async function respondToInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { accept } = respondSchema.parse(req.body);
    const me = await getStudentId(req.user!.id);

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM team_invitations WHERE id=? AND status='pending'",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Invitation not found' });
    const inv = rows[0];

    // A self-invitation (inviter == invitee) is a "join request": only the team
    // leader may accept/reject it. A normal invitation is responded to by the invitee.
    const isJoinRequest = inv.invitee_id === inv.inviter_id;
    if (isJoinRequest) {
      const team = await getTeamById(inv.team_id);
      if (!team || team.leader_id !== me) {
        return res.status(403).json({ error: 'Only the team leader can respond to join requests' });
      }
    } else if (inv.invitee_id !== me) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (!accept) {
      await pool.execute(
        "UPDATE team_invitations SET status='rejected', responded_at=NOW() WHERE id=?", [inv.id]
      );
      return res.json({ message: 'Invitation rejected' });
    }

    const team = await getTeamById(inv.team_id);
    if (!team) throw new AppError('Team not found', 404);
    const newMemberId = inv.invitee_id;

    const already = await isStudentInAnyCycleTeam(newMemberId, team.cycle_id);
    if (already) throw new AppError('Student is already in a team for this cycle', 409);

    const [settings] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name='max_team_size'"
    );
    const maxSize = parseInt(settings[0]?.value || '4');
    const currentCount = await countTeamMembers(inv.team_id);
    if (currentCount >= maxSize) throw new AppError('Team is full (max ' + maxSize + ')', 409);

    await pool.execute('INSERT INTO team_members (id,team_id,student_id) VALUES (?,?,?)',
      [uuidv4(), inv.team_id, newMemberId]
    );
    await pool.execute(
      "UPDATE team_invitations SET status='accepted', responded_at=NOW() WHERE id=?", [inv.id]
    );
    return res.json({ message: 'Joined team successfully' });
  } catch (e) { next(e); }
}

export async function sendJoinRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await getTeamById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const studentId = await getStudentId(req.user!.id);
    const already = await isStudentInAnyCycleTeam(studentId, team.cycle_id);
    if (already) throw new AppError('Already in a team this cycle', 409);

    // Reuse invitation table with self-invite pattern (inviter = invitee, leader approves)
    await pool.execute(
      'INSERT INTO team_invitations (id,team_id,invitee_id,inviter_id,message,status) VALUES (?,?,?,?,?,?)',
      [uuidv4(), team.id, studentId, studentId, 'Join request from student', 'pending']
    );
    return res.status(201).json({ message: 'Join request sent' });
  } catch (e) { next(e); }
}

export async function getMyTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.id);
    const cycleId = await getActiveCycleId();
    const team = await getTeamByStudentAndCycle(studentId, cycleId);
    if (!team) return res.json(null);
    const members = await getTeamMembers(team.id);
    return res.json({ ...team, members });
  } catch (e) { next(e); }
}

export async function autoMatchTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const cycleId = await getActiveCycleId();
    const callerId = await getStudentId(req.user!.id);

    const already = await isStudentInAnyCycleTeam(callerId, cycleId);
    if (already) throw new AppError('You are already in a team for this cycle', 409);

    const [sMax] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name = 'max_team_size'"
    );
    const [sMin] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name = 'min_team_size'"
    );
    const maxSize = parseInt(sMax[0]?.value || '4');
    const minSize = parseInt(sMin[0]?.value || '2');

    const [callerRow] = await pool.execute<RowDataPacket[]>(
      'SELECT id, section FROM students WHERE id = ?', [callerId]
    );
    const caller = callerRow[0] as any;
    const callerSkills = (await getStudentSkills(callerId)).map(s => s.name);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.id, s.section, u.first_name, u.last_name
       FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.id <> ?
         AND s.id NOT IN (
           SELECT tm.student_id FROM team_members tm
           JOIN teams t ON t.id = tm.team_id
           WHERE t.cycle_id = ?
         )`,
      [callerId, cycleId]
    );
    const candidates = await Promise.all(rows.map(async (r: any) => ({
      id: r.id,
      section: r.section,
      firstName: r.first_name,
      lastName: r.last_name,
      skills: (await getStudentSkills(r.id)).map(s => s.name),
    })));

    const overlap = (skills: string[]) => {
      if (!callerSkills.length || !skills.length) return 0;
      const set = new Set(skills);
      return callerSkills.filter(s => set.has(s)).length;
    };
    candidates.sort((a, b) => overlap(b.skills) - overlap(a.skills) || Math.random() - 0.5);

    const team: { id: string; section: string | null; skills: string[]; firstName: string; lastName: string }[] = [
      { id: callerId, section: caller?.section ?? null, skills: callerSkills, firstName: '', lastName: '' },
    ];
    const usedSections = new Set<string>();
    if (caller?.section) usedSections.add(caller.section);

    for (const c of candidates) {
      if (team.length >= maxSize) break;
      const sec = c.section;
      if (sec && usedSections.has(sec)) continue;
      if (sec) usedSections.add(sec);
      team.push(c);
    }

    if (team.length < minSize) {
      throw new AppError(
        'Not enough students from different sections are available to form a team. Try again later or invite teammates manually from Discover.',
        409
      );
    }

    const allSkills = team.flatMap(t => t.skills);
    const skillCounts: Record<string, number> = {};
    allSkills.forEach(s => { skillCounts[s] = (skillCounts[s] || 0) + 1; });
    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(e => e[0]);
    const teamName = 'Auto Squad' + (topSkills.length ? (' - ' + topSkills.join('/')) : '') + ' #' + Math.random().toString(36).slice(2, 6);

    const teamId = uuidv4();
    await pool.execute(
      `INSERT INTO teams (id, cycle_id, name, description, project_topic, project_domain, leader_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'forming')`,
      [
        teamId, cycleId, teamName,
        'Auto-formed team based on tech-stack compatibility (distinct sections).',
        'Auto-Matched Project', topSkills[0] || 'General', callerId,
      ]
    );
    for (const m of team) {
      await pool.execute(
        'INSERT INTO team_members (id, team_id, student_id) VALUES (?, ?, ?)',
        [uuidv4(), teamId, m.id]
      );
    }

    await writeAuditLog(req.user!.id, 'AUTO_MATCH_TEAM', 'team', teamId, null, { members: team.length, topSkills }, req.ip);
    return res.status(201).json({
      teamId,
      teamName,
      members: team.length,
      message: 'Auto-matched team created based on tech stack!',
    });
  } catch (e) { next(e); }
}

// ── Invitation inbox ─────────────────────────────────────────────────────────
// Returns (a) invitations received by the current student and (b) join requests
// sent to teams the current student leads. Both are pending and actionable.
export async function getMyInvitations(req: Request, res: Response, next: NextFunction) {
  try {
    const me = await getStudentId(req.user!.id);

    const [received] = await pool.execute<RowDataPacket[]>(
      `SELECT ti.id, ti.team_id, ti.message, ti.created_at, ti.status,
              t.name AS team_name, t.project_topic, t.project_domain,
              inviter.first_name AS inviter_first, inviter.last_name AS inviter_last,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = ti.team_id) AS member_count
       FROM team_invitations ti
       JOIN teams t ON t.id = ti.team_id
       JOIN students inv_s ON inv_s.id = ti.inviter_id
       JOIN users inviter ON inviter.id = inv_s.user_id
       WHERE ti.invitee_id = ? AND ti.invitee_id <> ti.inviter_id AND ti.status='pending'
       ORDER BY ti.created_at DESC`,
      [me]
    );

    const [joinReqs] = await pool.execute<RowDataPacket[]>(
      `SELECT ti.id, ti.team_id, ti.message, ti.created_at, ti.status,
              t.name AS team_name, t.project_topic, t.project_domain,
              requester.first_name AS inviter_first, requester.last_name AS inviter_last,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = ti.team_id) AS member_count
       FROM team_invitations ti
       JOIN teams t ON t.id = ti.team_id
       JOIN students req_s ON req_s.id = ti.inviter_id
       JOIN users requester ON requester.id = req_s.user_id
       WHERE t.leader_id = ? AND ti.invitee_id = ti.inviter_id AND ti.status='pending'
       ORDER BY ti.created_at DESC`,
      [me]
    );

    const receivedTyped = (received as any[]).map(r => ({ ...r, type: 'invite' }));
    const joinTyped = (joinReqs as any[]).map(r => ({ ...r, type: 'join_request' }));
    return res.json([...receivedTyped, ...joinTyped]);
  } catch (e) { next(e); }
}
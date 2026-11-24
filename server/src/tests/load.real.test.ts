/**
 * Real-MySQL Load Test — 1,000 sequential allocation requests
 *
 * Run with: TEST_DB_NAME=smartalloc_test npx vitest run src/tests/load.real.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql, { Connection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const TEST_DB = process.env.TEST_DB_NAME;
const SKIP = !TEST_DB;
const N = 1000;

// Reuse same SCHEMA_STATEMENTS and DROP_ORDER as concurrency test
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, role ENUM('student','mentor','admin') NOT NULL,
    first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS project_cycles (
    id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, semester VARCHAR(20) NOT NULL,
    year INT NOT NULL, min_team_size INT NOT NULL DEFAULT 2, max_team_size INT NOT NULL DEFAULT 4,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS mentors (
    id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL UNIQUE,
    employee_id VARCHAR(20) NOT NULL UNIQUE, department VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL, domain VARCHAR(100), bio TEXT,
    max_capacity INT NOT NULL DEFAULT 3, is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL UNIQUE,
    roll_number VARCHAR(20) NOT NULL UNIQUE, department VARCHAR(100) NOT NULL,
    semester INT NOT NULL, cgpa DECIMAL(4,2), bio TEXT, project_interests TEXT, section VARCHAR(10),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(36) PRIMARY KEY, cycle_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL, description TEXT, project_topic VARCHAR(255),
    project_domain VARCHAR(100), leader_id VARCHAR(36) NOT NULL,
    status ENUM('forming','active','allocated','completed') NOT NULL DEFAULT 'forming',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cycle_id) REFERENCES project_cycles(id) ON DELETE CASCADE,
    FOREIGN KEY (leader_id) REFERENCES students(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS mentor_requests (
    id VARCHAR(36) PRIMARY KEY, team_id VARCHAR(36) NOT NULL,
    mentor_id VARCHAR(36) NOT NULL, cycle_id VARCHAR(36) NOT NULL,
    status ENUM('pending','queued','processing','allocated','rejected','cancelled','failed','waiting') NOT NULL DEFAULT 'pending',
    priority INT NOT NULL DEFAULT 0, priority_score DECIMAL(10,4) NOT NULL DEFAULT 0,
    enqueue_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processing_start DATETIME, completion_time DATETIME,
    failure_reason TEXT, rejection_comments TEXT, message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
    FOREIGN KEY (cycle_id) REFERENCES project_cycles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS allocations (
    id VARCHAR(36) PRIMARY KEY, team_id VARCHAR(36) NOT NULL,
    mentor_id VARCHAR(36) NOT NULL, cycle_id VARCHAR(36) NOT NULL,
    request_id VARCHAR(36) NOT NULL,
    status ENUM('active','cancelled','reassigned','completed') NOT NULL DEFAULT 'active',
    allocated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at DATETIME, notes TEXT,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT,
    FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE RESTRICT,
    FOREIGN KEY (cycle_id) REFERENCES project_cycles(id) ON DELETE RESTRICT,
    FOREIGN KEY (request_id) REFERENCES mentor_requests(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS resource_locks (
    id VARCHAR(36) PRIMARY KEY, resource_id VARCHAR(36) NOT NULL,
    held_by VARCHAR(36), acquired_at DATETIME, released_at DATETIME,
    lock_status ENUM('acquired','released','timeout','failed') NOT NULL DEFAULT 'acquired',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS scheduler_events (
    id VARCHAR(36) PRIMARY KEY, request_id VARCHAR(36),
    event_type VARCHAR(50) NOT NULL, old_status VARCHAR(50), new_status VARCHAR(50),
    metadata JSON, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES mentor_requests(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36),
    action VARCHAR(100) NOT NULL, entity_type VARCHAR(50), entity_id VARCHAR(36),
    old_value JSON, new_value JSON, ip_address VARCHAR(45),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS system_settings (
    key_name VARCHAR(100) PRIMARY KEY, value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `INSERT IGNORE INTO system_settings (key_name, value) VALUES ('rr_last_request_id','')`,
];

const DROP_ORDER = [
  'audit_logs','scheduler_events','resource_locks',
  'allocations','mentor_requests','teams',
  'students','mentors','users',
  'project_cycles','system_settings',
];

describe.skipIf(SKIP)('Real-MySQL Load Test (1,000 sequential requests, capacity 1,000)', { timeout: 300000 }, () => {
  let conn: Connection;
  const mentorId = uuidv4();
  const cycleId  = uuidv4();
  const userId   = uuidv4();
  const requests: { teamId: string; reqId: string }[] = [];

  beforeAll(async () => {
    if (!TEST_DB || TEST_DB === 'smartalloc') {
      throw new Error('TEST_DB_NAME must be set and must not be "smartalloc"');
    }

    process.env.DB_NAME = TEST_DB;

    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: TEST_DB,
      multipleStatements: false,
    });

    for (const stmt of SCHEMA_STATEMENTS) {
      try { await conn.execute(stmt); } catch (e: any) {
        if (!['ER_DUP_KEYNAME','ER_TABLE_EXISTS_ERROR'].includes(e.code)) throw e;
      }
    }

    await conn.query(`DROP PROCEDURE IF EXISTS allocate_mentor`);
    await conn.query(`
      CREATE PROCEDURE allocate_mentor(
        IN p_request_id VARCHAR(36), IN p_team_id VARCHAR(36),
        IN p_mentor_id VARCHAR(36),  IN p_cycle_id VARCHAR(36),
        IN p_user_id VARCHAR(36),
        OUT p_alloc_id VARCHAR(36),  OUT p_ok TINYINT
      )
      proc_body: BEGIN
        DECLARE v_max INT DEFAULT 0;
        DECLARE v_active INT DEFAULT 0;
        DECLARE v_avail TINYINT DEFAULT 0;
        DECLARE v_exist INT DEFAULT 0;
        DECLARE v_new_id VARCHAR(36) DEFAULT '';
        DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET p_ok=0; SET p_alloc_id=''; END;
        START TRANSACTION;
        SELECT max_capacity, is_available INTO v_max, v_avail FROM mentors WHERE id=p_mentor_id FOR UPDATE;
        SELECT COUNT(*) INTO v_active FROM allocations WHERE mentor_id=p_mentor_id AND status='active';
        IF v_avail=0 OR (v_max - v_active) <= 0 THEN
          UPDATE mentor_requests SET status='waiting', updated_at=NOW() WHERE id=p_request_id;
          COMMIT; SET p_ok=0; SET p_alloc_id=''; LEAVE proc_body;
        END IF;
        SELECT COUNT(*) INTO v_exist FROM allocations WHERE team_id=p_team_id AND cycle_id=p_cycle_id AND status='active';
        IF v_exist > 0 THEN ROLLBACK; SET p_ok=0; SET p_alloc_id=''; LEAVE proc_body; END IF;
        SET v_new_id = UUID();
        INSERT INTO allocations (id,team_id,mentor_id,cycle_id,request_id,status,allocated_at)
          VALUES (v_new_id,p_team_id,p_mentor_id,p_cycle_id,p_request_id,'active',NOW());
        UPDATE mentor_requests SET status='allocated',processing_start=NOW(),completion_time=NOW(),updated_at=NOW() WHERE id=p_request_id;
        UPDATE teams SET status='allocated',updated_at=NOW() WHERE id=p_team_id;
        INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id)
          VALUES (UUID(),p_user_id,'PROC_ALLOCATE','allocation',v_new_id);
        COMMIT; SET p_ok=1; SET p_alloc_id=v_new_id;
      END
    `);

    await conn.execute(
      `INSERT IGNORE INTO users (id,email,password_hash,role,first_name,last_name) VALUES (?,?,?,?,?,?)`,
      [userId, 'load.mentor@test.local', '$2a$10$ph', 'mentor', 'Load', 'Mentor']
    );
    await conn.execute(
      `INSERT IGNORE INTO mentors (id,user_id,employee_id,department,designation,max_capacity,is_available) VALUES (?,?,?,?,?,?,?)`,
      [mentorId, userId, 'EMP-LOAD-001', 'CSE', 'Professor', N, true]
    );
    await conn.execute(
      `INSERT IGNORE INTO project_cycles (id,name,semester,year,is_active) VALUES (?,?,?,?,?)`,
      [cycleId, 'Load Test Cycle', 'Even', 2024, true]
    );

    // Batch-insert 1000 teams and requests
    for (let i = 0; i < N; i++) {
      const stuUserId = uuidv4();
      const stuId = uuidv4();
      const teamId = uuidv4();
      const reqId = uuidv4();
      await conn.execute(
        `INSERT INTO users (id,email,password_hash,role,first_name,last_name) VALUES (?,?,?,?,?,?)`,
        [stuUserId, `load${i}@test.local`, '$2a$10$ph', 'student', `Load${i}`, 'Stu']
      );
      await conn.execute(
        `INSERT INTO students (id,user_id,roll_number,department,semester) VALUES (?,?,?,?,?)`,
        [stuId, stuUserId, `LD${i.toString().padStart(5,'0')}`, 'CSE', 5]
      );
      await conn.execute(
        `INSERT INTO teams (id,cycle_id,name,leader_id,status) VALUES (?,?,?,?,?)`,
        [teamId, cycleId, `LoadTeam${i}`, stuId, 'active']
      );
      await conn.execute(
        `INSERT INTO mentor_requests (id,team_id,mentor_id,cycle_id,status,enqueue_time) VALUES (?,?,?,?,?,NOW())`,
        [reqId, teamId, mentorId, cycleId, 'pending']
      );
      requests.push({ teamId, reqId });
    }

    const { initSemaphores } = await import('../utils/semaphore');
    await initSemaphores();
  }, 180000);

  it(`1,000 sequential allocations — zero over-allocation`, async () => {
    const { allocateMentor } = await import('../algorithms/allocationEngine');

    let successCount = 0;
    const start = Date.now();

    for (const { reqId, teamId } of requests) {
      const result = await allocateMentor(reqId, teamId, mentorId, cycleId, userId);
      if (result.success) successCount++;
    }

    const elapsed = Date.now() - start;
    const avgMs = elapsed / N;
    console.log(`Load test: ${N} requests in ${elapsed}ms — avg ${avgMs.toFixed(1)}ms/req — ${successCount} allocated`);

    // Verify DB count matches TypeScript count
    const [rows] = await conn.execute<any[]>(
      `SELECT COUNT(*) AS cnt FROM allocations WHERE mentor_id=? AND status='active'`,
      [mentorId]
    );
    const dbCount = Number((rows as any)[0].cnt);

    expect(dbCount).toBe(successCount);
    expect(dbCount).toBeLessThanOrEqual(N);
    expect(dbCount).toBeGreaterThan(0);
  }, 240000);

  afterAll(async () => {
    if (!conn) return;
    for (const tbl of DROP_ORDER) {
      try { await conn.execute(`DELETE FROM \`${tbl}\``); } catch { /* ignore */ }
    }
    try { await conn.query(`DROP PROCEDURE IF EXISTS allocate_mentor`); } catch { /* ignore */ }
    await conn.end();
  });
});

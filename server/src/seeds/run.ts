import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smartalloc',
  });

  console.log('🌱 Seeding database...');
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  // ── Skills catalogue ────────────────────────────────────────────────────────
  const skillDefs = [
    { name: 'React', category: 'Frontend' },
    { name: 'Node.js', category: 'Backend' },
    { name: 'Python', category: 'Backend' },
    { name: 'MySQL', category: 'Database' },
    { name: 'Machine Learning', category: 'AI/ML' },
    { name: 'TypeScript', category: 'Frontend' },
    { name: 'Java', category: 'Backend' },
    { name: 'System Design', category: 'Architecture' },
    { name: 'OS Concepts', category: 'Systems' },
    { name: 'DBMS', category: 'Database' },
    { name: 'Cybersecurity', category: 'Security' },
    { name: 'Cloud Computing', category: 'Cloud/DevOps' },
    { name: 'Mobile Development', category: 'Mobile' },
    { name: 'Blockchain', category: 'Web3' },
    { name: 'Big Data', category: 'Data Engineering' },
  ];
  const skills = skillDefs.map(s => ({ id: uuidv4(), ...s }));
  const skillMap: Record<string, string> = {};
  skills.forEach(s => { skillMap[s.name] = s.id; });

  // ── Mentors ─────────────────────────────────────────────────────────────────
  const mentors = [
    { first: 'Priya',   last: 'Sharma',  email: 'priya.sharma@smartalloc.edu',  emp: 'EMP001', dept: 'CSE', designation: 'Associate Professor', domain: 'OS/DBMS',                 bio: 'Expert in OS, DBMS, and distributed systems.', capacity: 3, skills: ['OS Concepts', 'DBMS', 'Python', 'System Design'] },
    { first: 'Rajesh',  last: 'Kumar',   email: 'rajesh.kumar@smartalloc.edu',  emp: 'EMP002', dept: 'CSE', designation: 'Assistant Professor',  domain: 'Machine Learning',        bio: 'Specializes in ML, AI, and data science.', capacity: 2, skills: ['Machine Learning', 'Python', 'MySQL'] },
    { first: 'Anita',   last: 'Singh',   email: 'anita.singh@smartalloc.edu',   emp: 'EMP003', dept: 'IT',  designation: 'Associate Professor',  domain: 'Web Development',         bio: 'Full-stack development, modern frontend, and software engineering.', capacity: 3, skills: ['React', 'Node.js', 'TypeScript', 'System Design'] },
    { first: 'Vikram',  last: 'Joshi',   email: 'vikram.joshi@smartalloc.edu',  emp: 'EMP004', dept: 'CSE', designation: 'Professor',             domain: 'Cybersecurity',            bio: 'Network security, ethical hacking, and cryptography.', capacity: 3, skills: ['Cybersecurity', 'OS Concepts', 'Python', 'System Design'] },
    { first: 'Sneha',   last: 'Patel',   email: 'sneha.patel@smartalloc.edu',   emp: 'EMP005', dept: 'IT',  designation: 'Assistant Professor',  domain: 'Cloud/DevOps',            bio: 'Cloud architecture, Docker, Kubernetes, and CI/CD pipelines.', capacity: 3, skills: ['Cloud Computing', 'Node.js', 'System Design', 'Python'] },
    { first: 'Amit',    last: 'Verma',   email: 'amit.verma@smartalloc.edu',    emp: 'EMP006', dept: 'CSE', designation: 'Associate Professor',  domain: 'Artificial Intelligence', bio: 'Deep learning, computer vision, and neural network architectures.', capacity: 2, skills: ['Machine Learning', 'Python', 'System Design'] },
    { first: 'Neha',    last: 'Gupta',    email: 'neha.gupta@smartalloc.edu',    emp: 'EMP007', dept: 'CSE', designation: 'Assistant Professor',  domain: 'Mobile Computing',        bio: 'Cross-platform mobile apps, Flutter, and React Native.', capacity: 3, skills: ['Mobile Development', 'React', 'TypeScript', 'Node.js'] },
    { first: 'Rohan',   last: 'Mehta',   email: 'rohan.mehta@smartalloc.edu',   emp: 'EMP008', dept: 'IT',  designation: 'Associate Professor',  domain: 'Data Engineering',        bio: 'Big data pipelines, distributed computing, and database optimization.', capacity: 3, skills: ['Big Data', 'DBMS', 'MySQL', 'Python', 'System Design'] },
    { first: 'Kavita',  last: 'Rao',     email: 'kavita.rao@smartalloc.edu',     emp: 'EMP009', dept: 'CSE', designation: 'Assistant Professor',  domain: 'Blockchain/Web3',          bio: 'Decentralized systems, smart contracts, and Web3 architectures.', capacity: 2, skills: ['Blockchain', 'Cybersecurity', 'System Design', 'Python'] },
    { first: 'Sanjay',  last: 'Nair',    email: 'sanjay.nair@smartalloc.edu',    emp: 'EMP010', dept: 'CSE', designation: 'Professor',             domain: 'IoT/Embedded Systems',     bio: 'Embedded systems, IoT architectures, and edge computing.', capacity: 3, skills: ['Python', 'OS Concepts', 'System Design', 'Mobile Development'] },
    { first: 'Meera',   last: 'Joshi',   email: 'meera.joshi@smartalloc.edu',    emp: 'EMP011', dept: 'IT',  designation: 'Associate Professor',  domain: 'Data Science',            bio: 'Statistical modelling, data wrangling, and analytics.', capacity: 3, skills: ['Machine Learning', 'Python', 'Big Data', 'MySQL'] },
    { first: 'Arvind',  last: 'Krishna', email: 'arvind.krishna@smartalloc.edu', emp: 'EMP012', dept: 'CSE', designation: 'Assistant Professor',  domain: 'AR/VR & Graphics',         bio: 'Computer graphics, AR/VR pipelines, and creative coding.', capacity: 2, skills: ['React', 'TypeScript', 'Mobile Development', 'System Design'] },
  ];

  // ── Students (sections spread across A/B/C/D) ───────────────────────────────
  const students = [
    { first: 'Aditya',     last: 'Bisht',     email: 'aditya.bisht@smartalloc.edu',          roll: '24021285',  dept: 'CSE', sem: 5, cgpa: 8.5, section: 'A', bio: 'Passionate about backend systems.',          interests: 'OS, DBMS, Web Development',      skills: [['Node.js', 'advanced'], ['MySQL', 'intermediate'], ['OS Concepts', 'intermediate']] },
    { first: 'Amritanshu', last: 'Purohit',   email: 'amritanshu.purohit@smartalloc.edu',    roll: '240211559', dept: 'CSE', sem: 5, cgpa: 8.2, section: 'A', bio: 'Interested in ML and data.',                interests: 'Machine Learning, Python',      skills: [['Python', 'advanced'], ['Machine Learning', 'intermediate']] },
    { first: 'Ananya',     last: 'Nautiyal',  email: 'ananya.nautiyal@smartalloc.edu',       roll: '24012254',  dept: 'CSE', sem: 5, cgpa: 8.8, section: 'B', bio: 'UI/UX and frontend enthusiast.',            interests: 'React, TypeScript, UI Design',   skills: [['React', 'advanced'], ['TypeScript', 'advanced']] },
    { first: 'Aryan',      last: 'Barthwal',  email: 'aryan.barthwal@smartalloc.edu',        roll: '240212203', dept: 'CSE', sem: 5, cgpa: 7.9, section: 'B', bio: 'System design and architecture.',          interests: 'System Design, Java, OS',       skills: [['Java', 'advanced'], ['System Design', 'intermediate'], ['OS Concepts', 'intermediate']] },
    { first: 'Riya',       last: 'Gupta',     email: 'riya.gupta@smartalloc.edu',            roll: '24099001',  dept: 'IT',  sem: 5, cgpa: 8.1, section: 'C', bio: 'Web and mobile developer.',                interests: 'React, Node.js, Mobile',        skills: [['React', 'intermediate'], ['Node.js', 'intermediate']] },
    { first: 'Karan',      last: 'Mehta',     email: 'karan.mehta@smartalloc.edu',           roll: '24099002',  dept: 'CSE', sem: 5, cgpa: 7.7, section: 'C', bio: 'Database and backend focus.',              interests: 'MySQL, Python, APIs',           skills: [['MySQL', 'advanced'], ['Python', 'intermediate']] },
    { first: 'Shreya',     last: 'Joshi',     email: 'shreya.joshi@smartalloc.edu',          roll: '24099003',  dept: 'CSE', sem: 5, cgpa: 8.6, section: 'D', bio: 'AI/ML researcher.',                         interests: 'Machine Learning, Python',      skills: [['Machine Learning', 'advanced'], ['Python', 'advanced']] },
    { first: 'Vivek',      last: 'Rana',      email: 'vivek.rana@smartalloc.edu',             roll: '24099004',  dept: 'IT',  sem: 5, cgpa: 7.5, section: 'D', bio: 'Full-stack developer.',                    interests: 'React, Node.js, TypeScript',    skills: [['React', 'intermediate'], ['Node.js', 'advanced'], ['TypeScript', 'intermediate']] },
    { first: 'Ishaan',     last: 'Verma',     email: 'ishaan.verma@smartalloc.edu',          roll: '24099005',  dept: 'CSE', sem: 5, cgpa: 8.0, section: 'A', bio: 'Cloud-native tinkerer.',                   interests: 'Cloud, DevOps, Node.js',         skills: [['Cloud Computing', 'intermediate'], ['Node.js', 'intermediate']] },
    { first: 'Nisha',      last: 'Rao',       email: 'nisha.rao@smartalloc.edu',              roll: '24099006',  dept: 'IT',  sem: 5, cgpa: 8.3, section: 'B', bio: 'Mobile-first builder.',                    interests: 'React, Mobile',                 skills: [['React', 'advanced'], ['Mobile Development', 'intermediate']] },
    { first: 'Rohit',      last: 'Singh',     email: 'rohit.singh@smartalloc.edu',           roll: '24099007',  dept: 'CSE', sem: 5, cgpa: 7.6, section: 'C', bio: 'Systems & concurrency nerd.',              interests: 'Java, OS',                      skills: [['Java', 'advanced'], ['OS Concepts', 'intermediate']] },
    { first: 'Pooja',      last: 'Nair',      email: 'pooja.nair@smartalloc.edu',            roll: '24099008',  dept: 'CSE', sem: 5, cgpa: 8.4, section: 'D', bio: 'Data pipelines enthusiast.',              interests: 'Big Data, Python',             skills: [['Machine Learning', 'intermediate'], ['Python', 'advanced'], ['Big Data', 'intermediate']] },
    { first: 'Arjun',      last: 'Malhotra',  email: 'arjun.malhotra@smartalloc.edu',        roll: '24099009',  dept: 'IT',  sem: 5, cgpa: 7.8, section: 'A', bio: 'Web3 explorer.',                           interests: 'Blockchain, Security',          skills: [['Blockchain', 'intermediate'], ['Cybersecurity', 'intermediate']] },
    { first: 'Sneha',      last: 'Reddy',     email: 'sneha.reddy@smartalloc.edu',           roll: '24099010',  dept: 'CSE', sem: 5, cgpa: 8.1, section: 'B', bio: 'Frontend craftsman.',                      interests: 'React, TypeScript',            skills: [['React', 'intermediate'], ['TypeScript', 'intermediate']] },
    { first: 'Manav',      last: 'Shah',      email: 'manav.shah@smartalloc.edu',            roll: '24099011',  dept: 'CSE', sem: 5, cgpa: 7.9, section: 'C', bio: 'Cloud & automation fan.',                  interests: 'Cloud, Python',               skills: [['Cloud Computing', 'advanced'], ['Python', 'intermediate']] },
    { first: 'Kavya',      last: 'Iyer',      email: 'kavya.iyer@smartalloc.edu',             roll: '24099012',  dept: 'IT',  sem: 5, cgpa: 8.2, section: 'D', bio: 'Database optimizer.',                     interests: 'DBMS, MySQL',                 skills: [['DBMS', 'advanced'], ['MySQL', 'advanced']] },
    { first: 'Devansh',    last: 'Kapoor',    email: 'devansh.kapoor@smartalloc.edu',        roll: '24099013',  dept: 'CSE', sem: 5, cgpa: 7.7, section: 'A', bio: 'Mobile app lover.',                       interests: 'Mobile, React',               skills: [['Mobile Development', 'intermediate'], ['React', 'intermediate']] },
    { first: 'Tanya',      last: 'Menon',     email: 'tanya.menon@smartalloc.edu',           roll: '24099014',  dept: 'CSE', sem: 5, cgpa: 8.0, section: 'B', bio: 'ML hobbyist.',                            interests: 'ML, Python',                  skills: [['Machine Learning', 'intermediate'], ['Python', 'intermediate']] },
    { first: 'Sahil',      last: 'Khan',      email: 'sahil.khan@smartalloc.edu',             roll: '24099015',  dept: 'IT',  sem: 5, cgpa: 7.6, section: 'C', bio: 'API & backend dev.',                      interests: 'Node.js, MySQL',               skills: [['Node.js', 'advanced'], ['MySQL', 'intermediate']] },
    { first: 'Ishita',     last: 'Bose',      email: 'ishita.bose@smartalloc.edu',           roll: '24099016',  dept: 'CSE', sem: 5, cgpa: 8.1, section: 'D', bio: 'Security mindset.',                       interests: 'Cybersecurity, Blockchain',   skills: [['Cybersecurity', 'intermediate'], ['Blockchain', 'intermediate']] },
  ];

  // Clear in FK-safe order (children before parents)
  const tables = [
    'audit_logs', 'scheduler_events', 'resource_locks',
    'allocations', 'mentor_requests',
    'team_invitations', 'team_members', 'teams',
    'student_skills', 'mentor_skills',
    'students', 'mentors', 'users',
    'skills', 'project_cycles', 'system_settings',
  ];
  for (const t of tables) {
    await conn.execute(`DELETE FROM \`${t}\``);
  }

  // Project cycle
  const cycleId = uuidv4();
  await conn.execute(
    `INSERT INTO project_cycles (id,name,semester,year,min_team_size,max_team_size,is_active)
     VALUES (?,?,?,?,?,?,?)`,
    [cycleId, 'PBL Semester 5', 'Odd', 2024, 2, 4, true]
  );

  // Admin user
  const adminUserId = uuidv4();
  await conn.execute(
    'INSERT INTO users (id,email,password_hash,role,first_name,last_name) VALUES (?,?,?,?,?,?)',
    [adminUserId, 'admin@smartalloc.edu', hash('Admin@123'), 'admin', 'System', 'Admin']
  );

  // Skills
  for (const sk of skills) {
    await conn.execute('INSERT INTO skills (id,name,category) VALUES (?,?,?)', [sk.id, sk.name, sk.category]);
  }

  // Mentors
  for (const m of mentors) {
    const uid = uuidv4();
    const mid = uuidv4();
    await conn.execute(
      'INSERT INTO users (id,email,password_hash,role,first_name,last_name) VALUES (?,?,?,?,?,?)',
      [uid, m.email, hash('Mentor@123'), 'mentor', m.first, m.last]
    );
    await conn.execute(
      'INSERT INTO mentors (id,user_id,employee_id,department,designation,domain,bio,max_capacity,is_available) VALUES (?,?,?,?,?,?,?,?,true)',
      [mid, uid, m.emp, m.dept, m.designation, m.domain, m.bio, m.capacity]
    );
    for (const sk of m.skills) {
      if (skillMap[sk]) await conn.execute('INSERT INTO mentor_skills (mentor_id,skill_id) VALUES (?,?)', [mid, skillMap[sk]]);
    }
  }

  // Students
  const studentIds: string[] = [];
  for (const s of students) {
    const uid = uuidv4();
    const sid = uuidv4();
    studentIds.push(sid);
    await conn.execute(
      'INSERT INTO users (id,email,password_hash,role,first_name,last_name) VALUES (?,?,?,?,?,?)',
      [uid, s.email, hash('Student@123'), 'student', s.first, s.last]
    );
    await conn.execute(
      'INSERT INTO students (id,user_id,roll_number,department,semester,cgpa,bio,project_interests,section) VALUES (?,?,?,?,?,?,?,?,?)',
      [sid, uid, s.roll, s.dept, s.sem, s.cgpa, s.bio, s.interests, s.section]
    );
    for (const [skName, prof] of s.skills) {
      if (skillMap[skName]) {
        await conn.execute(
          'INSERT INTO student_skills (student_id,skill_id,proficiency) VALUES (?,?,?)',
          [sid, skillMap[skName], prof]
        );
      }
    }
  }

  // Teams — every member from a DISTINCT section (honours the no-same-section rule)
  // indices: 0 Aditya(A) 1 Amritanshu(A) 2 Ananya(B) 3 Aryan(B) 4 Riya(C)
  //          5 Karan(C) 6 Shreya(D) 7 Vivek(D) 11 Pooja(D)
  const team1Id = uuidv4();
  await conn.execute(
    `INSERT INTO teams (id,cycle_id,name,description,project_topic,project_domain,leader_id,status)
     VALUES (?,?,?,?,?,?,?,?)`,
    [team1Id, cycleId, 'The Incredibles', 'SmartAlloc project team', 'Smart Allocation System', 'OS/DBMS', studentIds[1], 'active']
  );
  for (const idx of [1, 2, 4, 6]) { // Amritanshu(A), Ananya(B), Riya(C), Shreya(D)
    await conn.execute('INSERT INTO team_members (id,team_id,student_id) VALUES (?,?,?)', [uuidv4(), team1Id, studentIds[idx]]);
  }

  const team2Id = uuidv4();
  await conn.execute(
    `INSERT INTO teams (id,cycle_id,name,description,project_topic,project_domain,leader_id,status)
     VALUES (?,?,?,?,?,?,?,?)`,
    [team2Id, cycleId, 'Code Crusaders', 'ML-based recommendation system', 'Recommendation Engine', 'Machine Learning', studentIds[5], 'forming']
  );
  for (const idx of [5, 11]) { // Karan(C), Pooja(D)
    await conn.execute('INSERT INTO team_members (id,team_id,student_id) VALUES (?,?,?)', [uuidv4(), team2Id, studentIds[idx]]);
  }

  // Aditya (index 0, section A) is intentionally left WITHOUT a team so the
  // demo login can browse Discover and use Auto-Match.

  await conn.end();
  console.log('✅ Seed complete');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Admin:   admin@smartalloc.edu / Admin@123');
  console.log('  Mentors (password Mentor@123):');
  console.log('    priya.sharma / rajesh.kumar / anita.singh / vikram.joshi');
  console.log('    sneha.patel / amit.verma / neha.gupta / rohan.mehta');
  console.log('    kavita.rao / sanjay.nair / meera.joshi / arvind.krishna  @smartalloc.edu');
  console.log('  Student (no team — ready to Discover & Auto-Match):');
  console.log('    aditya.bisht@smartalloc.edu / Student@123');
  console.log('  All other students share password Student@123');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

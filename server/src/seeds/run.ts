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

  // IDs
  const adminUserId   = uuidv4();
  const m1UserId = uuidv4(); const m2UserId = uuidv4(); const m3UserId = uuidv4();
  const m4UserId = uuidv4(); const m5UserId = uuidv4(); const m6UserId = uuidv4();
  const m7UserId = uuidv4(); const m8UserId = uuidv4(); const m9UserId = uuidv4();

  const s1UserId = uuidv4(); const s2UserId = uuidv4(); const s3UserId = uuidv4();
  const s4UserId = uuidv4(); const s5UserId = uuidv4(); const s6UserId = uuidv4();
  const s7UserId = uuidv4(); const s8UserId = uuidv4();

  const m1Id = uuidv4(); const m2Id = uuidv4(); const m3Id = uuidv4();
  const m4Id = uuidv4(); const m5Id = uuidv4(); const m6Id = uuidv4();
  const m7Id = uuidv4(); const m8Id = uuidv4(); const m9Id = uuidv4();

  const s1Id = uuidv4(); const s2Id = uuidv4(); const s3Id = uuidv4();
  const s4Id = uuidv4(); const s5Id = uuidv4(); const s6Id = uuidv4();
  const s7Id = uuidv4(); const s8Id = uuidv4();
  const cycleId = uuidv4();
  const team1Id = uuidv4(); const team2Id = uuidv4();

  // Skills
  const skills = [
    { id: uuidv4(), name: 'React',              category: 'Frontend' },
    { id: uuidv4(), name: 'Node.js',            category: 'Backend'  },
    { id: uuidv4(), name: 'Python',             category: 'Backend'  },
    { id: uuidv4(), name: 'MySQL',              category: 'Database' },
    { id: uuidv4(), name: 'Machine Learning',   category: 'AI/ML' },
    { id: uuidv4(), name: 'TypeScript',         category: 'Frontend' },
    { id: uuidv4(), name: 'Java',               category: 'Backend'  },
    { id: uuidv4(), name: 'System Design',      category: 'Architecture' },
    { id: uuidv4(), name: 'OS Concepts',        category: 'Systems'  },
    { id: uuidv4(), name: 'DBMS',               category: 'Database' },
    { id: uuidv4(), name: 'Cybersecurity',      category: 'Security' },
    { id: uuidv4(), name: 'Cloud Computing',    category: 'Cloud/DevOps' },
    { id: uuidv4(), name: 'Mobile Development', category: 'Mobile' },
    { id: uuidv4(), name: 'Blockchain',         category: 'Web3' },
    { id: uuidv4(), name: 'Big Data',           category: 'Data Engineering' },
  ];

  // Clear in FK-safe order (children before parents)
  const tables = [
    'audit_logs', 'scheduler_events', 'resource_locks',
    'allocations', 'mentor_requests',
    'team_invitations', 'team_members', 'teams',
    'student_skills', 'mentor_skills',
    'students', 'mentors', 'users',
    'skills', 'project_cycles', 'system_settings'
  ];
  for (const t of tables) {
    await conn.execute(`DELETE FROM \`${t}\``);
  }

  // Project cycle
  await conn.execute(
    `INSERT INTO project_cycles (id,name,semester,year,min_team_size,max_team_size,is_active)
     VALUES (?,?,?,?,?,?,?)`,
    [cycleId, 'PBL Semester 5', 'Odd', 2024, 2, 4, true]
  );

  // Users
  await conn.execute(
    `INSERT INTO users (id,email,password_hash,role,first_name,last_name) VALUES
     (?,?,?,'admin','System','Admin'),
     (?,?,?,'mentor','Dr. Priya','Sharma'),
     (?,?,?,'mentor','Prof. Rajesh','Kumar'),
     (?,?,?,'mentor','Dr. Anita','Singh'),
     (?,?,?,'mentor','Dr. Vikram','Joshi'),
     (?,?,?,'mentor','Prof. Sneha','Patel'),
     (?,?,?,'mentor','Dr. Amit','Verma'),
     (?,?,?,'mentor','Prof. Neha','Gupta'),
     (?,?,?,'mentor','Dr. Rohan','Mehta'),
     (?,?,?,'mentor','Prof. Kavita','Rao'),
     (?,?,?,'student','Aditya','Bisht'),
     (?,?,?,'student','Amritanshu','Purohit'),
     (?,?,?,'student','Ananya','Nautiyal'),
     (?,?,?,'student','Aryan','Barthwal'),
     (?,?,?,'student','Riya','Gupta'),
     (?,?,?,'student','Karan','Mehta'),
     (?,?,?,'student','Shreya','Joshi'),
     (?,?,?,'student','Vivek','Rana')`,
    [
      adminUserId, 'admin@smartalloc.edu', hash('Admin@123'),
      m1UserId,    'priya.sharma@smartalloc.edu', hash('Mentor@123'),
      m2UserId,    'rajesh.kumar@smartalloc.edu', hash('Mentor@123'),
      m3UserId,    'anita.singh@smartalloc.edu',  hash('Mentor@123'),
      m4UserId,    'vikram.joshi@smartalloc.edu', hash('Mentor@123'),
      m5UserId,    'sneha.patel@smartalloc.edu',  hash('Mentor@123'),
      m6UserId,    'amit.verma@smartalloc.edu',   hash('Mentor@123'),
      m7UserId,    'neha.gupta@smartalloc.edu',   hash('Mentor@123'),
      m8UserId,    'rohan.mehta@smartalloc.edu',  hash('Mentor@123'),
      m9UserId,    'kavita.rao@smartalloc.edu',   hash('Mentor@123'),
      s1UserId,    'aditya.bisht@smartalloc.edu',    hash('Student@123'),
      s2UserId,    'amritanshu.purohit@smartalloc.edu', hash('Student@123'),
      s3UserId,    'ananya.nautiyal@smartalloc.edu', hash('Student@123'),
      s4UserId,    'aryan.barthwal@smartalloc.edu', hash('Student@123'),
      s5UserId,    'riya.gupta@smartalloc.edu',     hash('Student@123'),
      s6UserId,    'karan.mehta@smartalloc.edu',    hash('Student@123'),
      s7UserId,    'shreya.joshi@smartalloc.edu',   hash('Student@123'),
      s8UserId,    'vivek.rana@smartalloc.edu',     hash('Student@123'),
    ]
  );

  // Mentors with specific domains
  await conn.execute(
    `INSERT INTO mentors (id,user_id,employee_id,department,designation,domain,bio,max_capacity,is_available) VALUES
     (?,?,'EMP001','CSE','Associate Professor','OS/DBMS','Expert in OS, DBMS, and distributed systems.',3,true),
     (?,?,'EMP002','CSE','Assistant Professor','Machine Learning','Specializes in ML, AI, and data science.',2,true),
     (?,?,'EMP003','IT', 'Associate Professor','Web Development','Full-stack development, modern frontend, and software engineering.',3,true),
     (?,?,'EMP004','CSE','Professor',          'Cybersecurity','Network security, ethical hacking, and cryptography.',3,true),
     (?,?,'EMP005','IT', 'Assistant Professor','Cloud/DevOps','Cloud architecture, Docker, Kubernetes, and CI/CD pipelines.',3,true),
     (?,?,'EMP006','CSE','Associate Professor','Artificial Intelligence','Deep learning, computer vision, and neural network architectures.',2,true),
     (?,?,'EMP007','CSE','Assistant Professor','Mobile Computing','Cross-platform mobile apps, Flutter, and React Native.',3,true),
     (?,?,'EMP008','IT', 'Associate Professor','Data Engineering','Big data pipelines, distributed computing, and database optimization.',3,true),
     (?,?,'EMP009','CSE','Assistant Professor','Blockchain/Web3','Decentralized systems, smart contracts, and Web3 architectures.',2,true)`,
    [
      m1Id,m1UserId, m2Id,m2UserId, m3Id,m3UserId,
      m4Id,m4UserId, m5Id,m5UserId, m6Id,m6UserId,
      m7Id,m7UserId, m8Id,m8UserId, m9Id,m9UserId,
    ]
  );

  // Students
  await conn.execute(
    `INSERT INTO students (id,user_id,roll_number,department,semester,cgpa,bio,project_interests) VALUES
     (?,?,'24021285','CSE',5,8.5,'Passionate about backend systems.','OS, DBMS, Web Development'),
     (?,?,'240211559','CSE',5,8.2,'Interested in ML and data.','Machine Learning, Python'),
     (?,?,'24012254','CSE',5,8.8,'UI/UX and frontend enthusiast.','React, TypeScript, UI Design'),
     (?,?,'240212203','CSE',5,7.9,'System design and architecture.','System Design, Java, OS'),
     (?,?,'24099001','IT',5,8.1,'Web and mobile developer.','React, Node.js, Mobile'),
     (?,?,'24099002','CSE',5,7.7,'Database and backend focus.','MySQL, Python, APIs'),
     (?,?,'24099003','CSE',5,8.6,'AI/ML researcher.','Machine Learning, Python'),
     (?,?,'24099004','IT',5,7.5,'Full-stack developer.','React, Node.js, TypeScript')`,
    [
      s1Id,s1UserId, s2Id,s2UserId, s3Id,s3UserId, s4Id,s4UserId,
      s5Id,s5UserId, s6Id,s6UserId, s7Id,s7UserId, s8Id,s8UserId,
    ]
  );

  // Skills
  for (const sk of skills) {
    await conn.execute('INSERT INTO skills (id,name,category) VALUES (?,?,?)', [sk.id,sk.name,sk.category]);
  }

  const skillMap: Record<string,string> = {};
  skills.forEach(s => { skillMap[s.name] = s.id; });

  // Mentor skills
  const mentorSkillData = [
    [m1Id, ['OS Concepts','DBMS','Python','System Design']],
    [m2Id, ['Machine Learning','Python','MySQL']],
    [m3Id, ['React','Node.js','TypeScript','System Design']],
    [m4Id, ['Cybersecurity','OS Concepts','Python','System Design']],
    [m5Id, ['Cloud Computing','Node.js','System Design','Python']],
    [m6Id, ['Machine Learning','Python','System Design']],
    [m7Id, ['Mobile Development','React','TypeScript','Node.js']],
    [m8Id, ['Big Data','DBMS','MySQL','Python','System Design']],
    [m9Id, ['Blockchain','Cybersecurity','System Design','Python']],
  ] as [string, string[]][];
  for (const [mid, sks] of mentorSkillData) {
    for (const sk of sks) {
      if (skillMap[sk]) await conn.execute('INSERT INTO mentor_skills (mentor_id,skill_id) VALUES (?,?)', [mid, skillMap[sk]]);
    }
  }

  // Student skills
  const studentSkillData = [
    [s1Id, [['Node.js','advanced'],['MySQL','intermediate'],['OS Concepts','intermediate']]],
    [s2Id, [['Python','advanced'],['Machine Learning','intermediate']]],
    [s3Id, [['React','advanced'],['TypeScript','advanced']]],
    [s4Id, [['Java','advanced'],['System Design','intermediate'],['OS Concepts','intermediate']]],
    [s5Id, [['React','intermediate'],['Node.js','intermediate']]],
    [s6Id, [['MySQL','advanced'],['Python','intermediate']]],
    [s7Id, [['Machine Learning','advanced'],['Python','advanced']]],
    [s8Id, [['React','intermediate'],['Node.js','advanced'],['TypeScript','intermediate']]],
  ] as [string, [string, string][]][];
  for (const [sid, sks] of studentSkillData) {
    for (const [skName, prof] of sks) {
      if (skillMap[skName]) {
        await conn.execute(
          'INSERT INTO student_skills (student_id,skill_id,proficiency) VALUES (?,?,?)',
          [sid, skillMap[skName], prof]
        );
      }
    }
  }

  // Teams
  await conn.execute(
    `INSERT INTO teams (id,cycle_id,name,description,project_topic,project_domain,leader_id,status) VALUES
     (?,?,'The Incredibles','SmartAlloc project team','Smart Allocation System','OS/DBMS',?,'active'),
     (?,?,'Code Crusaders','ML-based recommendation system','Recommendation Engine','Machine Learning',?,'forming')`,
    [team1Id,cycleId,s1Id, team2Id,cycleId,s5Id]
  );

  // Team members
  await conn.execute(
    `INSERT INTO team_members (id,team_id,student_id) VALUES
     (?,?,?),(?,?,?),(?,?,?),(?,?,?)`,
    [uuidv4(),team1Id,s1Id, uuidv4(),team1Id,s2Id, uuidv4(),team1Id,s3Id, uuidv4(),team1Id,s4Id]
  );
  await conn.execute(
    `INSERT INTO team_members (id,team_id,student_id) VALUES (?,?,?)`,
    [uuidv4(),team2Id,s5Id]
  );

  await conn.end();
  console.log('✅ Seed complete');
  console.log('');
  console.log('Demo credentials (Password for all Mentors: Mentor@123):');
  console.log('  Admin:   admin@smartalloc.edu / Admin@123');
  console.log('  Mentor (OS/DBMS):              priya.sharma@smartalloc.edu');
  console.log('  Mentor (Machine Learning):     rajesh.kumar@smartalloc.edu');
  console.log('  Mentor (Web Development):      anita.singh@smartalloc.edu');
  console.log('  Mentor (Cybersecurity):        vikram.joshi@smartalloc.edu');
  console.log('  Mentor (Cloud/DevOps):         sneha.patel@smartalloc.edu');
  console.log('  Mentor (Artificial Intel):     amit.verma@smartalloc.edu');
  console.log('  Mentor (Mobile Computing):     neha.gupta@smartalloc.edu');
  console.log('  Mentor (Data Engineering):     rohan.mehta@smartalloc.edu');
  console.log('  Mentor (Blockchain/Web3):      kavita.rao@smartalloc.edu');
  console.log('  Student: aditya.bisht@smartalloc.edu / Student@123');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

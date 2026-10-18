import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  // Step 1: create DB if it doesn't exist
  const root = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  const dbName = process.env.DB_NAME || 'smartalloc';
  await root.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.end();

  // Step 2: run DDL statements against the new DB
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  });

  console.log('🔄 Running migrations...');

  const statements = [
    // project_cycles
    `CREATE TABLE IF NOT EXISTS project_cycles (
      id          VARCHAR(36) PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      semester    VARCHAR(20)  NOT NULL,
      year        INT          NOT NULL,
      min_team_size INT        NOT NULL DEFAULT 2,
      max_team_size INT        NOT NULL DEFAULT 4,
      is_active   BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // users
    `CREATE TABLE IF NOT EXISTS users (
      id            VARCHAR(36) PRIMARY KEY,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role          ENUM('student','mentor','admin') NOT NULL,
      first_name    VARCHAR(100) NOT NULL,
      last_name     VARCHAR(100) NOT NULL,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`,
    `CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role)`,

    // students
    `CREATE TABLE IF NOT EXISTS students (
      id              VARCHAR(36) PRIMARY KEY,
      user_id         VARCHAR(36) NOT NULL UNIQUE,
      roll_number     VARCHAR(20) NOT NULL UNIQUE,
      department      VARCHAR(100) NOT NULL,
      semester        INT NOT NULL,
      cgpa            DECIMAL(4,2),
      bio             TEXT,
      project_interests TEXT,
      created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // mentors
    `CREATE TABLE IF NOT EXISTS mentors (
      id                  VARCHAR(36) PRIMARY KEY,
      user_id             VARCHAR(36) NOT NULL UNIQUE,
      employee_id         VARCHAR(20) NOT NULL UNIQUE,
      department          VARCHAR(100) NOT NULL,
      designation         VARCHAR(100) NOT NULL,
      domain              VARCHAR(100),
      bio                 TEXT,
      max_capacity        INT NOT NULL DEFAULT 3,
      is_available        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `ALTER TABLE mentors ADD COLUMN domain VARCHAR(100)`,

    // skills
    `CREATE TABLE IF NOT EXISTS skills (
      id         VARCHAR(36) PRIMARY KEY,
      name       VARCHAR(100) NOT NULL UNIQUE,
      category   VARCHAR(100),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS student_skills (
      student_id    VARCHAR(36) NOT NULL,
      skill_id      VARCHAR(36) NOT NULL,
      proficiency   ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'intermediate',
      PRIMARY KEY (student_id, skill_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id)   REFERENCES skills(id)   ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS mentor_skills (
      mentor_id  VARCHAR(36) NOT NULL,
      skill_id   VARCHAR(36) NOT NULL,
      PRIMARY KEY (mentor_id, skill_id),
      FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id)  REFERENCES skills(id)  ON DELETE CASCADE
    )`,

    // teams
    `CREATE TABLE IF NOT EXISTS teams (
      id               VARCHAR(36) PRIMARY KEY,
      cycle_id         VARCHAR(36) NOT NULL,
      name             VARCHAR(100) NOT NULL,
      description      TEXT,
      project_topic    VARCHAR(255),
      project_domain   VARCHAR(100),
      leader_id        VARCHAR(36) NOT NULL,
      status           ENUM('forming','active','allocated','completed') NOT NULL DEFAULT 'forming',
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (cycle_id)  REFERENCES project_cycles(id) ON DELETE CASCADE,
      FOREIGN KEY (leader_id) REFERENCES students(id) ON DELETE RESTRICT,
      UNIQUE KEY uq_team_name_cycle (cycle_id, name)
    )`,

    `CREATE TABLE IF NOT EXISTS team_members (
      id         VARCHAR(36) PRIMARY KEY,
      team_id    VARCHAR(36) NOT NULL,
      student_id VARCHAR(36) NOT NULL,
      joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id)    REFERENCES teams(id)    ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE KEY uq_member_team (team_id, student_id)
    )`,

    `CREATE TABLE IF NOT EXISTS team_invitations (
      id           VARCHAR(36) PRIMARY KEY,
      team_id      VARCHAR(36) NOT NULL,
      invitee_id   VARCHAR(36) NOT NULL,
      inviter_id   VARCHAR(36) NOT NULL,
      status       ENUM('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
      message      TEXT,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME,
      FOREIGN KEY (team_id)    REFERENCES teams(id)    ON DELETE CASCADE,
      FOREIGN KEY (invitee_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (inviter_id) REFERENCES students(id) ON DELETE CASCADE
    )`,

    // mentor requests
    `CREATE TABLE IF NOT EXISTS mentor_requests (
      id               VARCHAR(36) PRIMARY KEY,
      team_id          VARCHAR(36) NOT NULL,
      mentor_id        VARCHAR(36) NOT NULL,
      cycle_id         VARCHAR(36) NOT NULL,
      status           ENUM('pending','queued','processing','allocated','rejected','cancelled','failed','waiting') NOT NULL DEFAULT 'pending',
      priority         INT NOT NULL DEFAULT 0,
      priority_score   DECIMAL(10,4) NOT NULL DEFAULT 0,
      enqueue_time     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processing_start DATETIME,
      completion_time  DATETIME,
      failure_reason   TEXT,
      rejection_comments TEXT,
      message          TEXT,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id)   REFERENCES teams(id)   ON DELETE CASCADE,
      FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
      FOREIGN KEY (cycle_id)  REFERENCES project_cycles(id) ON DELETE CASCADE
    )`,
    `ALTER TABLE mentor_requests ADD COLUMN rejection_comments TEXT`,

    // allocations — no UNIQUE on (team,cycle,status) because MySQL can't enforce uniqueness with enum value match
    `CREATE TABLE IF NOT EXISTS allocations (
      id           VARCHAR(36) PRIMARY KEY,
      team_id      VARCHAR(36) NOT NULL,
      mentor_id    VARCHAR(36) NOT NULL,
      cycle_id     VARCHAR(36) NOT NULL,
      request_id   VARCHAR(36) NOT NULL,
      status       ENUM('active','cancelled','reassigned','completed') NOT NULL DEFAULT 'active',
      allocated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      released_at  DATETIME,
      notes        TEXT,
      FOREIGN KEY (team_id)    REFERENCES teams(id)    ON DELETE RESTRICT,
      FOREIGN KEY (mentor_id)  REFERENCES mentors(id)  ON DELETE RESTRICT,
      FOREIGN KEY (cycle_id)   REFERENCES project_cycles(id) ON DELETE RESTRICT,
      FOREIGN KEY (request_id) REFERENCES mentor_requests(id) ON DELETE RESTRICT
    )`,

    // scheduler events
    `CREATE TABLE IF NOT EXISTS scheduler_events (
      id           VARCHAR(36) PRIMARY KEY,
      request_id   VARCHAR(36),
      event_type   VARCHAR(50) NOT NULL,
      old_status   VARCHAR(50),
      new_status   VARCHAR(50),
      metadata     JSON,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES mentor_requests(id) ON DELETE SET NULL
    )`,

    // resource locks
    `CREATE TABLE IF NOT EXISTS resource_locks (
      id           VARCHAR(36) PRIMARY KEY,
      resource_id  VARCHAR(36) NOT NULL,
      held_by      VARCHAR(36),
      acquired_at  DATETIME,
      released_at  DATETIME,
      lock_status  ENUM('acquired','released','timeout','failed') NOT NULL DEFAULT 'acquired',
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    // audit logs
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id          VARCHAR(36) PRIMARY KEY,
      user_id     VARCHAR(36),
      action      VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id   VARCHAR(36),
      old_value   JSON,
      new_value   JSON,
      ip_address  VARCHAR(45),
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,

    // system settings
    `CREATE TABLE IF NOT EXISTS system_settings (
      key_name   VARCHAR(100) PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    `INSERT IGNORE INTO system_settings (key_name, value) VALUES
      ('scheduler_algorithm',   'FCFS'),
      ('priority_aging_rate',   '0.1'),
      ('max_team_size',         '4'),
      ('min_team_size',         '2'),
      ('max_mentor_capacity',   '5'),
      ('request_cooldown_minutes','5'),
      ('allocation_window_open','true')`,
  ];

  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
    } catch (err: any) {
      // INDEX IF NOT EXISTS / ADD COLUMN IF NOT EXISTS gracefully handled
      if (err.code === 'ER_DUP_KEYNAME' || err.message?.includes('Duplicate key name')) continue;
      if (err.code === 'ER_DUP_ENTRY') continue;
      if (err.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column name')) continue;
      console.error(`❌ Migration error: ${err.message}`);
      console.error(`   Statement: ${stmt.substring(0, 80)}...`);
    }
  }

  await conn.end();
  console.log('✅ Migrations complete');
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

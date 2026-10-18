-- SmartAlloc Initial Schema
-- Migration 001: Full normalized schema

CREATE DATABASE IF NOT EXISTS smartalloc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smartalloc;

-- ─── Project Cycles ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_cycles (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(100) NOT NULL,
  semester    VARCHAR(20)  NOT NULL,
  year        INT          NOT NULL,
  min_team_size INT        NOT NULL DEFAULT 2,
  max_team_size INT        NOT NULL DEFAULT 4,
  is_active   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','mentor','admin') NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role  (role)
);

-- ─── Students ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36) NOT NULL UNIQUE,
  roll_number     VARCHAR(20) NOT NULL UNIQUE,
  department      VARCHAR(100) NOT NULL,
  semester        INT NOT NULL,
  cgpa            DECIMAL(4,2),
  bio             TEXT,
  project_interests TEXT,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_students_user_id (user_id),
  INDEX idx_students_roll     (roll_number)
);

-- ─── Mentors ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentors (
  id                  VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_mentors_user_id (user_id),
  INDEX idx_mentors_available (is_available),
  INDEX idx_mentors_domain (domain)
);

-- ─── Skills ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id         VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name       VARCHAR(100) NOT NULL UNIQUE,
  category   VARCHAR(100),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_skills (
  student_id    VARCHAR(36) NOT NULL,
  skill_id      VARCHAR(36) NOT NULL,
  proficiency   ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'intermediate',
  PRIMARY KEY (student_id, skill_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id)   REFERENCES skills(id)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mentor_skills (
  mentor_id  VARCHAR(36) NOT NULL,
  skill_id   VARCHAR(36) NOT NULL,
  PRIMARY KEY (mentor_id, skill_id),
  FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id)  REFERENCES skills(id)  ON DELETE CASCADE
);

-- ─── Teams ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id               VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
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
  UNIQUE KEY uq_team_name_cycle (cycle_id, name),
  INDEX idx_teams_cycle  (cycle_id),
  INDEX idx_teams_leader (leader_id),
  INDEX idx_teams_status (status)
);

CREATE TABLE IF NOT EXISTS team_members (
  id         VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  team_id    VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id)    REFERENCES teams(id)    ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  -- A student can be in only one active team per cycle (enforced at app layer + this unique key)
  UNIQUE KEY uq_member_team (team_id, student_id),
  INDEX idx_tm_student (student_id),
  INDEX idx_tm_team    (team_id)
);

CREATE TABLE IF NOT EXISTS team_invitations (
  id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  team_id      VARCHAR(36) NOT NULL,
  invitee_id   VARCHAR(36) NOT NULL,
  inviter_id   VARCHAR(36) NOT NULL,
  status       ENUM('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
  message      TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME,
  FOREIGN KEY (team_id)    REFERENCES teams(id)    ON DELETE CASCADE,
  FOREIGN KEY (invitee_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (inviter_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_inv_invitee (invitee_id),
  INDEX idx_inv_team    (team_id)
);

-- ─── Mentor Requests & Allocations ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentor_requests (
  id               VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
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
  FOREIGN KEY (cycle_id)  REFERENCES project_cycles(id) ON DELETE CASCADE,
  INDEX idx_mr_mentor    (mentor_id),
  INDEX idx_mr_team      (team_id),
  INDEX idx_mr_status    (status),
  INDEX idx_mr_enqueue   (enqueue_time),
  INDEX idx_mr_priority  (priority_score DESC)
);

CREATE TABLE IF NOT EXISTS allocations (
  id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  team_id      VARCHAR(36) NOT NULL,
  mentor_id    VARCHAR(36) NOT NULL,
  cycle_id     VARCHAR(36) NOT NULL,
  request_id   VARCHAR(36) NOT NULL,
  status       ENUM('active','cancelled','reassigned','completed') NOT NULL DEFAULT 'active',
  allocated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at  DATETIME,
  notes        TEXT,
  -- A team can have at most one active allocation per cycle
  UNIQUE KEY uq_team_cycle_active (team_id, cycle_id, status),
  FOREIGN KEY (team_id)    REFERENCES teams(id)    ON DELETE RESTRICT,
  FOREIGN KEY (mentor_id)  REFERENCES mentors(id)  ON DELETE RESTRICT,
  FOREIGN KEY (cycle_id)   REFERENCES project_cycles(id) ON DELETE RESTRICT,
  FOREIGN KEY (request_id) REFERENCES mentor_requests(id) ON DELETE RESTRICT,
  INDEX idx_alloc_mentor (mentor_id),
  INDEX idx_alloc_team   (team_id),
  INDEX idx_alloc_status (status)
);

-- ─── Scheduler Events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduler_events (
  id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  request_id   VARCHAR(36),
  event_type   VARCHAR(50) NOT NULL,
  old_status   VARCHAR(50),
  new_status   VARCHAR(50),
  metadata     JSON,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES mentor_requests(id) ON DELETE SET NULL,
  INDEX idx_se_request   (request_id),
  INDEX idx_se_type      (event_type),
  INDEX idx_se_created   (created_at)
);

-- ─── Resource Lock Log (mutex simulation) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_locks (
  id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  resource_id  VARCHAR(36) NOT NULL COMMENT 'mentor_id being locked',
  held_by      VARCHAR(36) COMMENT 'request_id holding lock',
  acquired_at  DATETIME,
  released_at  DATETIME,
  lock_status  ENUM('acquired','released','timeout','failed') NOT NULL DEFAULT 'acquired',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rl_resource (resource_id),
  INDEX idx_rl_status   (lock_status)
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   VARCHAR(36),
  old_value   JSON,
  new_value   JSON,
  ip_address  VARCHAR(45),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_al_user    (user_id),
  INDEX idx_al_action  (action),
  INDEX idx_al_entity  (entity_type, entity_id),
  INDEX idx_al_created (created_at)
);

-- ─── System Settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key_name   VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO system_settings (key_name, value) VALUES
  ('scheduler_algorithm',   'FCFS'),
  ('priority_aging_rate',   '0.1'),
  ('max_team_size',         '4'),
  ('min_team_size',         '2'),
  ('max_mentor_capacity',   '5'),
  ('request_cooldown_minutes','5'),
  ('allocation_window_open','true');

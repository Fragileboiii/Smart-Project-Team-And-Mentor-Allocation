USE smartalloc$$

-- ─── Helper procedure: idempotent index creation ─────────────────────────────
DROP PROCEDURE IF EXISTS _add_index_safe$$
CREATE PROCEDURE _add_index_safe(
  IN tbl VARCHAR(64),
  IN idx VARCHAR(64),
  IN ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name   = tbl
       AND index_name   = idx
     LIMIT 1
  ) THEN
    SET @_sql = ddl;
    PREPARE _s FROM @_sql;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END$$

CALL _add_index_safe('allocations',     'idx_alloc_cycle', 'CREATE INDEX idx_alloc_cycle ON allocations (cycle_id)')$$
CALL _add_index_safe('mentor_requests', 'idx_mr_cycle',    'CREATE INDEX idx_mr_cycle ON mentor_requests (cycle_id)')$$
CALL _add_index_safe('mentor_requests', 'idx_mr_priority', 'CREATE INDEX idx_mr_priority ON mentor_requests (priority_score DESC)')$$

DROP PROCEDURE IF EXISTS _add_index_safe$$

-- ─── Availability view ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW mentor_availability AS
  SELECT
    m.id              AS mentor_id,
    CONCAT(u.first_name, ' ', u.last_name) AS mentor_name,
    m.domain,
    m.max_capacity,
    COUNT(CASE WHEN a.status = 'active' THEN 1 END)                    AS active_allocations,
    (m.max_capacity - COUNT(CASE WHEN a.status = 'active' THEN 1 END)) AS remaining_capacity,
    m.is_available,
    CASE
      WHEN m.is_available = 1
       AND (m.max_capacity - COUNT(CASE WHEN a.status = 'active' THEN 1 END)) > 0
      THEN 1 ELSE 0
    END AS can_accept
  FROM mentors m
  JOIN users u ON u.id = m.user_id
  LEFT JOIN allocations a ON a.mentor_id = m.id
  GROUP BY m.id, u.first_name, u.last_name,
           m.domain, m.max_capacity, m.is_available$$

-- ─── Stored procedure: allocate_mentor ──────────────────────────────────────
DROP PROCEDURE IF EXISTS allocate_mentor$$
CREATE PROCEDURE allocate_mentor(
  IN  p_request_id  VARCHAR(36),
  IN  p_team_id     VARCHAR(36),
  IN  p_mentor_id   VARCHAR(36),
  IN  p_cycle_id    VARCHAR(36),
  IN  p_user_id     VARCHAR(36),
  OUT p_alloc_id    VARCHAR(36),
  OUT p_ok          TINYINT
)
proc_body: BEGIN
  DECLARE v_max    INT     DEFAULT 0;
  DECLARE v_active INT     DEFAULT 0;
  DECLARE v_avail  TINYINT DEFAULT 0;
  DECLARE v_exist  INT     DEFAULT 0;
  DECLARE v_new_id VARCHAR(36) DEFAULT '';

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_ok = 0;
    SET p_alloc_id = '';
  END;

  START TRANSACTION;

  SELECT max_capacity, is_available
    INTO v_max, v_avail
    FROM mentors WHERE id = p_mentor_id FOR UPDATE;

  SELECT COUNT(*) INTO v_active
    FROM allocations WHERE mentor_id = p_mentor_id AND status = 'active';

  IF v_avail = 0 OR (v_max - v_active) <= 0 THEN
    UPDATE mentor_requests SET status = 'waiting', updated_at = NOW() WHERE id = p_request_id;
    COMMIT;
    SET p_ok = 0;
    SET p_alloc_id = '';
    LEAVE proc_body;
  END IF;

  SELECT COUNT(*) INTO v_exist
    FROM allocations WHERE team_id = p_team_id AND cycle_id = p_cycle_id AND status = 'active';

  IF v_exist > 0 THEN
    ROLLBACK;
    SET p_ok = 0;
    SET p_alloc_id = '';
    LEAVE proc_body;
  END IF;

  SET v_new_id = UUID();

  INSERT INTO allocations (id, team_id, mentor_id, cycle_id, request_id, status, allocated_at)
    VALUES (v_new_id, p_team_id, p_mentor_id, p_cycle_id, p_request_id, 'active', NOW());

  UPDATE mentor_requests
     SET status = 'allocated', processing_start = NOW(),
         completion_time = NOW(), updated_at = NOW()
   WHERE id = p_request_id;

  UPDATE teams SET status = 'allocated', updated_at = NOW() WHERE id = p_team_id;

  INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (UUID(), p_user_id, 'PROC_ALLOCATE', 'allocation', v_new_id, NULL,
            JSON_OBJECT('mentorId', p_mentor_id, 'teamId', p_team_id));

  COMMIT;
  SET p_ok = 1;
  SET p_alloc_id = v_new_id;
END$$

-- ─── Trigger: trg_audit_allocation ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_allocation$$
CREATE TRIGGER trg_audit_allocation
AFTER UPDATE ON allocations
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value)
      VALUES (
        UUID(), NULL,
        CONCAT('ALLOC_', UPPER(NEW.status)),
        'allocation', NEW.id,
        JSON_OBJECT('status', OLD.status),
        JSON_OBJECT('status', NEW.status)
      );
  END IF;
END$$

-- ─── Trigger: trg_capacity_guard ────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_capacity_guard$$
CREATE TRIGGER trg_capacity_guard
BEFORE INSERT ON allocations
FOR EACH ROW
BEGIN
  DECLARE v_max    INT DEFAULT 0;
  DECLARE v_active INT DEFAULT 0;
  IF NEW.status = 'active' THEN
    SELECT max_capacity INTO v_max   FROM mentors     WHERE id        = NEW.mentor_id;
    SELECT COUNT(*)      INTO v_active FROM allocations WHERE mentor_id = NEW.mentor_id AND status = 'active';
    IF v_active >= v_max THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Mentor capacity exceeded (capacity guard trigger)';
    END IF;
  END IF;
END$$

-- ─── CHECK constraints ───────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _add_check_safe$$
CREATE PROCEDURE _add_check_safe(
  IN tbl_name   VARCHAR(64),
  IN check_name VARCHAR(64),
  IN check_expr TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_schema = DATABASE()
       AND table_name        = tbl_name
       AND constraint_name   = check_name
       AND constraint_type   = 'CHECK'
  ) THEN
    SET @_sql = CONCAT('ALTER TABLE `', tbl_name, '` ADD CONSTRAINT `', check_name, '` CHECK (', check_expr, ')');
    PREPARE _s FROM @_sql;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END$$

CALL _add_check_safe('mentors',         'chk_max_capacity', 'max_capacity > 0')$$
CALL _add_check_safe('students',        'chk_cgpa',         'cgpa IS NULL OR (cgpa >= 0 AND cgpa <= 10)')$$
CALL _add_check_safe('mentor_requests', 'chk_priority',     'priority >= 0 AND priority <= 10')$$
CALL _add_check_safe('project_cycles',  'chk_team_size',    'max_team_size >= min_team_size AND min_team_size > 0')$$

DROP PROCEDURE IF EXISTS _add_check_safe$$
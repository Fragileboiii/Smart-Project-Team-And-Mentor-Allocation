import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export async function writeAuditLog(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  oldValue: any,
  newValue: any,
  ipAddress?: string
) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id,old_value,new_value,ip_address)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        uuidv4(), userId, action, entityType, entityId,
        oldValue  ? JSON.stringify(oldValue)  : null,
        newValue  ? JSON.stringify(newValue)  : null,
        ipAddress || null,
      ]
    );
  } catch (e) {
    // Audit log failure must not crash the main operation
    console.error('[Audit] Failed to write audit log:', e);
  }
}

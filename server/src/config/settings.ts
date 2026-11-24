// Updated to use system_settings table for scheduler configuration
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

/** Retrieve scheduler algorithm and interval from system_settings.
 * Expected keys:
 *   - scheduler_algorithm (e.g., 'FCFS', 'PRIORITY')
 *   - scheduler_interval_seconds (integer)
 */
export async function getSchedulerSettings() {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT key_name, value FROM system_settings WHERE key_name IN ('scheduler_algorithm', 'scheduler_interval_seconds')`
  );
  const settings: any = {};
  for (const r of rows as any[]) {
    settings[r.key_name] = r.value;
  }
  const algorithm = settings['scheduler_algorithm'] || 'FCFS';
  const interval_seconds = parseInt(settings['scheduler_interval_seconds'] || '60', 10);
  return { algorithm, interval_seconds };
}
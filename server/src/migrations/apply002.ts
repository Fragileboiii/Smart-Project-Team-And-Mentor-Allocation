import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  // Use multipleStatements:false (default) so we send one statement at a time.
  // We split the SQL file on our custom $$ delimiter ourselves.
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'smartalloc',
  });

  const sqlFile = fs.readFileSync(
    path.join(__dirname, '002_dbms_objects.sql'),
    'utf8'
  );

  // Split on $$ - each chunk is a complete statement (may contain internal ;)
  const blocks = sqlFile
    .split('$$')
    .map(b => b.replace(/^[\s\r\n]+|[\s\r\n]+$/g, ''))
    .filter(b => b.length > 0 && !b.startsWith('--'));

  let ok = 0; let warn = 0;
  for (const block of blocks) {
    try {
      await conn.query(block);
      ok++;
    } catch (e: any) {
      const msg: string = e.message || '';
      const skip =
        msg.includes('already exists') ||
        e.code === 'ER_DUP_KEYNAME'  ||
        e.code === 'ER_DUP_FIELDNAME' ||
        e.code === 'ER_CHECK_CONSTRAINT_ALREADY_EXISTS' ||
        e.code === 'ER_TRG_ALREADY_EXISTS';
      if (!skip) {
        console.warn('[002 warn]', msg.substring(0, 160));
        warn++;
      } else {
        ok++;
      }
    }
  }

  await conn.end();
  console.log('Migration 002 done: ' + ok + ' OK, ' + warn + ' warnings');
}

// Export for use from the main migration runner
export { run as apply002 };

// Also run directly when invoked standalone
if (require.main === module) {
  run().catch(e => { console.error(e); process.exit(1); });
}
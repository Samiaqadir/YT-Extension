import { db } from './config/db.js';
import { TokenService } from './services/token.service.js';

async function debug() {
  await db.init();
  const tables = await db.query(`SELECT name, sql FROM sqlite_master WHERE type='table'`);
  console.log('--- ALL TABLES ---');
  for (const t of tables.rows) {
    console.log(t.name, '=>', t.sql);
  }

  const users = await db.query(`SELECT * FROM managed_users`);
  console.log('--- ALL USERS ---');
  console.log(users.rows);

  // Test insert
  console.log('--- TESTING INSERT ---');
  const testId = 'test_' + Date.now();
  const passHash = TokenService.hashPasscode('mypassword123');
  try {
    const res = await db.query(
      `INSERT INTO managed_users (id, username, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [testId, 'newcreator@test.com', passHash, 'creator']
    );
    console.log('INSERT RESULT:', res);
  } catch (err: any) {
    console.error('INSERT FAILED:', err.message);
  }

  const usersAfter = await db.query(`SELECT * FROM managed_users`);
  console.log('--- ALL USERS AFTER ---');
  console.log(usersAfter.rows);
}

debug().catch(console.error);

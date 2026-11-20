// Gamit: npm run admin:create -- email@example.com MalakasNaPassword
import { query, pool } from './db.js';
import { hashPassword } from './auth.js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Gamit: npm run admin:create -- email password   (password: 8+ characters)');
  process.exit(1);
}
await query(
  `INSERT INTO admins (email, password_hash) VALUES ($1,$2)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [email.toLowerCase(), await hashPassword(password)]);
console.log(`Admin ready: ${email.toLowerCase()}`);
await pool.end();

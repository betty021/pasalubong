import 'dotenv/config';
import pg from 'pg';

// BIGINT (id) ay ibalik bilang number, hindi text
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 4,                          // maliit para hindi maubos ang limit ng Supabase
  idleTimeoutMillis: 60_000,       // isara ang idle connection pagkalipas ng 1 minuto
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  connectionTimeoutMillis: 15_000,
});

pool.on('error', (e) => console.error('[db] idle connection error:', e.message));

export const query = (text, params) => pool.query(text, params);

let keepAliveTimer;
export async function warmUp(n = 2) {
  await Promise.all(Array.from({ length: n }, () => pool.query('SELECT 1')))
    .catch((e) => console.error('[db] warm-up failed:', e.message));
  keepAliveTimer = setInterval(() => {
    Promise.all(Array.from({ length: n }, () => pool.query('SELECT 1'))).catch(() => {});
  }, 25_000);
  keepAliveTimer.unref();
}

// Isara nang maayos ang pool kapag nag-restart/nag-stop ang server (mahalaga sa `node --watch`)
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(keepAliveTimer);
  try { await pool.end(); } catch {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
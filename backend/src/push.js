// Web Push: nakakarating ang notification kahit sarado ang tab/app.
// Kailangan ng VAPID keys sa .env (npm run push:keys). Kapag wala, naka-off lang ang push (hindi nagka-crash).
import 'dotenv/config';
import { Router } from 'express';
import webpush from 'web-push';
import { query } from './db.js';
import { wrap, HttpError } from './util.js';
import { requireAuth } from './auth.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
export const pushEnabled = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
else console.warn('[push] Walang VAPID keys sa .env — naka-off ang push notifications.');

// Hindi kailanman nagbabato ng error.
export async function sendPush(kind, id, { title, body, link }) {
  if (!pushEnabled) return;
  try {
    const { rows } = await query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE recipient_kind = $1 AND recipient_id = $2', [kind, id]);
    const payload = JSON.stringify({ title, body: body || '', url: link || '/' });
    await Promise.all(rows.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
        else console.error('[push] send failed:', e.statusCode || e.message);
      }
    }));
  } catch (e) { console.error('[push] failed:', e.message); }
}

const r = Router();
r.get('/key', (_req, res) => res.json({ key: pushEnabled ? VAPID_PUBLIC_KEY : null }));

r.use(requireAuth('customer', 'admin'));
const rcpt = (u) => (u.role === 'admin' ? ['admin', 0] : ['customer', u.id]);

r.post('/subscribe', wrap(async (req, res) => {
  const { endpoint, keys } = req.body?.subscription || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new HttpError(400, 'Invalid subscription.');
  const [kind, id] = rcpt(req.user);
  await query(
    `INSERT INTO push_subscriptions (recipient_kind, recipient_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint) DO UPDATE SET recipient_kind = $1, recipient_id = $2, p256dh = $4, auth = $5`,
    [kind, id, endpoint, keys.p256dh, keys.auth]);
  res.json({ ok: true });
}));

r.post('/unsubscribe', wrap(async (req, res) => {
  if (req.body?.endpoint) await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [req.body.endpoint]);
  res.json({ ok: true });
}));

export default r;

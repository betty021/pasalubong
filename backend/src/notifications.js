// Notification bell: naka-save sa database (hindi nawawala kahit offline ang tatanggap) + itinutulak agad via SSE.
// Tatanggap:  customer:<id>   admin:0 (ang may-ari)
import { Router } from 'express';
import { query } from './db.js';
import { wrap, HttpError, toId } from './util.js';
import { requireAuth } from './auth.js';
import { toRecipient } from './realtime.js';
import { sendPush } from './push.js';

const rcpt = (u) => (u.role === 'admin' ? ['admin', 0] : ['customer', u.id]);

// Hindi kailanman nagbabato ng error (hindi dapat mabigo ang order dahil lang sa notification).
// refreshEvent: opsyonal na event (hal. 'order:new') para ma-refresh ng browser ang listahan.
export async function createNotification(kind, id, { type, title, body = null, link = null, data = null }, refreshEvent = null) {
  try {
    const { rows } = await query(
      `INSERT INTO notifications (recipient_kind, recipient_id, type, title, body, link, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, type, title, body, link, read_at, created_at`,
      [kind, id, type, title, body, link, data ? JSON.stringify(data) : null]);
    toRecipient(kind, id, 'notification', rows[0]);
    sendPush(kind, id, { title, body, link });   // hindi hinihintay; hindi nagba-bato ng error
    if (refreshEvent) toRecipient(kind, id, refreshEvent, data ?? {});
  } catch (e) { console.error('[notifications] create failed:', e.message); }
}

const r = Router();
r.use(requireAuth('customer', 'admin'));

r.get('/', wrap(async (req, res) => {
  const [kind, id] = rcpt(req.user);
  const [items, count] = await Promise.all([
    query(`SELECT id, type, title, body, link, read_at, created_at FROM notifications
            WHERE recipient_kind = $1 AND recipient_id = $2 ORDER BY created_at DESC, id DESC LIMIT 30`, [kind, id]),
    query(`SELECT count(*)::int AS n FROM notifications WHERE recipient_kind = $1 AND recipient_id = $2 AND read_at IS NULL`, [kind, id]),
  ]);
  res.json({ items: items.rows, unread: count.rows[0].n });
}));

r.post('/read-all', wrap(async (req, res) => {
  const [kind, id] = rcpt(req.user);
  await query(`UPDATE notifications SET read_at = now() WHERE recipient_kind = $1 AND recipient_id = $2 AND read_at IS NULL`, [kind, id]);
  res.json({ ok: true });
}));

r.post('/:id/read', wrap(async (req, res) => {
  const [kind, id] = rcpt(req.user);
  const { rowCount } = await query(
    `UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND recipient_kind = $2 AND recipient_id = $3`,
    [toId(req.params.id), kind, id]);
  if (!rowCount) throw new HttpError(404, 'Notification not found.');
  res.json({ ok: true });
}));

export default r;

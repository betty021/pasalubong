// Hakbang 3: Chat. Customer <-> may-ari (admin). Isang usapan bawat customer.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { wrap, HttpError, toId, imgSql } from '../util.js';
import { requireAuth } from '../auth.js';
import { toRecipient } from '../realtime.js';
import { createNotification } from '../notifications.js';

const r = Router();
r.use(requireAuth('customer', 'admin'));

const sendLimit = rateLimit({
  windowMs: 60_000, limit: 40, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `${req.user.role}:${req.user.id}`,
  message: { error: 'You are sending messages too fast. Please wait a moment.' },
});

const other = (role) => (role === 'admin' ? 'customer' : 'admin');
const OWNER_NAME = 'PasalubongHub';
// Profile picture ng may-ari (admin) para sa chat
const ownerAvatar = async () =>
  (await query(`SELECT ${imgSql('admin', 'avatar_url', 'id')} AS a FROM admins ORDER BY id LIMIT 1`)).rows[0]?.a ?? null;

// Ang usapan ay para lang sa customer na may-ari nito, o sa may-ari ng tindahan
async function loadConv(user, id) {
  const { rows } = await query(
    `SELECT c.id, c.customer_id, cu.first_name || ' ' || cu.last_name AS customer_name,
            ${imgSql('customer', 'cu.avatar_url', 'cu.id')} AS customer_avatar
       FROM conversations c JOIN customers cu ON cu.id = c.customer_id WHERE c.id = $1`, [id]);
  const c = rows[0];
  if (!c || (user.role === 'customer' && c.customer_id !== user.id)) throw new HttpError(404, 'Conversation not found.');
  return c;
}

// Ipadala sa dalawang panig. (Ang browser ay dini-dedupe ayon sa message id.)
const toBoth = (c, event, data) => { toRecipient('admin', 0, event, data); toRecipient('customer', c.customer_id, event, data); };

// Minamarkahang nabasa ang mga mensaheng galing sa kabila + ang bell nito
async function markRead(c, user) {
  const { rowCount } = await query(
    `UPDATE messages SET read_at = now() WHERE conversation_id = $1 AND sender_role = $2 AND read_at IS NULL`,
    [c.id, other(user.role)]);
  const [kind, rid] = user.role === 'admin' ? ['admin', 0] : ['customer', user.id];
  const n = await query(
    `UPDATE notifications SET read_at = now()
      WHERE recipient_kind = $1 AND recipient_id = $2 AND type = 'chat' AND read_at IS NULL
        AND (data->>'conversation_id')::bigint = $3`, [kind, rid, c.id]);
  if (rowCount || n.rowCount) toBoth(c, 'chat:read', { conversation_id: c.id, reader: user.role });
  if (n.rowCount) toRecipient(kind, rid, 'notification', {});   // i-refresh ang bell ng bumasa
}

// ---------- Simulan / kunin ang usapan ----------
// customer: (walang body) -> sarili niyang usapan.   admin: { customer_id } (kailangang may order na ang customer)
r.post('/conversations', wrap(async (req, res) => {
  let customerId;
  if (req.user.role === 'customer') customerId = req.user.id;
  else {
    customerId = toId(req.body.customer_id);
    const { rows } = await query(`SELECT 1 FROM orders WHERE customer_id = $1 LIMIT 1`, [customerId]);
    if (!rows[0]) throw new HttpError(403, 'You can only message customers who have placed an order.');
  }
  const { rows } = await query(
    `INSERT INTO conversations (customer_id) VALUES ($1)
     ON CONFLICT (customer_id) DO UPDATE SET customer_id = EXCLUDED.customer_id RETURNING id`, [customerId]);
  res.json({ id: rows[0].id });
}));

// ---------- Listahan ng usapan ----------
r.get('/conversations', wrap(async (req, res) => {
  const me = req.user.role;
  const { rows } = await query(
    `SELECT c.id, c.customer_id, c.last_message_at, cu.first_name || ' ' || cu.last_name AS customer_name,
            ${imgSql('customer', 'cu.avatar_url', 'cu.id')} AS customer_avatar,
            lm.body AS last_body, lm.sender_role AS last_sender,
            (SELECT count(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.sender_role <> $1 AND m.read_at IS NULL) AS unread
       FROM conversations c
       JOIN customers cu ON cu.id = c.customer_id
       JOIN LATERAL (SELECT body, sender_role FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) lm ON true
      ${me === 'customer' ? 'WHERE c.customer_id = $2' : 'WHERE $2::bigint IS NOT NULL'}
      ORDER BY c.last_message_at DESC LIMIT 100`,
    [me, me === 'customer' ? req.user.id : 0]);
  const oa = await ownerAvatar();
  res.json(rows.map((c) => ({ ...c, store_name: OWNER_NAME, owner_avatar: oa })));
}));

// Kabuuang hindi pa nababasa (para sa badge sa menu)
r.get('/unread', wrap(async (req, res) => {
  const me = req.user.role;
  const { rows } = await query(
    `SELECT count(*)::int AS count FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE m.sender_role <> $1 AND m.read_at IS NULL ${me === 'customer' ? 'AND c.customer_id = $2' : 'AND $2::bigint IS NOT NULL'}`,
    [me, me === 'customer' ? req.user.id : 0]);
  res.json({ count: rows[0].count });
}));

// ---------- Mga mensahe (huling 100). Minamarkahan ding nabasa na ----------
r.get('/conversations/:id/messages', wrap(async (req, res) => {
  const c = await loadConv(req.user, toId(req.params.id));
  const { rows } = await query(
    `SELECT id, sender_role, body, created_at, read_at FROM messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 100`, [c.id]);
  await markRead(c, req.user);
  res.json({ conversation: { id: c.id, customer_id: c.customer_id, customer_name: c.customer_name, customer_avatar: c.customer_avatar, store_name: OWNER_NAME, owner_avatar: await ownerAvatar() }, messages: rows.reverse() });
}));

r.post('/conversations/:id/read', wrap(async (req, res) => {
  await markRead(await loadConv(req.user, toId(req.params.id)), req.user);
  res.json({ ok: true });
}));

// ---------- Magpadala ----------
r.post('/conversations/:id/messages', sendLimit, wrap(async (req, res) => {
  const c = await loadConv(req.user, toId(req.params.id));
  const body = String(req.body.body ?? '').trim();
  if (!body) throw new HttpError(422, 'Type a message first.');
  if (body.length > 2000) throw new HttpError(422, 'Message is too long (max 2000).');

  const { rows } = await query(
    `INSERT INTO messages (conversation_id, sender_role, body) VALUES ($1, $2, $3)
     RETURNING id, sender_role, body, created_at, read_at`, [c.id, req.user.role, body]);
  await query(`UPDATE conversations SET last_message_at = now() WHERE id = $1`, [c.id]);

  const fromCustomer = req.user.role === 'customer';
  const from = fromCustomer ? c.customer_name : OWNER_NAME;
  toBoth(c, 'chat:message', { conversation_id: c.id, message: rows[0], from });

  // Bell ng tatanggap: iisang notif bawat usapan hangga't hindi pa binabasa (hindi nagkakapatung-patong)
  const [kind, rid] = fromCustomer ? ['admin', 0] : ['customer', c.customer_id];
  await query(
    `DELETE FROM notifications WHERE recipient_kind = $1 AND recipient_id = $2 AND type = 'chat' AND read_at IS NULL
        AND (data->>'conversation_id')::bigint = $3`, [kind, rid, c.id]);
  createNotification(kind, rid, {
    type: 'chat', title: `New message from ${from}`, body: body.length > 80 ? `${body.slice(0, 80)}…` : body,
    link: fromCustomer ? `/admin/messages/${c.id}` : '/messages', data: { conversation_id: c.id },
  });
  res.status(201).json(rows[0]);
}));

export default r;

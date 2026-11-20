// Real-time gamit ang Server-Sent Events (SSE): isang bukas na koneksyon bawat browser tab,
// at ang server ang nagtutulak ng event. Isang direksyon lang (server -> browser), kaya hindi na kailangan ng WebSocket.
//
// Susi ng tatanggap:  customer:<id>   admin:0  (ang may-ari ay may isang "admin:0" bell)
import { Router } from 'express';
import { requireAuth } from './auth.js';

const clients = new Map();   // key -> Set<res>

const keyOf = (user) => (user.role === 'admin' ? 'admin:0' : `customer:${user.id}`);

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`);
}

function publish(key, event, data) {
  const set = clients.get(key);
  if (!set) return;
  for (const res of set) {
    try { send(res, event, data); } catch { set.delete(res); }
  }
}

// kind: 'customer' | 'admin'   (admin: id 0)
export const toRecipient = (kind, id, event, data) => publish(`${kind}:${id}`, event, data);

// Heartbeat: pinipigilan nito na putulin ng proxy ang koneksyong walang laman
setInterval(() => {
  for (const set of clients.values()) for (const res of set) { try { res.write(': ping\n\n'); } catch { set.delete(res); } }
}, 25_000).unref();

const r = Router();

// GET /api/events   (Authorization: Bearer <token>)
r.get('/', requireAuth('customer', 'admin'), (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',   // huwag i-buffer ng nginx
  });
  res.write('retry: 3000\n\n');

  const key = keyOf(req.user);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(res);
  send(res, 'ready', {});   // sa browser: kunin ulit ang datos (baka may na-miss habang naputol)

  req.on('close', () => {
    const set = clients.get(key);
    if (!set) return;
    set.delete(res);
    if (!set.size) clients.delete(key);
  });
});

export default r;

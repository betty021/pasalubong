import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { pool, query } from '../db.js';
import { wrap, HttpError, toId } from '../util.js';
import { requireAuth } from '../auth.js';
import { createNotification } from '../notifications.js';

const r = Router();
const STATUSES = ['pending', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];

// Mensahe sa bell ng customer
// Magkaiba ang "Ready" ng Pickup at Delivery. Ang "Out for delivery" ay para sa Delivery lang.
const statusText = (status, fulfillment) => {
  const pickup = fulfillment === 'pickup';
  return {
    pending:   { title: 'Pending',   body: 'Waiting for the store to confirm.' },
    preparing: { title: 'Preparing', body: 'Your order is being prepared.' },
    ready:     pickup ? { title: 'Ready for pickup', body: 'Your order is ready! Show your order code at the store.' }
                      : { title: 'Ready', body: 'Your order is packed and will be sent out for delivery soon.' },
    out_for_delivery: { title: 'Out for delivery', body: 'Your order is on its way! Keep your phone nearby.' },
    completed: { title: 'Completed', body: 'Salamat sa pagbili!' },
    cancelled: { title: 'Cancelled', body: 'This order was cancelled.' },
  }[status];
};

// Walang 0/O at 1/I para hindi malito sa pagbasa ng code
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

const ITEMS_JSON = `COALESCE((SELECT json_agg(json_build_object('name', oi.product_name, 'quantity', oi.quantity,
                    'unit_price', oi.unit_price) ORDER BY oi.id) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items`;

const text = (b, k, max, { optional = false } = {}) => {
  const v = String(b[k] ?? '').trim();
  if (!v) { if (optional) return null; throw new HttpError(422, `${k} is required.`); }
  if (v.length > max) throw new HttpError(422, `${k} is too long (max ${max}).`);
  return v;
};

const MINDORO = ['Oriental Mindoro'];   // Oriental Mindoro lang ang hinahatiran

// ---------- Checkout (customer) ----------
// Ang presyo at stock ay laging galing sa database, hindi sa browser, para hindi madaya.
// Body: { customer_name, customer_phone, fulfillment: 'pickup'|'delivery', notes?, items: [{product_id, quantity}],
//         at kapag delivery: province, municipality, barangay, street, lat, lng }
r.post('/', requireAuth('customer'), wrap(async (req, res) => {
  const b = req.body;
  // client_key: unique na susi bawat order galing sa browser. Kapag naulit (hal. offline order na na-sync nang dalawang beses),
  // ibabalik lang ang dating order at hindi na gagawa ng bago.
  const clientKey = text(b, 'client_key', 64, { optional: true });
  if (clientKey && !/^[A-Za-z0-9_-]{8,64}$/.test(clientKey)) throw new HttpError(422, 'Invalid client_key.');
  if (clientKey) {
    const dup = (await query(`SELECT id, total FROM orders WHERE customer_id = $1 AND client_key = $2`, [req.user.id, clientKey])).rows[0];
    if (dup) return res.status(200).json({ id: dup.id, total: dup.total, duplicate: true });
  }
  const name = text(b, 'customer_name', 100);
  const phone = text(b, 'customer_phone', 30).replace(/[\s-]/g, '');
  if (!/^09\d{9}$/.test(phone)) throw new HttpError(422, 'Mobile number must start with 09 and have 11 digits (e.g. 09123456789).');
  const fulfillment = b.fulfillment ?? 'pickup';
  if (!['pickup', 'delivery'].includes(fulfillment)) throw new HttpError(422, 'fulfillment must be pickup or delivery.');
  // Delivery: munisipyo + barangay + street/detalye + map pin (para sa Mindoro lang)
  let d = null;
  if (fulfillment === 'delivery') {
    const province = text(b, 'province', 40);
    if (!MINDORO.includes(province)) throw new HttpError(422, 'We only deliver within Oriental Mindoro.');
    const lat = Number(b.lat), lng = Number(b.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(422, 'Please pin your delivery location on the map.');
    if (lat < 12.1 || lat > 13.7 || lng < 120.8 || lng > 121.7) throw new HttpError(422, 'The map pin must be inside Oriental Mindoro.');
    d = {
      province, municipality: text(b, 'municipality', 80), barangay: text(b, 'barangay', 80),
      street: text(b, 'street', 200), lat: lat.toFixed(6), lng: lng.toFixed(6),
    };
    d.address = `${d.street}, Brgy. ${d.barangay}, ${d.municipality}, ${d.province}`;
  }
  const notes = text(b, 'notes', 1000, { optional: true });

  if (!Array.isArray(b.items) || !b.items.length) throw new HttpError(422, 'Your cart is empty.');
  if (b.items.length > 50) throw new HttpError(422, 'Too many items.');
  const want = new Map();   // product_id -> kabuuang bilang (pinagsama kung inulit)
  for (const it of b.items) {
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new HttpError(422, 'Invalid quantity.');
    const pid = toId(it.product_id);
    want.set(pid, (want.get(pid) ?? 0) + qty);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // FOR UPDATE: hindi mababawasan ng dalawang customer ang parehong huling stock
    const { rows: prods } = await client.query(
      `SELECT id, name, price, stock FROM products
        WHERE id = ANY($1) AND status = 'active' AND deleted_at IS NULL ORDER BY id FOR UPDATE`, [[...want.keys()]]);
    const byId = new Map(prods.map((p) => [p.id, p]));
    for (const [pid, qty] of want) {
      const p = byId.get(pid);
      if (!p) throw new HttpError(422, 'Some items are no longer available. Please review your cart.');
      if (p.stock < qty) throw new HttpError(409, `Not enough stock for "${p.name}".`);
    }

    let totalCents = 0;
    for (const [pid, qty] of want) totalCents += Math.round(Number(byId.get(pid).price) * 100) * qty;
    // Shipping fee: galing sa tindahan (database), hindi sa browser. Delivery lang ang may fee.
    let shippingCents = 0;
    if (fulfillment === 'delivery') {
      const st = (await client.query(`SELECT shipping_fee FROM store_settings WHERE id = 1`)).rows[0];
      shippingCents = Math.round(Number(st?.shipping_fee ?? 0) * 100);
    }
    totalCents += shippingCents;

    let order;
    for (let i = 0; i < 5 && !order; i++) {
      try {
        await client.query('SAVEPOINT code');
        order = (await client.query(
          `INSERT INTO orders (code, customer_id, customer_name, customer_phone, fulfillment, address, notes, total,
                               delivery_province, delivery_municipality, delivery_barangay, delivery_street, delivery_lat, delivery_lng, shipping_fee, client_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id, total`,
          [makeCode(), req.user.id, name, phone, fulfillment, d?.address ?? null, notes, (totalCents / 100).toFixed(2),
           d?.province ?? null, d?.municipality ?? null, d?.barangay ?? null, d?.street ?? null, d?.lat ?? null, d?.lng ?? null, (shippingCents / 100).toFixed(2), clientKey])).rows[0];
      } catch (e) {
        if (e.code !== '23505' || e.constraint === 'orders_client_key_uq') throw e;   // client_key na ginamit na: ihihinto (sasaluhin sa ibaba)
        await client.query('ROLLBACK TO SAVEPOINT code');   // nagkapareho lang ng code: ulitin
      }
    }
    if (!order) throw new HttpError(500, 'Could not create order. Try again.');

    for (const [pid, qty] of want) {
      const p = byId.get(pid);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)`,
        [order.id, pid, p.name, qty, p.price]);
      await client.query(`UPDATE products SET stock = stock - $2 WHERE id = $1`, [pid, qty]);
    }
    await client.query('COMMIT');
    // Abisuhan ang may-ari (bell + real-time). Hindi hinihintay at hindi nakakasira sa order kapag pumalya.
    createNotification('admin', 0, {
      type: 'order:new', title: `New order #${order.id}`,
      body: `${name} · ₱${Number(order.total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      link: '/admin', data: { order_id: order.id },
    }, 'order:new');
    res.status(201).json({ id: order.id, total: order.total });   // hindi ibinibigay ang code hangga't hindi pa Ready
  } catch (e) {
    await client.query('ROLLBACK');
    // Sabay na dalawang request na may parehong client_key: ang isa ang mananalo, ibalik sa isa ang order na iyon
    if (e.constraint === 'orders_client_key_uq') {
      const dup = (await query(`SELECT id, total FROM orders WHERE customer_id = $1 AND client_key = $2`, [req.user.id, clientKey])).rows[0];
      if (dup) return res.status(200).json({ id: dup.id, total: dup.total, duplicate: true });
    }
    throw e;
  } finally { client.release(); }
}));

// ---------- Mga order ng naka-login na customer ----------
r.get('/mine', requireAuth('customer'), wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT o.id, CASE WHEN o.status IN ('ready','out_for_delivery','completed') THEN o.code END AS code,   -- lalabas lang ang code kapag Ready na
            o.status, o.total, o.shipping_fee, o.fulfillment, o.address, o.delivery_lat, o.delivery_lng, o.notes, o.created_at, ${ITEMS_JSON}
       FROM orders o WHERE o.customer_id = $1 ORDER BY o.created_at DESC LIMIT 50`, [req.user.id]);
  res.json(rows);
}));

// ---------- Admin (may-ari) ----------
// Listahan (?status=pending|preparing|ready|out_for_delivery|completed|cancelled)
r.get('/', requireAuth('admin'), wrap(async (req, res) => {
  const status = req.query.status;
  if (status && !STATUSES.includes(status)) throw new HttpError(422, 'Invalid status.');
  const { rows } = await query(
    `SELECT o.id, o.code, o.status, o.total, o.shipping_fee, o.fulfillment, o.customer_name, o.customer_phone, o.created_at,
            (SELECT COALESCE(sum(quantity), 0)::int FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o ${status ? 'WHERE o.status = $1' : ''} ORDER BY o.created_at DESC LIMIT 200`, status ? [status] : []);
  res.json(rows);
}));

r.get('/:id', requireAuth('admin'), wrap(async (req, res) => {
  const { rows } = await query(`SELECT o.*, ${ITEMS_JSON} FROM orders o WHERE o.id = $1`, [toId(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Order not found.');
  res.json(rows[0]);
}));

// Pag-update ng status. Ang "cancelled" ay ibinabalik ang stock at hindi na mababago pagkatapos.
r.patch('/:id/status', requireAuth('admin'), wrap(async (req, res) => {
  const id = toId(req.params.id), next = req.body.status;
  if (!STATUSES.includes(next)) throw new HttpError(422, 'Invalid status.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = (await client.query(`SELECT status, customer_id, fulfillment FROM orders WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!cur) throw new HttpError(404, 'Order not found.');
    if (next === 'out_for_delivery' && cur.fulfillment !== 'delivery') throw new HttpError(409, 'Only delivery orders can be marked Out for delivery.');
    if (cur.status === next) { await client.query('COMMIT'); return res.json({ id, status: next }); }
    if (cur.status === 'cancelled') throw new HttpError(409, 'A cancelled order cannot be changed.');
    if (cur.status === 'completed' && next === 'cancelled') throw new HttpError(409, 'A completed order cannot be cancelled.');
    if (next === 'cancelled') {
      await client.query(
        `UPDATE products p SET stock = p.stock + oi.quantity FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`, [id]);
    }
    await client.query(`UPDATE orders SET status = $2 WHERE id = $1`, [id, next]);
    await client.query('COMMIT');
    // Abisuhan ang customer sa bawat pagbabago ng status
    createNotification('customer', cur.customer_id, {
      type: 'order:status', title: `Order #${id}: ${statusText(next, cur.fulfillment).title}`,
      body: statusText(next, cur.fulfillment).body, link: '/my-orders', data: { order_id: id, status: next },
    }, 'order:status');
    res.json({ id, status: next });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

export default r;

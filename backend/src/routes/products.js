import { Router } from 'express';
import { query } from '../db.js';
import { wrap, HttpError, toId, buildUpdate, imageField, imgSql, isImgRef } from '../util.js';
import { optionalAuth, requireAuth } from '../auth.js';

const r = Router();
const admin = requireAuth('admin');

async function validate(b, partial = false) {
  const out = {};
  const has = (k) => b[k] !== undefined;
  const need = (k) => { if (!has(k) && !partial) throw new HttpError(422, `${k} is required.`); return has(k); };

  if (need('name')) {
    const v = String(b.name).trim();
    if (!v || v.length > 100) throw new HttpError(422, 'name must be 1-100 characters.');
    out.name = v;
  }
  if (has('description')) {
    const v = b.description == null ? null : String(b.description).trim();
    if (v && v.length > 1000) throw new HttpError(422, 'description is too long (max 1000).');
    out.description = v || null;
  }
  if (has('unit')) {   // hal. "250g", "bote", "piraso"
    const v = b.unit == null ? null : String(b.unit).trim();
    if (v && v.length > 30) throw new HttpError(422, 'unit is too long (max 30).');
    out.unit = v || null;
  }
  if (need('price')) {
    const v = Number(b.price);
    if (!Number.isFinite(v) || v < 0 || v > 1000000) throw new HttpError(422, 'price must be 0-1,000,000.');
    out.price = v;
  }
  if (need('stock')) {
    const v = Number(b.stock);
    if (!Number.isInteger(v) || v < 0 || v > 100000) throw new HttpError(422, 'stock must be a whole number 0-100,000.');
    out.stock = v;
  }
  if (need('status')) {
    if (!['active', 'inactive'].includes(b.status)) throw new HttpError(422, 'status must be active or inactive.');
    out.status = b.status;
  }
  if (has('image_url') && !isImgRef(b.image_url)) out.image_url = imageField(b.image_url);
  if (has('category_id')) {
    if (b.category_id == null || b.category_id === '') out.category_id = null;
    else {
      const id = toId(b.category_id);
      const { rowCount } = await query(`SELECT 1 FROM categories WHERE id = $1 AND deleted_at IS NULL`, [id]);
      if (!rowCount) throw new HttpError(422, 'Invalid category.');
      out.category_id = id;
    }
  }
  return out;
}

// Public: active na produkto lang. Admin: lahat (?archived=true para sa na-archive).
// Opsyonal: ?category_id=3  ?q=ube
r.get('/', optionalAuth, wrap(async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const archived = isAdmin && req.query.archived === 'true';
  const where = [`p.deleted_at IS ${archived ? 'NOT NULL' : 'NULL'}`];
  const params = [];
  if (!isAdmin) where.push(`p.status = 'active'`);
  if (req.query.category_id) { params.push(toId(req.query.category_id)); where.push(`p.category_id = $${params.length}`); }
  if (req.query.q) { params.push(`%${String(req.query.q).trim().slice(0, 60)}%`); where.push(`p.name ILIKE $${params.length}`); }
  const { rows } = await query(
    `SELECT p.id, p.category_id, p.name, p.description, p.price, p.unit, p.stock, p.status,
            p.created_at, p.updated_at, p.deleted_at, ${imgSql('product', 'p.image_url', 'p.id')} AS image_url,
            c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
      WHERE ${where.join(' AND ')} ORDER BY p.name`, params);
  res.json(rows);
}));

r.get('/:id', optionalAuth, wrap(async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const { rows } = await query(
    `SELECT p.id, p.category_id, p.name, p.description, p.price, p.unit, p.stock, p.status,
            ${imgSql('product', 'p.image_url', 'p.id')} AS image_url, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
      WHERE p.id = $1 AND p.deleted_at IS NULL ${isAdmin ? '' : "AND p.status = 'active'"}`, [toId(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Product not found.');
  res.json(rows[0]);
}));

r.post('/', admin, wrap(async (req, res) => {
  const d = await validate(req.body);
  const cols = Object.keys(d);
  const { rows } = await query(
    `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING id, name, price, unit, stock, status, category_id`, cols.map((c) => d[c]));
  res.status(201).json(rows[0]);
}));

r.patch('/:id', admin, wrap(async (req, res) => {
  const u = buildUpdate(await validate(req.body, true), 2);
  if (!u.count) throw new HttpError(422, 'Nothing to update.');
  const { rows } = await query(
    `UPDATE products SET ${u.set} WHERE id = $1 AND deleted_at IS NULL RETURNING id, name, price, unit, stock, status, category_id`,
    [toId(req.params.id), ...u.values]);
  if (!rows[0]) throw new HttpError(404, 'Product not found.');
  res.json(rows[0]);
}));

// SOFT DELETE (hindi mabubura ang lumang orders na gumamit nito)
r.delete('/:id', admin, wrap(async (req, res) => {
  const { rowCount } = await query(`UPDATE products SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [toId(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Product not found.');
  res.json({ archived: true });
}));

r.post('/:id/restore', admin, wrap(async (req, res) => {
  const { rowCount } = await query(`UPDATE products SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL`, [toId(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Archived product not found.');
  res.json({ restored: true });
}));

export default r;

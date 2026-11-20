import { Router } from 'express';
import { pool, query } from '../db.js';
import { wrap, HttpError, toId } from '../util.js';
import { optionalAuth, requireAuth } from '../auth.js';

const r = Router();
const admin = requireAuth('admin');

const name = (b) => {
  const v = String(b.name ?? '').trim();
  if (!v || v.length > 60) throw new HttpError(422, 'name must be 1-60 characters.');
  return v;
};
const dupe = (e) => (e.code === '23505' ? new HttpError(422, 'A category with this name already exists.') : e);

// Public: mga category. Admin lang ang makakakita ng archived (?archived=true)
r.get('/', optionalAuth, wrap(async (req, res) => {
  const archived = req.user?.role === 'admin' && req.query.archived === 'true';
  const { rows } = await query(
    `SELECT c.id, c.name, c.deleted_at,
            (SELECT count(*)::int FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL
               ${req.user?.role === 'admin' ? '' : "AND p.status = 'active'"}) AS product_count
       FROM categories c WHERE c.deleted_at IS ${archived ? 'NOT NULL' : 'NULL'} ORDER BY c.name`);
  res.json(rows);
}));

r.post('/', admin, wrap(async (req, res) => {
  try {
    const { rows } = await query(`INSERT INTO categories (name) VALUES ($1) RETURNING *`, [name(req.body)]);
    res.status(201).json(rows[0]);
  } catch (e) { throw dupe(e); }
}));

r.patch('/:id', admin, wrap(async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE categories SET name = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING *`, [toId(req.params.id), name(req.body)]);
    if (!rows[0]) throw new HttpError(404, 'Category not found.');
    res.json(rows[0]);
  } catch (e) { throw dupe(e); }
}));

// SOFT DELETE: naka-archive ang category, mananatili ang mga produkto (mawawalan lang ng category)
r.delete('/:id', admin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(`UPDATE categories SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!rowCount) throw new HttpError(404, 'Category not found.');
    await client.query(`UPDATE products SET category_id = NULL WHERE category_id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ archived: true });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

r.post('/:id/restore', admin, wrap(async (req, res) => {
  try {
    const { rowCount } = await query(
      `UPDATE categories SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL`, [toId(req.params.id)]);
    if (!rowCount) throw new HttpError(404, 'Archived category not found.');
    res.json({ restored: true });
  } catch (e) { throw dupe(e); }
}));

export default r;

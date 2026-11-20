import { Router } from 'express';
import { query } from '../db.js';
import { wrap, HttpError, toId } from '../util.js';

const r = Router();
const SRC = { product: ['products', 'image_url'], store: ['store_settings', 'cover_url'], store2: ['store_settings', 'cover2_url'], store3: ['store_settings', 'cover3_url'], storelogo: ['store_settings', 'logo_url'], customer: ['customers', 'avatar_url'], admin: ['admins', 'avatar_url'] };

// Naghahatid ng larawan bilang totoong image file (may cache ang browser).
r.get('/img/:kind/:id', wrap(async (req, res) => {
  const src = SRC[req.params.kind];
  if (!src) throw new HttpError(404, 'Not found.');
  const { rows } = await query(`SELECT ${src[1]} AS img FROM ${src[0]} WHERE id = $1`, [toId(req.params.id)]);
  const v = rows[0]?.img;
  if (!v) throw new HttpError(404, 'Not found.');
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(v);
  if (!m) {
    if (/^https?:\/\/\S+$/.test(v)) return res.redirect(302, v);
    throw new HttpError(404, 'Not found.');
  }
  res.set({ 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable' });   // may ?v= sa link kaya ligtas i-cache
  res.send(Buffer.from(m[2], 'base64'));
}));

export default r;

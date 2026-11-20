import { Router } from 'express';
import { query } from '../db.js';
import { wrap, HttpError, buildUpdate, imageField, imgSql, isImgRef } from '../util.js';
import { requireAuth } from '../auth.js';

const r = Router();

const SELECT = `SELECT id, name, tagline, about, address, phone, lat::float8 AS lat, lng::float8 AS lng, shipping_fee::float8 AS shipping_fee, updated_at,
                       ${imgSql('store', 'cover_url', 'id')} AS cover_url,
                       ${imgSql('store2', 'cover2_url', 'id')} AS cover2_url,
                       ${imgSql('store3', 'cover3_url', 'id')} AS cover3_url,
                       ${imgSql('storelogo', 'logo_url', 'id')} AS logo_url FROM store_settings WHERE id = 1`;

// Public: impormasyon ng tindahan (para sa home page)
r.get('/', wrap(async (_req, res) => {
  res.json((await query(SELECT)).rows[0]);
}));

// Admin lang: palitan ang impormasyon ng tindahan
r.patch('/', requireAuth('admin'), wrap(async (req, res) => {
  const b = req.body, d = {};
  const text = (k, max, required = false) => {
    if (b[k] === undefined) return;
    const v = b[k] == null ? '' : String(b[k]).trim();
    if (!v && required) throw new HttpError(422, `${k} is required.`);
    if (v.length > max) throw new HttpError(422, `${k} is too long (max ${max}).`);
    d[k] = v || null;
  };
  text('name', 100, true); text('tagline', 120); text('about', 1000); text('address', 255); text('phone', 30);
  // Shipping fee ng delivery (₱). 0 = libre
  if (b.shipping_fee !== undefined) {
    const fee = b.shipping_fee === '' || b.shipping_fee == null ? 0 : Number(b.shipping_fee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 100000) throw new HttpError(422, 'Invalid shipping fee.');
    d.shipping_fee = fee.toFixed(2);
  }
  // Map pin ng tindahan (para sa Pickup). Walang laman ang dalawa = alisin ang pin.
  if (b.lat !== undefined || b.lng !== undefined) {
    const blank = (v) => v == null || v === '';
    if (blank(b.lat) && blank(b.lng)) { d.lat = null; d.lng = null; }
    else {
      const lat = Number(b.lat), lng = Number(b.lng);
      if (blank(b.lat) || blank(b.lng) || !Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(422, 'Invalid map pin.');
      if (lat < 12.1 || lat > 13.7 || lng < 120.8 || lng > 121.7) throw new HttpError(422, 'The map pin must be inside Oriental Mindoro.');
      d.lat = lat.toFixed(6); d.lng = lng.toFixed(6);
    }
  }
  // Hanggang 3 cover photo ang puwedeng ilagay ng admin
  for (const k of ['cover_url', 'cover2_url', 'cover3_url']) {
    if (b[k] !== undefined && !isImgRef(b[k])) d[k] = imageField(b[k]);
  }
  if (b.logo_url !== undefined && !isImgRef(b.logo_url)) d.logo_url = imageField(b.logo_url);
  const u = buildUpdate(d, 1);
  if (!u.count) throw new HttpError(422, 'Nothing to update.');
  await query(`UPDATE store_settings SET ${u.set} WHERE id = 1`, u.values);
  res.json((await query(SELECT)).rows[0]);
}));

export default r;

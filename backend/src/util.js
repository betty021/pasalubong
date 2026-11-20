// Ang async route errors ay mapupunta sa error handler
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const toId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid id.');
  return n;
};

// Gumagawa ng "SET a=$1, b=$2" mula sa mga field na ipinadala lang
export function buildUpdate(data, startAt = 1) {
  const keys = Object.keys(data);
  return {
    set: keys.map((k, i) => `${k} = $${i + startAt}`).join(', '),
    values: keys.map((k) => data[k]),
    count: keys.length,
  };
}

// Larawan: data URL (jpeg/png/webp) na galing sa browser, o http(s) link. Walang laman = alisin.
export function imageField(v, max = 1_500_000) {
  if (v == null || v === '') return null;
  const s = String(v);
  if (s.length > max) throw new HttpError(422, 'The image is too large.');
  const ok = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) || /^https?:\/\/\S+$/.test(s);
  if (!ok) throw new HttpError(422, 'Invalid image.');
  return s;
}

// Para gumaan ang listahan: ang data-URL ng larawan ay pinapalitan ng maikling link (/api/img/...).
// Gamitin sa SELECT:  ${imgSql('product', 'p.image_url', 'p.id')} AS image_url
export const imgSql = (kind, col, idCol) =>
  `CASE WHEN ${col} LIKE 'data:%' THEN '/api/img/${kind}/' || ${idCol} || '?v=' || substr(md5(${col}), 1, 8) ELSE ${col} END`;
// Kapag ibinalik ng browser ang link na iyon sa pag-save, ibig sabihin ay hindi binago ang larawan
export const isImgRef = (v) => typeof v === 'string' && v.startsWith('/api/img/');

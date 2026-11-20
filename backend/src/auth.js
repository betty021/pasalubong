import 'dotenv/config';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { HttpError } from './util.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('Missing JWT_SECRET sa .env (kahit 16 characters pataas).');
  process.exit(1);
}

const SECRET = process.env.JWT_SECRET;

export const hashPassword = (p) => bcrypt.hash(p, 12);
export const checkPassword = (p, hash) => bcrypt.compare(p, hash);

// role: 'admin' (may-ari ng tindahan) | 'customer'
export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: '7d' });

function readToken(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const p = jwt.verify(h.slice(7), SECRET);
    return { id: Number(p.sub), role: p.role };
  } catch { return null; }
}

// Para sa mga route na public pero iba ang makikita ng naka-login
export const optionalAuth = (req, _res, next) => { req.user = readToken(req); next(); };

// Kailangan naka-login at tamang role. Halimbawa: requireAuth('admin')
export const requireAuth = (...roles) => (req, _res, next) => {
  const u = readToken(req);
  if (!u) return next(new HttpError(401, 'Please log in.'));
  if (roles.length && !roles.includes(u.role)) return next(new HttpError(403, 'Not allowed.'));
  req.user = u;
  next();
};

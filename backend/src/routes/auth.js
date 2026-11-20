import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { wrap, HttpError, imageField, imgSql } from '../util.js';
import { hashPassword, checkPassword, signToken, requireAuth } from '../auth.js';
import { sendVerificationCode } from '../mail.js';

const r = Router();

const limiter = (limit) => rateLimit({ windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a minute.' } });
const loginLimit = limiter(10);
const registerLimit = limiter(5);
const verifyLimit = limiter(10);
const resendLimit = limiter(5);

const str = (b, k, max, { optional = false } = {}) => {
  const v = String(b[k] ?? '').trim();
  if (!v) { if (optional) return null; throw new HttpError(422, `${k} is required.`); }
  if (v.length > max) throw new HttpError(422, `${k} is too long (max ${max}).`);
  return v;
};
// PH mobile: 09 + 9 na digit = 11 digits. Tinatanggap ang espasyo/gitling (tinatanggal bago i-save).
const phoneNo = (b, k = 'phone', { optional = true } = {}) => {
  const v = String(b[k] ?? '').replace(/[\s-]/g, '');
  if (!v) { if (optional) return null; throw new HttpError(422, 'Mobile number is required.'); }
  if (!/^09\d{9}$/.test(v)) throw new HttpError(422, 'Mobile number must start with 09 and have 11 digits (e.g. 09123456789).');
  return v;
};
const email = (b) => {
  const v = str(b, 'email', 100).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError(422, 'Invalid email.');
  return v;
};
const password = (b) => {
  const v = String(b.password ?? '');
  if (v.length < 8 || v.length > 72) throw new HttpError(422, 'password must be 8-72 characters.');
  if (b.password_confirmation !== undefined && b.password_confirmation !== v)
    throw new HttpError(422, 'Passwords do not match.');
  return v;
};
const emailTaken = (e) => (e.code === '23505' ? new HttpError(422, 'This email is already registered.') : e);

// ---------- Email verification (Gmail lang, 6-digit code) ----------
const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

// Gmail lang: gmail.com o googlemail.com, at tamang format ng Gmail username (6-30: letters, numbers, tuldok)
const gmail = (b) => {
  const v = email(b);
  const [local, domain] = v.split('@');
  const okDomain = domain === 'gmail.com' || domain === 'googlemail.com';
  const okLocal = /^[a-z0-9][a-z0-9.]{4,28}[a-z0-9]$/.test(local) && !local.includes('..');
  if (!okDomain || !okLocal) throw new HttpError(422, 'Please use a valid Gmail address (example: juan.delacruz@gmail.com).');
  return v;
};

const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
const hashCode = (e, code) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${e}:${code}`).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Gumawa ng bagong code, i-save (naka-hash), at ipadala sa Gmail
async function issueCode(c) {
  const code = newCode();
  await query(
    `UPDATE customers SET verify_code_hash = $2, verify_expires_at = now() + ($3 || ' minutes')::interval,
            verify_attempts = 0, verify_sent_at = now() WHERE id = $1`,
    [c.id, hashCode(c.email.toLowerCase(), code), String(CODE_MINUTES)]);
  await sendVerificationCode(c.email, c.first_name, code);
}

// Customer: mag-register -> magpapadala ng code sa Gmail. Hindi pa naka-login hangga't hindi na-verify.
r.post('/register-customer', registerLimit, wrap(async (req, res) => {
  const b = req.body;
  const e = gmail(b);
  const first = str(b, 'first_name', 60), last = str(b, 'last_name', 60);
  const phone = phoneNo(b);
  const hash = await hashPassword(password(b));

  const found = (await query(`SELECT id, email_verified_at FROM customers WHERE lower(email) = $1 AND deleted_at IS NULL`, [e])).rows[0];
  if (found?.email_verified_at) throw new HttpError(422, 'This email is already registered.');

  let id;
  if (found) {
    // Hindi pa na-verify na dating sign-up gamit ang parehong email: i-update na lang (para hindi ma-"squat" ang email)
    await query(`UPDATE customers SET first_name = $2, last_name = $3, phone = $4, password_hash = $5 WHERE id = $1`,
      [found.id, first, last, phone, hash]);
    id = found.id;
  } else {
    try {
      id = (await query(
        `INSERT INTO customers (first_name, last_name, email, phone, password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [first, last, e, phone, hash])).rows[0].id;
    } catch (err) { throw emailTaken(err); }
  }
  await issueCode({ id, email: e, first_name: first });
  res.status(201).json({ verification_required: true, email: e });
}));

// I-verify ang 6-digit code. Kapag tama: na-verify na; pagkatapos ay kailangan pang mag-login.
r.post('/verify-email', verifyLimit, wrap(async (req, res) => {
  const e = String(req.body.email ?? '').trim().toLowerCase();
  const code = String(req.body.code ?? '').replace(/\s+/g, '');
  const BAD_CODE = new HttpError(422, 'That code is incorrect. Please check your email and try again.');
  if (!e || !/^\d{6}$/.test(code)) throw BAD_CODE;

  const c = (await query(`SELECT * FROM customers WHERE lower(email) = $1 AND deleted_at IS NULL`, [e])).rows[0];
  if (!c) throw BAD_CODE;
  if (c.email_verified_at) throw new HttpError(422, 'This email is already verified. Please log in.');
  if (!c.verify_code_hash || !c.verify_expires_at || new Date(c.verify_expires_at) < new Date())
    throw new HttpError(422, 'This code has expired. Please request a new one.');
  if (c.verify_attempts >= MAX_ATTEMPTS)
    throw new HttpError(429, 'Too many wrong attempts. Please request a new code.');

  if (!sameHash(c.verify_code_hash, hashCode(e, code))) {
    await query(`UPDATE customers SET verify_attempts = verify_attempts + 1 WHERE id = $1`, [c.id]);
    throw BAD_CODE;
  }
  await query(`UPDATE customers SET email_verified_at = now(), verify_code_hash = NULL, verify_expires_at = NULL, verify_attempts = 0 WHERE id = $1`, [c.id]);
  // Hindi na auto-login: kailangang mag-login muna ang customer pagkatapos ng sign-up
  res.json({ verified: true, email: c.email });
}));

// Magpadala ulit ng code (may 60 segundong pagitan)
r.post('/resend-verification', resendLimit, wrap(async (req, res) => {
  const e = String(req.body.email ?? '').trim().toLowerCase();
  const c = e && (await query(`SELECT * FROM customers WHERE lower(email) = $1 AND deleted_at IS NULL`, [e])).rows[0];
  if (c && !c.email_verified_at) {
    const wait = c.verify_sent_at ? RESEND_SECONDS - (Date.now() - new Date(c.verify_sent_at)) / 1000 : 0;
    if (wait > 0) throw new HttpError(429, `Please wait ${Math.ceil(wait)} seconds before requesting another code.`);
    await issueCode(c);
  }
  res.json({ sent: true });   // parehong sagot kahit hindi existing, para hindi mahulaan kung may account
}));

// Parehong mensahe kapag mali ang email o password (hindi malalaman kung alin)
const BAD = new HttpError(401, 'Incorrect email or password.');

r.post('/login', loginLimit, wrap(async (req, res) => {
  const e = String(req.body.email ?? '').trim().toLowerCase();
  const p = String(req.body.password ?? '');
  if (!e || !p) throw BAD;

  // Awtomatikong kinikilala: kapag email ng may-ari (admin) -> admin; kung hindi, customer.
  const admin = (await query(
    `SELECT id, email, password_hash, ${imgSql('admin', 'avatar_url', 'id')} AS avatar_url FROM admins WHERE lower(email) = $1`, [e])).rows[0];
  if (admin) {
    if (!(await checkPassword(p, admin.password_hash))) throw BAD;
    const user = { id: admin.id, role: 'admin', email: admin.email, avatar_url: admin.avatar_url };
    return res.json({ token: signToken(user), user });
  }

  const row = (await query(
    `SELECT *, ${imgSql('customer', 'avatar_url', 'id')} AS avatar_ref FROM customers WHERE lower(email) = $1 AND deleted_at IS NULL`, [e])).rows[0];
  if (!row || row.status !== 'active' || !(await checkPassword(p, row.password_hash))) throw BAD;
  if (!row.email_verified_at) {
    // Tama ang password pero hindi pa na-verify ang Gmail: magpadala ng bagong code (kung lampas na sa 60 segundo)
    const stale = !row.verify_sent_at || Date.now() - new Date(row.verify_sent_at) > RESEND_SECONDS * 1000;
    if (stale) await issueCode(row).catch(() => {});
    return res.status(403).json({ error: 'Please verify your Gmail first. We sent a code to your email.', code: 'email_not_verified', email: row.email });
  }
  const user = { id: row.id, role: 'customer', first_name: row.first_name, last_name: row.last_name, email: row.email, avatar_url: row.avatar_ref };
  res.json({ token: signToken(user), user });
}));

r.get('/me', requireAuth(), wrap(async (req, res) => {
  const { id, role } = req.user;
  const sql = {
    customer: `SELECT id, first_name, last_name, email, phone, ${imgSql('customer', 'avatar_url', 'id')} AS avatar_url FROM customers WHERE id = $1 AND deleted_at IS NULL`,
    admin: `SELECT id, email, ${imgSql('admin', 'avatar_url', 'id')} AS avatar_url FROM admins WHERE id = $1`,
  }[role];
  const { rows } = await query(sql, [id]);
  if (!rows[0]) throw new HttpError(401, 'Please log in.');
  res.json({ ...rows[0], role });
}));

// Palitan ang pangalan at phone (customer)
r.patch('/me', requireAuth('customer'), wrap(async (req, res) => {
  const first = str(req.body, 'first_name', 60), last = str(req.body, 'last_name', 60);
  const phone = phoneNo(req.body);
  await query(`UPDATE customers SET first_name = $2, last_name = $3, phone = $4 WHERE id = $1 AND deleted_at IS NULL`,
    [req.user.id, first, last, phone]);
  res.json({ updated: true, first_name: first, last_name: last, phone });
}));

// Profile picture (admin o customer). image = data URL; walang laman = alisin.
r.put('/me/avatar', requireAuth('admin', 'customer'), wrap(async (req, res) => {
  const table = req.user.role === 'admin' ? 'admins' : 'customers';
  const value = imageField(req.body.image, 600_000);
  await query(`UPDATE ${table} SET avatar_url = $2 WHERE id = $1`, [req.user.id, value]);
  const { rows } = await query(`SELECT ${imgSql(req.user.role, 'avatar_url', 'id')} AS avatar_url FROM ${table} WHERE id = $1`, [req.user.id]);
  res.json({ avatar_url: rows[0]?.avatar_url ?? null });
}));

// Palitan ang password (admin o customer)
r.put('/password', requireAuth('admin', 'customer'), wrap(async (req, res) => {
  const table = req.user.role === 'admin' ? 'admins' : 'customers';
  const extra = req.user.role === 'admin' ? '' : ' AND deleted_at IS NULL';
  const { rows } = await query(`SELECT password_hash FROM ${table} WHERE id = $1${extra}`, [req.user.id]);
  if (!rows[0] || !(await checkPassword(String(req.body.current_password ?? ''), rows[0].password_hash)))
    throw new HttpError(422, 'Current password is incorrect.');
  await query(`UPDATE ${table} SET password_hash = $2 WHERE id = $1`, [req.user.id, await hashPassword(password(req.body))]);
  res.json({ updated: true });
}));

export default r;

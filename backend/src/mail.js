import 'dotenv/config';
import nodemailer from 'nodemailer';
import { HttpError } from './util.js';

const { SMTP_HOST = 'smtp.gmail.com', SMTP_PORT = '465', SMTP_USER, MAIL_FROM, BREVO_API_KEY } = process.env;
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '');   // ang App Password ay madalas may espasyo

const useBrevo = Boolean(BREVO_API_KEY);                 // HTTPS API: gumagana sa Railway (bawal ang SMTP doon)
const useSmtp = !useBrevo && Boolean(SMTP_USER && SMTP_PASS);   // para sa local development
const configured = useBrevo || useSmtp;

let transporter;
const getTransporter = () => (transporter ??= nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
}));

if (!configured) console.warn('[mail] Walang BREVO_API_KEY o SMTP_USER/SMTP_PASS — ipi-print na lang sa console ang verification code (pang-development lang).');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "PasalubongHub <me@gmail.com>"  ->  { name: 'PasalubongHub', email: 'me@gmail.com' }
function parseFrom(v) {
  const m = String(v || '').match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || 'PasalubongHub', email: m[2].trim() } : { name: 'PasalubongHub', email: String(v || SMTP_USER || '').trim() };
}

async function sendViaBrevo({ to, subject, text, html }) {
  const sender = parseFrom(MAIL_FROM || SMTP_USER);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function sendVerificationCode(to, firstName, code) {
  if (!configured) {
    if (process.env.NODE_ENV === 'production') throw new HttpError(503, 'Email service is not configured.');
    console.log(`[mail] Verification code para kay ${to}: ${code}`);
    return;
  }
  const msg = {
    to,
    subject: `${code} is your PasalubongHub verification code`,
    text: `Hi ${firstName},\n\nYour PasalubongHub verification code is ${code}.\nIt expires in 15 minutes.\n\nIf you didn't sign up, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
        <h2 style="margin:0 0 8px">Verify your email</h2>
        <p>Hi ${esc(firstName)}, use this code to finish creating your PasalubongHub account:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:18px 0">${code}</p>
        <p style="color:#666;font-size:13px">This code expires in 15 minutes. If you didn't sign up, you can safely ignore this email.</p>
      </div>`,
  };
  try {
    if (useBrevo) await sendViaBrevo(msg);
    else await getTransporter().sendMail({ from: MAIL_FROM || SMTP_USER, ...msg });
  } catch (e) {
    console.error('[mail] send failed:', e.message);
    throw new HttpError(502, 'We could not send the verification email. Please try again in a moment.');
  }
}

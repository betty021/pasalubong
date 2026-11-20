import 'dotenv/config';
import nodemailer from 'nodemailer';
import { HttpError } from './util.js';

const { SMTP_HOST = 'smtp.gmail.com', SMTP_PORT = '465', SMTP_USER, MAIL_FROM } = process.env;
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '');   // ang App Password ay madalas may espasyo
const configured = Boolean(SMTP_USER && SMTP_PASS);

let transporter;
const getTransporter = () => (transporter ??= nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
}));

if (!configured) console.warn('[mail] Walang SMTP_USER/SMTP_PASS sa .env — ipi-print na lang sa console ang verification code (pang-development lang).');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function sendVerificationCode(to, firstName, code) {
  if (!configured) {
    if (process.env.NODE_ENV === 'production') throw new HttpError(503, 'Email service is not configured.');
    console.log(`[mail] Verification code para kay ${to}: ${code}`);
    return;
  }
  try {
    await getTransporter().sendMail({
      from: MAIL_FROM || SMTP_USER,
      to,
      subject: `${code} is your PasalubongHub verification code`,
      text: `Hi ${firstName},\n\nYour PasalubongHub verification code is ${code}.\nIt expires in 15 minutes.\n\nIf you didn't sign up, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
        <h2 style="margin:0 0 8px">Verify your email</h2>
        <p>Hi ${esc(firstName)}, use this code to finish creating your PasalubongHub account:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:18px 0">${code}</p>
        <p style="color:#666;font-size:13px">This code expires in 15 minutes. If you didn't sign up, you can safely ignore this email.</p>
      </div>`,
    });
  } catch (e) {
    console.error('[mail] send failed:', e.message);
    throw new HttpError(502, 'We could not send the verification email. Please try again in a moment.');
  }
}

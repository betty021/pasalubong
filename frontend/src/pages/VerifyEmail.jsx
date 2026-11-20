import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { notify } from '../notice.jsx';

// Ilagay ang 6-digit code na ipinadala sa Gmail. Kapag tama, naka-login na agad.
export default function VerifyEmail() {
  const nav = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState(state?.email ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(state?.fromLogin ? 0 : 60);   // pagkatapos ma-send ang code, 60s bago puwedeng mag-resend

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const data = await api('/auth/verify-email', { method: 'POST', body: { email, code } });
      // Hindi auto-login: dalhin sa Login page para mag-login muna
      nav('/login', { replace: true, state: { email: data.email || email, verified: true } });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function resend() {
    setError('');
    try {
      await api('/auth/resend-verification', { method: 'POST', body: { email } });
      setWait(60); notify('A new code was sent to your Gmail.');
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="auth"><form className="panel" onSubmit={submit}>
      <h1>Verify your <span className="accent">Gmail</span></h1>
      <span className="muted">
        {state?.email ? <>We sent a 6-digit code to <b>{state.email}</b>. Enter it below (check Spam too).</> : 'Enter your Gmail and the 6-digit code we sent you.'}
      </span>
      {!state?.email && (
        <div className="field"><label>Gmail address</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      )}
      <div className="field">
        <label>Verification code</label>
        <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="123456"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} />
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn block" style={{ marginTop: 20 }} disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
      <p className="alt">
        Didn’t get it?{' '}
        <button type="button" className="linklike" onClick={resend} disabled={wait > 0 || !email}
          style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 600, color: wait > 0 ? 'var(--muted, #888)' : 'var(--brand)', cursor: wait > 0 ? 'default' : 'pointer' }}>
          {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
        </button>
      </p>
      <p className="alt"><Link to="/login">Back to log in</Link></p>
    </form></main>
  );
}

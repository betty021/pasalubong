import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Register() {
  const nav = useNavigate();
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', password: '', password_confirmation: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);   // ipakita/itago ang password at confirm password
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const data = await api('/auth/register-customer', { method: 'POST', body: f });
      nav('/verify-email', { state: { email: data.email }, replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <main className="auth"><form className="panel" onSubmit={submit}>
      <h1>Create your <span className="accent">account</span></h1>
      <span className="muted">Use your Gmail address. We’ll email you a 6-digit code to verify it.</span>
      <div className="two">
        <div className="field"><label>First name</label><input required value={f.first_name} onChange={set('first_name')} /></div>
        <div className="field"><label>Last name</label><input required value={f.last_name} onChange={set('last_name')} /></div>
      </div>
      <div className="field"><label>Gmail address</label><input type="email" required value={f.email} onChange={set('email')} placeholder="yourname@gmail.com" autoComplete="email" pattern="[A-Za-z0-9.]+@(gmail|googlemail)\.com" title="Please use a Gmail address (yourname@gmail.com)" /></div>
      <div className="two">
        <div className="field"><label>Password</label>
          <div style={{ position: 'relative' }}>
            <input type={show ? 'text' : 'password'} required minLength={8} value={f.password} onChange={set('password')} autoComplete="new-password" style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'}
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, cursor: 'pointer', padding: '6px 8px', color: 'inherit' }}>
            <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="field"><label>Confirm password</label>
          <input type={show ? 'text' : 'password'} required minLength={8} value={f.password_confirmation} onChange={set('password_confirmation')} autoComplete="new-password" />
        </div>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn block" style={{ marginTop: 20 }} disabled={busy}>{busy ? 'Sending code…' : 'Create account'}</button>
      <p className="alt">Already have an account? <Link to="/login">Log in</Link></p>
    </form></main>
  );
}

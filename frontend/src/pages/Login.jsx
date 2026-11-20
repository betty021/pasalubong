import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { HOME, useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { state } = useLocation();
  const [email, setEmail] = useState(state?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const u = await login(email, password);
      // Awtomatikong nakikilala ang may-ari (admin) o customer; hindi puwedeng dalhin ang customer sa /admin
      const next = sp.get('next');
      const okNext = next && next.startsWith('/') && (u.role === 'admin' ? next.startsWith('/admin') : !next.startsWith('/admin'));
      nav(okNext ? next : HOME[u.role], { replace: true });
    } catch (err) {
      if (err.code === 'email_not_verified') { nav('/verify-email', { state: { email: err.data?.email || email, fromLogin: true } }); return; }
      setError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <main className="auth"><form className="panel" onSubmit={submit}>
      <h1>Welcome <span className="accent">back</span></h1>
      <span className="muted">Log in to your PasalubongHub account.</span>
      {state?.verified && <div className="ok-note" role="status"><i className="fa-solid fa-circle-check" aria-hidden="true" /> Email verified! Please log in to continue.</div>}
      <div className="field"><label>Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus={!email} /></div>
      <div className="field"><label>Password</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus={!!email} /></div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn block" style={{ marginTop: 20 }} disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      <p className="alt">New here? <Link to="/register">Create an account</Link></p>
    </form></main>
  );
}

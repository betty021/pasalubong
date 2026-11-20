import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { notify, confirmDialog } from '../notice.jsx';
import { pushStatus, enablePush, disablePush } from '../push.js';

// Settings: palitan ang password (customer at admin)
export default function Settings() {
  return (
    <main className="page"><div className="wrap" style={{ maxWidth: 620 }}>
      <h1><span className="accent">Settings</span></h1>
      <p className="muted">Manage your account security.</p>
      <PushBox />
      <PasswordForm />
    </div></main>
  );
}

function PasswordForm() {
  const empty = { current_password: '', password: '', password_confirmation: '' };
  const [f, setF] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault(); setError('');
    if (f.password !== f.password_confirmation) return setError('New passwords do not match.');
    if (!(await confirmDialog({ title: 'Change password?', message: 'Use your new password the next time you log in.', confirmText: 'Yes, change it', icon: 'fa-key' }))) return;
    setBusy(true);
    try {
      await api('/auth/password', { method: 'PUT', body: f });
      setF(empty); notify('Password changed.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form className="box" onSubmit={save} style={{ marginTop: 20 }}>
      <h3 style={{ marginTop: 0 }}>Change password</h3>
      <div className="field"><label>Current password</label><input type="password" required value={f.current_password} onChange={set('current_password')} autoComplete="current-password" /></div>
      <div className="field"><label>New password (8–72 characters)</label><input type="password" required minLength={8} maxLength={72} value={f.password} onChange={set('password')} autoComplete="new-password" /></div>
      <div className="field"><label>Confirm new password</label><input type="password" required value={f.password_confirmation} onChange={set('password_confirmation')} autoComplete="new-password" /></div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}

// Push notifications: makakatanggap ng alert kahit sarado ang app
function PushBox() {
  const [st, setSt] = useState('loading');
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushStatus().then(setSt).catch(() => setSt('unsupported')); }, []);
  if (st === 'loading' || st === 'unsupported') return null;

  async function toggle() {
    setBusy(true);
    try {
      if (st === 'on') { await disablePush(); notify('Push notifications turned off.'); }
      else { await enablePush(); notify('Push notifications turned on.'); }
      setSt(await pushStatus());
    } catch (err) { notify(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="box" style={{ marginTop: 20 }}>
      <h3 style={{ marginTop: 0 }}>Push notifications</h3>
      <p className="muted">Get order and message alerts on this device, even when the app is closed.</p>
      {st === 'blocked'
        ? <p className="muted">Notifications are blocked in your browser settings for this site.</p>
        : <button className="btn" onClick={toggle} disabled={busy}>{busy ? 'Please wait…' : st === 'on' ? 'Turn off' : 'Turn on'}</button>}
    </div>
  );
}

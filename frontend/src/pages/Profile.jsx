import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { notify, confirmDialog } from '../notice.jsx';
import { fileToDataUrl } from '../imageUtil.js';
import Avatar from '../components/Avatar.jsx';
import { displayName } from '../components/AccountMenu.jsx';

// My Profile: profile picture (customer at admin) + detalye.
// customer = pangalan + phone (puwedeng i-edit); admin (may-ari) = email at role.
export default function Profile() {
  const { user, updateUser } = useAuth();
  const isCustomer = user.role === 'customer';

  return (
    <main className="page"><div className="wrap profile-wrap">
      <h1>My <span className="accent">profile</span></h1>
      <section className="box profile-hero">
        <PhotoEditor user={user} updateUser={updateUser} />
        <div className="profile-id">
          <h2>{displayName(user)}</h2>
          <p className="muted">{user.email}</p>
          <span className="role-pill">{isCustomer ? 'Customer' : 'Store owner'}</span>
        </div>
      </section>
      {isCustomer
        ? <DetailsForm updateUser={updateUser} />
        : <div className="box" style={{ marginTop: 18 }}>
            <h3 style={{ marginTop: 0 }}>Your details</h3>
            <div className="field"><label>Email</label><input value={user.email ?? ''} readOnly /></div>
            <div className="field"><label>Role</label><input value="Admin (store owner)" readOnly /></div>
          </div>}
    </div></main>
  );
}

function PhotoEditor({ user, updateUser }) {
  const file = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(image, msg) {
    setBusy(true); setError('');
    try {
      const r = await api('/auth/me/avatar', { method: 'PUT', body: { image } });
      updateUser({ avatar_url: r.avatar_url });
      notify(msg);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function pick(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = await fileToDataUrl(f, { maxSide: 400, quality: 0.85 });
      if (!(await confirmDialog({ title: 'Change profile picture?', message: 'This photo will show in your account and in your chat messages.', confirmText: 'Yes, change it', icon: 'fa-camera' }))) return;
      await save(data, 'Profile picture updated.');
    } catch (err) { setError(err.message); }
  }
  async function remove() {
    if (!(await confirmDialog({ title: 'Remove profile picture?', message: 'Your initial will be shown instead.', confirmText: 'Yes, remove', danger: true }))) return;
    save('', 'Profile picture removed.');
  }

  return (
    <div className="photo-edit">
      <button type="button" className="photo-btn" onClick={() => file.current?.click()} disabled={busy} aria-label="Change profile picture">
        <Avatar src={user.avatar_url} name={displayName(user)} size={112} />
        <span className="photo-cam"><i className="fa-solid fa-camera" aria-hidden="true" /></span>
      </button>
      <input ref={file} type="file" accept="image/*" hidden onChange={pick} />
      <div className="photo-actions">
        <button type="button" className="ghost-btn" onClick={() => file.current?.click()} disabled={busy}>{busy ? 'Saving…' : 'Change photo'}</button>
        {user.avatar_url && <button type="button" className="ghost-btn danger" onClick={remove} disabled={busy}>Remove</button>}
      </div>
      {error && <div className="err" role="alert">{error}</div>}
    </div>
  );
}

function DetailsForm({ updateUser }) {
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/auth/me').then((me) => {
      setF({ first_name: me.first_name, last_name: me.last_name, phone: me.phone ?? '' });
      updateUser({ avatar_url: me.avatar_url });
    }).catch((e) => setError(e.message));
  }, []); // eslint-disable-line

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault(); setError('');
    if (!(await confirmDialog({ title: 'Save changes?', message: 'Your name and phone number will be updated.', confirmText: 'Yes, save', icon: 'fa-floppy-disk' }))) return;
    setBusy(true);
    try {
      const r = await api('/auth/me', { method: 'PATCH', body: f });
      updateUser({ first_name: r.first_name, last_name: r.last_name });
      notify('Profile saved.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form className="box" onSubmit={save} style={{ marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>Your details</h3>
      <div className="two">
        <div className="field"><label>First name</label><input required maxLength={60} value={f.first_name} onChange={set('first_name')} /></div>
        <div className="field"><label>Last name</label><input required maxLength={60} value={f.last_name} onChange={set('last_name')} /></div>
      </div>
      <div className="field"><label>Phone</label><input value={f.phone} onChange={(e) => set('phone')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 11) } })} inputMode="tel" maxLength={11} pattern="09[0-9]{9}" title="Start with 09 and use 11 digits (e.g. 09123456789)" placeholder="09123456789" autoComplete="tel" /></div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}

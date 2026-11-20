import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { notify, confirmDialog } from '../../notice.jsx';

export default function CategoriesTab({ focus = false }) {
  const nameRef = useRef(null);
  const [archived, setArchived] = useState(false);
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  const load = () => api(`/categories${archived ? '?archived=true' : ''}`).then(setList).catch((e) => setError(e.message));
  useEffect(() => { setList(null); load(); }, [archived]); // eslint-disable-line
  useEffect(() => { if (focus) nameRef.current?.focus(); }, [focus]);

  async function save(e) {
    e.preventDefault(); setError('');
    try {
      if (editId) await api(`/categories/${editId}`, { method: 'PATCH', body: { name } });
      else await api('/categories', { method: 'POST', body: { name } });
      notify('Saved.'); setName(''); setEditId(null); load();
    } catch (err) { setError(err.message); }
  }
  async function act(id, path, method, msg) {
    try { await api(`/categories/${id}${path}`, { method }); notify(msg); load(); } catch (err) { setError(err.message); }
  }

  return (
    <>
      {!archived && (
        <form className="toolbar" onSubmit={save}>
          <input ref={nameRef} className="input-inline" placeholder="Category name (e.g. Dried goods)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          <button className="btn sm">{editId ? 'Update' : 'Add category'}</button>
          {editId && <button type="button" className="ghost-btn" onClick={() => { setEditId(null); setName(''); }}>Cancel</button>}
        </form>
      )}
      <div className="chips" style={{ marginBottom: 16 }}>
        <button className={`chip ${!archived ? 'on' : ''}`} onClick={() => setArchived(false)}>Active</button>
        <button className={`chip ${archived ? 'on' : ''}`} onClick={() => setArchived(true)}>Archived</button>
      </div>
      {error && <div className="err">{error}</div>}
      {list === null && !error && <div className="empty">Loading…</div>}
      {list?.length === 0 && <div className="empty">Nothing here yet.</div>}
      {list?.map((c) => (
        <div className="box row-between" key={c.id} style={{ marginBottom: 10 }}>
          <div><b>{c.name}</b> <span className="muted">· {c.product_count} product(s)</span></div>
          <div className="row-gap">
            {archived
              ? <button className="ghost-btn" onClick={async () => (await confirmDialog({ title: `Restore "${c.name}"?`, confirmText: 'Yes, restore', icon: 'fa-rotate-left' })) && act(c.id, '/restore', 'POST', 'Restored.')}>Restore</button>
              : <>
                  <button className="ghost-btn" onClick={() => { setEditId(c.id); setName(c.name); }}>Edit</button>
                  <button className="ghost-btn danger" onClick={async () => (await confirmDialog({ title: `Archive "${c.name}"?`, message: 'You can restore it later.', confirmText: 'Yes, archive', danger: true })) && act(c.id, '', 'DELETE', 'Archived.')}>Archive</button>
                </>}
          </div>
        </div>
      ))}
    </>
  );
}

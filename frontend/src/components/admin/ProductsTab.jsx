import { useEffect, useState } from 'react';
import { api, img } from '../../api.js';
import { notify, confirmDialog } from '../../notice.jsx';
import { peso } from '../../format.js';
import { fileToDataUrl } from '../../imageUtil.js';
import CategoriesTab from './CategoriesTab.jsx';

const EMPTY = { name: '', category_id: '', price: '', unit: '', stock: '', status: 'active', description: '', image_url: undefined };

export default function ProductsTab() {
  const [archived, setArchived] = useState(false);
  const [list, setList] = useState(null);
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState(null);       // null = nakasara ang form
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('products');   // 'products' | 'categories'
  const [focusCat, setFocusCat] = useState(false);

  const load = () => api(`/products${archived ? '?archived=true' : ''}`).then(setList).catch((e) => setError(e.message));
  useEffect(() => { setList(null); load(); }, [archived]); // eslint-disable-line
  useEffect(() => { if (view === 'products') api('/categories').then(setCats).catch(() => {}); }, [view]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function openForm(p) {
    setError('');
    setPreview(p ? img(p.image_url) : null);
    setForm(p ? { id: p.id, name: p.name, category_id: p.category_id ?? '', price: p.price, unit: p.unit ?? '', stock: p.stock, status: p.status, description: p.description ?? '', image_url: undefined } : { ...EMPTY });
  }
  async function pick(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { const url = await fileToDataUrl(f); setForm({ ...form, image_url: url }); setPreview(url); }
    catch (err) { setError(err.message); }
  }
  async function save(e) {
    e.preventDefault(); setError(''); setBusy(true);
    const body = {
      name: form.name, category_id: form.category_id === '' ? null : Number(form.category_id),
      price: Number(form.price), unit: form.unit, stock: Number(form.stock), status: form.status, description: form.description,
    };
    if (form.image_url !== undefined) body.image_url = form.image_url;   // kapag may bagong larawan lang
    try {
      if (form.id) await api(`/products/${form.id}`, { method: 'PATCH', body });
      else await api('/products', { method: 'POST', body });
      notify('Product saved.'); setForm(null); load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function act(id, path, method, msg) {
    try { await api(`/products/${id}${path}`, { method }); notify(msg); load(); } catch (err) { setError(err.message); }
  }

  if (form) return (
    <form className="box" onSubmit={save} style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: '1.3rem' }}>{form.id ? 'Edit product' : 'New product'}</h2>
      <div className="field"><label>Name</label><input value={form.name} onChange={set('name')} maxLength={100} required /></div>
      <div className="two">
        <div className="field"><label>Category</label>
          <select value={form.category_id} onChange={set('category_id')}><option value="">— None —</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label>Unit (e.g. 250g, bote)</label><input value={form.unit} onChange={set('unit')} maxLength={30} /></div>
      </div>
      <div className="two">
        <div className="field"><label>Price (₱)</label><input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} required /></div>
        <div className="field"><label>Stock</label><input type="number" min="0" step="1" value={form.stock} onChange={set('stock')} required /></div>
      </div>
      <div className="field"><label>Status</label>
        <select value={form.status} onChange={set('status')}><option value="active">Active (visible to customers)</option><option value="inactive">Inactive (hidden)</option></select></div>
      <div className="field"><label>Description</label><textarea rows={3} value={form.description} onChange={set('description')} maxLength={1000} /></div>
      <div className="field"><label>Photo</label>
        {preview && <img src={preview} alt="" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 14 }} />}
        <input type="file" accept="image/*" onChange={pick} /></div>
      {error && <div className="err">{error}</div>}
      <div className="row-gap" style={{ marginTop: 18 }}>
        <button className="btn sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="ghost-btn" onClick={() => setForm(null)}>Cancel</button>
      </div>
    </form>
  );

  const switcher = (
    <div className="tabs sub-tabs" role="tablist">
      <button role="tab" aria-selected={view === 'products'} className={view === 'products' ? 'on' : ''} onClick={() => { setFocusCat(false); setView('products'); }}>
        <i className="fa-solid fa-box-open" aria-hidden="true" /> Products
      </button>
      <button role="tab" aria-selected={view === 'categories'} className={view === 'categories' ? 'on' : ''} onClick={() => { setFocusCat(false); setView('categories'); }}>
        <i className="fa-solid fa-tags" aria-hidden="true" /> Categories
      </button>
    </div>
  );

  if (view === 'categories') return (
    <>
      {switcher}
      <CategoriesTab focus={focusCat} />
    </>
  );

  return (
    <>
      {switcher}
      <div className="toolbar">
        <div className="chips">
          <button className={`chip ${!archived ? 'on' : ''}`} onClick={() => setArchived(false)}>Active</button>
          <button className={`chip ${archived ? 'on' : ''}`} onClick={() => setArchived(true)}>Archived</button>
        </div>
        {!archived && (
          <div className="row-gap toolbar-actions">
            <button className="ghost-btn" onClick={() => { setFocusCat(true); setView('categories'); }}><i className="fa-solid fa-plus" aria-hidden="true" /> Add category</button>
            <button className="btn sm" onClick={() => openForm(null)}>+ Add product</button>
          </div>
        )}
      </div>
      {error && <div className="err">{error}</div>}
      {list === null && !error && <div className="empty">Loading…</div>}
      {list?.length === 0 && <div className="empty">No products here.</div>}
      {list?.map((p) => (
        <div className="box row-between" key={p.id} style={{ marginBottom: 10 }}>
          <div className="row-gap">
            <div className="thumb-sm">{p.image_url ? <img src={img(p.image_url)} alt="" /> : <i className="fa-solid fa-basket-shopping" aria-hidden="true" />}</div>
            <div>
              <b>{p.name}</b> {p.status === 'inactive' && <span className="status">Hidden</span>}
              <div className="muted" style={{ fontSize: '.88rem' }}>{p.category_name || 'No category'} · {peso(p.price)}{p.unit && ` / ${p.unit}`} · Stock: {p.stock}</div>
            </div>
          </div>
          <div className="row-gap">
            {archived
              ? <button className="ghost-btn" onClick={async () => (await confirmDialog({ title: `Restore "${p.name}"?`, message: 'It will be visible to customers again.', confirmText: 'Yes, restore', icon: 'fa-rotate-left' })) && act(p.id, '/restore', 'POST', 'Restored.')}>Restore</button>
              : <>
                  <button className="ghost-btn" onClick={() => openForm(p)}>Edit</button>
                  <button className="ghost-btn danger" onClick={async () => (await confirmDialog({ title: `Archive "${p.name}"?`, message: 'It will be hidden from customers. You can restore it later.', confirmText: 'Yes, archive', danger: true })) && act(p.id, '', 'DELETE', 'Archived.')}>Archive</button>
                </>}
          </div>
        </div>
      ))}
    </>
  );
}

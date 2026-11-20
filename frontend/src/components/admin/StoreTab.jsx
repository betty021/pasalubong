import { useEffect, useState } from 'react';
import { api, img } from '../../api.js';
import { notify, confirmDialog } from '../../notice.jsx';
import { fileToDataUrl } from '../../imageUtil.js';
import DeliveryFields from '../DeliveryFields.jsx';

const COVER_KEYS = ['cover_url', 'cover2_url', 'cover3_url'];

export default function StoreTab() {
  const [f, setF] = useState(null);
  // Hanggang 3 cover photo. Bawat slot: undefined = walang pagbabago, data URL = bago, '' = alisin
  const [covers, setCovers] = useState({ cover_url: undefined, cover2_url: undefined, cover3_url: undefined });
  const [logo, setLogo] = useState(undefined);     // bagong logo (data URL, '' = alisin)
  const [error, setError] = useState('');
  // Lokasyon ng tindahan: munisipyo, barangay, street at map pin (pareho ng sa delivery)
  const [loc, setLoc] = useState({ province: '', muniCode: '', municipality: '', barangay: '', street: '', lat: '', lng: '' });
  useEffect(() => {
    api('/store').then((d) => { setF(d); setLoc((l) => ({ ...l, lat: d.lat ?? '', lng: d.lng ?? '' })); }).catch((e) => setError(e.message));
  }, []);
  if (!f) return error ? <div className="err">{error}</div> : <div className="empty">Loading…</div>;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pickCover = (key) => async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const url = await fileToDataUrl(file, { maxSide: 1400 }); setCovers((c) => ({ ...c, [key]: url })); }
    catch (err) { setError(err.message); }
    e.target.value = '';
  };
  async function pickLogo(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try { setLogo(await fileToDataUrl(file, { maxSide: 400 })); } catch (err) { setError(err.message); }
  }
  // Kapag pumili ng munisipyo/barangay, awtomatikong mapupunan ang Address (puwede pa ring i-edit)
  function patchLoc(p) {
    const n = { ...loc, ...p };
    setLoc(n);
    if (n.municipality && n.barangay) {
      setF((x) => ({ ...x, address: [n.street.trim(), `Brgy. ${n.barangay}`, n.municipality, n.province].filter(Boolean).join(', ').slice(0, 255) }));
    }
  }
  async function save(e) {
    e.preventDefault(); setError('');
    if (!(await confirmDialog({ title: 'Save store info?', message: 'Customers will see these changes.', confirmText: 'Yes, save', icon: 'fa-floppy-disk' }))) return;
    const body = { name: f.name, tagline: f.tagline ?? '', about: f.about ?? '', address: f.address ?? '', phone: f.phone ?? '',
      shipping_fee: f.shipping_fee === '' || f.shipping_fee == null ? 0 : f.shipping_fee,
      lat: loc.lat === '' ? null : loc.lat, lng: loc.lng === '' ? null : loc.lng };
    for (const k of COVER_KEYS) if (covers[k] !== undefined) body[k] = covers[k];
    if (logo !== undefined) body.logo_url = logo;
    try { const saved = await api('/store', { method: 'PATCH', body }); setF(saved); setLoc((l) => ({ ...l, lat: saved.lat ?? '', lng: saved.lng ?? '' })); setCovers({ cover_url: undefined, cover2_url: undefined, cover3_url: undefined }); setLogo(undefined); window.dispatchEvent(new Event('store-updated')); notify('Store info saved.'); }
    catch (err) { setError(err.message); }
  }

  const shownCover = (k) => (covers[k] === undefined ? img(f[k]) : covers[k]);   // '' = tinanggal
  const shownLogo = logo === undefined ? img(f.logo_url) : logo;   // '' = tinanggal
  return (
    <form className="box" onSubmit={save} style={{ maxWidth: 640 }}>
      <div className="field"><label>Store name</label><input value={f.name ?? ''} onChange={set('name')} maxLength={100} required /></div>
      <div className="field"><label>Tagline</label><input value={f.tagline ?? ''} onChange={set('tagline')} maxLength={120} /></div>
      <div className="field"><label>About</label><textarea rows={4} value={f.about ?? ''} onChange={set('about')} maxLength={1000} /></div>
      <div className="two">
        <div className="field"><label>Address</label><input value={f.address ?? ''} onChange={set('address')} maxLength={255} /></div>
        <div className="field"><label>Phone</label><input value={f.phone ?? ''} onChange={set('phone')} maxLength={30} /></div>
      </div>
      <div className="field"><label>Delivery shipping fee (₱)</label>
        <input type="number" min="0" max="100000" step="0.01" value={f.shipping_fee ?? 0} onChange={set('shipping_fee')} style={{ maxWidth: 200 }} />
        <small className="muted">Added to the total of delivery orders. Enter 0 for free delivery. Pickup orders have no shipping fee.</small>
      </div>
      <div className="field"><label>Pickup location</label>
        <small className="muted">Choose your municipality and barangay, then adjust the pin. Customers who choose Pickup will see this.</small>
      </div>
      <DeliveryFields value={loc} onChange={patchLoc} required={false}
                      streetLabel="House no. / Street / Landmark (optional)" streetPlaceholder="e.g. Rizal St., near the chapel"
                      mapLabel="Store pin on the map" mapAria="Map: click or drag the pin to your store location" />
      {loc.lat !== '' && <button type="button" className="ghost-btn" style={{ marginTop: 6 }} onClick={() => setLoc((l) => ({ ...l, lat: '', lng: '' }))}>Remove pin</button>}
      <div className="field"><label>Logo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div className="logo-preview">{shownLogo ? <img src={shownLogo} alt="" /> : <span><i className="fa-solid fa-basket-shopping" aria-hidden="true" /></span>}</div>
          <div>
            <input type="file" accept="image/*" onChange={pickLogo} />
            {shownLogo && <button type="button" className="ghost-btn" style={{ marginTop: 8 }} onClick={async () => (await confirmDialog({ title: 'Remove logo?', confirmText: 'Yes, remove', danger: true })) && setLogo('')}>Remove logo</button>}
          </div>
        </div>
      </div>
      <div className="field"><label>Cover photos (up to 3)</label>
        <div className="cover-slots">
          {COVER_KEYS.map((k, i) => {
            const shown = shownCover(k);
            return (
              <div className="cover-slot" key={k}>
                <div className="cover-thumb">{shown ? <img src={shown} alt="" /> : <span><i className="fa-solid fa-image" aria-hidden="true" /></span>}</div>
                <small className="muted">Photo {i + 1}</small>
                <input type="file" accept="image/*" onChange={pickCover(k)} />
                {shown && <button type="button" className="ghost-btn" onClick={async () => (await confirmDialog({ title: 'Remove this photo?', confirmText: 'Yes, remove', danger: true })) && setCovers((c) => ({ ...c, [k]: '' }))}>Remove</button>}
              </div>
            );
          })}
        </div>
      </div>
      {error && <div className="err">{error}</div>}
      <button className="btn sm" style={{ marginTop: 18 }}>Save</button>
    </form>
  );
}

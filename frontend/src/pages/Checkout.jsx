import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, session, API_BASE } from '../api.js';
import { enqueue } from '../offlineQueue.js';
import { peso } from '../format.js';
import { useCart } from '../cart.jsx';
import { useAuth } from '../auth.jsx';
import DeliveryFields from '../components/DeliveryFields.jsx';
import PickupInfo from '../components/PickupInfo.jsx';

export default function Checkout() {
  const { items, total, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ customer_name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim(), customer_phone: user?.phone ?? '', fulfillment: 'pickup', notes: '',
    province: '', muniCode: '', municipality: '', barangay: '', street: '', lat: '', lng: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [store, setStore] = useState(undefined);     // para sa pickup location
  // Unique na susi ng order na ito: kapag naulit ang pagpapadala (offline sync, double click), hindi magdodoble ang order
  const orderKey = useRef(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
  useEffect(() => { api('/store').then(setStore).catch(() => setStore(null)); }, []);
  // Ang mobile number na inilagay sa sign-up ay kusang ilalagay dito (hindi ito papalitan kung may tinype na ang customer)
  const phoneTouched = useRef(false);
  useEffect(() => {
    api('/auth/me').then((m) => {
      const p = m?.phone ?? m?.user?.phone;
      if (p && !phoneTouched.current) setF((x) => (x.customer_phone ? x : { ...x, customer_phone: p }));
    }).catch(() => {});
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const patch = (p) => setF((x) => ({ ...x, ...p }));   // ligtas kahit sunod-sunod ang update (mapa + dropdown)

  if (!items.length) return <Navigate to="/cart" replace />;
  const shipping = f.fulfillment === 'delivery' ? Number(store?.shipping_fee ?? 0) : 0;   // ang server pa rin ang magpapasya ng huling fee
  const grand = total + shipping;

  async function submit(e) {
    e.preventDefault(); setError('');
    const delivery = f.fulfillment === 'delivery';
    if (delivery && f.lat === '') { setError('Please pin your delivery location on the map.'); return; }
    setBusy(true);
    const body = {
        customer_name: f.customer_name, customer_phone: f.customer_phone, fulfillment: f.fulfillment, notes: f.notes,
        items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
        client_key: orderKey.current,
        ...(delivery && { province: f.province, municipality: f.municipality, barangay: f.barangay, street: f.street, lat: f.lat, lng: f.lng }),
    };
    try {
      await api('/orders', { method: 'POST', body });
      clear();
      nav('/my-orders?placed=1', { replace: true });
    } catch (err) {
      // Walang internet: i-save muna sa device at ipapadala pagbalik ng internet
      const token = session.get()?.token;
      if (err.offline && token) {
        try {
          await enqueue({
            url: `${API_BASE}/api/orders`, method: 'POST', token, body: JSON.stringify(body), kind: 'order',
            meta: { fulfillment: f.fulfillment, shipping, total: grand, items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })) },
          });
          clear();
          nav('/my-orders?queued=1', { replace: true });
          return;
        } catch { /* hindi na-save: ipakita ang error sa ibaba */ }
      }
      setError(err.offline ? "You're offline and we couldn't save your order on this device. Please try again." : err.message);
    } finally { setBusy(false); }
  }

  return (
    <main className="page"><div className="wrap">
      <h1>Check<span className="accent">out</span></h1>
      <form className="layout" onSubmit={submit}>
        <div className="box">
          <div className="two">
            <div className="field" style={{ marginTop: 0 }}><label>Your name</label><input required value={f.customer_name} onChange={set('customer_name')} /></div>
            <div className="field" style={{ marginTop: 0 }}><label>Mobile number</label><input required value={f.customer_phone} onChange={(e) => { phoneTouched.current = true; set('customer_phone')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 11) } }); }} inputMode="tel" maxLength={11} pattern="09[0-9]{9}" title="Start with 09 and use 11 digits (e.g. 09123456789)" placeholder="09123456789" autoComplete="tel" /></div>
          </div>
          <div className="field"><label>How will you receive it?</label>
            <div className="radio-row">
              {[['pickup', 'Pickup'], ['delivery', 'Delivery']].map(([v, l]) => (
                <label key={v} className={f.fulfillment === v ? 'on' : ''}>
                  <input type="radio" name="ful" checked={f.fulfillment === v} onChange={() => setF({ ...f, fulfillment: v })} /> {l}
                </label>
              ))}
            </div>
          </div>
          {f.fulfillment === 'pickup' && (
            <div className="field"><label>Pick up at</label>
              <div className="box" style={{ background: 'var(--brand-soft)' }}><PickupInfo store={store} /></div>
            </div>
          )}
          {f.fulfillment === 'delivery' && <DeliveryFields value={f} onChange={patch} />}
          <div className="field"><label>Notes (optional)</label><textarea rows={3} value={f.notes} onChange={set('notes')} /></div>
          {error && <div className="err" role="alert">{error}</div>}
        </div>
        <aside className="box">
          {items.map((i) => <div className="sum" key={i.id}><span>{i.quantity} × {i.name}</span><span>{peso(i.price * i.quantity)}</span></div>)}
          <div className="sum"><span>Subtotal</span><span>{peso(total)}</span></div>
          {f.fulfillment === 'delivery' && <div className="sum"><span>Shipping fee</span><span>{shipping > 0 ? peso(shipping) : 'Free'}</span></div>}
          <div className="sum total"><span>Total</span><span>{peso(grand)}</span></div>
          <button className="btn block" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Placing order…' : 'Place order'}</button>
          <p className="muted center" style={{ fontSize: '.85rem' }}>Final prices and stock are confirmed by the store.</p>
        </aside>
      </form>
    </div></main>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLive } from '../realtime.jsx';
import { peso, when, statusOf } from '../format.js';
import PickupInfo from '../components/PickupInfo.jsx';
import { listOrders, dismissQueued } from '../offlineQueue.js';

export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [sp] = useSearchParams();
  const [store, setStore] = useState(undefined);
  const [queued, setQueued] = useState([]);       // mga order na naka-save sa device, naghihintay ng internet
  const [offErr, setOffErr] = useState(false);
  useEffect(() => { api('/store').then(setStore).catch(() => setStore(null)); }, []);

  const load = useCallback(() => api('/orders/mine')
    .then((d) => { setOrders(d); setError(''); setOffErr(false); })
    .catch((e) => { setError(e.message); setOffErr(!!e.offline); }), []);
  const loadQueued = useCallback(() => listOrders().then(setQueued), []);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    loadQueued();
    const onChange = () => { loadQueued(); load(); };   // may nag-sync o nagbalik ng internet: i-refresh
    window.addEventListener('ph-queue-change', onChange);
    window.addEventListener('online', onChange);
    return () => { window.removeEventListener('ph-queue-change', onChange); window.removeEventListener('online', onChange); };
  }, [loadQueued, load]);   // 60s lang bilang backup
  useLive(['order:status', 'resync'], load);   // real-time: agad kapag nag-update ang may-ari

  return (
    <main className="page"><div className="wrap" style={{ maxWidth: 820 }}>
      <h1>My <span className="accent">orders</span></h1>
      {sp.get('placed') && <div className="box" style={{ background: 'var(--brand-soft)', marginBottom: 18 }}>Order placed! We'll show your order code here once it's Ready.</div>}
      {sp.get('queued') && <div className="box" style={{ background: 'var(--brand-soft)', marginBottom: 18 }}>Order saved! It will be placed automatically when you're back online.</div>}
      {queued.map((q) => (
        <div className="box" key={q.id} style={{ marginBottom: 16, borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <b>Waiting to be placed</b>
            <span className={`status ${q.failed ? 'cancelled' : 'pending'}`}>{q.failed ? 'Not placed' : 'Waiting for internet'}</span>
          </div>
          <div className="muted" style={{ fontSize: '.88rem' }}>{when(q.ts)} · {q.meta?.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}</div>
          <div style={{ marginTop: 10 }}>
            {q.meta?.items?.map((it, i) => <div className="sum" key={i}><span>{it.quantity} × {it.name}</span><span>{peso(it.price * it.quantity)}</span></div>)}
            {q.meta?.shipping > 0 && <div className="sum"><span>Shipping fee</span><span>{peso(q.meta.shipping)}</span></div>}
            <div className="sum total"><span>Total (estimate)</span><span>{peso(q.meta?.total ?? 0)}</span></div>
          </div>
          {q.failed ? (
            <>
              <div className="err" role="alert" style={{ marginTop: 10 }}>{q.failed}</div>
              <button className="ghost-btn" style={{ marginTop: 8 }} onClick={() => dismissQueued(q.id)}>Dismiss</button>
            </>
          ) : <p className="muted" style={{ marginBottom: 0 }}>Saved on this device. It will be placed automatically when you're back online. Final prices and stock are confirmed by the store.</p>}
        </div>
      ))}
      {error && (offErr
        ? <div className="muted" style={{ marginBottom: 14 }}>You're offline. Your placed orders will show again when you're back online.</div>
        : <div className="err">{error}</div>)}
      {orders === null && !error && <div className="empty">Loading…</div>}
      {orders?.length === 0 && queued.length === 0 && <div className="empty">No orders yet. <Link to="/products" className="accent">Start shopping</Link></div>}
      {orders?.map((o) => (
        <div className="box" key={o.id} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <b>Order #{o.id}</b>
            <span className={`status ${o.status}`}>{statusOf(o.status, o.fulfillment).label}</span>
          </div>
          <div className="muted" style={{ fontSize: '.88rem' }}>{when(o.created_at)} · {o.fulfillment === 'delivery' ? `Delivery to ${o.address}` : 'Pickup'}
            {o.fulfillment === 'delivery' && o.delivery_lat && <> · <a className="accent" href={`https://www.openstreetmap.org/?mlat=${o.delivery_lat}&mlon=${o.delivery_lng}#map=17/${o.delivery_lat}/${o.delivery_lng}`} target="_blank" rel="noreferrer">View pin</a></>}</div>
          <div style={{ marginTop: 10 }}>
            {o.items.map((it, i) => <div className="sum" key={i}><span>{it.quantity} × {it.name}</span><span>{peso(it.unit_price * it.quantity)}</span></div>)}
            {o.fulfillment === 'delivery' && <div className="sum"><span>Shipping fee</span><span>{Number(o.shipping_fee) > 0 ? peso(o.shipping_fee) : 'Free'}</span></div>}
            <div className="sum total"><span>Total</span><span>{peso(o.total)}</span></div>
          </div>
          {o.fulfillment === 'pickup' && ['pending', 'preparing', 'ready'].includes(o.status) && (
            <div style={{ marginTop: 12 }}><div className="muted" style={{ fontSize: '.85rem', marginBottom: 4 }}>Pick up at</div><PickupInfo store={store} showMap={o.status === 'ready'} /></div>
          )}
          <p className="muted" style={{ marginBottom: 0 }}>{statusOf(o.status, o.fulfillment).hint}</p>
          {o.code && <div className="codebox">Your order code<b>{o.code}</b></div>}
        </div>
      ))}
    </div></main>
  );
}

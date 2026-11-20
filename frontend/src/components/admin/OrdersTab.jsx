import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useLive } from '../../realtime.jsx';
import { notify } from '../../notice.jsx';
import { peso, when, STATUS, statusOf } from '../../format.js';

const FILTERS = ['all', 'pending', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];
// Susunod na hakbang ng bawat status. Delivery: Ready -> Out for delivery -> Completed. Pickup: Ready for pickup -> Completed.
const NEXT_PICKUP = { pending: 'preparing', preparing: 'ready', ready: 'completed' };
const NEXT_DELIVERY = { pending: 'preparing', preparing: 'ready', ready: 'out_for_delivery', out_for_delivery: 'completed' };
const nextOf = (o) => (o.fulfillment === 'delivery' ? NEXT_DELIVERY : NEXT_PICKUP)[o.status];

export default function OrdersTab() {
  const [filter, setFilter] = useState('pending');
  const [orders, setOrders] = useState(null);
  const [open, setOpen] = useState(null);      // binuksang order (detalye)
  const [error, setError] = useState('');

  const load = () => api(`/orders${filter === 'all' ? '' : `?status=${filter}`}`)
    .then((d) => { setOrders(d); setError(''); }).catch((e) => setError(e.message));

  useEffect(() => { setOrders(null); load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [filter]); // eslint-disable-line
  useLive(['order:new', 'resync'], load);   // real-time: agad kapag may bagong order

  async function show(id) {
    if (open?.id === id) return setOpen(null);
    try { setOpen(await api(`/orders/${id}`)); } catch (e) { setError(e.message); }
  }
  async function setStatus(id, status) {
    if (status === 'cancelled' && !window.confirm('Cancel this order? The stock will be returned.')) return;
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
      notify(`Order #${id} → ${statusOf(status, open?.fulfillment).label}`);
      setOpen(await api(`/orders/${id}`));
      load();
    } catch (e) { setError(e.message); }
  }

  return (
    <>
      <div className="chips" style={{ marginBottom: 18 }}>
        {FILTERS.map((f) => <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : STATUS[f].label}</button>)}
      </div>
      {error && <div className="err">{error}</div>}
      {orders === null && !error && <div className="empty">Loading…</div>}
      {orders?.length === 0 && <div className="empty">No orders here.</div>}
      {orders?.map((o) => (
        <div className="box" key={o.id} style={{ marginBottom: 14 }}>
          <div className="row-between" onClick={() => show(o.id)} style={{ cursor: 'pointer' }}>
            <div><b>Order #{o.id}</b> · {o.customer_name}<div className="muted" style={{ fontSize: '.88rem' }}>{when(o.created_at)} · {o.item_count} item(s) · {o.fulfillment} · {peso(o.total)}</div></div>
            <span className={`status ${o.status}`}>{statusOf(o.status, o.fulfillment).label}</span>
          </div>
          {open?.id === o.id && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontSize: '.9rem' }}>📞 {open.customer_phone}{open.fulfillment === 'delivery' && ` · 📍 ${open.address}`}</div>
              {open.fulfillment === 'delivery' && open.delivery_lat && (
                <div style={{ fontSize: '.9rem', marginTop: 4 }}>
                  <a className="accent" href={`https://www.google.com/maps/dir/?api=1&destination=${open.delivery_lat},${open.delivery_lng}`} target="_blank" rel="noreferrer">🧭 Open directions</a>
                  {' · '}
                  <a className="accent" href={`https://www.openstreetmap.org/?mlat=${open.delivery_lat}&mlon=${open.delivery_lng}#map=17/${open.delivery_lat}/${open.delivery_lng}`} target="_blank" rel="noreferrer">View pin on map</a>
                </div>
              )}
              {open.notes && <div className="muted" style={{ fontSize: '.9rem' }}>📝 {open.notes}</div>}
              <div style={{ margin: '10px 0' }}>
                {open.items.map((it, i) => <div className="sum" key={i}><span>{it.quantity} × {it.name}</span><span>{peso(it.unit_price * it.quantity)}</span></div>)}
                {open.fulfillment === 'delivery' && <div className="sum"><span>Shipping fee</span><span>{Number(open.shipping_fee) > 0 ? peso(open.shipping_fee) : 'Free'}</span></div>}
                <div className="sum total"><span>Total</span><span>{peso(open.total)}</span></div>
              </div>
              {['ready', 'out_for_delivery', 'completed'].includes(open.status) && <div className="codebox">Order code<b>{open.code}</b></div>}
              <div className="row-gap" style={{ marginTop: 12 }}>
                {nextOf(open) && <button className="btn sm" onClick={() => setStatus(open.id, nextOf(open))}>Mark as {statusOf(nextOf(open), open.fulfillment).label}</button>}
                {['pending', 'preparing', 'ready', 'out_for_delivery'].includes(open.status) && <button className="ghost-btn danger" onClick={() => setStatus(open.id, 'cancelled')}>Cancel order</button>}
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

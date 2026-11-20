import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLive } from '../realtime.jsx';
import { peso, when, STATUS } from '../format.js';

// History: mga order na tapos na (Completed) o na-cancel (Cancelled)
export default function History() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [show, setShow] = useState('all');   // all | completed | cancelled

  const load = useCallback(() => api('/orders/mine')
    .then((all) => setOrders(all.filter((o) => ['completed', 'cancelled'].includes(o.status))))
    .catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useLive(['order:status', 'resync'], load);

  const list = orders?.filter((o) => show === 'all' || o.status === show);

  return (
    <main className="page"><div className="wrap" style={{ maxWidth: 820 }}>
      <h1><span className="accent">History</span></h1>
      <div className="chips" style={{ margin: '18px 0 20px' }}>
        {[['all', 'All'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([k, label]) => (
          <button key={k} className={`chip ${show === k ? 'on' : ''}`} onClick={() => setShow(k)}>{label}</button>
        ))}
      </div>
      {error && <div className="err">{error}</div>}
      {orders === null && !error && <div className="empty">Loading…</div>}
      {list?.length === 0 && <div className="empty">Nothing here yet. Your finished orders will show up here. <Link to="/my-orders" className="accent">See active orders</Link></div>}
      {list?.map((o) => (
        <div className="box" key={o.id} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <b>Order #{o.id}</b>
            <span className={`status ${o.status}`}>{STATUS[o.status].label}</span>
          </div>
          <div className="muted" style={{ fontSize: '.88rem' }}>{when(o.created_at)} · {o.fulfillment === 'delivery' ? `Delivery to ${o.address}` : 'Pickup'}</div>
          <div style={{ marginTop: 10 }}>
            {o.items.map((it, i) => <div className="sum" key={i}><span>{it.quantity} × {it.name}</span><span>{peso(it.unit_price * it.quantity)}</span></div>)}
            <div className="sum total"><span>Total</span><span>{peso(o.total)}</span></div>
          </div>
        </div>
      ))}
    </div></main>
  );
}

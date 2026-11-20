import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useLive } from '../../realtime.jsx';
import { peso } from '../../format.js';
import './dashboard.css';

const CARDS = [
  ['pending', 'Pending'],
  ['preparing', 'Preparing'],
  ['ready', 'Ready'],
  ['out_for_delivery', 'Out for delivery'],
  ['completed', 'Completed'],
];

export default function DashboardTab() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/summary').then((x) => { setD(x); setError(''); }).catch((e) => setError(e.message));
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useLive(['order:new', 'resync'], load);   // agad mag-update kapag may bagong order

  if (error) return <p className="error">{error}</p>;
  if (!d) return <p>Loading…</p>;

  const max = Math.max(1, ...d.week.map((x) => x.sales));

  return (
    <div>
      <div className="dash-grid">
        <div className="dash-card"><span>Sales today</span><b>{peso(d.today.sales)}</b></div>
        <div className="dash-card"><span>Orders today</span><b>{d.today.orders}</b></div>
        {CARDS.map(([k, label]) => (
          <div className="dash-card" key={k}><span>{label}</span><b>{d.by_status[k]}</b></div>
        ))}
      </div>

      <div className="dash-card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Sales — last 7 days</h3>
        <div className="dash-bars">
          {d.week.map((x) => (
            <div key={x.day} title={`${x.day}: ${peso(x.sales)}`}>
              <i style={{ height: `${(x.sales / max) * 100}%` }} />
              <span>{x.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-two">
        <div className="dash-card">
          <h3>Best sellers</h3>
          {d.top_products.length === 0 ? <p>No sales yet.</p> : (
            <ul className="dash-list">
              {d.top_products.map((p) => <li key={p.name}><span>{p.name}</span><b>{p.sold} sold</b></li>)}
            </ul>
          )}
        </div>
        <div className="dash-card">
          <h3>Low stock (≤ {d.low_stock_limit})</h3>
          {d.low_stock.length === 0 ? <p>All products have enough stock.</p> : (
            <ul className="dash-list">
              {d.low_stock.map((p) => <li key={p.id}><span>{p.name}</span><b>{p.stock} left</b></li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

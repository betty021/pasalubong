import { img } from '../api.js';
import { peso } from '../format.js';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { useAuth } from '../auth.jsx';
import { notify } from '../notice.jsx';

export default function ProductCard({ p }) {
  const { add, setQty: setCartQty } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const out = p.stock < 1;
  // Ilang piraso ang bibilhin (hindi lalampas sa natitirang stock). Puwedeng pindutin ang − / + o i-type mismo.
  const [qty, setQty] = useState(1);
  const q = Math.min(Math.max(1, Number(qty) || 1), Math.max(1, p.stock));
  return (
    <article className="card">
      <div className="pic">{p.image_url ? <img src={img(p.image_url)} alt={p.name} loading="lazy" /> : <div className="ph"><i className="fa-solid fa-basket-shopping" aria-hidden="true" /></div>}</div>
      <div className="body">
        {p.category_name && <span className="cat">{p.category_name}</span>}
        <h3>{p.name}</h3>
        {p.description && <span className="muted" style={{ fontSize: '.88rem' }}>{p.description.slice(0, 70)}{p.description.length > 70 ? '…' : ''}</span>}
        <div className="price">{peso(p.price)} {p.unit && <small>/ {p.unit}</small>}</div>
        {user && !out && (
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: '.88rem' }}>Quantity</span>
            <div className="qty">
              <button type="button" aria-label="Less" disabled={q <= 1} onClick={() => setQty(q - 1)}>−</button>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={qty} aria-label="Quantity"
                style={{ width: 44, height: 32, padding: 0, margin: 0, border: 0, borderRadius: 0, boxShadow: 'none', outline: 'none', background: 'none', textAlign: 'center', font: 'inherit', fontWeight: 700 }}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setQty(v === '' ? '' : Math.min(p.stock, Math.max(1, parseInt(v, 10)))); }}
                onFocus={(e) => e.target.select()}
                onBlur={() => setQty(q)}
              />
              <button type="button" aria-label="More" disabled={q >= p.stock} onClick={() => setQty(q + 1)}>+</button>
            </div>
          </div>
        )}
        <div className="row">
          {out ? <span className="soldout">Sold out</span>
            : p.stock <= 5 ? <span className="lowstock">Only {p.stock} left</span> : <span />}
          {user
            ? <span className="row-gap" style={{ gap: 6 }}>
                <button className="ghost-btn" style={{ padding: '6px 12px', fontSize: '.85rem' }} disabled={out}
                  onClick={() => { add(p, q); setCartQty(p.id, q); nav('/checkout'); }}>Buy now</button>
                <button className="btn sm" disabled={out} onClick={() => { add(p, q); setQty(1); notify(q > 1 ? `Added ${q} to cart` : 'Added to cart'); }}>Add to cart</button>
              </span>
            : <Link to="/login?next=/products" className="btn sm">Log in to order</Link>}
        </div>
      </div>
    </article>
  );
}

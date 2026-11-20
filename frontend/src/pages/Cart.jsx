import { Link, useNavigate } from 'react-router-dom';
import { img } from '../api.js';
import { peso } from '../format.js';
import { useCart } from '../cart.jsx';
import { useAuth } from '../auth.jsx';
import { confirmDialog } from '../notice.jsx';

export default function Cart() {
  const { items, setQty, remove, total } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();

  if (!items.length) return (
    <main className="page"><div className="wrap empty">
      <h1>Your cart is empty</h1>
      <p>Find something nice to bring home.</p>
      <Link to="/products" className="btn">Browse products <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
    </div></main>
  );

  return (
    <main className="page"><div className="wrap">
      <h1>Your <span className="accent">cart</span></h1>
      <div className="layout">
        <div className="box">
          {items.map((i) => (
            <div className="line" key={i.id}>
              <div className="thumb">{i.image_url ? <img src={img(i.image_url)} alt="" /> : <div className="ph"><i className="fa-solid fa-basket-shopping" aria-hidden="true" /></div>}</div>
              <div className="info"><b>{i.name}</b><div className="muted">{peso(i.price)}{i.unit ? ` / ${i.unit}` : ''}</div></div>
              <div className="qty">
                <button onClick={() => setQty(i.id, i.quantity - 1)} aria-label="Less">−</button>
                <span>{i.quantity}</span>
                <button onClick={() => setQty(i.id, i.quantity + 1)} aria-label="More" disabled={i.quantity >= i.stock}>+</button>
              </div>
              <b style={{ minWidth: 90, textAlign: 'right' }}>{peso(i.price * i.quantity)}</b>
              <button className="ghost-btn danger" onClick={async () => (await confirmDialog({ title: 'Remove from cart?', message: `Remove "${i.name}" from your cart?`, confirmText: 'Yes, remove', danger: true })) && remove(i.id)} aria-label="Remove"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
          ))}
        </div>
        <aside className="box">
          <div className="sum"><span>Subtotal</span><span>{peso(total)}</span></div>
          <div className="sum total"><span>Total</span><span>{peso(total)}</span></div>
          <button className="btn block" style={{ marginTop: 16 }}
            onClick={() => nav(user?.role === 'customer' ? '/checkout' : '/login?next=/checkout')}>
            {user?.role === 'customer' ? 'Checkout' : 'Log in to checkout'}
          </button>
        </aside>
      </div>
    </div></main>
  );
}

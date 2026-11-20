import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, img } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Home() {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api('/store').then(setStore).catch(() => {});
    api('/products').then(setProducts).catch(() => {});
  }, []);

  // 3 cover photo ng admin: arch + 2 polaroid. Kung wala pang 2nd/3rd, larawan ng produkto muna ang ipapalit.
  const prodPics = products.filter((p) => p.image_url).map((p) => p.image_url);
  const polaroid = [store?.cover2_url || prodPics[0], store?.cover3_url || prodPics[1]];

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <h1>Authentic pasalubong from <span className="accent">local sellers</span>, made easy for you.</h1>
            <p>{store?.about || "Browse food, dried goods and handicrafts from the province's local businesses, add them to your cart, and check out in one simple step. No long messages, no guessing."}</p>
            <div className="stats">
              <div><b>{products.length}</b><span>Products</span></div>
              <div><b>2</b><span>Ways to receive</span></div>
              <div><b>Easy</b><span>Checkout</span></div>
            </div>
          </div>
          <div className="collage">
            <div className="arch">{store?.cover_url ? <img src={img(store.cover_url)} alt="" /> : null}</div>
            <div className="polaroid a">{polaroid[0] ? <img src={img(polaroid[0])} alt="" /> : <div className="ph"><i className="fa-solid fa-cake-candles" aria-hidden="true" /></div>}</div>
            <div className="polaroid b">{polaroid[1] ? <img src={img(polaroid[1])} alt="" /> : <div className="ph"><i className="fa-solid fa-cookie-bite" aria-hidden="true" /></div>}</div>
          </div>
        </div>
      </section>

      <section className="section" id="about">
        <div className="wrap">
          <h2>About <span className="accent">{store?.name || 'PasalubongHub'}</span></h2>
          <p className="muted" style={{ maxWidth: 680, fontSize: '1.05rem' }}>
            {store?.tagline || 'Pasalubong from the province, all in one place.'} We bring together food, dried goods and handicrafts
            from local businesses so you can order easily and take home the real taste of the province.
            {store?.address && <> Find us at {store.address}.</>}
          </p>
        </div>
      </section>

      <section className="section" id="features">
        <div className="wrap">
          <h2>Why <span className="accent">PasalubongHub</span></h2>
          <div className="steps">
            <div className="step"><div className="n"><i className="fa-solid fa-bag-shopping" aria-hidden="true" /></div><h3>Local products</h3><p>Food, dried goods and handicrafts from the province's local sellers.</p></div>
            <div className="step"><div className="n"><i className="fa-solid fa-bolt" aria-hidden="true" /></div><h3>One-step checkout</h3><p>Add to cart and check out. No long messages, no guessing.</p></div>
            <div className="step"><div className="n"><i className="fa-solid fa-store" aria-hidden="true" /></div><h3>Pickup or delivery</h3><p>Choose how you receive your order.</p></div>
            <div className="step"><div className="n"><i className="fa-solid fa-bell" aria-hidden="true" /></div><h3>Order tracking</h3><p>See when your order is being prepared and when it's Ready.</p></div>
            <div className="step"><div className="n"><i className="fa-solid fa-key" aria-hidden="true" /></div><h3>Order code</h3><p>When your order is Ready, show your code to the store.</p></div>
            <div className="step"><div className="n"><i className="fa-solid fa-user-plus" aria-hidden="true" /></div><h3>Free account</h3><p>Sign up in seconds, no approval needed.</p></div>
          </div>
        </div>
      </section>

      <section className="section" id="products">
        <div className="wrap">
          <div className="section-head">
            <h2>Our <span className="accent">products</span></h2>
            <Link to="/login?next=/products" className="ghost-btn">Log in to see all</Link>
          </div>
          {products.length === 0
            ? <div className="empty">Products are coming soon.</div>
            : <div className="grid">{products.slice(0, 8).map((p) => <ProductCard key={p.id} p={p} />)}</div>}
          <p className="muted center" style={{ marginTop: 28 }}>
            Want to order? <Link to="/register" className="accent">Create a free account</Link> or <Link to="/login" className="accent">log in</Link>.
          </p>
        </div>
      </section>
    </>
  );
}

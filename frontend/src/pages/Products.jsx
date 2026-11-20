import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Products() {
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/categories').then(setCats).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (cat) p.set('category_id', cat);
      if (q.trim()) p.set('q', q.trim());
      api(`/products?${p}`).then((d) => { setList(d); setError(''); }).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [cat, q]);

  return (
    <main className="page"><div className="wrap">
      <h1>Our <span className="accent">products</span></h1>
      <div className="toolbar">
        <input className="search" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="cat-select" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}
                style={{ flex: '1 1 180px', maxWidth: 260, width: 'auto' }}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>
      {error && <div className="err">{error}</div>}
      {list === null && !error && <div className="empty">Loading…</div>}
      {list?.length === 0 && <div className="empty">No products found.</div>}
      {list?.length > 0 && <div className="grid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
    </div></main>
  );
}

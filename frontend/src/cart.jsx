import { createContext, useContext, useEffect, useState } from 'react';

// Cart ay nasa browser lang. Presyo at stock ay muling sinusuri ng server sa checkout.
const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);
const KEY = 'pasalubong_cart';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ } }, [items]);

  // product = { id, name, price, unit, stock, image_url }
  const add = (product, qty = 1) => setItems((cur) => {
    const hit = cur.find((i) => i.id === product.id);
    const max = product.stock;
    if (hit) return cur.map((i) => (i.id === product.id ? { ...i, stock: max, quantity: Math.min(max, i.quantity + qty) } : i));
    return [...cur, { id: product.id, name: product.name, price: Number(product.price), unit: product.unit, stock: max, image_url: product.image_url, quantity: Math.min(max, qty) }];
  });
  const setQty = (id, q) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(i.stock, q)) } : i)));
  const remove = (id) => setItems((cur) => cur.filter((i) => i.id !== id));
  const clear = () => setItems([]);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.quantity * i.price, 0);

  return <Ctx.Provider value={{ items, add, setQty, remove, clear, count, total }}>{children}</Ctx.Provider>;
}

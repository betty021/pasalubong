import { enqueue, QUEUEABLE } from './offlineQueue.js';

const BASE = import.meta.env.VITE_API_URL || '';
export const API_BASE = BASE;
const KEY = 'pasalubong_session';

export const session = {
  // Admin: sessionStorage lang (kailangang mag-login ulit kapag isinara ang tab/browser o nagbukas ng bagong tab).
  // Customer: localStorage (nananatiling naka-login).
  get() {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY));
      if (s) return s;
      const l = JSON.parse(localStorage.getItem(KEY));
      if (l?.user?.role === 'admin') { localStorage.removeItem(KEY); return null; } // alisin ang lumang admin session
      return l;
    } catch { return null; }
  },
  set(s) {
    try {
      const store = s?.user?.role === 'admin' ? sessionStorage : localStorage;
      const other = store === sessionStorage ? localStorage : sessionStorage;
      other.removeItem(KEY);
      store.setItem(KEY, JSON.stringify(s));
    } catch { /* ignore */ }
  },
  clear() { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

// Ang larawan ay maaaring maikling link (/api/img/...) galing sa server
export const img = (u) => (u && u.startsWith('/api/') ? `${BASE}${u}` : u);

export async function api(path, { method = 'GET', body } = {}) {
  const s = session.get();
  let res;
  try {
    if (!navigator.onLine) throw new Error('offline');   // walang internet ang device: ituring na offline kahit abot pa ang localhost
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(s?.token ? { Authorization: `Bearer ${s.token}` } : {}),
        ...(s?.user?.role === 'admin' ? { 'X-No-Cache': '1' } : {}),   // huwag i-cache ang admin data
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Offline: ang mga simpleng "mark as read" ay ipinipila at ipapadala pagbalik ng internet
    if (method === 'POST' && s?.token && QUEUEABLE.some((re) => re.test(path))) {
      await enqueue({ url: `${BASE}/api${path}`, method, token: s.token, body: body ? JSON.stringify(body) : null }).catch(() => {});
      return { queued: true };
    }
    throw Object.assign(new Error('Cannot reach the server. Is the backend running?'), { offline: true });
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login' && s?.token) { session.clear(); window.location.assign('/login'); }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { code: data.code, data });
  return data;
}

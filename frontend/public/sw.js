// PasalubongHub service worker
//  - Offline: app shell + products/categories/store/images (stale-while-revalidate). HINDI naka-cache: login, orders, chat, admin.
//  - Background sync: nire-replay ang mga aksyong naka-queue habang offline (tingnan ang src/offlineQueue.js).
//  - Push notifications.
const V = 'v2';
const SHELL = `ph-shell-${V}`;
const ASSETS = `ph-assets-${V}`;
const DATA = `ph-data-${V}`;
const PUBLIC_API = [/^\/api\/products(\/\d+)?$/, /^\/api\/categories$/, /^\/api\/store$/, /^\/api\/img\//];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [SHELL, ASSETS, DATA];
    for (const k of await caches.keys()) if (k.startsWith('ph-') && !keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pahina (SPA): network muna, cache ng "/" kapag offline
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) caches.open(SHELL).then((c) => c.put('/', res.clone()));
      return res;
    }).catch(() => caches.match('/')));
    return;
  }

  // Vite assets (may hash sa pangalan) at mga icon: cache-first
  if (url.origin === location.origin && (url.pathname.startsWith('/assets/') || /^\/icon-.*\.png$/.test(url.pathname))) {
    e.respondWith(caches.open(ASSETS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Impormasyon ng tindahan (cover photos, logo): network muna para agad makita ang pagbabago ng admin; cache lang kapag offline
  if (url.pathname === '/api/store' && !req.headers.get('X-No-Cache')) {
    e.respondWith(caches.open(DATA).then(async (c) => {
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch {
        const hit = await c.match(req);
        if (hit) return hit;
        throw new Error('offline');
      }
    }));
    return;
  }

  // Public na datos: stale-while-revalidate. Lalaktawan ang request ng admin (X-No-Cache) at may ?archived
  const api = url.pathname.startsWith('/api/') && PUBLIC_API.some((re) => re.test(url.pathname));
  if (api && !req.headers.get('X-No-Cache') && !url.searchParams.has('archived')) {
    e.respondWith(caches.open(DATA).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; });
      if (hit) { net.catch(() => {}); return hit; }
      return net;
    }));
  }
});

// ---------- Background sync ----------
function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('ph-offline', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });

async function replay() {
  const db = await idb();
  const items = await new Promise((res, rej) => {
    const q = db.transaction('queue').objectStore('queue').getAll();
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
  let retry = false;
  for (const it of items) {
    if (it.failed) continue;                                       // natapos na (hindi natuloy), hinihintay lang ang customer
    try {
      const r = await fetch(it.url, { method: it.method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${it.token}` }, body: it.body });
      if (r.status >= 500) { retry = true; continue; }          // subukan ulit mamaya
      if (it.kind === 'order' && !r.ok) {
        // Tinanggihan ng server (hal. ubos na ang stock): itala ang dahilan para makita ng customer sa My Orders
        const j = await r.json().catch(() => ({}));
        const msg = r.status === 401 ? 'Your login expired. Please log in and place the order again.' : (j.error || 'The order could not be placed.');
        const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').put({ ...it, failed: msg }); await done(tx);
        await tell('order-failed', msg);
        continue;
      }
      const j = it.kind === 'order' ? await r.json().catch(() => ({})) : {};
      const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').delete(it.id); await done(tx);   // tagumpay o 4xx (wala nang saysay ulitin)
      if (it.kind === 'order' && !j.duplicate) await tell('order-placed');
    } catch { retry = true; }                                      // offline pa rin
  }
  await tell('queue-change');
  if (retry) throw new Error('retry');   // para i-retry ng browser
}

// Sabihan ang mga bukas na pahina; kung wala, magpakita ng notification (kung pinayagan)
async function tell(type, message) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of all) c.postMessage({ type: `ph-${type}`, message });
  if (type.startsWith('order') && !all.some((c) => c.visibilityState === 'visible')) {
    const title = type === 'order-placed' ? 'Order placed' : 'Order could not be placed';
    await self.registration.showNotification(title, {
      body: type === 'order-placed' ? 'Your offline order was placed. Salamat!' : message,
      icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/my-orders' },
    }).catch(() => {});
  }
}
self.addEventListener('sync', (e) => { if (e.tag === 'ph-replay') e.waitUntil(replay()); });

// ---------- Push ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'PasalubongHub', body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'PasalubongHub', {
    body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.focus(); if ('navigate' in c) await c.navigate(url).catch(() => {}); return; } }
    await self.clients.openWindow(url);
  })());
});

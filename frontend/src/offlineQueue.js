// Pila ng mga mababang-risk na aksyon (mark as read) na ginawa habang offline.
// Nire-replay ng service worker (Background Sync, Chromium) o ng pahina kapag bumalik ang internet (lahat ng browser).
// Kasama na ang CHECKOUT (kind: 'order'). Hindi ito magdodoble dahil may unique na client_key ang bawat order at ang server
// ang kumukuha ng presyo/stock. Kapag tinanggihan pagbalik ng internet (hal. ubos na ang stock), itatala ang dahilan (failed)
// at ipapakita sa My Orders. HINDI pa kasama ang chat message.
import { notify } from './notice.jsx';
function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('ph-offline', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });

export const QUEUEABLE = [/^\/notifications\/read-all$/, /^\/notifications\/\d+\/read$/, /^\/chat\/conversations\/\d+\/read$/];

// Ilan pa ang naghihintay na ma-sync (para sa indicator sa taas)
const getAll = (db) => new Promise((res, rej) => { const q = db.transaction('queue').objectStore('queue').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
export async function pendingCount() {
  try { return (await getAll(await open())).filter((x) => !x.failed).length; } catch { return 0; }
}
// Mga order na nakapila (kasama ang mga hindi natuloy, may "failed")
export async function listOrders() {
  try { return (await getAll(await open())).filter((x) => x.kind === 'order').sort((a, b) => b.ts - a.ts); } catch { return []; }
}
export async function dismissQueued(id) {
  const db = await open();
  const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').delete(id); await done(tx);
  changed();
}
const changed = () => window.dispatchEvent(new Event('ph-queue-change'));

export async function enqueue({ url, method, token, body, kind, meta }) {
  const db = await open();
  const tx = db.transaction('queue', 'readwrite');
  tx.objectStore('queue').add({ url, method, token, body: body ?? null, ts: Date.now(), ...(kind && { kind, meta }) });
  await done(tx);
  changed();
  try {
    // Huwag maghintay nang walang hanggan: kapag walang aktibong service worker (hal. `npm run dev`), hindi kailanman natatapos ang .ready
    const reg = await Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 1500))]);
    if (reg?.sync) await reg.sync.register('ph-replay');
  } catch { /* walang Background Sync: sasalo ang flush() */ }
}

let flushing = false;
export async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const db = await open();
    const items = (await getAll(db)).filter((x) => !x.failed);
    for (const it of items) {
      try {
        const r = await fetch(it.url, { method: it.method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${it.token}` }, body: it.body });
        if (r.status >= 500) continue;
        if (it.kind === 'order' && !r.ok) {
          // Tinanggihan ng server (hal. ubos na ang stock): itala ang dahilan, huwag ulitin, ipakita sa customer
          const j = await r.json().catch(() => ({}));
          const msg = r.status === 401 ? 'Your login expired. Please log in and place the order again.' : (j.error || 'The order could not be placed.');
          const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').put({ ...it, failed: msg }); await done(tx);
          notify(`Order could not be placed: ${msg}`, 7000, 'error');
          changed();
          continue;
        }
        const j = it.kind === 'order' ? await r.json().catch(() => ({})) : {};
        const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').delete(it.id); await done(tx);
        if (it.kind === 'order' && !j.duplicate) notify('Your offline order was placed. Salamat!', 4500);
        changed();
      } catch { break; }
    }
  } catch { /* ignore */ } finally { flushing = false; changed(); }
}

// Mensahe galing sa service worker (kapag siya ang nag-sync sa background)
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    const t = e.data?.type;
    if (t === 'ph-order-placed') notify('Your offline order was placed. Salamat!', 4500);
    else if (t === 'ph-order-failed') notify(`Order could not be placed: ${e.data.message}`, 7000, 'error');
    if (typeof t === 'string' && t.startsWith('ph-')) changed();
  });
}

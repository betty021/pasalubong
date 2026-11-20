import { useEffect, useRef, useState } from 'react';
import { flush, pendingCount } from '../offlineQueue.js';

// online / offline / syncing — para sa indicator sa taas
export function useConnection() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    const count = async () => { const n = await pendingCount(); if (alive) setPending(n); return n; };

    // Pagbalik ng internet: i-sync ang nakapila, tapos tingnan hanggang maubos
    const sync = async () => {
      setSyncing(true);
      await flush();
      let tries = 0;
      clearInterval(timer.current);
      timer.current = setInterval(async () => {
        const n = await count(); tries += 1;
        if (n === 0 || tries >= 6) { clearInterval(timer.current); if (alive) setSyncing(false); }
      }, 1200);
      await count();
    };
    const goOnline = () => { setOnline(true); sync(); };
    const goOffline = () => { setOnline(false); setSyncing(false); clearInterval(timer.current); };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('ph-queue-change', count);
    count();
    return () => {
      alive = false; clearInterval(timer.current);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('ph-queue-change', count);
    };
  }, []);

  return { online, pending, syncing };
}

// Maliit na pill sa top bar: Online (berde) · Syncing… (amber) · Offline (pula)
export default function ConnectionStatus() {
  const { online, pending, syncing } = useConnection();
  const state = !online ? 'off' : (syncing || pending > 0) ? 'sync' : 'on';
  const label = state === 'off' ? 'Offline' : state === 'sync' ? 'Syncing…' : 'Online';
  const title = state === 'off'
    ? `You're offline.${pending ? ` ${pending} action(s) will sync when you're back online.` : ''}`
    : state === 'sync' ? 'Back online — syncing your changes…' : 'You’re online. Everything is synced.';
  return (
    <span className={`conn ${state}`} role="status" aria-live="polite" title={title}>
      <i className={`fa-solid ${state === 'off' ? 'fa-plug-circle-xmark' : state === 'sync' ? 'fa-rotate fa-spin' : 'fa-wifi'}`} aria-hidden="true" />
      <span className="conn-txt">{label}</span>
      {pending > 0 && <b className="conn-n">{pending}</b>}
    </span>
  );
}

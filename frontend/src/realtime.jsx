import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, session } from './api.js';
import { useAuth } from './auth.jsx';

// Real-time gamit ang Server-Sent Events. fetch ang ginamit (hindi EventSource) para mailagay ang token
// sa Authorization header at hindi sa URL.
//
// Mga event galing sa server:
//   notification   (lahat)     bagong laman ng bell
//   order:new      (admin)     may bagong order -> i-refresh ang listahan
//   order:status   (customer)  nag-update ng status ang may-ari -> i-refresh ang listahan
//   resync         (lokal)     nakakonekta ulit: kunin muli ang datos (baka may na-miss)

const Ctx = createContext({ subscribe: () => () => {}, connected: false });
export const useRealtime = () => useContext(Ctx);

// Gamitin sa pahina:  useLive(['order:new', 'resync'], () => load())
export function useLive(events, fn) {
  const { subscribe } = useRealtime();
  const ref = useRef(fn);
  ref.current = fn;
  const key = [].concat(events).join('|');
  useEffect(() => {
    const offs = key.split('|').map((e) => subscribe(e, (d) => ref.current(d)));
    return () => offs.forEach((off) => off());
  }, [subscribe, key]);
}

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const subs = useRef(new Map());
  const [connected, setConnected] = useState(false);
  const enabled = user?.role === 'customer' || user?.role === 'admin';

  const subscribe = useCallback((event, fn) => {
    if (!subs.current.has(event)) subs.current.set(event, new Set());
    subs.current.get(event).add(fn);
    return () => subs.current.get(event)?.delete(fn);
  }, []);

  useEffect(() => {
    if (!enabled) { setConnected(false); return undefined; }
    let stop = false;
    let ctrl;
    const emit = (event, data) => subs.current.get(event)?.forEach((fn) => { try { fn(data); } catch { /* ignore */ } });

    function parse(frame) {
      let event = 'message'; let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data && event === 'message') return;   // ": ping"
      try {
        const d = data ? JSON.parse(data) : {};
        if (event === 'ready') emit('resync');
        emit(event, d);
      } catch { /* ignore */ }
    }

    (async function run() {
      let wait = 1000;
      while (!stop) {
        ctrl = new AbortController();
        try {
          const token = session.get()?.token;
          if (!token) return;
          const res = await fetch(`${API_BASE}/api/events`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: ctrl.signal,
          });
          if (res.status === 401 || res.status === 403) return;   // hindi na uulit-ulitin
          if (!res.ok || !res.body) throw new Error('stream failed');
          setConnected(true); wait = 1000;
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
            let i;
            while ((i = buf.indexOf('\n\n')) >= 0) { parse(buf.slice(0, i)); buf = buf.slice(i + 2); }
          }
        } catch { /* naputol ang koneksyon o na-abort */ }
        setConnected(false);
        if (stop) return;
        await new Promise((r) => setTimeout(r, wait));
        wait = Math.min(wait * 2, 15_000);   // 1s, 2s, 4s ... hanggang 15s
      }
    })();

    return () => { stop = true; ctrl?.abort(); };
  }, [enabled, user?.id, user?.role]);

  const value = useMemo(() => ({ subscribe, connected }), [subscribe, connected]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

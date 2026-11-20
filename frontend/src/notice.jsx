import { useEffect, useRef, useState } from 'react';

// Maliit na pop-up na kusang nawawala. Tawagin kahit saan: notify('Saved.')
let push = () => {};
export const notify = (message, ms = 2200, kind = 'ok') => push(message, ms, kind);

// "Sigurado ka ba?" na pop-up. Gamitin:  if (!(await confirmDialog({ title, message, confirmText, danger }))) return;
let ask = () => Promise.resolve(window.confirm('Are you sure?'));
export const confirmDialog = (opts) => ask(opts);

export function NoticeHost() {
  const [n, setN] = useState(null);
  const [dlg, setDlg] = useState(null);
  const okRef = useRef(null);

  useEffect(() => {
    push = (message, ms, kind) => setN({ id: Date.now() + Math.random(), message, ms, kind });
    ask = (o = {}) => new Promise((resolve) => setDlg({ ...o, resolve }));
    return () => { push = () => {}; };
  }, []);
  useEffect(() => {
    if (!n) return undefined;
    const t = setTimeout(() => setN(null), n.ms);
    return () => clearTimeout(t);
  }, [n]);

  const close = (v) => { dlg?.resolve(v); setDlg(null); };
  useEffect(() => {
    if (!dlg) return undefined;
    okRef.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [dlg]); // eslint-disable-line

  return (
    <>
      {n && (
        <div className="notice-wrap" role="status" aria-live="polite">
          <div className="notice" key={n.id}><i className={`fa-solid ${n.kind === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} aria-hidden="true" /> {n.message}</div>
        </div>
      )}
      {dlg && (
        <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title">
            <span className={`modal-ico ${dlg.danger ? 'danger' : ''}`} aria-hidden="true">
              <i className={`fa-solid ${dlg.icon || (dlg.danger ? 'fa-triangle-exclamation' : 'fa-circle-question')}`} />
            </span>
            <h3 id="dlg-title">{dlg.title || 'Are you sure?'}</h3>
            {dlg.message && <p>{dlg.message}</p>}
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => close(false)}>{dlg.cancelText || 'Cancel'}</button>
              <button type="button" ref={okRef} className={`btn sm ${dlg.danger ? 'danger' : ''}`} onClick={() => close(true)}>{dlg.confirmText || 'Yes, continue'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

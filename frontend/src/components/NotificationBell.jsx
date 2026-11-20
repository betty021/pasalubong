import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useLive } from '../realtime.jsx';

const ICON = { 'order:new': 'cart-shopping', 'order:status': 'box', chat: 'comments' };

function ago(d) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

const BellIcon = () => <i className="fa-solid fa-bell" aria-hidden="true" />;

// Notification bell: para sa customer at sa may-ari
export default function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  const load = useCallback(() => api('/notifications').then((d) => { setItems(d.items); setUnread(d.unread); }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useLive(['notification', 'resync'], load);   // may bago, o nakakonekta ulit

  // Isara kapag pinindot ang labas o Esc
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  function openItem(n) {
    setOpen(false);
    if (!n.read_at) {
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    }
    if (n.link) navigate(n.link);
  }

  function readAll() {
    setItems((l) => l.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    setUnread(0);
    api('/notifications/read-all', { method: 'POST' }).catch(() => {});
  }

  return (
    <div className="bell" ref={box}>
      <button type="button" className="bell-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BellIcon />
        {unread > 0 && <span className="bell-n">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <b>Notifications</b>
            {unread > 0 && <button type="button" className="bell-link" onClick={readAll}>Mark all as read</button>}
          </div>
          <div className="bell-list">
            {!items.length && <p className="empty" style={{ padding: '28px 16px' }}>No notifications yet.</p>}
            {items.map((n) => (
              <button type="button" key={n.id} className={`bell-item ${n.read_at ? '' : 'new'}`} onClick={() => openItem(n)}>
                <span className="bell-ico" aria-hidden="true"><i className={`fa-solid fa-${ICON[n.type] ?? 'bell'}`} /></span>
                <span className="bell-txt">
                  <b>{n.title}</b>
                  {n.body && <span>{n.body}</span>}
                  <small>{ago(n.created_at)}</small>
                </span>
                {!n.read_at && <span className="bell-dot" aria-label="Unread" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

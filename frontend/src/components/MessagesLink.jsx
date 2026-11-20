import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { useLive } from '../realtime.jsx';

// "Messages" sa menu na may bilang ng hindi pa nababasa (real-time)
export default function MessagesLink({ to, className = 'cart-link' }) {
  const [n, setN] = useState(0);
  const load = useCallback(() => api('/chat/unread').then((d) => setN(d.count)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useLive(['chat:message', 'chat:read', 'resync'], load);
  return (
    <NavLink to={to} className={className}>
      <i className="fa-solid fa-comments" aria-hidden="true" /><span className={className === 'cart-link' ? 'hide-sm' : ''}>Messages</span>
      {n > 0 && <span className="badge">{n > 99 ? '99+' : n}</span>}
    </NavLink>
  );
}

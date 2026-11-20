import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Avatar from './Avatar.jsx';

// Pangalang ipapakita: customer = first + last name; admin = bahagi ng email bago ang @
export function displayName(user) {
  if (!user) return '';
  if (user.role === 'customer') return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email || 'Customer';
  const local = String(user.email ?? '').split('@')[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Admin';
}

// Account: bilog (initial) + pangalan + role. Kapag pinindot, lalabas ang My Profile, Settings at Log out.
// placement: 'up' (sa sidebar, bubukas paitaas) | 'down' (sa top bar, bubukas pababa)
export default function AccountMenu({ placement = 'down' }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const name = displayName(user);
  const role = user?.role === 'admin' ? 'Admin' : 'Customer';

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className={`acct ${placement}`} ref={box}>
      <button type="button" className="acct-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar src={user?.avatar_url} name={name} size={40} className="acct-av" />
        <span className="acct-txt"><b>{name}</b><small>{role}</small></span>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <Link to="/profile" role="menuitem"><i className="fa-solid fa-user" aria-hidden="true" /><span>My Profile</span></Link>
          <Link to="/settings" role="menuitem"><i className="fa-solid fa-gear" aria-hidden="true" /><span>Settings</span></Link>
          <button type="button" role="menuitem" className="acct-logout" onClick={async () => { setOpen(false); if (await logout()) nav('/'); }}>
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" /><span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}

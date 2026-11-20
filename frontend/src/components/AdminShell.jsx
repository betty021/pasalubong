import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { img } from '../api.js';
import NotificationBell from './NotificationBell.jsx';
import MessagesLink from './MessagesLink.jsx';
import AccountMenu from './AccountMenu.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';
import { useScrollOnNav, useStoreLogo } from './shellHooks.js';

// [path, Font Awesome icon, label]
const LINKS = [
  ['/admin', 'chart-line', 'Dashboard'],
  ['/admin/orders', 'receipt', 'Orders'],
  ['/admin/products', 'box-open', 'Products'],
  ['/admin/store', 'store', 'Store info'],
];

// Layout ng may-ari: sidebar sa kaliwa, notification bell sa taas
export default function AdminShell() {
  const { pathname } = useLocation();
  const logo = useStoreLogo();
  const [open, setOpen] = useState(false);   // sidebar sa phone
  useScrollOnNav();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="admin-shell">
      <aside className={`side ${open ? 'open' : ''}`}>
        <Link to="/admin" className="side-logo">
          {logo ? <img src={img(logo)} alt="" className="logo-img" /> : <i className="fa-solid fa-basket-shopping" aria-hidden="true" />}
          <span>Pasalubong<b>Hub</b></span>
        </Link>
        <nav className="side-nav">
          {LINKS.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === '/admin'} className="side-link">
              <i className={`fa-solid fa-${icon}`} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
          <MessagesLink to="/admin/messages" className="side-link" />
        </nav>
        <div className="side-foot">
          <AccountMenu placement="up" />
        </div>
      </aside>
      {open && <div className="side-scrim" onClick={() => setOpen(false)} />}

      <div className="admin-main">
        <div className="admin-top">
          <button className="side-toggle" aria-label="Open menu" onClick={() => setOpen(true)}>
            <i className="fa-solid fa-bars" aria-hidden="true" />
          </button>
          <span className="admin-who"><i className="fa-solid fa-user-shield" aria-hidden="true" /><span className="admin-who-txt"> Owner dashboard</span></span>
          <ConnectionStatus />
          <NotificationBell />
        </div>
        <Outlet />
      </div>
    </div>
  );
}

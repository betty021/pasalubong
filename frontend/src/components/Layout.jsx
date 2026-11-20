import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { HOME, useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { img } from '../api.js';
import NotificationBell from './NotificationBell.jsx';
import MessagesLink from './MessagesLink.jsx';
import AccountMenu from './AccountMenu.jsx';
import AdminShell from './AdminShell.jsx';
import InstallButton from './InstallButton.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';
import { useScrollOnNav, useStoreLogo } from './shellHooks.js';

// Admin (may-ari) = sidebar, PERO sa mga pahina ng admin lang (/admin..., /profile, /settings).
// Ang landing page ("/") ay top bar para sa lahat. Bisita at customer = top bar.
export default function Layout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const inAdminArea = pathname.startsWith('/admin') || pathname === '/profile' || pathname === '/settings';
  return user?.role === 'admin' && inAdminArea ? <AdminShell /> : <SiteShell />;
}

function SiteShell() {
  const { user } = useAuth();
  const { count } = useCart();
  const { pathname } = useLocation();
  const logo = useStoreLogo();
  useScrollOnNav();
  // Sa landing page ("/"), laging itsura ng bisita ang ipinapakita (3 link + Log in), kahit may naka-login.
  // Kapag pinindot ang Log in/Register habang naka-login, awtomatiko siyang dadalhin sa sarili niyang pahina.
  const landing = pathname === '/';
  const guest = !user || landing;
  // Sa login/register/verify na pahina, walang nav links (logo at Online status lang)
  const authPage = ['/login', '/register', '/verify-email'].includes(pathname);

  return (
    <>
      <header className="header">
        <div className="wrap">
          <Link to={guest ? '/' : HOME[user.role]} className="logo">
            {logo ? <img src={img(logo)} alt="" className="logo-img" /> : <i className="fa-solid fa-basket-shopping" aria-hidden="true" />}
            <span>Pasalubong<b>Hub</b></span>
          </Link>
          <ConnectionStatus />
          <nav className="nav">
            {!authPage && <InstallButton />}
            {/* Bisita: About, Features, Products lang (mga seksyon ng landing page) */}
            {guest && !authPage && <>
              <Link to="/#about">About</Link>
              <Link to="/#features">Features</Link>
              <Link to="/#products">Products</Link>
            </>}
            {!guest && user.role === 'customer' && <>
              <NavLink to="/products"><i className="fa-solid fa-store" aria-hidden="true" /><span className="hide-sm">Products</span></NavLink>
              <NavLink to="/my-orders"><i className="fa-solid fa-receipt" aria-hidden="true" /><span className="hide-sm">My orders</span></NavLink>
              <NavLink to="/history"><i className="fa-solid fa-clock-rotate-left" aria-hidden="true" /><span className="hide-sm">History</span></NavLink>
              <MessagesLink to="/messages" />
              <NavLink to="/cart" className="cart-link">
                <i className="fa-solid fa-cart-shopping" aria-hidden="true" /><span className="hide-sm">Cart</span>
                {count > 0 && <span className="badge">{count}</span>}
              </NavLink>
              <NotificationBell />
              <AccountMenu placement="down" />
            </>}
            {!guest && user.role === 'admin' && <>
              <NavLink to="/admin"><i className="fa-solid fa-chart-line" aria-hidden="true" /><span className="hide-sm">Dashboard</span></NavLink>
              <AccountMenu placement="down" />
            </>}
            {guest && !authPage && <Link to="/login" className="btn sm">Log in</Link>}
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="footer"><div className="wrap">© PasalubongHub — authentic pasalubong from local sellers.</div></footer>
    </>
  );
}
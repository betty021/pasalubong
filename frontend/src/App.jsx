import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HOME, useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Products from './pages/Products.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import MyOrders from './pages/MyOrders.jsx';
import History from './pages/History.jsx';
import Admin from './pages/Admin.jsx';
import Chat from './pages/Chat.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';

// Bantay: kailangang naka-login at tama ang role.
// Kapag hindi pa naka-login -> ibabalik sa Login (tapos babalik sa pahinang pinuntahan pagka-login).
function Guard({ role, children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  }
  if (user.role !== role) return <Navigate to={HOME[user.role]} replace />;
  return children;
}

// Kahit anong role basta naka-login (hal. Account page)
function LoggedIn({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  return children;
}

// Para sa mga pahinang pang-bisita lang (landing, login, register):
// kapag naka-login na, dalhin na agad sa sarili niyang pahina.
function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to={HOME[user.role]} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public: landing page muna ang unang lalabas */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/verify-email" element={<GuestOnly><VerifyEmail /></GuestOnly>} />

        {/* Customer: kailangan munang mag-login */}
        <Route path="/products" element={<Guard role="customer"><Products /></Guard>} />
        <Route path="/cart" element={<Guard role="customer"><Cart /></Guard>} />
        <Route path="/checkout" element={<Guard role="customer"><Checkout /></Guard>} />
        <Route path="/my-orders" element={<Guard role="customer"><MyOrders /></Guard>} />
        <Route path="/history" element={<Guard role="customer"><History /></Guard>} />
        <Route path="/messages" element={<Guard role="customer"><Chat /></Guard>} />

        {/* Admin / Owner */}
        <Route path="/admin" element={<Guard role="admin"><Admin tab="dashboard" /></Guard>} />
        <Route path="/admin/orders" element={<Guard role="admin"><Admin tab="orders" /></Guard>} />
        <Route path="/admin/products" element={<Guard role="admin"><Admin tab="products" /></Guard>} />
        <Route path="/admin/categories" element={<Navigate to="/admin/products" replace />} />
        <Route path="/admin/store" element={<Guard role="admin"><Admin tab="store" /></Guard>} />
        <Route path="/admin/messages" element={<Guard role="admin"><Chat /></Guard>} />
        <Route path="/admin/messages/:id" element={<Guard role="admin"><Chat /></Guard>} />

        {/* Account: customer at admin parehong puwede */}
        <Route path="/profile" element={<LoggedIn><Profile /></LoggedIn>} />
        <Route path="/settings" element={<LoggedIn><Settings /></LoggedIn>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

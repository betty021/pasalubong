import DashboardTab from '../components/admin/DashboardTab.jsx';
import OrdersTab from '../components/admin/OrdersTab.jsx';
import ProductsTab from '../components/admin/ProductsTab.jsx';
import StoreTab from '../components/admin/StoreTab.jsx';

const PAGES = {
  dashboard: ['Dashboard', DashboardTab],
  orders: ['Orders', OrdersTab],
  products: ['Products', ProductsTab],
  store: ['Store info', StoreTab],
};

// Isang pahina bawat seksyon; ang sidebar (AdminShell) ang nagpapalit ng route
export default function Admin({ tab = 'dashboard' }) {
  const [title, Tab] = PAGES[tab];
  return (
    <main className="page"><div className="wrap">
      <h1><span className="accent">{title}</span></h1>
      <Tab />
    </div></main>
  );
}

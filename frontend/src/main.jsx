import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { CartProvider } from './cart.jsx';
import { RealtimeProvider } from './realtime.jsx';
import { NoticeHost } from './notice.jsx';
import OfflineBar from './OfflineBar.jsx';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles.css';
import './theme.css';
import './responsive.css';
import { registerPWA } from './pwa.js';

registerPWA();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <CartProvider>
            <OfflineBar />
            <App />
            <NoticeHost />
          </CartProvider>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

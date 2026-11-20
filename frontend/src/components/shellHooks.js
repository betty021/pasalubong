import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';

// Logo ng tindahan; nagre-refresh kapag nag-save ang admin sa Store info
export function useStoreLogo() {
  const [logo, setLogo] = useState(null);
  useEffect(() => {
    const load = () => api('/store').then((s) => setLogo(s.logo_url || null)).catch(() => {});
    load();
    window.addEventListener('store-updated', load);
    return () => window.removeEventListener('store-updated', load);
  }, []);
  return logo;
}

// Mag-scroll sa #about / #features kapag may hash; kung wala, sa itaas
export function useScrollOnNav() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 60);
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
}

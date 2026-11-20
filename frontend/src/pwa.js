import { flush } from './offlineQueue.js';

// Ang "install" event ng browser ay kinukuha rito para magamit ng InstallButton.
export const installer = { event: null };
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); installer.event = e;
  window.dispatchEvent(new Event('ph-install-change'));
});
window.addEventListener('appinstalled', () => {
  installer.event = null;
  window.dispatchEvent(new Event('ph-install-change'));
});

// Production lang (para hindi manggulo ang cache habang nagde-develop). Subukan: npm run build && npm run preview
export function registerPWA() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('online', flush);
  window.addEventListener('load', () => {
    flush();
    if (import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

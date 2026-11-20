import { useEffect, useState } from 'react';
import { installer } from '../pwa.js';
import { notify } from '../notice.jsx';

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const iOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// Lumalabas lang kapag puwede pang i-install ang app. Android/Chrome/Edge: direktang install.
// iPhone/iPad (Safari): walang install prompt, kaya may maikling gabay.
export default function InstallButton() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    window.addEventListener('ph-install-change', f);
    return () => window.removeEventListener('ph-install-change', f);
  }, []);
  if (standalone()) return null;
  const canPrompt = !!installer.event;
  if (!canPrompt && !iOS()) return null;

  async function install() {
    if (!canPrompt) return notify('On iPhone: tap Share, then “Add to Home Screen”.', 5000);
    installer.event.prompt();
    await installer.event.userChoice.catch(() => {});
    installer.event = null; force((n) => n + 1);
  }
  return (
    <button className="btn sm" onClick={install} title="Install PasalubongHub">
      <i className="fa-solid fa-download" aria-hidden="true" /> <span className="hide-sm">Install app</span>
    </button>
  );
}

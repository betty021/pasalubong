import { useEffect, useState } from 'react';

// Paalala sa pinakataas ng pahina kapag walang internet (hindi nakaharang sa chat/checkout sa ibaba).
// Naka-save pa rin ang cart. Ang order na ilalagay habang offline ay ise-save at ipapadala kusa pagbalik ng internet.
export default function OfflineBar() {
  const [off, setOff] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOff(false); const offf = () => setOff(true);
    window.addEventListener('online', on); window.addEventListener('offline', offf);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', offf); };
  }, []);
  if (!off) return null;
  return (
    <div role="status" className="offline-bar">
      <i className="fa-solid fa-plug-circle-xmark" aria-hidden="true" />
      <span>You’re offline. Your cart is saved — orders you place will be sent when you’re back online.</span>
    </div>
  );
}

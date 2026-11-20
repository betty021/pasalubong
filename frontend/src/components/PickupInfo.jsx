import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { pinIcon } from '../mapIcon.js';

// Mapa na pang-tingin lang (hindi mailipat ang pin)
function StoreMap({ lat, lng, height = 220 }) {
  const el = useRef(null);
  useEffect(() => {
    const map = L.map(el.current, { center: [lat, lng], zoom: 16, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.marker([lat, lng], { icon: pinIcon, interactive: false }).addTo(map);
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => { clearTimeout(t); map.remove(); };
  }, [lat, lng]);
  return <div ref={el} className="map-box" style={{ height }} role="application" aria-label="Map: store pickup location" />;
}

// Saan magpa-pickup: pangalan, address, telepono, mapa at directions ng tindahan.
// store: galing sa GET /api/store
export default function PickupInfo({ store, showMap = true }) {
  if (store === undefined) return <div className="muted" style={{ fontSize: '.9rem' }}>Loading pickup location…</div>;
  if (!store) return <div className="muted" style={{ fontSize: '.9rem' }}>Pickup location is not available right now.</div>;
  const hasPin = store.lat != null && store.lng != null;
  const dir = hasPin
    ? `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`
    : store.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}` : null;
  if (!store.address && !hasPin) {
    return <div className="muted" style={{ fontSize: '.9rem' }}>The store will share the pickup location soon.</div>;
  }
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{store.name}</div>
      {store.address && <div className="muted" style={{ fontSize: '.9rem' }}>{store.address}</div>}
      {store.phone && <div className="muted" style={{ fontSize: '.9rem' }}>{store.phone}</div>}
      {showMap && hasPin && <div style={{ margin: '10px 0 6px' }}><StoreMap lat={store.lat} lng={store.lng} /></div>}
      {dir && (
        <div style={{ fontSize: '.9rem', marginTop: 6 }}>
          <a className="accent" href={dir} target="_blank" rel="noreferrer">Get directions</a>
          {hasPin && <>{' · '}<a className="accent" href={`https://www.openstreetmap.org/?mlat=${store.lat}&mlon=${store.lng}#map=17/${store.lat}/${store.lng}`} target="_blank" rel="noreferrer">View on map</a></>}
        </div>
      )}
    </div>
  );
}

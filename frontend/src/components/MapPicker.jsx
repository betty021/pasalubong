import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { pinIcon } from '../mapIcon.js';
import { MINDORO_BOUNDS, inMindoro } from '../mindoro.js';

// Mapa na may pin na puwedeng i-click o i-drag.
//   focus: { lat, lng, zoom, pin: boolean, n }  -> ilipat ang mapa (at ilagay ang pin kung pin=true). Palitan ang `n` para gumana ulit.
//   value: { lat, lng } | null                  -> kasalukuyang pin
//   onChange({ lat, lng })                      -> kapag inilipat ng customer ang pin
export default function MapPicker({ focus, value, onChange, height = 320, label = 'Map: click or drag the pin to your delivery location' }) {
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  function place(lat, lng, notify) {
    if (!marker.current) {
      marker.current = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map.current);
      marker.current.on('dragend', () => {
        const p = marker.current.getLatLng();
        if (!inMindoro(p.lat, p.lng)) return;
        cb.current({ lat: p.lat, lng: p.lng });
      });
    } else marker.current.setLatLng([lat, lng]);
    if (notify) cb.current({ lat, lng });
  }

  // Gawin ang mapa nang isang beses
  useEffect(() => {
    map.current = L.map(el.current, {
      center: [13.0, 121.3], zoom: 9, minZoom: 8,
      maxBounds: L.latLngBounds(MINDORO_BOUNDS).pad(0.1), maxBoundsViscosity: 0.8,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    map.current.on('click', (e) => { if (inMindoro(e.latlng.lat, e.latlng.lng)) place(e.latlng.lat, e.latlng.lng, true); });
    if (value) { place(value.lat, value.lng, false); map.current.setView([value.lat, value.lng], 16); }
    const t = setTimeout(() => map.current?.invalidateSize(), 150);
    return () => { clearTimeout(t); map.current?.remove(); map.current = null; marker.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lumipat kapag pumili ng bagong munisipyo/barangay
  useEffect(() => {
    if (!focus || !map.current) return;
    map.current.setView([focus.lat, focus.lng], focus.zoom ?? 14);
    if (focus.pin) place(focus.lat, focus.lng, true);
  }, [focus?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Alisin ang pin kapag na-clear ang value (hal. nagpalit ng munisipyo)
  useEffect(() => {
    if (!value && marker.current) { marker.current.remove(); marker.current = null; }
  }, [value]);

  return <div ref={el} className="map-box" style={{ height }} role="application" aria-label={label} />;
}

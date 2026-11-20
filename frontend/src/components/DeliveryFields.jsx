import { useEffect, useState } from 'react';
import MapPicker from './MapPicker.jsx';
import { geocode, inMindoro, loadBarangays, loadMunicipalities } from '../mindoro.js';

// Delivery sa Mindoro: Municipality -> Barangay -> pin sa mapa -> street/detalye.
// value: { province, muniCode, municipality, barangay, street, lat, lng }   onChange(patch)
export default function DeliveryFields({ value: v, onChange, required = true, streetLabel = 'House no. / Street / Landmark',
  streetPlaceholder = 'e.g. Blk 2 Lot 5, Rizal St., near the chapel', mapLabel = 'Pin your location on the map',
  mapAria = 'Map: click or drag the pin to your delivery location' }) {
  const [munis, setMunis] = useState(null);       // null = naglo-load, 'error' = pumalya
  const [brgys, setBrgys] = useState(null);       // null = wala pang munisipyo
  const [focus, setFocus] = useState(null);
  const [hint, setHint] = useState('');

  const loadM = () => { setMunis(null); loadMunicipalities().then(setMunis).catch(() => setMunis('error')); };
  useEffect(loadM, []);

  // Kung bumalik sa pahinang ito na may napili na, i-load ang mga barangay
  useEffect(() => {
    if (v.muniCode && !brgys) loadBarangays(v.muniCode).then(setBrgys).catch(() => setBrgys('error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function pickMuni(code) {
    const m = munis.find((x) => x.code === code);
    setBrgys(null); setHint('');
    if (!m) { onChange({ muniCode: '', municipality: '', province: '', barangay: '', lat: '', lng: '' }); return; }
    onChange({ muniCode: m.code, municipality: m.name, province: m.province, barangay: '', lat: '', lng: '' });
    loadBarangays(m.code).then(setBrgys).catch(() => setBrgys('error'));
    const g = await geocode([`${m.name}, ${m.province}, Philippines`, `${m.name}, Mindoro, Philippines`]);
    if (g) setFocus({ lat: g.lat, lng: g.lng, zoom: 12, pin: false, n: Date.now() });
  }

  async function pickBrgy(name) {
    setHint('');
    if (!name) { onChange({ barangay: '', lat: '', lng: '' }); return; }
    onChange({ barangay: name, lat: '', lng: '' });
    const g = await geocode([
      `Barangay ${name}, ${v.municipality}, ${v.province}, Philippines`,
      `${name}, ${v.municipality}, ${v.province}, Philippines`,
    ]);
    if (g && inMindoro(g.lat, g.lng)) { setFocus({ lat: g.lat, lng: g.lng, zoom: 16, pin: true, n: Date.now() }); return; }
    // Hindi nahanap ang barangay: gamitin ang gitna ng munisipyo
    const m = await geocode([`${v.municipality}, ${v.province}, Philippines`]);
    if (m) { setFocus({ lat: m.lat, lng: m.lng, zoom: 14, pin: true, n: Date.now() }); setHint('We could not find this barangay exactly. Please drag the pin to your location.'); }
    else setHint('Please click the map to place your pin.');
  }

  return (
    <>
      {munis === 'error' && (
        <div className="err" role="alert">Could not load the list of municipalities. Check your internet connection. <button type="button" className="link-btn" onClick={loadM}>Retry</button></div>
      )}
      <div className="two">
        <div className="field">
          <label htmlFor="muni">Municipality / City</label>
          <select id="muni" required={required} value={v.muniCode} disabled={!munis || munis === 'error'} onChange={(e) => pickMuni(e.target.value)}>
            <option value="">{munis ? 'Select municipality' : 'Loading…'}</option>
            {Array.isArray(munis) && munis.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="brgy">Barangay</label>
          <select id="brgy" required={required} value={v.barangay} disabled={!v.muniCode || !Array.isArray(brgys)} onChange={(e) => pickBrgy(e.target.value)}>
            <option value="">{!v.muniCode ? 'Select municipality first' : brgys === 'error' ? 'Could not load barangays' : brgys ? 'Select barangay' : 'Loading…'}</option>
            {Array.isArray(brgys) && brgys.map((b) => <option key={b.code} value={b.name}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="street">{streetLabel}</label>
        <input id="street" required={required} maxLength={200} value={v.street} onChange={(e) => onChange({ street: e.target.value })}
               placeholder={streetPlaceholder} />
      </div>

      <div className="field">
        <label>{mapLabel}</label>
        <MapPicker focus={focus} value={v.lat !== '' ? { lat: Number(v.lat), lng: Number(v.lng) } : null}
                   onChange={(p) => { setHint(''); onChange({ lat: p.lat, lng: p.lng }); }} label={mapAria} />
        <small className="muted">
          {v.lat !== '' ? 'Pin placed. Click the map or drag the pin to adjust it.' : 'Select the barangay, then click the map or drag the pin to the exact spot.'}
        </small>
        {hint && <div className="err" role="alert" style={{ marginTop: 6 }}>{hint}</div>}
      </div>
    </>
  );
}

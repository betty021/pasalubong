// Listahan ng munisipyo at barangay ng Oriental Mindoro mula sa opisyal na PSGC API (Philippine Statistics Authority).
// Libre ito at hindi kailangan ng API key. Ang mga resulta ay naka-cache habang bukas ang pahina.
const PSGC = 'https://psgc.gitlab.io/api';
const PROVINCES = ['Oriental Mindoro'];   // Oriental Mindoro lang ang hinahatiran

async function getJson(path) {
  const res = await fetch(`${PSGC}${path}`);
  if (!res.ok) throw new Error(`PSGC ${res.status}`);
  return res.json();
}
// Subukan ang mga alternatibong landas kung may hindi umubra
async function firstOk(paths) {
  let last;
  for (const p of paths) { try { return await getJson(p); } catch (e) { last = e; } }
  throw last;
}
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

let munisP;
// -> [{ code, name, province }]  (kasama ang Calapan City at iba pang lungsod)
export function loadMunicipalities() {
  if (!munisP) {
    munisP = (async () => {
      const provs = await getJson('/provinces.json');
      const out = [];
      for (const pname of PROVINCES) {
        const prov = provs.find((p) => p.name === pname);
        if (!prov) throw new Error(`Province not found: ${pname}`);
        let list;
        try { list = await getJson(`/provinces/${prov.code}/cities-municipalities.json`); }
        catch {
          const [m, c] = await Promise.all([
            getJson(`/provinces/${prov.code}/municipalities.json`).catch(() => []),
            getJson(`/provinces/${prov.code}/cities.json`).catch(() => []),
          ]);
          list = [...m, ...c];
        }
        out.push(...list.map((x) => ({ code: x.code, name: x.name, province: pname })));
      }
      if (!out.length) throw new Error('Empty list');
      return out.sort(byName);
    })().catch((e) => { munisP = null; throw e; });   // payagan ang "Retry"
  }
  return munisP;
}

const brgyCache = new Map();
// -> [{ code, name }]
export async function loadBarangays(muniCode) {
  if (brgyCache.has(muniCode)) return brgyCache.get(muniCode);
  const list = await firstOk([
    `/cities-municipalities/${muniCode}/barangays.json`,
    `/municipalities/${muniCode}/barangays.json`,
    `/cities/${muniCode}/barangays.json`,
  ]);
  const out = list.map((x) => ({ code: x.code, name: x.name })).sort(byName);
  brgyCache.set(muniCode, out);
  return out;
}

// Humanap ng coordinates sa OpenStreetMap (Nominatim) para ma-zoom ang mapa. Hindi ito kailangang tumama:
// ang customer pa rin ang maglalagay ng eksaktong pin.
const geoCache = new Map();
export async function geocode(parts) {
  for (const q of parts) {
    const key = q.toLowerCase();
    if (geoCache.has(key)) { if (geoCache.get(key)) return geoCache.get(key); continue; }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&q=${encodeURIComponent(q)}`,
        { headers: { 'Accept-Language': 'en' } });
      const j = res.ok ? await res.json() : [];
      const hit = j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon), query: q } : null;
      geoCache.set(key, hit);
      if (hit) return hit;
    } catch { /* subukan ang susunod */ }
  }
  return null;
}

// Hangganan ng Oriental Mindoro (pareho sa backend)
export const MINDORO_BOUNDS = [[12.1, 120.8], [13.7, 121.7]];
export const inMindoro = (lat, lng) => lat >= 12.1 && lat <= 13.7 && lng >= 120.8 && lng <= 121.7;

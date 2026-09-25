export type Place = { id: string; name: string; kind: string; lat: number; lon: number; distance?: number; country?: string };
export type Area = { name: string; lat: number; lon: number; country?: string; label?: string };

const OVERPASS = ['https://overpass-api.de/api/interpreter'];

const KIND_HE: Record<string, string> = {
    hotel: 'מלון', guest_house: 'גסטהאוס', hostel: 'הוסטל', alpine_hut: 'טי-האוס / לודג׳', motel: 'מוטל', lodge: 'לודג׳',
};
export const kindLabel = (k: string) => KIND_HE[k] ?? 'לינה';

function km(aLat: number, aLon: number, bLat: number, bLon: number) {
    const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
}

// Same id format for Photon (N/W/R) and Overpass (node/way/relation), so reports always match.
const OSM_TYPE: Record<string, string> = { N: 'node', W: 'way', R: 'relation' };

const LODGING = ['hotel', 'guest_house', 'hostel', 'alpine_hut', 'motel'];

async function photonNearby(lat: number, lon: number, radiusKm: number): Promise<Place[]> {
    const tags = LODGING.map(t => `&osm_tag=tourism:${t}`).join('');
    const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&radius=${radiusKm}&limit=60&lang=en${tags}`);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const seen = new Set<string>();
    const out: Place[] = [];
    for (const f of j.features ?? []) {
        const pr = f.properties ?? {};
        if (!pr.name || !LODGING.includes(pr.osm_value)) continue;
        const id = `osm-${OSM_TYPE[pr.osm_type] ?? pr.osm_type}-${pr.osm_id}`;
        if (seen.has(id)) continue; seen.add(id);
        const [pLon, pLat] = f.geometry.coordinates;
        out.push({ id, name: pr.name, kind: pr.osm_value, lat: pLat, lon: pLon, distance: km(lat, lon, pLat, pLon), country: pr.countrycode?.toUpperCase() });
    }
    return out.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)).slice(0, 60);
}

export async function nearbyStays(lat: number, lon: number, radius = 2000): Promise<Place[]> {
    try { const p = await photonNearby(lat, lon, radius / 1000); if (p.length) return p; } catch { /* try Overpass */ }
    return overpassNearby(lat, lon, radius);
}

async function overpassNearby(lat: number, lon: number, radius: number): Promise<Place[]> {
    const q = `[out:json][timeout:20];nwr["tourism"~"^(hotel|guest_house|hostel|alpine_hut|motel)$"](around:${radius},${lat},${lon});out center 80;`;
    let lastError: unknown;
    for (const url of OVERPASS) {
        try {
            const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            if (!res.ok) throw new Error(String(res.status));
            const json = await res.json();
            const out: Place[] = [];
            for (const e of json.elements ?? []) {
                const name = e.tags?.['name:en'] || e.tags?.name;
                const pLat = e.lat ?? e.center?.lat, pLon = e.lon ?? e.center?.lon;
                if (!name || pLat == null) continue;
                out.push({ id: `osm-${e.type}-${e.id}`, name, kind: e.tags.tourism, lat: pLat, lon: pLon, distance: km(lat, lon, pLat, pLon) });
            }
            return out.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)).slice(0, 40);
        } catch (err) { lastError = err; }
    }
    throw lastError ?? new Error('lookup failed');
}

/** Human name of the town/village at a point (for "near you" headers). */
export async function localityAt(lat: number, lon: number): Promise<{ name: string; country?: string } | null> {
    try {
        const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1&lang=en&layer=city&layer=district&layer=locality`);
        if (r.ok) { const j = await r.json(); const pr = j.features?.[0]?.properties; const name = pr?.name || pr?.city || pr?.district; if (name) return { name, country: pr.countrycode?.toUpperCase() }; }
    } catch { /* ignore */ }
    return null;
}

/** Country code (e.g. "NP") at a point, from OpenStreetMap. */
export async function countryAt(lat: number, lon: number): Promise<string | null> {
    try {
        const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1&lang=en`);
        if (r.ok) { const j = await r.json(); const c = j.features?.[0]?.properties?.countrycode; if (c) return String(c).toUpperCase(); }
    } catch { /* fall through */ }
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=3&lat=${lat}&lon=${lon}`);
        if (r.ok) { const j = await r.json(); const c = j.address?.country_code; if (c) return String(c).toUpperCase(); }
    } catch { /* ignore */ }
    return null;
}

export async function findArea(text: string): Promise<Area | null> {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&accept-language=en&q=${encodeURIComponent(text)}`);
        if (r.ok) { const j = await r.json(); if (j[0]) return { name: j[0].display_name.split(',').slice(0, 2).join(','), lat: +j[0].lat, lon: +j[0].lon, country: j[0].address?.country_code?.toUpperCase() }; }
    } catch { /* fall through */ }
    try {
        const r = await fetch(`https://photon.komoot.io/api/?limit=1&lang=en&q=${encodeURIComponent(text)}`);
        if (r.ok) { const j = await r.json(); const f = j.features?.[0]; if (f) return { name: f.properties.name, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], country: f.properties.countrycode?.toUpperCase() }; }
    } catch { /* ignore */ }
    return null;
}

// Starting points checked against OpenStreetMap on 24 Sep 2026.
export const QUICK_AREAS: Area[] = [
    { name: 'תמל, קטמנדו', lat: 27.7167, lon: 85.3127, country: 'NP' },
    { name: 'לייקסייד, פוקרה', lat: 28.2211, lon: 83.9583, country: 'NP' },
    { name: 'נמצ׳ה בזאר', lat: 27.8042, lon: 86.7098, country: 'NP' },
    { name: 'חאו סן, בנגקוק', lat: 13.7589, lon: 100.4973, country: 'TH' },
    { name: 'פאי', lat: 19.3581, lon: 98.4406, country: 'TH' },
    { name: 'האד רין, קופנגן', lat: 9.6750, lon: 100.0676, country: 'TH' },
    { name: 'העיר העתיקה, האנוי', lat: 21.0353, lon: 105.8500, country: 'VN' },
    { name: 'ארמבול, גואה', lat: 15.6879, lon: 73.7056, country: 'IN' },
    { name: 'קוסקו', lat: -13.5171, lon: -71.9785, country: 'PE' },
    { name: 'ברילוצ׳ה', lat: -41.1335, lon: -71.3101, country: 'AR' },
];

// Popular destinations with Hebrew names, for Hebrew autocomplete (coordinates from OpenStreetMap Nominatim, 24 Sep 2026).
export type Suggestion = Area & { sub?: string; type?: 'area' | 'stay'; placeId?: string; kind?: string; city?: string };
export const HE_PLACES: (Area & { en: string })[] = [
  { name: 'קטמנדו', en: "Kathmandu Metropolitan City", lat: 27.7083, lon: 85.3206, country: 'NP' },
  { name: 'פוקרה', en: "Pokhara", lat: 28.2095, lon: 83.9914, country: 'NP' },
  { name: 'נמצ׳ה בזאר', en: "Namche Bazaar", lat: 27.8042, lon: 86.7098, country: 'NP' },
  { name: 'לוקלה', en: "Lukla", lat: 27.689, lon: 86.7307, country: 'NP' },
  { name: 'מנאנג', en: "Manang", lat: 28.6718, lon: 84.1709, country: 'NP' },
  { name: 'סאורהה, צ׳יטוואן', en: "Sauraha", lat: 27.5802, lon: 84.5023, country: 'NP' },
  { name: 'בנגקוק', en: "Bangkok", lat: 13.7525, lon: 100.4935, country: 'TH' },
  { name: 'צ׳יאנג מאי', en: "Chiang Mai City Municipality", lat: 18.7883, lon: 98.9859, country: 'TH' },
  { name: 'פאי', en: "Pai", lat: 19.3581, lon: 98.4406, country: 'TH' },
  { name: 'קו פנגן', en: "Ko Pha-ngan", lat: 9.735, lon: 100.0306, country: 'TH' },
  { name: 'קו סמוי', en: "Ko Samui District", lat: 9.5072, lon: 99.9958, country: 'TH' },
  { name: 'קו טאו', en: "Ko Pha-ngan District", lat: 10.0922, lon: 99.8395, country: 'TH' },
  { name: 'האנוי', en: "H\u00e0 N\u1ed9i", lat: 21.0283, lon: 105.854, country: 'VN' },
  { name: 'הו צ׳י מין', en: "Ho Chi Minh City", lat: 10.7737, lon: 106.7166, country: 'VN' },
  { name: 'הוי אן', en: "Hoi An", lat: 15.8796, lon: 108.3319, country: 'VN' },
  { name: 'דה לאט', en: "Da Lat", lat: 11.9402, lon: 108.4376, country: 'VN' },
  { name: 'לואנג פרבנג', en: "Luang Prabang", lat: 19.8887, lon: 102.1359, country: 'LA' },
  { name: 'ואנג ויאנג', en: "Nakkhae", lat: 18.9539, lon: 102.4564, country: 'LA' },
  { name: 'סיאם ריפ', en: "Siem Reap", lat: 13.3618, lon: 103.859, country: 'KH' },
  { name: 'אובוד, באלי', en: "Ubud District", lat: -8.517, lon: 115.2551, country: 'ID' },
  { name: 'מנאלי', en: "Manali", lat: 32.2455, lon: 77.1873, country: 'IN' },
  { name: 'דרמסלה', en: "Dharamshala", lat: 32.2143, lon: 76.3197, country: 'IN' },
  { name: 'קסול', en: "Kasol", lat: 32.0104, lon: 77.3166, country: 'IN' },
  { name: 'ארמבול, גואה', en: "Arambol", lat: 15.6879, lon: 73.7056, country: 'IN' },
  { name: 'ריקישיקש', en: "Rishikesh", lat: 30.1087, lon: 78.2916, country: 'IN' },
  { name: 'ניו דלהי', en: "New Delhi", lat: 28.6139, lon: 77.209, country: 'IN' },
  { name: 'לה', en: "Leh", lat: 34.0041, lon: 77.6573, country: 'IN' },
  { name: 'וארנסי', en: "Varanasi", lat: 25.3356, lon: 83.0076, country: 'IN' },
  { name: 'קוסקו', en: "Cuzco", lat: -13.5171, lon: -71.9785, country: 'PE' },
  { name: 'לימה', en: "Lima", lat: -12.046, lon: -77.0306, country: 'PE' },
  { name: 'לה פאס', en: "La Paz", lat: -16.4955, lon: -68.1336, country: 'BO' },
  { name: 'אויוני', en: "Uyuni", lat: -20.4628, lon: -66.8239, country: 'BO' },
  { name: 'בואנוס איירס', en: "Buenos Aires", lat: -34.6096, lon: -58.3888, country: 'AR' },
  { name: 'ברילוצ׳ה', en: "San Carlos de Bariloche", lat: -41.1335, lon: -71.3101, country: 'AR' },
  { name: 'אל צ׳לטן', en: "El Chalten", lat: -49.332, lon: -72.886, country: 'AR' },
  { name: 'פוארטו נטאלס', en: "Puerto Natales", lat: -51.7262, lon: -72.506, country: 'CL' },
  { name: 'סנטיאגו', en: "Santiago", lat: -33.4377, lon: -70.6511, country: 'CL' },
  { name: 'בוגוטה', en: "Bogota", lat: 4.6534, lon: -74.0836, country: 'CO' },
  { name: 'מדיין', en: "Medell\u00edn", lat: 6.2697, lon: -75.6026, country: 'CO' },
  { name: 'מקסיקו סיטי', en: "Mexico City", lat: 19.3208, lon: -99.1515, country: 'MX' },
  { name: 'טולום', en: "Tulum", lat: 20.4296, lon: -87.6529, country: 'MX' },
  { name: 'ריו דה ז׳נרו', en: "Rio de Janeiro", lat: -22.911, lon: -43.2094, country: 'BR' },
  { name: 'טוקיו', en: "Tokyo", lat: 35.6769, lon: 139.7639, country: 'JP' },
  { name: 'אלה, סרי לנקה', en: "Ella", lat: 6.8736, lon: 81.049, country: 'LK' },

];

const norm = (t: string) => t.replace(/[׳'"`]/g, '').trim().toLowerCase();

/** Autocomplete: Hebrew list first, then worldwide places from Photon (OpenStreetMap). */
/** Backpacker neighbourhoods Photon often misses or misspells (Thamle -> Thamel). */
export const HOODS: (Area & { en: string })[] = [
  { name: 'תמל, קטמנדו', en: 'Thamel', lat: 27.7167, lon: 85.3127, country: 'NP' },
  { name: 'לייקסייד, פוקרה', en: 'Lakeside Pokhara', lat: 28.2211, lon: 83.9583, country: 'NP' },
  { name: 'חאו סן, בנגקוק', en: 'Khao San Road', lat: 13.7589, lon: 100.4973, country: 'TH' },
  { name: 'האד רין, קופנגן', en: 'Haad Rin', lat: 9.675, lon: 100.0676, country: 'TH' },
  { name: 'העיר העתיקה, האנוי', en: 'Hanoi Old Quarter', lat: 21.0353, lon: 105.85, country: 'VN' },
  { name: 'פהרגנג׳, דלהי', en: 'Paharganj', lat: 28.6448, lon: 77.2167, country: 'IN' },
  { name: 'ואשישט, מנאלי', en: 'Vashisht', lat: 32.2667, lon: 77.1886, country: 'IN' },
];

/** Edit distance with transpositions, capped for speed. */
function dist(a: string, b: string) {
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 3;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}
/** 0 = prefix hit, 1-2 = typo, 9 = no match. Compares against each word and the whole name. */
function fuzzy(q: string, name: string) {
  const n = norm(name); if (!q) return 9;
  if (n.startsWith(q) || n.split(/[ ,\-]+/).some(w => w.startsWith(q))) return 0;
  if (q.length < 4) return 9;
  const tol = q.length >= 6 ? 2 : 1;
  let best = 9;
  for (const w of [n, ...n.split(/[ ,\-]+/)]) { const dd = dist(q, w.slice(0, Math.max(q.length, Math.min(w.length, q.length + 1)))); if (dd < best) best = dd; }
  return best <= tol ? best : 9;
}

const STAY_TAGS = ['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'chalet', 'camp_site', 'alpine_hut'];

/**
 * One search box for everything: towns, neighbourhoods and stays ("namaste namche", "yog hostel kathmandu").
 * Local lists answer instantly and forgive typos; Photon (OSM, free, no key) fills in the rest.
 */
/** Words that describe the kind of stay, not which one ("Hotel yog kathmandu" -> "yog kathmandu"). */
const GENERIC = new Set(['hotel', 'hotels', 'hostel', 'hostels', 'lodge', 'lodges', 'guest', 'house', 'guesthouse', 'gh', 'inn', 'resort', 'motel', 'homestay', 'teahouse', 'the', 'in', 'at', 'near']);
const KATHMANDU = { lat: 27.7172, lon: 85.324 };

/** True when every key word appears (prefix or small typo) somewhere in the text. */
function allTokens(tokens: string[], hay: string) {
  const words = norm(hay).split(/[ ,\-()&/]+/).filter(Boolean);
  return tokens.every(t => words.some(w => w.startsWith(t) || (t.length >= 4 && dist(t, w.slice(0, t.length + 1)) <= (t.length >= 6 ? 2 : 1))));
}

async function photon(q: string, tags: string[], bias: { lat: number; lon: number }, signal?: AbortSignal): Promise<any[]> {
  try {
    const t = tags.map(x => `&osm_tag=${x}`).join('');
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=12&lang=en${t}&lat=${bias.lat}&lon=${bias.lon}&location_bias_scale=0.3`, { signal });
    if (!r.ok) return [];
    return (await r.json()).features ?? [];
  } catch { return []; }
}

/**
 * One search box for everything: towns, neighbourhoods and stays ("namaste namche", "Hotel yog kathmandu").
 * Local lists answer instantly and forgive typos; Photon (OSM, free, no key) fills in the rest.
 * Generic words like "hotel" are dropped, results must contain every key word, and nearby wins.
 */
export async function suggestPlaces(text: string, bias?: { lat: number; lon: number } | null, signal?: AbortSignal): Promise<Suggestion[]> {
  const q = norm(text);
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const keys = words.filter(w => !GENERIC.has(w));
  const core = (keys.length ? keys : words).join(' ');
  const saidStay = keys.length < words.length || keys.length > 1;
  const scored = [...HOODS, ...HE_PLACES].map(p => ({ p, s: Math.min(fuzzy(core, p.name), fuzzy(core, p.en)) })).filter(x => x.s < 9).sort((a, b) => a.s - b.s);
  const local: Suggestion[] = scored.slice(0, 4).map(({ p }) => ({ name: p.name, lat: p.lat, lon: p.lon, country: p.country, sub: p.en, type: 'area' }));
  let remote: (Suggestion & { d: number; full: boolean })[] = [];
  if (!/[\u0590-\u05FF]/.test(text) || local.length === 0) {
    const b = bias ?? KATHMANDU;
    const [st, pl] = await Promise.all([
      photon(core, STAY_TAGS.map(t => `tourism:${t}`), b, signal),
      keys.length ? photon(core, ['place'], b, signal) : Promise.resolve([]),
    ]);
    const tokens = (keys.length ? keys : words).filter(t => t.length >= 2);
    remote = [...st, ...pl].filter((f: any) => f.properties?.name).map((f: any) => {
      const pr = f.properties; const stay = pr.osm_key === 'tourism';
      const town = pr.city || pr.town || pr.village || pr.district || pr.county;
      const ot = ({ N: 'node', W: 'way', R: 'relation' } as Record<string, string>)[pr.osm_type];
      const [lon, lat] = f.geometry.coordinates;
      const full = allTokens(tokens, [pr.name, town, pr.county, pr.state, pr.country].filter(Boolean).join(' '));
      const base = stay
        ? { type: 'stay' as const, name: pr.name, lat, lon, country: pr.countrycode?.toUpperCase(), kind: pr.osm_value, city: town, placeId: ot ? `osm-${ot}-${pr.osm_id}` : undefined, sub: [town, pr.country].filter(Boolean).join(', ') }
        : { type: 'area' as const, name: pr.name, lat, lon, country: pr.countrycode?.toUpperCase(), sub: [pr.osm_value === 'city' ? null : town, pr.state, pr.country].filter(Boolean).join(', ') };
      return { ...base, d: km(b.lat, b.lon, lat, lon), full };
    }).filter(x => x.type === 'area' || x.placeId)
      // Keep results that contain every key word; partial matches only if they are close by.
      .filter(x => x.full || x.d < 300)
      .sort((a, c) => (Number(c.full) - Number(a.full)) || (a.d - c.d));
  }
  const seen = new Set<string>();
  const all: Suggestion[] = [...local, ...remote].filter(s => { const k = `${s.type}:${s.lat.toFixed(s.type === 'stay' ? 4 : 2)},${s.lon.toFixed(s.type === 'stay' ? 4 : 2)}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(s => { const { d, full, ...rest } = s as any; return rest as Suggestion; });
  const stays = all.filter(s => s.type === 'stay').slice(0, 5), areas = all.filter(s => s.type !== 'stay').slice(0, 5);
  const stayFirst = stays.length > 0 && (saidStay || remote[0]?.type === 'stay') && !(local.length && scored[0]?.s === 0 && !saidStay);
  return stayFirst ? [...stays, ...areas] : [...areas, ...stays];
}

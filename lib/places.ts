export type Place = { id: string; name: string; kind: string; lat: number; lon: number; distance?: number; country?: string };
export type Area = { name: string; lat: number; lon: number; country?: string };

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

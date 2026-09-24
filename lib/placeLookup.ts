/** Server-side place details by OSM id (Nominatim lookup, cached a day), with D1 reports as fallback. */
import { env } from './env';

export type PlaceInfo = { id: string; name: string; kind: string; lat: number; lon: number; country?: string; locality?: string; region?: string; wikidata?: string; commons?: string; reports: number };
const UA = { 'User-Agent': 'israeli-stay-prices/1.0 (https://github.com/YuvalHir/israeli-stay-prices)' };
const LODGING = ['hotel', 'guest_house', 'hostel', 'alpine_hut', 'motel', 'apartment', 'chalet'];

/** Nominatim lookup for up to 50 OSM ids per call. */
export async function nominatimLookup(ids: string[]): Promise<Record<string, Omit<PlaceInfo, 'reports'>>> {
  const out: Record<string, Omit<PlaceInfo, 'reports'>> = {};
  const osm = ids.map(id => id.match(/^osm-(node|way|relation)-(\d+)$/)).filter(Boolean) as RegExpMatchArray[];
  for (let i = 0; i < osm.length; i += 50) {
    const q = osm.slice(i, i + 50).map(m => m[1][0].toUpperCase() + m[2]).join(',');
    const r = await fetch(`https://nominatim.openstreetmap.org/lookup?osm_ids=${q}&format=jsonv2&extratags=1&addressdetails=1&accept-language=en`,
      { headers: UA, signal: AbortSignal.timeout(8000), cf: { cacheTtl: 86400, cacheEverything: true } } as RequestInit);
    if (!r.ok) continue;
    for (const p of await r.json() as any[]) {
      const a = p.address ?? {}, x = p.extratags ?? {};
      const id = `osm-${p.osm_type}-${p.osm_id}`;
      out[id] = {
        id, name: p.name || p.namedetails?.name || '', kind: p.category === 'tourism' && LODGING.includes(p.type) ? p.type : 'guest_house',
        lat: Number(p.lat), lon: Number(p.lon), country: a.country_code?.toUpperCase(),
        locality: a.village || a.town || a.city || a.hamlet || a.suburb || a.municipality || a.county, region: a.state || a.county,
        wikidata: /^Q\d+$/.test(x.wikidata ?? '') ? x.wikidata : undefined, commons: x.wikimedia_commons || x.image || undefined,
      };
    }
  }
  return out;
}

export async function getPlace(id: string): Promise<PlaceInfo | null> {
  const { DB } = await env();
  const agg = await DB.prepare(`SELECT MAX(place_name) AS name, MAX(place_kind) AS kind, AVG(lat) AS lat, AVG(lon) AS lon, MAX(country) AS country, MAX(area) AS area, COUNT(*) AS n FROM reports WHERE place_id = ?`)
    .bind(id).first<{ name: string | null; kind: string | null; lat: number | null; lon: number | null; country: string | null; area: string | null; n: number }>();
  const reports = agg?.n ?? 0;
  if (id.startsWith('osm-')) {
    const found = (await nominatimLookup([id]).catch(() => ({} as Record<string, never>)))[id];
    if (found?.name) return { ...found, reports };
  }
  if (agg?.name) return { id, name: agg.name, kind: agg.kind ?? 'guest_house', lat: agg.lat ?? NaN, lon: agg.lon ?? NaN, country: agg.country ?? undefined, locality: agg.area && agg.area !== 'המיקום שלך' ? agg.area : undefined, reports };
  return null;
}

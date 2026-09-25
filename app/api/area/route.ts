import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { nearbyStays, type Place } from '@/lib/places';
import { badRequest, validCoord } from '@/lib/security';

// One request for the area list: nearby stays from OSM plus report counts, instead of
// three chained round trips from the phone. No prices here; those stay behind the gate
// in /api/reports. The OSM part is cached at the edge by a ~100 m grid cell for a day.
const OSM_TTL = 86400;

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat')), lon = Number(req.nextUrl.searchParams.get('lon'));
  if (!req.nextUrl.searchParams.has('lat') || !validCoord(lat, lon)) return badRequest();
  const cLat = Math.round(lat * 1000) / 1000, cLon = Math.round(lon * 1000) / 1000;
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(`https://area-cache.internal/osm?lat=${cLat}&lon=${cLon}`);
  let osm: Place[] | null = null;
  try {
    const hit = cache && await cache.match(key);
    if (hit) osm = await hit.json();
  } catch { /* cache miss */ }
  const { DB } = await env();
  const dLat = 0.03, dLon = 0.03 / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const reportedQ = DB.prepare(
    `SELECT place_id AS id, MAX(place_name) AS name, MAX(place_kind) AS kind, AVG(lat) AS lat, AVG(lon) AS lon, MAX(country) AS country, COUNT(*) AS n
     FROM reports WHERE hidden = 0 AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? GROUP BY place_id LIMIT 100`,
  ).bind(lat - dLat, lat + dLat, lon - dLon, lon + dLon).all<Place & { n: number }>();
  if (!osm) {
    osm = await nearbyStays(cLat, cLon).catch(() => null);
    if (osm?.length && cache) {
      const res = new Response(JSON.stringify(osm), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${OSM_TTL}` } });
      try { await cache.put(key, res); } catch { /* best effort */ }
    }
  }
  const reported: (Place & { n: number })[] = (await reportedQ).results;
  // Counts for OSM places whose reports sit outside the 3 km box (rare, but keep them right).
  const counts: Record<string, number> = Object.fromEntries(reported.map(r => [r.id, r.n]));
  const missing = (osm ?? []).map(p => p.id).filter(id => !(id in counts)).slice(0, 100);
  if (missing.length) {
    const { results } = await DB.prepare(`SELECT place_id AS id, COUNT(*) AS n FROM reports WHERE hidden = 0 AND place_id IN (${missing.map(() => '?').join(',')}) GROUP BY place_id`)
      .bind(...missing).all<{ id: string; n: number }>();
    for (const r of results) counts[r.id] = r.n;
  }
  const places = osm?.map(({ distance, ...p }) => p) ?? null;
  return NextResponse.json({ places, reported, counts }, { headers: { 'Cache-Control': 'no-store' } });
}

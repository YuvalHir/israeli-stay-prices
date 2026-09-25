import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { creditState, SEARCHES_PER_CREDIT } from '@/lib/gate';
import { OFFLINE_ROUTES } from '@/lib/offlineRoutes';
import { badRequest, rateLimited, readJson, sameOrigin, tooMany, validCoord } from '@/lib/security';
import { nearbyStays } from '@/lib/places';

type Stop = { name: string; lat: number; lon: number };
const near = (a: {lat:number;lon:number}, b: {lat:number;lon:number}) => Math.hypot((a.lat - b.lat) * 111, (a.lon - b.lon) * 111 * Math.cos(a.lat * Math.PI / 180));
const allowed = (s: Stop) => validCoord(s.lat, s.lon) && s.lat >= 26 && s.lat <= 31 && s.lon >= 80 && s.lon <= 89;
const CACHE_POLICY = { 'Cache-Control': 'private, no-store' };
const toHex = (x: ArrayBuffer) => Array.from(new Uint8Array(x), n => n.toString(16).padStart(2, '0')).join('');
/** One server-authorized snapshot. Route pricing never goes through a public cache. */
export async function POST(req: NextRequest) {
  const e = await env();
  if (!sameOrigin(req, e.APP_URL)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (await rateLimited(e, req, 'offline-route', 'RL_WRITE')) return tooMany();
  const user = await currentUser();
  if (!user || user.banned) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const b = await readJson<{ routeKey?: unknown; requestId?: unknown; trekDays?: unknown; stops?: unknown }>(req);
  const route = OFFLINE_ROUTES.find(r => r.key === b?.routeKey);
  const requestId = typeof b?.requestId === 'string' ? b.requestId : '';
  const raw = b?.stops;
  if (!route || !new RegExp(`^${route?.key ?? 'invalid'}:[a-f0-9-]{36}$`, 'i').test(requestId) || !Number.isInteger(b?.trekDays) || (b!.trekDays as number) < 1 || (b!.trekDays as number) > 30 || !Array.isArray(raw) || raw.length < 2 || raw.length > 30) return badRequest();
  const stops: Stop[] = raw.map(x => ({ name: typeof x?.name === 'string' ? x.name.trim().slice(0, 90) : '', lat: x?.lat, lon: x?.lon }));
  if (stops.some(s => !s.name || !allowed(s)) || stops.some((s, i) => stops.slice(0, i).some(t => near(s, t) < .15))) return badRequest();
  // Research OSM first. Never spend a credit for a route with no lodges or a failed lookup.
  const { DB } = e;
  const found: { name: string; lat: number; lon: number; lodges: { id: string; name: string; kind: string; lat: number; lon: number; country?: string; reports: number }[] }[] = [];
  for (let i = 0; i < stops.length; i += 4) {
    const batch = await Promise.all(stops.slice(i, i + 4).map(async s => {
    const [osm, reported] = await Promise.all([
      nearbyStays(s.lat, s.lon).catch(() => null),
      DB.prepare(`SELECT place_id AS id, MAX(place_name) AS name, MAX(place_kind) AS kind, AVG(lat) AS lat, AVG(lon) AS lon, MAX(country) AS country, COUNT(*) AS reports
        FROM reports WHERE hidden = 0 AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? GROUP BY place_id LIMIT 100`)
        .bind(s.lat - .02, s.lat + .02, s.lon - .025, s.lon + .025).all<{ id: string; name: string; kind: string; lat: number; lon: number; country: string | null; reports: number }>(),
    ]);
    if (!osm && !reported.results.length) throw new Error('lookup_unavailable');
    const places = new Map<string, { id: string; name: string; kind: string; lat: number; lon: number; country?: string; reports: number }>();
    for (const p of osm ?? []) if (near(s, p) <= 2) places.set(p.id, { id: p.id, name: p.name, kind: p.kind, lat: p.lat, lon: p.lon, country: p.country, reports: 0 });
    for (const p of reported.results) if (p.lat != null && p.lon != null && near(s, p) <= 2) places.set(p.id, { ...p, kind: p.kind ?? 'guest_house', country: p.country ?? undefined });
    return { ...s, lodges: [...places.values()].slice(0, 100) };
    })).catch(() => null);
    if (!batch) return NextResponse.json({ error: 'lookup_unavailable' }, { status: 503, headers: CACHE_POLICY });
    found.push(...batch);
  }
  if (!found.some(s => s.lodges.length)) return NextResponse.json({ error: 'no_lodges', stops: found.map(s => ({ name: s.name, count: 0 })) }, { status: 422, headers: CACHE_POLICY });
  const ttlDays = (b!.trekDays as number) * 2;
  const stopHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ routeKey: route.key, trekDays: b!.trekDays, stops }))).then(toHex);
  const prev = await DB.prepare('SELECT id, expires_at, stops_hash FROM offline_route_searches WHERE user_id = ? AND request_id = ?')
    .bind(user.id, requestId).first<{ id: string; expires_at: string; stops_hash: string }>();
  if (prev && prev.stops_hash !== stopHash) return badRequest();
  if (!user.is_admin && !prev) {
    const id = crypto.randomUUID();
    const until = new Date(Date.now() + ttlDays * 864e5).toISOString();
    const result = await DB.prepare(`INSERT OR IGNORE INTO offline_route_searches (id, user_id, route_key, request_id, stops_hash, expires_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE
        ((SELECT COUNT(*) FROM reports WHERE user_id = ?2) +
         (SELECT COUNT(*) FROM report_votes v JOIN reports r ON r.id = v.report_id WHERE v.user_id = ?2 AND v.vote = 1 AND r.user_id <> ?2)) * ?7 >
        ((SELECT COUNT(*) FROM searches WHERE user_id = ?2) + (SELECT COUNT(*) FROM offline_route_searches WHERE user_id = ?2))`)
      .bind(id, user.id, route.key, requestId, stopHash, until, SEARCHES_PER_CREDIT).run();
    if (!result.meta.changes) {
      const retry = await DB.prepare('SELECT id, stops_hash FROM offline_route_searches WHERE user_id = ? AND request_id = ?').bind(user.id, requestId).first<{ id: string; stops_hash: string }>();
      if (retry && retry.stops_hash !== stopHash) return badRequest();
      if (!retry) return NextResponse.json({ error: 'report_required', ...(await creditState(DB, user.id)) }, { status: 402, headers: CACHE_POLICY });
    }
  }
  const grant = user.is_admin ? { id: 'admin', expires_at: new Date(Date.now() + ttlDays * 864e5).toISOString(), stops_hash: stopHash } : await DB.prepare('SELECT id, expires_at, stops_hash FROM offline_route_searches WHERE user_id = ? AND request_id = ?')
    .bind(user.id, requestId).first<{ id: string; expires_at: string; stops_hash: string }>();
  if (grant && grant.stops_hash !== stopHash) return badRequest();
  if (!grant || Date.parse(grant.expires_at) <= Date.now()) return NextResponse.json({ error: 'expired' }, { status: 409, headers: CACHE_POLICY });
  const ids = [...new Set(found.flatMap(s => s.lodges.map(l => l.id)))].slice(0, 1800);
  const prices: { placeId: string; price: number; currency: string; room: 'private' | 'dorm'; beds: number | null; israeliDeal: number }[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { results } = await DB.prepare(`SELECT place_id, price, currency, room, beds, israeli_deal, lat, lon FROM reports WHERE hidden = 0 AND place_id IN (${chunk.map(() => '?').join(',')}) ORDER BY created_at DESC LIMIT 500`).bind(...chunk).all<{ place_id: string; price: number; currency: string; beds: number | null; israeli_deal: number; room: 'private' | 'dorm'; lat: number | null; lon: number | null }>();
    for (const r of results) if (prices.length < 3000 && r.lat != null && r.lon != null && found.some(stop => near(stop, { lat: r.lat!, lon: r.lon! }) <= 2)) prices.push({ placeId: r.place_id, price: r.price, currency: r.currency, room: r.room, beds: r.beds, israeliDeal: r.israeli_deal });
  }
  return NextResponse.json({ key: requestId, name: route.name, savedAt: Date.now(), pricesExpireAt: Date.parse(grant.expires_at), stops: found, prices, trekDays: b!.trekDays, creditsUsed: user.is_admin || !!prev ? 0 : 1, entitlementId: grant.id, searchesLeft: (await creditState(DB, user.id, !!user.is_admin)).searchesLeft }, { headers: CACHE_POLICY });
}

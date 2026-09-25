import { countEvent } from '@/lib/events';
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { isCurrency } from '@/lib/currency';
import { trekDealRegion } from '@/lib/trekDeal';
import { creditState, searchCovers, searchValid } from '@/lib/gate';
import { nominatimLookup } from '@/lib/placeLookup';
import { badRequest, rateLimited, readJson, sameOrigin, tooMany, validCoord } from '@/lib/security';

// Report counts per place (public, no prices) so the list can show "3 reports".
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat')), lon = Number(req.nextUrl.searchParams.get('lon'));
  if (Number.isFinite(lat) && Number.isFinite(lon) && req.nextUrl.searchParams.has('lat')) {
    // Places with reports near a point (about 3 km), so reported places always show up in the list.
    const dLat = 0.03, dLon = 0.03 / Math.max(0.2, Math.cos(lat * Math.PI / 180));
    const { DB } = await env();
    const { results } = await DB.prepare(
      `SELECT place_id AS id, MAX(place_name) AS name, MAX(place_kind) AS kind, AVG(lat) AS lat, AVG(lon) AS lon, MAX(country) AS country, COUNT(*) AS n
       FROM reports WHERE hidden = 0 AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? GROUP BY place_id LIMIT 100`,
    ).bind(lat - dLat, lat + dLat, lon - dLon, lon + dLon).all();
    return NextResponse.json({ places: results });
  }
  const ids = (req.nextUrl.searchParams.get('placeIds') ?? '').split(',').filter(Boolean).slice(0, 100);
  if (!ids.length) return NextResponse.json({ counts: {}, prices: {} });
  const { DB } = await env();
  const { results } = await DB.prepare(
    `SELECT place_id, price, currency, lat, lon, beds, israeli_deal FROM reports WHERE hidden = 0 AND place_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC LIMIT 2000`,
  ).bind(...ids).all<{ place_id: string; price: number; currency: string; lat: number | null; lon: number | null; beds: number | null; israeli_deal: number }>();
  // Prices only for signed-in users with an active search; everyone else sees counts.
  const user = await currentUser();
  const sid = req.nextUrl.searchParams.get('searchId');
  const canSee = !!user && await searchValid(DB, user.id, sid, !!user.is_admin);
  // A place's location is the average of its reports' coordinates. Places with no coordinates are never "inside".
  const inside = canSee ? new Map<string, boolean>() : null;
  if (inside) {
    const pts = new Map<string, [number, number, number]>();
    for (const r of results) if (r.lat != null && r.lon != null) { const p = pts.get(r.place_id) ?? [0, 0, 0]; pts.set(r.place_id, [p[0] + r.lat, p[1] + r.lon, p[2] + 1]); }
    for (const id of new Set<string>(results.map((r: { place_id: string }) => r.place_id))) {
      const p = pts.get(id);
      inside.set(id, await searchCovers(DB, user!.id, sid, p ? p[0] / p[2] : null, p ? p[1] / p[2] : null, !!user!.is_admin));
    }
  }
  // Only non-price metadata is public; every price stays behind the existing search/location gate.
  const counts: Record<string, number> = {}, features: Record<string, [number | null, number][]> = {}, prices: Record<string, [number, string, number | null, number][]> = {};
  for (const r of results) {
    counts[r.place_id] = (counts[r.place_id] ?? 0) + 1;
    if (inside?.get(r.place_id)) {
      (features[r.place_id] ??= []).push([r.beds, r.israeli_deal]);
      (prices[r.place_id] ??= []).push([r.price, r.currency, r.beds, r.israeli_deal]);
    }
  }
  return NextResponse.json({ counts, features, prices });
}

/** Limits that keep one account from farming searches or flooding a place. */
const REPORTS_PER_DAY = 10;
const OSM_ID = /^osm-(node|way|relation)-\d+$/;
const MANUAL_ID = /^manual-[\p{L}\p{N}-]{1,200}$/u;
const KINDS = ['hotel', 'guest_house', 'hostel', 'alpine_hut', 'motel', 'apartment', 'chalet', 'camp_site', 'lodge'];

export async function POST(req: NextRequest) {
  const e = await env();
  if (!sameOrigin(req, e.APP_URL)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (await rateLimited(e, req, 'reports', 'RL_WRITE')) return tooMany();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  if (user.banned) return NextResponse.json({ error: 'blocked' }, { status: 403 });
  const b = await readJson<Record<string, unknown>>(req);
  if (!b) return badRequest();
  const str = (v: unknown, max: number) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const price = typeof b.price === 'number' ? b.price : Number(b.price);
  const currency = str(b.currency, 3), room = str(b.room, 10);
  const israeliDeal = b.israeliDeal === true;
  const clientReportId = typeof b.clientReportId === 'string' && /^[a-f0-9-]{36}$/i.test(b.clientReportId) ? b.clientReportId : null;
  const beds = b.beds == null || b.beds === '' ? null : b.beds;
  if (beds !== null && (typeof beds !== 'number' || !Number.isInteger(beds) || beds < 1 || beds > 20)) return badRequest();
  let placeName = str(b.placeName, 120);
  if (!placeName || !Number.isFinite(price) || (israeliDeal ? price !== 0 : !(price > 0)) || price > 10_000_000 || !isCurrency(currency) || !['dorm', 'private'].includes(room)) return badRequest();
  const nightsN = typeof b.nights === 'number' ? b.nights : Number(b.nights ?? 1);
  if (!Number.isFinite(nightsN)) return badRequest();
  const nights = Math.max(1, Math.min(60, Math.round(nightsN)));
  const now = new Date(), thisMonth = now.toISOString().slice(0, 7);
  const sm = str(b.stayMonth, 7);
  // Stays from the last 2 years up to this month; anything else becomes this month.
  const minMonth = `${now.getUTCFullYear() - 2}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sm) && sm <= thisMonth && sm >= minMonth ? sm : thisMonth;
  const area = str(b.area, 120) || null, note = str(b.note, 300) || null;
  let country = /^[A-Za-z]{2}$/.test(str(b.country, 2)) ? str(b.country, 2).toUpperCase() : null;
  let kind: string | null = KINDS.includes(str(b.placeKind, 20)) ? str(b.placeKind, 20) : null;
  let lat: number | null = validCoord(b.lat, b.lon) ? b.lat as number : null, lon: number | null = lat == null ? null : b.lon as number;

  // Place id: OSM ids are checked against OpenStreetMap and take its name and location. Anything else is a manual place keyed by country + area + name.
  const slug = (x?: string | null) => (x ?? '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const rawId = str(b.placeId, 200);
  let placeId: string;
  if (OSM_ID.test(rawId)) {
    const osm = (await nominatimLookup([rawId]).catch(() => ({} as Record<string, never>)))[rawId];
    if (!osm) return NextResponse.json({ error: 'unknown_place' }, { status: 400 });
    placeId = rawId; placeName = osm.name?.slice(0, 120) || placeName; lat = osm.lat; lon = osm.lon; country = osm.country ?? country; kind = osm.kind ?? kind;
  } else if (MANUAL_ID.test(rawId)) placeId = rawId;
  else placeId = `manual-${(country ?? 'xx').toLowerCase()}-${slug(area) || 'area'}-${slug(placeName) || 'place'}`;

  if (israeliDeal && !trekDealRegion(lat, lon)) return badRequest();
  const { DB } = e;
  if (clientReportId) {
    const prior = await DB.prepare('SELECT id FROM reports WHERE user_id = ? AND client_report_id = ?').bind(user.id, clientReportId).first();
    if (prior) return NextResponse.json({ ok: true, duplicate: true, ...(await creditState(DB, user.id, !!user.is_admin)) });
  }
  const lim = await DB.prepare(
    `SELECT (SELECT COUNT(*) FROM reports WHERE user_id = ?1 AND created_at >= datetime('now', '-1 day')) AS today,
            (SELECT COUNT(*) FROM reports WHERE user_id = ?1 AND place_id = ?2 AND stay_month = ?3) AS same`,
  ).bind(user.id, placeId, month).first<{ today: number; same: number }>();
  if (!user.is_admin && (lim?.same ?? 0) > 0) return NextResponse.json({ error: 'duplicate' }, { status: 409 });
  if (!user.is_admin && (lim?.today ?? 0) >= REPORTS_PER_DAY) return NextResponse.json({ error: 'daily_limit' }, { status: 429 });
  await DB.prepare(
    `INSERT INTO reports (id, user_id, place_id, place_name, place_kind, lat, lon, area, country, price, currency, room, nights, stay_month, note, beds, israeli_deal, client_report_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), user.id, placeId, placeName, kind, lat, lon, area, country, price, currency, room, nights, month, note, beds, israeliDeal ? 1 : 0, clientReportId).run();
  await countEvent(DB, 'report_sent');
  return NextResponse.json({ ok: true, ...(await creditState(DB, user.id, !!user.is_admin)) });
}

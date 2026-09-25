import { countEvent } from '@/lib/events';
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { isCurrency } from '@/lib/currency';
import { creditState, searchCovers, searchValid } from '@/lib/gate';

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
    `SELECT place_id, price, currency, lat, lon FROM reports WHERE hidden = 0 AND place_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC LIMIT 2000`,
  ).bind(...ids).all<{ place_id: string; price: number; currency: string; lat: number | null; lon: number | null }>();
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
  // Per place: report count and the prices (amount + currency) so the client can show a median in any display currency.
  const counts: Record<string, number> = {}, prices: Record<string, [number, string][]> = {};
  for (const r of results) { counts[r.place_id] = (counts[r.place_id] ?? 0) + 1; if (inside?.get(r.place_id)) (prices[r.place_id] ??= []).push([r.price, r.currency]); }
  return NextResponse.json({ counts, prices });
}

type Body = {
  placeId: string; placeName: string; placeKind?: string; lat?: number; lon?: number; area?: string;
  country?: string; price: number; currency: string; room: 'dorm' | 'private'; nights?: number; stayMonth?: string; note?: string;
};

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  if (user.banned) return NextResponse.json({ error: 'blocked' }, { status: 403 });
  const b = await req.json() as Body;
  const price = Number(b.price);
  if (!b.placeName?.trim() || !(price > 0) || price > 10_000_000 ||
      !isCurrency(b.currency) || !['dorm', 'private'].includes(b.room)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  // Manual places are keyed by country + area + name, so same-named places in different towns stay separate.
  const slug = (x?: string) => (x ?? '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  const placeId = b.placeId?.trim() || `manual-${(b.country ?? 'xx').toLowerCase()}-${slug(b.area) || 'area'}-${slug(b.placeName)}`;
  const month = /^\d{4}-\d{2}$/.test(b.stayMonth ?? '') ? b.stayMonth! : new Date().toISOString().slice(0, 7);
  const { DB } = await env();
  await DB.prepare(
    `INSERT INTO reports (id, user_id, place_id, place_name, place_kind, lat, lon, area, country, price, currency, room, nights, stay_month, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), user.id, placeId, b.placeName.trim().slice(0, 120), b.placeKind ?? null,
    b.lat ?? null, b.lon ?? null, b.area?.slice(0, 120) ?? null, /^[A-Za-z]{2}$/.test(b.country ?? '') ? b.country!.toUpperCase() : null, price, b.currency, b.room,
    Math.max(1, Math.min(60, Math.round(b.nights ?? 1))), month, b.note?.trim().slice(0, 300) || null,
  ).run();
  await countEvent(DB, 'report_sent');
  return NextResponse.json({ ok: true, ...(await creditState(DB, user.id, !!user.is_admin)) });
}

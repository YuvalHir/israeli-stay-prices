import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { isCurrency } from '@/lib/currency';

// Report counts per place (public, no prices) so the list can show "3 reports".
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat')), lon = Number(req.nextUrl.searchParams.get('lon'));
  if (Number.isFinite(lat) && Number.isFinite(lon) && req.nextUrl.searchParams.has('lat')) {
    // Places with reports near a point (about 3 km), so reported places always show up in the list.
    const dLat = 0.03, dLon = 0.03 / Math.max(0.2, Math.cos(lat * Math.PI / 180));
    const { DB } = await env();
    const { results } = await DB.prepare(
      `SELECT place_id AS id, MAX(place_name) AS name, MAX(place_kind) AS kind, AVG(lat) AS lat, AVG(lon) AS lon, MAX(country) AS country, COUNT(*) AS n
       FROM reports WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? GROUP BY place_id LIMIT 100`,
    ).bind(lat - dLat, lat + dLat, lon - dLon, lon + dLon).all();
    return NextResponse.json({ places: results });
  }
  const ids = (req.nextUrl.searchParams.get('placeIds') ?? '').split(',').filter(Boolean).slice(0, 80);
  if (!ids.length) return NextResponse.json({ counts: {} });
  const { DB } = await env();
  const { results } = await DB.prepare(
    `SELECT place_id, COUNT(*) AS n FROM reports WHERE place_id IN (${ids.map(() => '?').join(',')}) GROUP BY place_id`,
  ).bind(...ids).all<{ place_id: string; n: number }>();
  return NextResponse.json({ counts: Object.fromEntries(results.map((r: { place_id: string; n: number }) => [r.place_id, r.n])) });
}

type Body = {
  placeId: string; placeName: string; placeKind?: string; lat?: number; lon?: number; area?: string;
  country?: string; price: number; currency: string; room: 'dorm' | 'private'; nights?: number; stayMonth?: string; note?: string;
};

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const b = await req.json() as Body;
  const price = Number(b.price);
  if (!b.placeName?.trim() || !(price > 0) || price > 10_000_000 ||
      !isCurrency(b.currency) || !['dorm', 'private'].includes(b.room)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const placeId = b.placeId?.trim() || `manual-${b.placeName.trim().toLowerCase()}`;
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
  return NextResponse.json({ ok: true });
}

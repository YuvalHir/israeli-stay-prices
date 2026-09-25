import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { ANON_VIEWS, anonId, searchCovers } from '@/lib/gate';
import { badRequest, placeLocation, rateLimited, readJson, tooMany } from '@/lib/security';

// Prices for one place.
// Visitors: 3 places per browser session (cookie), then login.
// Signed-in users: need an active search whose circle contains the place's server-known location.
export async function POST(req: NextRequest) {
  const e = await env();
  if (await rateLimited(e, req, 'views')) return tooMany();
  const b = await readJson<{ placeId?: unknown; placeName?: unknown; searchId?: unknown }>(req);
  const placeId = typeof b?.placeId === 'string' ? b.placeId.trim() : '';
  if (!placeId || placeId.length > 200) return badRequest();
  const placeName = typeof b?.placeName === 'string' ? b.placeName.slice(0, 200) : '';
  const searchId = typeof b?.searchId === 'string' ? b.searchId.slice(0, 64) : undefined;
  const user = await currentUser();
  const { DB } = e;
  let anonLeft: number | null = null;

  if (!user) {
    const id = (await anonId(true))!;
    const s = await DB.prepare(
      `SELECT (SELECT COUNT(*) FROM anon_views WHERE anon_id = ?1) AS views, (SELECT COUNT(*) FROM anon_views WHERE anon_id = ?1 AND place_id = ?2) AS seen`,
    ).bind(id, placeId).first<{ views: number; seen: number }>();
    if (!s?.seen && (s?.views ?? 0) >= ANON_VIEWS) return NextResponse.json({ error: 'login_required' }, { status: 401 });
    if (!s?.seen) await DB.prepare('INSERT OR IGNORE INTO anon_views (anon_id, place_id) VALUES (?, ?)').bind(id, placeId).run();
    anonLeft = Math.max(0, ANON_VIEWS - (s?.views ?? 0) - (s?.seen ? 0 : 1));
  }
  const loc = await placeLocation(DB, placeId);
  if (user && !(await searchCovers(DB, user.id, searchId, loc?.lat, loc?.lon, !!user.is_admin))) {
    return NextResponse.json({ error: 'report_required' }, { status: 402 });
  }

  // Same-named reports filed under another id count only when they sit within ~1 km of this place.
  const nameKey = loc ? placeName.trim().toLowerCase() : '';
  const uid = user?.id ?? '';
  const { results } = await DB.prepare(
    `SELECT r.id, r.place_name, r.country, r.price, r.currency, r.room, r.beds, r.israeli_deal, r.nights, r.stay_month, r.note, r.created_at,
       (r.user_id = ?1) AS mine_report,
       (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.vote = 1) AS up,
       (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.vote = -1) AS down,
       (SELECT vote FROM report_votes v WHERE v.report_id = r.id AND v.user_id = ?1) AS my_vote
     FROM reports r WHERE r.hidden = 0 AND (r.place_id = ?2 OR (?3 <> '' AND lower(r.place_name) = ?3 AND r.lat IS NOT NULL AND abs(r.lat - ?4) < 0.01 AND abs(r.lon - ?5) < 0.01))
     ORDER BY r.created_at DESC LIMIT 100`,
  ).bind(uid, placeId, nameKey, loc?.lat ?? 0, loc?.lon ?? 0).all();
  return NextResponse.json({ reports: results, anonLeft });
}

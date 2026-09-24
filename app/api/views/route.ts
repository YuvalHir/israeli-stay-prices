import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { ANON_VIEWS, anonId, searchCovers } from '@/lib/gate';

// Prices for one place.
// Visitors: 3 places per browser session, then login. Signed-in users: need an active search covering the place.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const { placeId, placeName, lat, lon, searchId } = await req.json() as { placeId: string; placeName?: string; lat?: number; lon?: number; searchId?: string };
  if (!placeId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { DB } = await env();
  let anonLeft: number | null = null;

  if (!user) {
    const id = (await anonId(true))!;
    const s = await DB.prepare(
      `SELECT (SELECT COUNT(*) FROM anon_views WHERE anon_id = ?1) AS views, (SELECT COUNT(*) FROM anon_views WHERE anon_id = ?1 AND place_id = ?2) AS seen`,
    ).bind(id, placeId).first<{ views: number; seen: number }>();
    if (!s?.seen && (s?.views ?? 0) >= ANON_VIEWS) return NextResponse.json({ error: 'login_required' }, { status: 401 });
    if (!s?.seen) await DB.prepare('INSERT OR IGNORE INTO anon_views (anon_id, place_id) VALUES (?, ?)').bind(id, placeId).run();
    anonLeft = Math.max(0, ANON_VIEWS - (s?.views ?? 0) - (s?.seen ? 0 : 1));
  } else if (!(await searchCovers(DB, user.id, searchId, lat, lon))) {
    return NextResponse.json({ error: 'report_required' }, { status: 402 });
  }

  const nameKey = (placeName ?? '').trim().toLowerCase();
  const uid = user?.id ?? '';
  const { results } = await DB.prepare(
    `SELECT r.id, r.place_name, r.country, r.price, r.currency, r.room, r.nights, r.stay_month, r.note, r.created_at,
       (r.user_id = ?) AS mine_report,
       (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.vote = 1) AS up,
       (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.vote = -1) AS down,
       (SELECT vote FROM report_votes v WHERE v.report_id = r.id AND v.user_id = ?) AS my_vote
     FROM reports r WHERE r.place_id = ? OR (? <> '' AND lower(r.place_name) = ?)
     ORDER BY r.created_at DESC LIMIT 100`,
  ).bind(uid, uid, placeId, nameKey, nameKey).all();
  return NextResponse.json({ reports: results, anonLeft });
}

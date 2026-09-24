import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { FREE_VIEWS } from '@/lib/gate';

// Unlock one place's prices. Free for the first 3 places, unlimited after the user reports a price.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const { placeId, placeName } = await req.json() as { placeId: string; placeName?: string };
  if (!placeId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { DB } = await env();

  const s = await DB.prepare(
    `SELECT (SELECT COUNT(*) FROM reports WHERE user_id = ?1) AS reports,
            (SELECT COUNT(*) FROM place_views WHERE user_id = ?1) AS views,
            (SELECT COUNT(*) FROM place_views WHERE user_id = ?1 AND place_id = ?2) AS seen`,
  ).bind(user.id, placeId).first<{ reports: number; views: number; seen: number }>();
  const unlocked = (s?.reports ?? 0) > 0;
  if (!s?.seen && !unlocked && (s?.views ?? 0) >= FREE_VIEWS) {
    return NextResponse.json({ error: 'report_required' }, { status: 402 });
  }
  if (!s?.seen) {
    await DB.prepare('INSERT OR IGNORE INTO place_views (user_id, place_id) VALUES (?, ?)').bind(user.id, placeId).run();
  }

  const nameKey = (placeName ?? '').trim().toLowerCase();
  const { results } = await DB.prepare(
    `SELECT r.id, r.place_name, r.country, r.price, r.currency, r.room, r.nights, r.stay_month, r.note, r.created_at,
       (r.user_id = ?) AS mine_report,
       (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.vote = 1) AS up,
       (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.vote = -1) AS down,
       (SELECT vote FROM report_votes v WHERE v.report_id = r.id AND v.user_id = ?) AS my_vote
     FROM reports r WHERE r.place_id = ? OR (? <> '' AND lower(r.place_name) = ?)
     ORDER BY r.created_at DESC LIMIT 100`,
  ).bind(user.id, user.id, placeId, nameKey, nameKey).all();
  const views = (s?.views ?? 0) + (s?.seen ? 0 : 1);
  return NextResponse.json({ reports: results, viewsLeft: unlocked ? null : Math.max(0, FREE_VIEWS - views) });
}

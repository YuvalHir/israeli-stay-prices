import { NextRequest, NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { env } from '@/lib/env';

// Admin-only. Every handler checks the session's is_admin flag on the server before touching data.
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { DB } = await env();
  const [stats, users, reports, byCountry, daily, votes, topPlaces, events] = await DB.batch([
    DB.prepare(`SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM reports) AS reports,
      (SELECT COUNT(*) FROM searches) AS views, (SELECT COUNT(DISTINCT place_id) FROM reports WHERE hidden = 0) AS places,
      (SELECT COUNT(*) FROM report_votes) AS votes, (SELECT COUNT(*) FROM reports WHERE hidden = 1) AS hidden,
      (SELECT COUNT(*) FROM users WHERE banned = 1) AS banned, (SELECT COUNT(*) FROM anon_views) AS anonViews,
      (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now','-7 days')) AS users7,
      (SELECT COUNT(*) FROM reports WHERE created_at >= datetime('now','-7 days')) AS reports7,
      (SELECT COUNT(*) FROM searches WHERE created_at >= datetime('now','-7 days')) AS views7,
      (SELECT COUNT(*) FROM report_votes WHERE created_at >= datetime('now','-7 days')) AS votes7`),
    DB.prepare(`SELECT u.id, u.email, u.name, u.is_admin, u.banned, u.created_at,
      (SELECT COUNT(*) FROM reports r WHERE r.user_id = u.id) AS reports,
      (SELECT COUNT(*) FROM reports r WHERE r.user_id = u.id AND r.created_at >= datetime('now','-1 day')) AS reports24,
      (SELECT COUNT(*) FROM searches v WHERE v.user_id = u.id) AS views,
      (SELECT COUNT(*) FROM report_votes v WHERE v.user_id = u.id) AS votes,
      (SELECT MAX(t) FROM (SELECT MAX(created_at) AS t FROM reports WHERE user_id = u.id UNION ALL SELECT MAX(created_at) FROM searches WHERE user_id = u.id UNION ALL SELECT MAX(created_at) FROM report_votes WHERE user_id = u.id)) AS last_seen
      FROM users u ORDER BY u.created_at DESC LIMIT 1000`),
    DB.prepare(`SELECT r.id, r.user_id, r.place_id, r.place_name, r.area, r.country, r.price, r.currency, r.room, r.nights, r.stay_month, r.note, r.created_at, r.hidden, u.email, u.banned,
      (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.vote = 1) AS up,
      (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.vote = -1) AS down
      FROM reports r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 2000`),
    DB.prepare(`SELECT COALESCE(country, '?') AS country, COUNT(*) AS n FROM reports GROUP BY 1 ORDER BY n DESC LIMIT 30`),
    DB.prepare(`WITH RECURSIVE d(day) AS (SELECT date('now','-29 days') UNION ALL SELECT date(day,'+1 day') FROM d WHERE day < date('now'))
      SELECT d.day,
        (SELECT COUNT(*) FROM reports WHERE date(created_at) = d.day) AS reports,
        (SELECT COUNT(*) FROM users WHERE date(created_at) = d.day) AS users,
        (SELECT COUNT(*) FROM searches WHERE date(created_at) = d.day) AS views,
        (SELECT COUNT(*) FROM report_votes WHERE date(created_at) = d.day) AS votes
      FROM d ORDER BY d.day`),
    DB.prepare(`SELECT v.report_id, v.user_id, v.vote, v.created_at, u.email, r.place_name, r.price, r.currency, r.user_id AS author_id
      FROM report_votes v JOIN users u ON u.id = v.user_id JOIN reports r ON r.id = v.report_id ORDER BY v.created_at DESC LIMIT 1000`),
    DB.prepare(`SELECT place_id, MAX(place_name) AS name, MAX(country) AS country, COUNT(*) AS n FROM reports WHERE hidden = 0 GROUP BY place_id ORDER BY n DESC LIMIT 10`),
    DB.prepare(`SELECT day, name, n FROM event_counts WHERE day >= date('now','-29 days') ORDER BY day`),
  ]);
  return NextResponse.json({ me: admin.email, meId: admin.id, stats: stats.results[0], users: users.results, reports: reports.results,
    byCountry: byCountry.results, daily: daily.results, votes: votes.results, topPlaces: topPlaces.results, events: events.results });
}

type Body = { action: string; id?: string; ids?: string[]; value?: boolean; userId?: string };

export async function POST(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json() as Body;
  const { DB } = await env();
  const ids = (b.ids ?? (b.id ? [b.id] : [])).filter(x => typeof x === 'string').slice(0, 200);
  const inList = ids.map(() => '?').join(',');
  switch (b.action) {
    case 'deleteReport':
      if (!ids.length) break;
      await DB.prepare(`DELETE FROM reports WHERE id IN (${inList})`).bind(...ids).run();
      return NextResponse.json({ ok: true });
    case 'hideReport':
      if (!ids.length) break;
      await DB.prepare(`UPDATE reports SET hidden = ? WHERE id IN (${inList})`).bind(b.value ? 1 : 0, ...ids).run();
      return NextResponse.json({ ok: true });
    case 'deleteVote':
      if (!b.id || !b.userId) break;
      await DB.prepare('DELETE FROM report_votes WHERE report_id = ? AND user_id = ?').bind(b.id, b.userId).run();
      return NextResponse.json({ ok: true });
    case 'setAdmin':
      if (!b.id) break;
      if (b.id === admin.id && !b.value) return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 });
      await DB.prepare('UPDATE users SET is_admin = ? WHERE id = ?').bind(b.value ? 1 : 0, b.id).run();
      return NextResponse.json({ ok: true });
    case 'ban':
      // Blocking stops new reports and votes and hides the user's reports; unblocking shows them again.
      if (!b.id) break;
      if (b.id === admin.id) return NextResponse.json({ error: 'cannot_ban_self' }, { status: 400 });
      await DB.batch([
        DB.prepare('UPDATE users SET banned = ? WHERE id = ?').bind(b.value ? 1 : 0, b.id),
        DB.prepare('UPDATE reports SET hidden = ? WHERE user_id = ?').bind(b.value ? 1 : 0, b.id),
        ...(b.value ? [DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(b.id)] : []),
      ]);
      return NextResponse.json({ ok: true });
    case 'resetViews':
      if (!b.id) break;
      await DB.prepare('DELETE FROM searches WHERE user_id = ?').bind(b.id).run();
      return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'bad_request' }, { status: 400 });
}

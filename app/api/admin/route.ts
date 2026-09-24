import { NextRequest, NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { env } from '@/lib/env';

export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { DB } = await env();
  const [stats, users, reports, byCountry] = await DB.batch([
    DB.prepare(`SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM reports) AS reports,
      (SELECT COUNT(*) FROM place_views) AS views, (SELECT COUNT(DISTINCT place_id) FROM reports) AS places,
      (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now','-7 days')) AS users7,
      (SELECT COUNT(*) FROM reports WHERE created_at >= datetime('now','-7 days')) AS reports7`),
    DB.prepare(`SELECT u.id, u.email, u.name, u.is_admin, u.created_at,
      (SELECT COUNT(*) FROM reports r WHERE r.user_id = u.id) AS reports,
      (SELECT COUNT(*) FROM place_views v WHERE v.user_id = u.id) AS views
      FROM users u ORDER BY u.created_at DESC LIMIT 500`),
    DB.prepare(`SELECT r.id, r.place_name, r.area, r.country, r.price, r.currency, r.room, r.nights, r.stay_month, r.note, r.created_at, u.email,
      (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.vote = 1) AS up,
      (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.vote = -1) AS down
      FROM reports r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 300`),
    DB.prepare(`SELECT COALESCE(country, '?') AS country, COUNT(*) AS n FROM reports GROUP BY 1 ORDER BY n DESC LIMIT 30`),
  ]);
  return NextResponse.json({ me: admin.email, stats: stats.results[0], users: users.results, reports: reports.results, byCountry: byCountry.results });
}

export async function POST(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json() as { action: string; id?: string; value?: boolean };
  const { DB } = await env();
  if (b.action === 'deleteReport' && b.id) {
    await DB.prepare('DELETE FROM reports WHERE id = ?').bind(b.id).run();
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'setAdmin' && b.id) {
    if (b.id === admin.id && !b.value) return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 });
    await DB.prepare('UPDATE users SET is_admin = ? WHERE id = ?').bind(b.value ? 1 : 0, b.id).run();
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'resetViews' && b.id) {
    await DB.prepare('DELETE FROM place_views WHERE user_id = ?').bind(b.id).run();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'bad_request' }, { status: 400 });
}

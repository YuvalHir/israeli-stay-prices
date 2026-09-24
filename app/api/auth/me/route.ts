import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { FREE_VIEWS } from '@/lib/gate';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null });
  const { DB } = await env();
  const r = await DB.prepare(
    `SELECT (SELECT COUNT(*) FROM reports WHERE user_id = ?1) AS reports,
            (SELECT COUNT(*) FROM place_views WHERE user_id = ?1) AS views`,
  ).bind(user.id).first<{ reports: number; views: number }>();
  const reports = r?.reports ?? 0, views = r?.views ?? 0;
  return NextResponse.json({
    user: { name: user.name, email: user.email }, isAdmin: !!user.is_admin,
    reports, views, unlocked: reports > 0, viewsLeft: Math.max(0, FREE_VIEWS - views),
  });
}

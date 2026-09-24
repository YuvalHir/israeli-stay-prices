import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { creditState } from '@/lib/gate';

// Spend one "search with prices" on an area. Reuses a fresh search that already covers the point.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const { lat, lon } = await req.json() as { lat: number; lon: number };
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { DB } = await env();
  // Same spot searched again in the last hour (e.g. page reload) does not cost another search.
  const again = await DB.prepare(
    `SELECT id FROM searches WHERE user_id = ? AND created_at >= datetime('now','-1 hour') AND abs(lat - ?) < 0.01 AND abs(lon - ?) < 0.01 ORDER BY created_at DESC LIMIT 1`,
  ).bind(user.id, lat, lon).first<{ id: string }>();
  if (user.is_admin) return NextResponse.json({ searchId: 'admin', ...(await creditState(DB, user.id, true)) });
  if (again) return NextResponse.json({ searchId: again.id, ...(await creditState(DB, user.id, !!user.is_admin)) });
  const c = await creditState(DB, user.id, !!user.is_admin);
  if (c.searchesLeft <= 0) return NextResponse.json({ error: 'report_required', ...c }, { status: 402 });
  const id = crypto.randomUUID();
  await DB.prepare('INSERT INTO searches (id, user_id, lat, lon) VALUES (?, ?, ?, ?)').bind(id, user.id, lat, lon).run();
  return NextResponse.json({ searchId: id, ...c, used: c.used + 1, searchesLeft: c.searchesLeft - 1 });
}

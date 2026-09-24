import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { creditState } from '@/lib/gate';

// vote: 1 = "I paid the same", -1 = "I paid more", 0 = remove my vote.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const { reportId, vote } = await req.json() as { reportId: string; vote: number };
  if (!reportId || ![1, -1, 0].includes(vote)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { DB } = await env();
  const r = await DB.prepare('SELECT user_id FROM reports WHERE id = ?').bind(reportId).first<{ user_id: string }>();
  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (r.user_id === user.id) return NextResponse.json({ error: 'own_report' }, { status: 400 });
  if (vote === 0) await DB.prepare('DELETE FROM report_votes WHERE report_id = ? AND user_id = ?').bind(reportId, user.id).run();
  else await DB.prepare(`INSERT INTO report_votes (report_id, user_id, vote) VALUES (?, ?, ?)
    ON CONFLICT(report_id, user_id) DO UPDATE SET vote = excluded.vote, created_at = datetime('now')`).bind(reportId, user.id, vote).run();
  const c = await DB.prepare(`SELECT COALESCE(SUM(vote = 1), 0) AS up, COALESCE(SUM(vote = -1), 0) AS down FROM report_votes WHERE report_id = ?`)
    .bind(reportId).first<{ up: number; down: number }>();
  return NextResponse.json({ ok: true, up: c?.up ?? 0, down: c?.down ?? 0, mine: vote, ...(await creditState(DB, user.id, !!user.is_admin)) });
}

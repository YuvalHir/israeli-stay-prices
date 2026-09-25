import { NextRequest } from 'next/server';
import { rateLimited, sameOrigin, tooMany } from '@/lib/security';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { inviteState, newInviteCode } from '@/lib/invites';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const { DB } = await env();
  return NextResponse.json(await inviteState(DB, user.id, !!user.is_admin));
}

/** Create one single-use invite link, if the user still has invites left. */
export async function POST(req: NextRequest) {
  const e = await env();
  if (!sameOrigin(req, e.APP_URL)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (await rateLimited(e, req, 'invites', 'RL_WRITE')) return tooMany();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  if (user.banned) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { DB } = await env();
  const s = await inviteState(DB, user.id, !!user.is_admin);
  if (s.left <= 0) return NextResponse.json({ error: 'no_invites_left', ...s }, { status: 402 });
  const code = newInviteCode();
  await DB.prepare('INSERT INTO invites (code, inviter_id) VALUES (?, ?)').bind(code, user.id).run();
  return NextResponse.json({ code, ...(await inviteState(DB, user.id, !!user.is_admin)) });
}

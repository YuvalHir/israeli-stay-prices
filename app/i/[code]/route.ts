import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { INVITE_COOKIE, validInvite } from '@/lib/invites';

// Personal invite link: remember the code for sign-up, then show the app with a welcome.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const e = await env();
  const inv = await validInvite(e.DB, code);
  if (!inv) return NextResponse.redirect(`${e.APP_URL}/?invite=bad`);
  const first = (inv.inviter_name ?? '').split(' ')[0];
  const res = NextResponse.redirect(`${e.APP_URL}/?invite=ok${first ? `&from=${encodeURIComponent(first)}` : ''}`);
  res.cookies.set(INVITE_COOKIE, inv.code, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}

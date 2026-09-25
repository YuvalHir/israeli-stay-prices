import { countEvent } from '@/lib/events';
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { createSession, SESSION_COOKIE } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const e = await env();
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const savedState = req.cookies.get('sp_oauth_state')?.value;
  const verifier = req.cookies.get('sp_oauth_verifier')?.value;
  if (!code || !state || !savedState || state !== savedState || !verifier) {
    return NextResponse.redirect(`${e.APP_URL}/?login=failed`);
  }

  // Exchange the code directly with Google over TLS; the id_token in this response is trusted.
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: e.GOOGLE_CLIENT_ID, client_secret: e.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${e.APP_URL}/api/auth/callback`, grant_type: 'authorization_code', code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(`${e.APP_URL}/?login=failed`);
  const { id_token } = await tokenRes.json() as { id_token: string };
  const payload = JSON.parse(atob(id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
    sub: string; email: string; email_verified?: boolean; name?: string; aud: string; iss: string; exp: number;
  };
  const issOk = payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com';
  if (!issOk || payload.aud !== e.GOOGLE_CLIENT_ID || payload.exp * 1000 < Date.now() || !payload.email_verified) {
    return NextResponse.redirect(`${e.APP_URL}/?login=failed`);
  }

  const isNew = !(await e.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(payload.sub).first());
  await e.DB.prepare(
    `INSERT INTO users (id, email, name) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name`,
  ).bind(payload.sub, payload.email, payload.name ?? null).run();
  if (isNew) await countEvent(e.DB, 'signup');

  const admins = (e.ADMIN_EMAILS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (admins.includes(payload.email.toLowerCase())) {
    await e.DB.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').bind(payload.sub).run();
  }

  const { token, expires } = await createSession(payload.sub);
  const res = NextResponse.redirect(`${e.APP_URL}/`);
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires });
  res.cookies.delete('sp_oauth_state');
  res.cookies.delete('sp_oauth_verifier');
  return res;
}

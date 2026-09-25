import { countEvent } from '@/lib/events';
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { createSession, SESSION_COOKIE } from '@/lib/auth';
import { INVITE_COOKIE, validInvite } from '@/lib/invites';

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

  const existing = await e.DB.prepare('SELECT banned FROM users WHERE id = ?').bind(payload.sub).first<{ banned: number }>();
  const isNew = !existing;
  if (existing?.banned) return NextResponse.redirect(`${e.APP_URL}/?login=blocked`);
  const admins = (e.ADMIN_EMAILS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const isAdminEmail = admins.includes(payload.email.toLowerCase());
  // Sign-up is invite-only: a new account needs a valid personal invite link (admins excepted).
  const invite = isNew && !isAdminEmail ? await validInvite(e.DB, req.cookies.get(INVITE_COOKIE)?.value) : null;
  if (isNew && !isAdminEmail && !invite) {
    const r = NextResponse.redirect(`${e.APP_URL}/?login=invite_required`);
    r.cookies.delete('sp_oauth_state'); r.cookies.delete('sp_oauth_verifier');
    return r;
  }
  await e.DB.prepare(
    `INSERT INTO users (id, email, name) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name`,
  ).bind(payload.sub, payload.email, payload.name ?? null).run();
  if (invite) {
    // Claim the code atomically; if someone else used it a moment ago, undo the sign-up.
    const claim = await e.DB.prepare(`UPDATE invites SET used_by = ?, used_at = datetime('now') WHERE code = ? AND used_by IS NULL AND revoked = 0`).bind(payload.sub, invite.code).run();
    if (!claim.meta?.changes) {
      await e.DB.prepare('DELETE FROM users WHERE id = ?').bind(payload.sub).run();
      return NextResponse.redirect(`${e.APP_URL}/?invite=bad`);
    }
    await e.DB.prepare('UPDATE users SET invited_by = ? WHERE id = ?').bind(invite.inviter_id, payload.sub).run();
  }
  if (isNew) await countEvent(e.DB, 'signup');

  // Admin rights follow ADMIN_EMAILS on every login (removing an email revokes it), plus admins granted in the panel.
  await e.DB.prepare('UPDATE users SET is_admin = CASE WHEN ? = 1 OR admin_by_panel = 1 THEN 1 ELSE 0 END WHERE id = ?').bind(isAdminEmail ? 1 : 0, payload.sub).run();

  const { token, expires } = await createSession(payload.sub);
  const res = NextResponse.redirect(`${e.APP_URL}/`);
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires });
  res.cookies.delete('sp_oauth_state');
  res.cookies.delete('sp_oauth_verifier');
  res.cookies.delete(INVITE_COOKIE);
  return res;
}

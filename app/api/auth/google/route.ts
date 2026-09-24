import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { randomToken } from '@/lib/auth';

// Starts "Sign in with Google" (OAuth 2.0 authorization code flow + PKCE).
export async function GET() {
  const e = await env();
  if (!e.GOOGLE_CLIENT_ID || e.GOOGLE_CLIENT_ID.startsWith('REPLACE')) {
    return NextResponse.redirect(`${e.APP_URL}/?login=unconfigured`);
  }
  const state = randomToken(16);
  const verifier = randomToken(48);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: e.GOOGLE_CLIENT_ID,
    redirect_uri: `${e.APP_URL}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  const res = NextResponse.redirect(url.toString());
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 600 };
  res.cookies.set('sp_oauth_state', state, opts);
  res.cookies.set('sp_oauth_verifier', verifier, opts);
  return res;
}

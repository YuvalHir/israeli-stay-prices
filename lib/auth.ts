import { cookies } from 'next/headers';
import { env } from './env';

export const SESSION_COOKIE = 'sp_session';
const SESSION_DAYS = 60;

export type User = { id: string; email: string; name: string | null; is_admin: number; banned?: number };

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Creates a session and returns the raw token for the cookie. Only the hash is stored. */
export async function createSession(userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  const { DB } = await env();
  await DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, expires.toISOString()).run();
  return { token, expires };
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { DB } = await env();
  const row = await DB.prepare(
    `SELECT u.id, u.email, u.name, u.is_admin, u.banned FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), new Date().toISOString()).first<User>();
  return row ?? null;
}

export async function currentAdmin() {
  const u = await currentUser();
  return u && u.is_admin ? u : null;
}

export async function deleteSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const { DB } = await env();
    await DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
  }
  jar.delete(SESSION_COOKIE);
}

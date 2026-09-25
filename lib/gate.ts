import { cookies } from 'next/headers';
import { randomToken } from './auth';

type D1Database = CloudflareEnv['DB'];

/** Place views a visitor gets per browser session before being asked to log in. */
export const ANON_VIEWS = 3;
/** Searches with prices earned per report, and per like on someone else's report. */
export const SEARCHES_PER_CREDIT = 5;
/** A search unlocks prices around its point for this long and this far. */
export const SEARCH_TTL_HOURS = 12;
export const SEARCH_RADIUS_KM = 8;
export const ANON_COOKIE = 'sp_anon';

export async function creditState(DB: D1Database, userId: string, isAdmin = false) {
  const r = await DB.prepare(
    `SELECT (SELECT COUNT(*) FROM reports WHERE user_id = ?1) AS reports,
            (SELECT COUNT(*) FROM report_votes v JOIN reports r ON r.id = v.report_id WHERE v.user_id = ?1 AND v.vote = 1 AND r.user_id <> ?1) AS likes,
            ((SELECT COUNT(*) FROM searches WHERE user_id = ?1) + (SELECT COUNT(*) FROM offline_route_searches WHERE user_id = ?1)) AS used`,
  ).bind(userId).first<{ reports: number; likes: number; used: number }>();
  const reports = r?.reports ?? 0, likes = r?.likes ?? 0, used = r?.used ?? 0;
  // Admins have unlimited searches.
  if (isAdmin) return { reports, likes, used, searchesLeft: 9999, unlimited: true };
  return { reports, likes, used, searchesLeft: Math.max(0, SEARCHES_PER_CREDIT * (reports + likes) - used), unlimited: false };
}

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** True when searchId is this user's and still fresh (no location check). */
export async function searchValid(DB: D1Database, userId: string, searchId: string | null | undefined, isAdmin = false) {
  if (isAdmin) return true;
  if (!searchId) return false;
  return !!(await DB.prepare(`SELECT 1 FROM searches WHERE id = ? AND user_id = ? AND created_at >= datetime('now', ?)`).bind(searchId, userId, `-${SEARCH_TTL_HOURS} hours`).first());
}

/** True when searchId is this user's, still fresh, and the point is inside it. */
export async function searchCovers(DB: D1Database, userId: string, searchId: string | null | undefined, lat?: number | null, lon?: number | null, isAdmin = false) {
  if (isAdmin) return true;
  if (!searchId) return false;
  const s = await DB.prepare(`SELECT lat, lon FROM searches WHERE id = ? AND user_id = ? AND created_at >= datetime('now', ?)`)
    .bind(searchId, userId, `-${SEARCH_TTL_HOURS} hours`).first<{ lat: number; lon: number }>();
  if (!s) return false;
  // No known location = not covered. Prices only unlock for places we can place inside the search circle.
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return km(s.lat, s.lon, lat, lon) <= SEARCH_RADIUS_KM;
}

/** Browser-session id for anonymous visitors (session cookie, no expiry). */
export async function anonId(create = false) {
  const jar = await cookies();
  let id = jar.get(ANON_COOKIE)?.value ?? null;
  if (!id && create) {
    id = randomToken(18);
    jar.set(ANON_COOKIE, id, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  }
  return id;
}

export async function anonViewsLeft(DB: D1Database, id: string | null) {
  if (!id) return ANON_VIEWS;
  const r = await DB.prepare('SELECT COUNT(*) AS n FROM anon_views WHERE anon_id = ?').bind(id).first<{ n: number }>();
  return Math.max(0, ANON_VIEWS - (r?.n ?? 0));
}

/** Shared request guards: safe JSON parsing, per-IP rate limits, server-side place location. */
import { NextRequest, NextResponse } from 'next/server';
import { nominatimLookup } from './placeLookup';

type D1 = CloudflareEnv['DB'];
type RateLimiter = { limit(o: { key: string }): Promise<{ success: boolean }> };

export const badRequest = () => NextResponse.json({ error: 'bad_request' }, { status: 400 });
export const tooMany = () => NextResponse.json({ error: 'rate_limited' }, { status: 429 });

/** Parses a JSON object body. Returns null for bad JSON, non-objects or a non-JSON content type. */
export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T | null> {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) return null;
  try { const b = await req.json(); return b && typeof b === 'object' && !Array.isArray(b) ? b as T : null; } catch { return null; }
}

/** Writes must come from our own pages: a cross-site Origin is refused (missing Origin is allowed for same-origin fetches in old browsers). */
export function sameOrigin(req: NextRequest, appUrl: string) {
  const o = req.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === new URL(appUrl).host || new URL(o).host === req.nextUrl.host; } catch { return false; }
}

// Cloudflare sets CF-Connecting-IP itself and overwrites any client-sent value, so it can't be spoofed. X-Forwarded-For is not trusted.
export const clientIp = (req: NextRequest) => req.headers.get('cf-connecting-ip') ?? '0.0.0.0';

/** Cloudflare Rate Limiting binding (per IP + bucket). Missing binding (local dev) = allowed. */
export async function rateLimited(e: CloudflareEnv, req: NextRequest, bucket: string, which: 'RL_API' | 'RL_WRITE' = 'RL_API') {
  const rl = (e as unknown as Record<string, RateLimiter | undefined>)[which];
  if (!rl) return false;
  try { return !(await rl.limit({ key: `${bucket}:${clientIp(req)}` })).success; } catch { return false; }
}

/** Where a place is, from the server's own data: average of reported coordinates, else OSM (Nominatim). Never from the client. */
export async function placeLocation(DB: D1, placeId: string): Promise<{ lat: number; lon: number } | null> {
  const r = await DB.prepare('SELECT AVG(lat) AS lat, AVG(lon) AS lon FROM reports WHERE place_id = ? AND lat IS NOT NULL AND lon IS NOT NULL')
    .bind(placeId).first<{ lat: number | null; lon: number | null }>();
  if (r?.lat != null && r?.lon != null) return { lat: r.lat, lon: r.lon };
  if (/^osm-(node|way|relation)-\d+$/.test(placeId)) {
    const p = (await nominatimLookup([placeId]).catch(() => ({} as Record<string, never>)))[placeId];
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) return { lat: p.lat, lon: p.lon };
  }
  return null;
}

export const validCoord = (lat: unknown, lon: unknown) => typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

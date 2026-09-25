import type { Area } from './places';

type PublicArea = { places: unknown[] | null; reported: unknown[]; counts: Record<string, number> };
const CAP = 2, TTL = 90_000;
const entries = new Map<string, { at: number; promise: Promise<PublicArea | null> }>();
const key = (a: Pick<Area, 'lat' | 'lon'>) => `${a.lat.toFixed(3)},${a.lon.toFixed(3)}`;
/** Only /api/area public lodges and counts; never search, reports with prices, or views. */
export function prefetchPublicArea(a: Pick<Area, 'lat' | 'lon'>): Promise<PublicArea | null> {
  const k = key(a), old = entries.get(k);
  if (old && Date.now() - old.at < TTL) return old.promise;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!navigator.onLine || connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '') || document.visibilityState === 'hidden') return Promise.resolve(null);
  if (entries.size >= CAP) entries.delete(entries.keys().next().value!);
  const promise = fetch(`/api/area?lat=${a.lat}&lon=${a.lon}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    .then(r => r.ok ? r.json() as Promise<PublicArea> : null).catch(() => null)
    .then(result => { if (!result) entries.delete(k); return result; });
  entries.set(k, { at: Date.now(), promise });
  return promise;
}
export function consumePrefetchedArea(a: Pick<Area, 'lat' | 'lon'>): Promise<PublicArea | null> | null {
  const e = entries.get(key(a));
  if (!e || Date.now() - e.at >= TTL) return null;
  entries.delete(key(a));
  return e.promise;
}

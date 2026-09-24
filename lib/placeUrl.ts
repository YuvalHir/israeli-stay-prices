/** Stable, unique place URLs: /p/<osm-type>-<osm-id>/<readable-slug>. The id is the key; the slug is only for people and search. */
export const SITE_URL = 'https://israeli-stay-prices.hyuval1511.workers.dev';

export function slugify(name: string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'place';
}
export function placeKey(id: string) {
  const m = id.match(/^osm-(node|way|relation)-(\d+)$/);
  if (m) return `${m[1]}-${m[2]}`;
  return 'm-' + encodeURIComponent(id.replace(/^manual-/, ''));
}
export function idFromKey(key: string): string | null {
  const k = decodeURIComponent(key);
  const m = k.match(/^(node|way|relation)-(\d+)$/);
  if (m) return `osm-${m[1]}-${m[2]}`;
  if (k.startsWith('m-') && k.length > 2) return 'manual-' + k.slice(2);
  return null;
}
export const placePath = (p: { id: string; name: string }) => `/p/${placeKey(p.id)}/${encodeURIComponent(slugify(p.name))}`;

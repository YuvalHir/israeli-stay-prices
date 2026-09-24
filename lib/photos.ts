/** Free photos from Wikimedia Commons, hotlinked (never stored). Server-side helpers. */
export type Photo = { src: string; page: string; author: string; license: string; licenseUrl?: string; area?: boolean; title?: string };

const UA = { 'User-Agent': 'israeli-stay-prices/1.0 (https://github.com/YuvalHir/israeli-stay-prices)' };
const CACHE = { cf: { cacheTtl: 86400, cacheEverything: true } } as RequestInit;
const getJson = async (url: string, init: RequestInit = {}) => {
  const r = await fetch(url, { ...CACHE, signal: AbortSignal.timeout(8000), ...init, headers: { ...UA, ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json() as Promise<any>;
};
const strip = (html?: string) => (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Normalise an OSM image/wikimedia_commons tag to a Commons file title ("File:X.jpg"), or null. */
export function commonsTitle(tag?: string): string | null {
  if (!tag) return null;
  let t = tag.trim();
  const m = t.match(/commons\.wikimedia\.org\/wiki\/(File:[^?#]+)/i) || t.match(/upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i);
  if (m) t = decodeURIComponent(m[1]).startsWith('File:') ? decodeURIComponent(m[1]) : 'File:' + decodeURIComponent(m[1]);
  if (/^File:/i.test(t)) return 'File:' + t.slice(5).replace(/_/g, ' ');
  return null;
}

/** Commons imageinfo for many files: thumb URL + author + license. Only freely licensed files are returned. */
export async function commonsInfo(titles: string[], width = 480): Promise<Record<string, Photo>> {
  const out: Record<string, Photo> = {};
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${width}&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl|Credit&titles=${encodeURIComponent(batch.join('|'))}`);
    const norm: Record<string, string> = {};
    for (const n of j.query?.normalized ?? []) norm[n.to] = n.from;
    for (const p of Object.values<any>(j.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0]; if (!ii?.thumburl) continue;
      const md = ii.extmetadata ?? {};
      const license = strip(md.LicenseShortName?.value) || 'Wikimedia Commons';
      if (/fair use|non-free/i.test(license)) continue;
      const photo: Photo = { src: ii.thumburl, page: ii.descriptionurl, author: strip(md.Artist?.value) || strip(md.Credit?.value) || 'Wikimedia Commons', license, licenseUrl: md.LicenseUrl?.value };
      out[p.title] = photo; if (norm[p.title]) out[norm[p.title]] = photo;
    }
  }
  return out;
}

/** P18 (image) for Wikidata items. */
export async function wikidataImages(qids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < qids.length; i += 45) {
    const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${qids.slice(i, i + 45).join('|')}`);
    for (const [q, e] of Object.entries<any>(j.entities ?? {})) {
      const f = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (f) out[q] = 'File:' + String(f).replace(/_/g, ' ');
    }
  }
  return out;
}

import { nominatimLookup } from './placeLookup';

/** OSM photo tags for specific elements: Nominatim lookup first (reliable from Workers), Overpass as fallback. */
export async function osmPhotoTags(ids: string[]): Promise<Record<string, { wikidata?: string; commons?: string }>> {
  try {
    const found = await nominatimLookup(ids);
    if (Object.keys(found).length) {
      const out: Record<string, { wikidata?: string; commons?: string }> = {};
      for (const [id, p] of Object.entries(found)) { const commons = commonsTitle(p.commons); if (commons || p.wikidata) out[id] = { commons: commons ?? undefined, wikidata: p.wikidata }; }
      return out;
    }
  } catch { /* fall back to Overpass */ }
  return overpassPhotoTags(ids);
}

/** Resolve one place's own photo (commons tag or Wikidata P18). */
export async function placePhoto(p: { commons?: string; wikidata?: string }): Promise<Photo | null> {
  let f = commonsTitle(p.commons);
  if (!f && p.wikidata) f = (await wikidataImages([p.wikidata]))[p.wikidata] ?? null;
  if (!f) return null;
  return (await commonsInfo([f], 1200))[f] ?? null;
}

async function overpassPhotoTags(ids: string[]): Promise<Record<string, { wikidata?: string; commons?: string }>> {
  const by: Record<string, string[]> = { node: [], way: [], relation: [] };
  for (const id of ids) { const m = id.match(/^osm-(node|way|relation)-(\d+)$/); if (m) by[m[1]].push(m[2]); }
  const parts = Object.entries(by).filter(([, v]) => v.length).map(([t, v]) => `${t}(id:${v.join(',')});`).join('');
  if (!parts) return {};
  const q = `[out:json][timeout:15];(${parts});out tags;`;
  let j: any = null;
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']) {
    try { j = await getJson(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }); break; } catch { /* next mirror */ }
  }
  if (!j) return {};
  const out: Record<string, { wikidata?: string; commons?: string }> = {};
  for (const e of j.elements ?? []) {
    const t = e.tags ?? {};
    const commons = commonsTitle(t.wikimedia_commons) ?? commonsTitle(t.image);
    const wikidata = /^Q\d+$/.test(t.wikidata ?? '') ? t.wikidata : undefined;
    if (commons || wikidata) out[`osm-${e.type}-${e.id}`] = { commons: commons ?? undefined, wikidata };
  }
  return out;
}

/** Up to `n` free photos of the surroundings: nearest Wikipedia articles that have a Wikidata image. */
export async function areaPhotos(lat: number, lon: number, n = 6): Promise<Photo[]> {
  const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&generator=geosearch&ggscoord=${lat}|${lon}&ggsradius=10000&ggslimit=30&prop=pageprops|coordinates&ppprop=wikibase_item`);
  const pages = Object.values<any>(j.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const qids = pages.map(p => p.pageprops?.wikibase_item).filter(Boolean) as string[];
  if (!qids.length) return [];
  const imgs = await wikidataImages(qids);
  const titles: string[] = []; const names: Record<string, string> = {};
  for (const p of pages) { const f = imgs[p.pageprops?.wikibase_item]; if (f && !titles.includes(f)) { titles.push(f); names[f] = p.title; } if (titles.length >= n) break; }
  const info = await commonsInfo(titles, 640);
  return titles.map(t => info[t] && { ...info[t], area: true, title: names[t] }).filter(Boolean) as Photo[];
}

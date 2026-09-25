import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { rateLimited, tooMany } from '@/lib/security';
import { areaPhotos, commonsInfo, osmPhotoTags, wikidataImages, type Photo } from '@/lib/photos';

// Place photos from Wikimedia (linked via OSM wikidata/wikimedia_commons/image tags), plus free photos
// of the surrounding area as a fallback. Images are hotlinked from upload.wikimedia.org, never stored.
export async function GET(req: NextRequest) {
  if (await rateLimited(await env(), req, 'photos')) return tooMany();
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get('lat')), lon = Number(u.searchParams.get('lon'));
  const ids = (u.searchParams.get('ids') ?? '').split(',').filter(x => /^osm-(node|way|relation)-\d+$/.test(x)).slice(0, 80);
  const places: Record<string, Photo> = {};
  let area: Photo[] = [];
  await Promise.all([
    (async () => {
      if (!ids.length) return;
      const tags = await osmPhotoTags(ids);
      const qids = Object.values(tags).filter(t => !t.commons && t.wikidata).map(t => t.wikidata!);
      const wd = qids.length ? await wikidataImages(qids) : {};
      const want: Record<string, string> = {};
      for (const [id, t] of Object.entries(tags)) { const f = t.commons ?? (t.wikidata ? wd[t.wikidata] : undefined); if (f) want[id] = f; }
      const info = await commonsInfo([...new Set(Object.values(want))]);
      for (const [id, f] of Object.entries(want)) if (info[f]) places[id] = info[f];
    })().catch(() => {}),
    (async () => { if (Number.isFinite(lat) && Number.isFinite(lon)) area = await areaPhotos(lat, lon); })().catch(() => {}),
  ]);
  return NextResponse.json({ places, area }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
}

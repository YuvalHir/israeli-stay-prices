import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { placePath, SITE_URL } from '@/lib/placeUrl';

export const dynamic = 'force-dynamic';

// Home page plus every place that has at least one price report (the pages worth indexing).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home = { url: SITE_URL + '/', changeFrequency: 'daily' as const, priority: 1 };
  try {
    const { DB } = await env();
    const { results } = await DB.prepare(`SELECT place_id AS id, MAX(place_name) AS name, MAX(created_at) AS updated FROM reports GROUP BY place_id ORDER BY MAX(created_at) DESC LIMIT 45000`)
      .all<{ id: string; name: string; updated: string }>();
    return [home, ...results.map((r: { id: string; name: string; updated: string }) => ({ url: SITE_URL + placePath(r), lastModified: new Date(r.updated.replace(' ', 'T') + (r.updated.endsWith('Z') ? '' : 'Z')), changeFrequency: 'weekly' as const, priority: 0.7 }))];
  } catch { return [home]; }
}

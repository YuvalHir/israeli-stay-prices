import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { placePath, SITE_URL } from '@/lib/placeUrl';

export const dynamic = 'force-dynamic';

// Home page plus every place with a price report. Manual places need 2+ different reporters (same rule as their noindex).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home = { url: SITE_URL + '/', changeFrequency: 'daily' as const, priority: 1 };
  try {
    const { DB } = await env();
    const { results } = await DB.prepare(`SELECT place_id AS id, MAX(place_name) AS name, MAX(created_at) AS updated FROM reports WHERE hidden = 0 GROUP BY place_id HAVING place_id LIKE 'osm-%' OR COUNT(DISTINCT user_id) >= 2 ORDER BY MAX(created_at) DESC LIMIT 45000`)
      .all<{ id: string; name: string; updated: string }>();
    return [home, ...results.map((r: { id: string; name: string; updated: string }) => ({ url: SITE_URL + placePath(r), lastModified: new Date(r.updated.replace(' ', 'T') + (r.updated.endsWith('Z') ? '' : 'Z')), changeFrequency: 'weekly' as const, priority: 0.7 }))];
  } catch { return [home]; }
}

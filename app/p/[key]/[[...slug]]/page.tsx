import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import App from '@/components/App';
import { getPlace } from '@/lib/placeLookup';
import { areaPhotos, placePhoto, type Photo } from '@/lib/photos';
import { idFromKey, placePath, SITE_URL, slugify } from '@/lib/placeUrl';
import { kindLabel } from '@/lib/places';
import { flagOf } from '@/lib/currency';

type Props = { params: Promise<{ key: string; slug?: string[] }> };

const countryHe = (cc?: string) => { if (!cc) return ''; try { return new Intl.DisplayNames(['he'], { type: 'region' }).of(cc) ?? cc; } catch { return cc; } };

// One place, looked up by its unique OSM id (never by name). Prices are not rendered on the server:
// they load in the browser through the same gate as the rest of the app.
const load = cache(async (key: string) => {
  const id = idFromKey(key);
  if (!id) return null;
  const info = await getPlace(id).catch(() => null);
  if (!info) return null;
  let photo: Photo | null = await placePhoto(info).catch(() => null);
  if (!photo && Number.isFinite(info.lat)) photo = (await areaPhotos(info.lat, info.lon, 1).catch(() => []))[0] ?? null;
  return { info, photo };
});

function describe(info: NonNullable<Awaited<ReturnType<typeof load>>>['info']) {
  const where = [info.locality, countryHe(info.country)].filter(Boolean).join(', ');
  const kind = kindLabel(info.kind);
  const reports = info.reports ? (info.reports === 1 ? 'דיווח מחיר אחד' : `${info.reports} דיווחי מחיר`) + ' ממטיילים ישראלים' : 'מחירי לינה ממטיילים ישראלים';
  return {
    title: `${info.name}${info.locality ? `, ${info.locality}` : ''} · כמה ישראלים שילמו ללילה`,
    description: `${info.name}: ${kind}${where ? ` ב-${where}` : ''}. ${reports}: כמה שילמו ללילה, חדר פרטי או דורם, ומתי. התמקחת? ספר לחבריך.`,
    where, kind,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const data = await load(key);
  if (!data) return { title: 'המקום לא נמצא · כמה ישראלים שילמו ללילה', robots: { index: false } };
  const { info, photo } = data;
  const d = describe(info);
  const path = placePath(info);
  const image = photo && !photo.area ? { url: photo.src, alt: info.name } : { url: '/og.jpg', width: 1200, height: 630, alt: 'כמה ישראלים שילמו ללילה?' };
  // Manual places (typed in by one user, not in OpenStreetMap) stay out of search until 2+ different people reported them.
  const unverified = info.id.startsWith('manual-') && (info.reporters ?? 0) < 2;
  return {
    title: d.title, description: d.description,
    alternates: { canonical: path },
    ...(unverified ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: 'website', locale: 'he_IL', siteName: 'מחיר ללילה', url: path, title: `${info.name} ${info.country ? flagOf(info.country) : ''} · כמה ישראלים שילמו כאן ללילה? 👀`, description: d.description, images: [image] },
    twitter: { card: 'summary_large_image', title: d.title, description: d.description, images: [image.url] },
  };
}

export default async function PlacePage({ params }: Props) {
  const { key, slug } = await params;
  const data = await load(key);
  if (!data) notFound();
  const { info, photo } = data;
  if ((slug?.[0] ? decodeURIComponent(slug[0]) : '') !== slugify(info.name)) permanentRedirect(placePath(info));
  const d = describe(info);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': info.kind === 'hostel' ? 'Hostel' : info.kind === 'hotel' || info.kind === 'motel' ? 'Hotel' : 'LodgingBusiness',
    name: info.name,
    url: SITE_URL + placePath(info),
    description: d.description,
    ...(photo && !photo.area ? { image: photo.src } : {}),
    address: { '@type': 'PostalAddress', ...(info.locality ? { addressLocality: info.locality } : {}), ...(info.region ? { addressRegion: info.region } : {}), ...(info.country ? { addressCountry: info.country } : {}) },
    ...(Number.isFinite(info.lat) ? { geo: { '@type': 'GeoCoordinates', latitude: info.lat, longitude: info.lon } } : {}),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <App initialPlace={{ id: info.id, name: info.name, kind: info.kind, lat: info.lat, lon: info.lon, country: info.country, locality: info.locality, region: info.region, reports: info.reports, photo }} />
  </>;
}

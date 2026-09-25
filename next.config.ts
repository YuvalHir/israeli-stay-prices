import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  // Inline the (small) stylesheet so the first paint doesn't wait for another round trip.
  experimental: { inlineCss: true },
  // Build id baked into client and server, so an old cached app can notice a new deploy and reload itself.
  poweredByHeader: false,
  async headers() {
    // CSP starts as Report-Only (browser console warnings, nothing blocked) until a week of clean use; then switch the header name.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://upload.wikimedia.org https://thumb.wikimedia.org https://commons.wikimedia.org https://cdn.jsdelivr.net https://www.google.com https://*.gstatic.com",
      "font-src 'self'",
      "connect-src 'self' https://photon.komoot.io https://nominatim.openstreetmap.org https://overpass-api.de https://overpass.private.coffee https://cloudflareinsights.com https://static.cloudflareinsights.com https://cdn.jsdelivr.net https://commons.wikimedia.org https://www.wikidata.org https://en.wikipedia.org https://upload.wikimedia.org",
      "frame-src https://maps.google.com https://www.google.com",
      "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self' https://accounts.google.com", "object-src 'none'",
    ].join('; ');
    return [{ source: '/:path*', headers: [
      { key: 'Content-Security-Policy-Report-Only', value: csp },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
    ] }];
  },
  env: { NEXT_PUBLIC_BUILD: (process.env.GITHUB_SHA ?? '').slice(0, 7) || String(Date.now()) },
};
export default nextConfig;

initOpenNextCloudflareForDev();

// Service worker tuned for weak signal:
// - hashed app files, icons and the hero: cache-first (they never change under the same URL)
// - pages: network with a 2.5s timeout, then the cached copy (and refresh it in the background)
// - OSM map tiles and Wikimedia photos: cache-first, capped, so places you've seen load instantly
// - /api/* is never cached: prices and sign-in must be live.
const V = 'v2';
const SHELL = `sp-shell-${V}`, STATIC = `sp-static-${V}`, MEDIA = `sp-media-${V}`;
const KEEP = [SHELL, STATIC, MEDIA];
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/teahouse-720.webp'];
const MEDIA_MAX = 300;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max) {
  const c = await caches.open(name); const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
async function cacheFirst(req, name, cap) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') { const c = await caches.open(name); c.put(req, res.clone()); if (cap) trim(name, cap); }
  return res;
}
async function page(req) {
  const c = await caches.open(SHELL);
  const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; });
  const timeout = new Promise((r) => setTimeout(r, 2500));
  const first = await Promise.race([net.catch(() => null), timeout]);
  if (first) return first;
  const cached = await c.match(req) || await c.match('/');
  if (cached) { net.catch(() => {}); return cached; }
  return net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;
    if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(webp|jpg|png|svg|woff2?)$/.test(url.pathname)) { e.respondWith(cacheFirst(req, STATIC)); return; }
    if (req.mode === 'navigate') { e.respondWith(page(req)); return; }
    return;
  }
  if (url.hostname === 'tile.openstreetmap.org' || url.hostname === 'upload.wikimedia.org') { e.respondWith(cacheFirst(req, MEDIA, MEDIA_MAX).catch(() => fetch(req))); }
});

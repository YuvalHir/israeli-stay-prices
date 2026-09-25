import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'כמה ישראלים שילמו ללילה',
    short_name: 'מחיר ללילה',
    description: 'כמה ישראלים שילמו ללילה במלון, הוסטל או גסטהאוס, בכל העולם, כדי לדעת על מה להתמקח.',
    start_url: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'he',
    background_color: '#f6f3ee',
    theme_color: '#f6f3ee',
    icons: [
      { src: '/icons/v2/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/v2/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/v2/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

import type { Metadata, Viewport } from 'next';
import './globals.css';
import Beacon from '@/components/Beacon';


export const metadata: Metadata = {
  metadataBase: new URL('https://israeli-stay-prices.hyuval1511.workers.dev'),
  title: 'כמה ישראלים שילמו ללילה',
  description: 'מחירי לינה אמיתיים ממטיילים ישראלים: מלונות, הוסטלים וגסטהאוסים בכל העולם.',
  openGraph: {
    type: 'website', locale: 'he_IL', siteName: 'מחיר ללילה', url: '/',
    title: 'כמה ישראלים שילמו ללילה? 👀',
    description: 'התמקחת? ספר לחבריך. מחירי לינה אמיתיים ממטיילים ישראלים, בכל העולם.',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'כמה ישראלים שילמו ללילה? התמקחת? ספר לחבריך' }],
  },
  twitter: { card: 'summary_large_image', title: 'כמה ישראלים שילמו ללילה? 👀', description: 'התמקחת? ספר לחבריך.', images: ['/og.jpg'] },
  appleWebApp: { capable: true, title: 'מחיר ללילה', statusBarStyle: 'default' },
  icons: { icon: '/icons/favicon-32.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#f6f3ee', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* Heebo, self-hosted: only Hebrew + basic Latin (2 files). Arrows and rare letters use the system font. */}
        <link rel="preload" href="/fonts/heebo-hebrew.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preconnect" href="https://tile.openstreetmap.org" />
        <link rel="preconnect" href="https://upload.wikimedia.org" />
        <link rel="preconnect" href="https://photon.komoot.io" crossOrigin="" />
        <link rel="dns-prefetch" href="https://thumb.wikimedia.org" />
        <link rel="dns-prefetch" href="https://upload.wikimedia.org" />
      </head>
      <body>{children}<Beacon /></body>
    </html>
  );
}

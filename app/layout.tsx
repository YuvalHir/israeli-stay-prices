import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], weight: ['400', '500', '700', '800'], display: 'swap' });

export const metadata: Metadata = {
  title: 'כמה ישראלים שילמו ללילה',
  description: 'מחירי לינה אמיתיים ממטיילים ישראלים: מלונות, הוסטלים וגסטהאוסים בכל העולם.',
  appleWebApp: { capable: true, title: 'מחיר ללילה', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#f6f3ee', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.className}>
      <body>{children}</body>
    </html>
  );
}

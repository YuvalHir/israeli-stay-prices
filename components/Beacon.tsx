'use client';
import { useEffect } from 'react';

// Cloudflare Web Analytics (free, cookieless). The token is public by design. Empty = off.
const TOKEN = process.env.NEXT_PUBLIC_CF_BEACON ?? '';

/** Loads the beacon only after the page has finished loading and the browser is idle, so it never slows the first visit. */
export default function Beacon() {
  useEffect(() => {
    if (!TOKEN) return;
    const add = () => {
      const s = document.createElement('script');
      s.defer = true; s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
      s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN, spa: true }));
      document.body.appendChild(s);
    };
    const later = () => ((window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 2000)))(add, { timeout: 8000 });
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
  }, []);
  return null;
}

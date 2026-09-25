'use client';
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/track';

// Keyless classic Google Maps embed (Yuval's choice, 25 Sep 2026): no API key, no billing.
// The pin uses coordinates: name searches can land on the wrong place when Google doesn't know the lodge.

const slowLink = () => {
  const c = (navigator as any).connection;
  return !!c && (c.saveData || /(^|-)2g$/.test(c.effectiveType ?? ''));
};

/**
 * Google map of the stay, below the reports. Starts as a light card with a deep link (photos live there);
 * the iframe is created only when the card scrolls near the screen, and never automatically on 2G / data saver.
 */
export default function GoogleMapCard({ name, lat, lon, locality }: { name: string; lat: number; lon: number; locality?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const q = [name, locality].filter(Boolean).join(', ');
  const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  useEffect(() => {
    setShow(false); setLoaded(false); setFailed(false); setSlow(false);
    if (!box.current) return;
    if (slowLink()) { setSlow(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setShow(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [name, lat, lon]);
  // A cross-origin iframe can't report errors: if it hasn't loaded in 15s, fall back to the link card.
  useEffect(() => {
    if (!show || loaded) return;
    const t = setTimeout(() => setFailed(true), 15000);
    return () => clearTimeout(t);
  }, [show, loaded]);

  if (failed || typeof IntersectionObserver === 'undefined') return <a className="card gmap-row" href={link} target="_blank" rel="noopener" onClick={() => track('gmap_open')}>
    <span className="gmap-pin" aria-hidden="true">📍</span>
    <span className="gmap-txt"><b>פתח בגוגל מפות</b><span className="muted small">תמונות, ביקורות ומסלול</span></span>
    <span aria-hidden="true">↗</span>
  </a>;

  return <section className="card gmap" ref={box} aria-label="המקום בגוגל מפות">
    <div className="gmap-frame">
      {show && <iframe title={`${name} בגוגל מפות`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen onLoad={() => setLoaded(true)}
        src={`https://maps.google.com/maps?q=${lat},${lon}&z=17&hl=iw&output=embed`} />}
      {!loaded && <div className="gmap-ph">
        <span className="gmap-pin" aria-hidden="true">📍</span>
        <b>תמונות, ביקורות ומסלול</b>
        <span className="muted small">{show ? 'טוען מפה…' : slow ? 'חיבור חלש: המפה לא נטענת אוטומטית' : 'בגוגל מפות'}</span>
        {slow && <button className="btn small" onClick={() => { setSlow(false); setShow(true); }}>טען מפה בכל זאת</button>}
      </div>}
    </div>
    <a className="btn block" href={link} target="_blank" rel="noopener" onClick={() => track('gmap_open')}>פתח בגוגל מפות ↗</a>
  </section>;
}

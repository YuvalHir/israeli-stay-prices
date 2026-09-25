'use client';
import { useEffect, useRef, useState } from 'react';

// Public by design (Maps Embed keys are restricted by site referrer). Empty until Yuval adds MAPS_EMBED_KEY.
const KEY = process.env.NEXT_PUBLIC_MAPS_EMBED_KEY ?? '';

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
  const q = [name, locality].filter(Boolean).join(', ');
  const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  useEffect(() => {
    setShow(false); setLoaded(false);
    if (!KEY || !box.current) return;
    if (slowLink()) { setSlow(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setShow(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [name, lat, lon]);

  if (!KEY) return <a className="card gmap-row" href={link} target="_blank" rel="noopener">
    <span className="gmap-pin" aria-hidden="true">📍</span>
    <span className="gmap-txt"><b>פתח בגוגל מפות</b><span className="muted small">תמונות, ביקורות ומסלול</span></span>
    <span aria-hidden="true">↗</span>
  </a>;

  return <section className="card gmap" ref={box} aria-label="המקום בגוגל מפות">
    <div className="gmap-frame">
      {show && <iframe title={`${name} בגוגל מפות`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen onLoad={() => setLoaded(true)}
        src={`https://www.google.com/maps/embed/v1/place?key=${KEY}&q=${encodeURIComponent(q)}&center=${lat},${lon}&zoom=16&language=iw`} />}
      {!loaded && <div className="gmap-ph">
        <span className="gmap-pin" aria-hidden="true">📍</span>
        <b>תמונות, ביקורות ומסלול</b>
        <span className="muted small">{show ? 'טוען מפה…' : slow ? 'חיבור חלש: המפה לא נטענת אוטומטית' : 'בגוגל מפות'}</span>
        {slow && KEY && <button className="btn small" onClick={() => { setSlow(false); setShow(true); }}>טען מפה בכל זאת</button>}
      </div>}
    </div>
    <a className="btn block" href={link} target="_blank" rel="noopener">פתח בגוגל מפות ↗</a>
  </section>;
}

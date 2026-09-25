'use client';
import { useEffect, useRef, useState } from 'react';
import { currencyFor, flagOf, FLAG_BY_CURRENCY, formatMoney } from '@/lib/currency';

export const ROOM_HE = { dorm: 'מיטה בדורם', private: 'חדר פרטי' } as const;
export const KIND_ICON: Record<string, string> = { hotel: '🏨', guest_house: '🏡', hostel: '🛏️', alpine_hut: '🏔️', motel: '🛣️' };
export const curFlag = (c: string, country?: string | null) => country && currencyFor(country) === c ? flagOf(country) : (FLAG_BY_CURRENCY[c] ?? '💱');
export const money = (price: number, c: string) => formatMoney(price, c);
export const dist = (d?: number) => d == null ? '' : d < 1 ? `${Math.round(d * 1000)} מ׳` : `${d.toFixed(1)} ק״מ`;
export const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
export const monthLabel = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }); };
export const lastMonths = () => Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

export function Sheet({ onClose, className = '', children }: { onClose?: () => void; className?: string; children: (dismiss: () => void) => React.ReactNode }) {
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const dismiss = () => {
    if (!onClose || done.current) return;
    done.current = true; setClosing(true);
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(onClose, reduce ? 0 : 260);
  };
  useEffect(() => {
    const el = ref.current; if (!el || !onClose) return;
    let y0 = 0, x0 = 0, t0 = 0, dy = 0, active = false, dragging = false;
    const start = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      const scroller = t.closest('.sleep-list, .ac-list') as HTMLElement | null;
      if ((scroller && scroller.scrollTop > 0) || el.scrollTop > 0 || t.closest('input, textarea, select')) { active = false; return; }
      active = true; dragging = false; dy = 0; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; t0 = Date.now();
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      const d = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
      // Claim downward moves from the very first frame: once iOS starts its own scroll/bounce, later preventDefault calls are ignored.
      if (!dragging && d > 0 && d >= dx && e.cancelable) e.preventDefault();
      if (!dragging) { if (d > 8 && d > dx) { dragging = true; el.style.transition = 'none'; } else if (d < -4 || dx > 8) { active = false; return; } else return; }
      dy = Math.max(0, d); if (e.cancelable) e.preventDefault();
      el.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      if (!active) return; active = false; if (!dragging) return;
      const v = dy / Math.max(1, Date.now() - t0);
      el.style.transition = 'transform .32s cubic-bezier(.2,.9,.3,1.1)';
      if (dy > 110 || v > 0.6) dismiss(); else el.style.transform = '';
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
  }, [onClose]);
  return <div className={`sheet-backdrop${closing ? ' closing' : ''}`} role="dialog" aria-modal="true" onClick={dismiss}>
    <div ref={ref} className={`sheet ${className}`} onClick={e => e.stopPropagation()}>{children(dismiss)}</div>
  </div>;
}

export function WhatsAppIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>;
}

export const SLOGAN = 'התמקחת? ספר לחבריך';
export type Report = {
  id: string; place_name: string; price: number; currency: string; country?: string | null; room: 'dorm' | 'private'; beds: number | null; israeli_deal: number; nights: number;
  stay_month: string; created_at?: string; note: string | null; up?: number; down?: number; my_vote?: number | null; mine_report?: number;
};
export const A2HS_KEY = 'sp_a2hs';
export type A2hsState = { dismissed: number; last: number; installed?: boolean };
export const readA2hs = (): A2hsState => { try { return { dismissed: 0, last: 0, ...JSON.parse(localStorage.getItem(A2HS_KEY) ?? '{}') }; } catch { return { dismissed: 0, last: 0 }; } };
export const writeA2hs = (v: A2hsState) => { try { localStorage.setItem(A2HS_KEY, JSON.stringify(v)); } catch {} };
export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
export const isIOS = () => typeof navigator !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const canOfferA2hs = () => { const st = readA2hs(); return !isStandalone() && !st.installed && st.dismissed < 3 && Date.now() - st.last > 14 * 864e5; };

export function ShareGlyph() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-4px' }}><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>;
}


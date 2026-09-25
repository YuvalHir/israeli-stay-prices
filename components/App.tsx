'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { track } from '@/lib/track';
import { countryAt, localityAt, findArea, kindLabel, nearbyStays, QUICK_AREAS, suggestPlaces, type Area, type Place, type Suggestion } from '@/lib/places';
import { currencyFor, currencyName, flagOf, FLAG_BY_CURRENCY, formatMoney } from '@/lib/currency';
import type { ShareInfo } from '@/lib/shareCard';
import { ROOM_HE, KIND_ICON, curFlag, money, dist, median, monthLabel, lastMonths, Sheet, WhatsAppIcon, SLOGAN, type Report, readA2hs, writeA2hs, isStandalone, isIOS, canOfferA2hs, ShareGlyph } from '@/components/ui';
import { placePath, SITE_URL } from '@/lib/placeUrl';
import { BOOT_HTML, BOOT_JS } from '@/lib/boot';

export type { Photo };
export type InitialPlace = Place & { locality?: string; region?: string; reports?: number; photo?: Photo | null };

const GITHUB_URL = 'https://github.com/YuvalHir/israeli-stay-prices';
type Disp = 'local' | 'USD' | 'ILS';

type Me = { user: { name: string | null; email: string } | null; isAdmin?: boolean; reports?: number; likes?: number; searchesLeft?: number; anonLeft?: number; unlimited?: boolean };

const GoogleMapCard = dynamic(() => import('@/components/GoogleMapCard'), { ssr: false });
const ReportForm = dynamic(() => import('@/components/Extras').then(m => m.ReportForm), { ssr: false });
const ShareSheet = dynamic(() => import('@/components/Extras').then(m => m.ShareSheet), { ssr: false });
const InstallSheet = dynamic(() => import('@/components/Extras').then(m => m.InstallSheet), { ssr: false });
const AccountSheet = dynamic(() => import('@/components/Extras').then(m => m.AccountSheet), { ssr: false });
const StayMap = dynamic(() => import('@/components/StayMap'), { ssr: false, loading: () => <div className="map map-loading">טוען מפה…</div> });


function GitHubIcon() {
  return <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>;
}

type Photo = { src: string; page: string; author: string; license: string; licenseUrl?: string; area?: boolean; title?: string };
function Thumb({ place, size = 'sm', photo }: { place: Pick<Place, 'kind'>; size?: 'sm' | 'lg'; photo?: Photo | null }) {
  const [bad, setBad] = useState(false);
  const [full, setFull] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => { setBad(false); setFull(false); }, [photo?.src]);
  // 60px list thumbs only need a 250px Commons thumbnail (about a tenth of the bytes); fall back to the original URL if it fails.
  const small = photo && size === 'sm' && !full ? photo.src.replace(/\/(\d+)px-([^/]+)$/, (m, w, f) => Number(w) > 250 ? `/250px-${f}` : m) : photo?.src;
  // Server-rendered images can finish loading before React attaches onLoad; reveal them anyway.
  useEffect(() => { const i = imgRef.current; if (i?.complete && i.naturalWidth) i.classList.add('in'); }, [photo?.src, bad]);
  if (photo && !bad) return <div className={`thumb ${size} photo`}><img ref={imgRef} src={small} alt="" loading="lazy" decoding="async" onLoad={e => e.currentTarget.classList.add('in')} onError={() => small !== photo.src ? setFull(true) : setBad(true)} />{photo.area && size === 'sm' && <i className="area-tag">אזור</i>}</div>;
  return <div className={`thumb ${size} ph ph-${place.kind}`} aria-hidden="true"><span>{KIND_ICON[place.kind] ?? '🏠'}</span></div>;
}
const CUR_SYMBOL: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€', GBP: '£', THB: '฿', INR: '₹', JPY: '¥', VND: '₫' };
/** Number big, currency small, always left-to-right so "500 NPR" never flips in RTL. */
/** Rolls a number up to its value (ease-out), like the Apple Wallet/Health totals. Instant with reduced motion. */
function useCountUp(target: number, on: boolean) {
  const [v, setV] = useState(on ? 0 : target);
  const from = useRef(on ? 0 : target);
  useEffect(() => {
    if (!on || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) { setV(target); from.current = target; return; }
    const a = from.current, t0 = performance.now(), dur = 750; let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 4); setV(a + (target - a) * e); if (k < 1) raf = requestAnimationFrame(tick); else from.current = target; };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); };
  }, [target, on]);
  return v;
}
function PriceTag({ amount, cur, approx = false, roll = false }: { amount: number; cur: string; approx?: boolean; roll?: boolean }) {
  const shown = useCountUp(amount, roll);
  const val = roll && shown !== amount ? (amount % 1 ? Math.round(shown * 100) / 100 : Math.round(shown)) : amount;
  const n = val.toLocaleString('en-US', { maximumFractionDigits: amount % 1 ? 2 : 0 });
  const sym = CUR_SYMBOL[cur];
  return <span className="pt" dir="ltr">{approx && <i>≈</i>}{sym && <small className="sym">{sym}</small>}<span className="num">{n}</span>{!sym && <small className="code">{cur}</small>}</span>;
}
function PhotoCredit({ photo }: { photo: Photo }) {
  return <p className="photo-credit">📷 {photo.area ? <>תמונה של האזור{photo.title ? ` (${photo.title})` : ''}, לא של המקום עצמו · </> : null}
    <bdi><a href={photo.page} target="_blank" rel="noopener">{photo.author}</a></bdi> · {photo.licenseUrl ? <a href={photo.licenseUrl} target="_blank" rel="noopener"><bdi>{photo.license}</bdi></a> : <bdi>{photo.license}</bdi>} · Wikimedia Commons</p>;
}

/** Why we ask for Google sign-in. Shown before every sign-in. */
function LoginNote({ onMore }: { onMore: () => void }) {
  return <div className="login-note"><span aria-hidden="true">🔒</span><p>
    <b>למה להתחבר?</b> כדי למנוע דיווחים כפולים ולא אמינים. <strong className="hl">מגוגל אנחנו מקבלים רק שם ומייל.</strong> הם לא מוצגים למשתמשים אחרים, והדיווחים שלך מופיעים בלי שם.{' '}
    <button type="button" className="linkish" onClick={onMore}>איזה עוד מידע אנחנו שומרים?</button></p></div>;
}

const PRIVACY_ITEMS: [string, string, string][] = [
  ['👤', 'מגוגל', 'שם, מייל ומזהה החשבון בגוגל. לא תמונת פרופיל.'],
  ['💬', 'דיווחים והצבעות', 'מקושרים לחשבון שלך כדי למנוע כפילויות, אבל מוצגים לכולם בלי שם.'],
  ['📍', 'אזורים שחיפשת', 'המיקום והשעה של כל חיפוש עם מחירים, כדי לספור את 5 החיפושים.'],
  ['🎟️', 'הזמנות', 'מי הזמין אותך, והקישורים שיצרת ומי הצטרף דרכם.'],
  ['⚙️', 'פרטי חשבון', 'תאריך ההרשמה, והגדרות כמו חשבון מנהל או חסימה.'],
  ['🍪', 'עוגיות', 'עוגיית התחברות. מי שלא מחובר מקבל מזהה אקראי ורשימת המקומות שפתח, כדי לספור 3 צפיות חינם.'],
  ['📊', 'סטטיסטיקה', 'ספירה יומית אנונימית של פעולות באתר, ו-Cloudflare Web Analytics בלי עוגיות.'],
];


export default function App({ initialPlace = null }: { initialPlace?: InitialPlace | null }) {
  const [me, setMe] = useState<Me | null>(null);
  const [area, setArea] = useState<Area | null>(initialPlace && Number.isFinite(initialPlace.lat) ? { name: initialPlace.locality ?? initialPlace.name, lat: initialPlace.lat, lon: initialPlace.lon, country: initialPlace.country } : null);
  const [myPos, setMyPos] = useState<{ lat: number; lon: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [searchId, setSearchIdState] = useState<string | null>(null);
  const searchRef = useRef<string | null>(null);
  const setSearchId = (v: string | null) => { searchRef.current = v; setSearchIdState(v); };
  const [loginPop, setLoginPop] = useState(false);
  const areaRef = useRef<Area | null>(null);
  const [listPrices, setListPrices] = useState<Record<string, [number, string][]>>({});
  // True until auth and this area's prices have both resolved: show neutral placeholders, never a false 'locked'.
  const [pricesLoading, setPricesLoading] = useState(false);
  const [meHint, setMeHint] = useState<{ n?: string } | null>(null);
  useEffect(() => { try { setMeHint(JSON.parse(localStorage.getItem('sp_me_hint') ?? 'null')); } catch {} }, []);
  const [status, setStatus] = useState<'idle' | 'locating' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<InitialPlace | null>(initialPlace);
  const [openState, setOpenState] = useState<{ loading: boolean; locked?: boolean; needLogin?: boolean; reports?: Report[] }>({ loading: !!initialPlace });
  const [reporting, setReporting] = useState<Place | 'manual' | null>(null);
  const [toast, setToast] = useState('');
  const [installEvt, setInstallEvt] = useState<any>(null);
  const installEvtRef = useRef<any>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [step, setStep] = useState(0);
  const [picker, setPicker] = useState(false);
  const [bootOn, setBootOn] = useState(true); // the pre-React search box (lib/boot.ts)
  const [onlyKnown, setOnlyKnown] = useState(false);
  const [ipCountry, setIpCountry] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [disp, setDisp] = useState<Disp>('local');
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [sugOpen, setSugOpen] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // Landing sections glide in as they scroll into view.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    const t = setTimeout(() => document.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el)), 50);
    return () => { clearTimeout(t); io.disconnect(); };
  });
  useEffect(() => { const f = () => setScrolled(window.scrollY > 8); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);
  const [photos, setPhotos] = useState<{ places: Record<string, Photo>; area: Photo[] }>({ places: {}, area: [] });
  const photoFor = (p: Place): Photo | null => {
    const own = photos.places[p.id]; if (own) return own;
    if (!photos.area.length) return null;
    let h = 0; for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return photos.area[h % photos.area.length];
  };
  const [a2hs, setA2hs] = useState<null | 'native' | 'ios'>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const offerInstall = (force = false) => {
    if (isStandalone()) return;
    if (!force && !canOfferA2hs()) return;
    if (installEvtRef.current) setA2hs('native'); else if (isIOS()) setA2hs('ios');
  };
  const closeA2hs = () => { const st = readA2hs(); writeA2hs({ ...st, dismissed: st.dismissed + 1, last: Date.now() }); setA2hs(null); };
  const doInstall = async () => {
    const e = installEvtRef.current; setA2hs(null);
    if (!e) return;
    e.prompt();
    const r = await e.userChoice.catch(() => null);
    installEvtRef.current = null; setInstallEvt(null);
    if (r?.outcome === 'accepted') { track('install'); writeA2hs({ ...readA2hs(), installed: true }); setInstalled(true); } else closeA2hs();
  };
  const [loginWhy, setLoginWhy] = useState<'views' | 'report' | 'invite' | 'plain'>('views');
  useEffect(() => { if (reporting) track('report_open'); }, [!!reporting]);
  useEffect(() => { if (loginPop) track('login_open'); }, [loginPop]);
  const [acct, setAcct] = useState(false);
  const [inviteFrom, setInviteFrom] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState(false);
  // Sign-up is invite-only. Strangers (no account on this device, no invite link opened) get the invite-only sheet;
  // they can still sign in if they already have an account. The server enforces the rule either way.
  const [canJoin, setCanJoin] = useState(false);
  const [sleepPick, setSleepPick] = useState<{ status: 'locating' | 'ready' | 'error'; places: Place[]; msg?: string } | null>(null);

  // Autocomplete: debounce, cancel the previous request, and drop any answer that isn't for the current text.
  const sugSeq = useRef(0);
  const [sugFor, setSugFor] = useState('');
  useEffect(() => {
    const q = search.trim();
    const id = ++sugSeq.current;
    if (q.length < 2) { setSugs([]); setSugFor(''); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      suggestPlaces(q, area ?? myPos, ctl.signal).then(r => { if (!ctl.signal.aborted && id === sugSeq.current) { setSugs(r); setSugFor(q); } });
    }, 280);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [search]);
  const sugFresh = sugFor !== '' && sugFor === search.trim();
  const sugBusy = search.trim().length >= 2 && !sugFresh;
  const liveSugs = sugFresh ? sugs : [];

  // A cached old copy of the app (weak signal, service worker) notices a new deploy and reloads once.
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD;
    const check = async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' }); if (!r.ok) return;
        const { v } = await r.json();
        if (!v || !mine || v === mine || sessionStorage.getItem('sp_reloaded') === v) return;
        sessionStorage.setItem('sp_reloaded', v);
        try { for (const k of await caches.keys()) if (k.startsWith('sp-shell')) await caches.delete(k); } catch { /* no caches */ }
        await navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => {});
        location.reload();
      } catch { /* offline */ }
    };
    const first = setTimeout(check, 6000);
    const onVis = () => { if (document.visibilityState === 'visible' && !document.activeElement?.matches('input,textarea')) check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(first); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  const pickSug = async (sg: Suggestion) => {
    track('search_pick');
    setSugOpen(false); setSearch(''); setSugs([]);
    if (sg.type === 'stay' && sg.placeId) {
      // A specific stay: load its surroundings for the list/map, then open the place itself.
      const p: InitialPlace = { id: sg.placeId, name: sg.name, kind: sg.kind ?? 'guest_house', lat: sg.lat, lon: sg.lon, country: sg.country, locality: sg.city };
      openPlace(p);
      await loadArea({ name: sg.city ?? sg.name, lat: sg.lat, lon: sg.lon, country: sg.country }, true);
      if (openRef.current?.id === p.id) openPlace(p, false); // refresh once this area's search is active
      return;
    }
    loadArea({ name: sg.name, lat: sg.lat, lon: sg.lon, country: sg.country });
  };

  const [toastOut, setToastOut] = useState(false);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hideToast = (m?: string) => { setToastOut(true); toastTimers.current.push(setTimeout(() => { setToast(t => (m === undefined || t === m) ? '' : t); setToastOut(false); }, 280)); };
  const say = (m: string) => {
    toastTimers.current.forEach(clearTimeout); toastTimers.current = [];
    setToastOut(false); setToast(m);
    toastTimers.current.push(setTimeout(() => hideToast(m), 4200));
  };
  const refreshMe = () => fetch('/api/auth/me').then(r => r.json()).then((m: Me) => { setMe(m); try { localStorage.setItem('sp_me_hint', JSON.stringify(m.user ? { n: (m.user.name ?? m.user.email ?? '?').trim()[0] } : {})); if (m.user) { localStorage.setItem('sp_member', '1'); setCanJoin(true); } } catch {} return m; }).catch(() => { const m = { user: null }; setMe(m); return m as Me; });
  const loadListPrices = (list: Place[], sid: string | null) => {
    if (!list.length) return Promise.resolve();
    return fetch(`/api/reports?placeIds=${encodeURIComponent(list.map(p => p.id).join(','))}${sid ? `&searchId=${sid}` : ''}`)
      .then(r => r.json()).then(j => { setCounts(j.counts ?? {}); setListPrices(j.prices ?? {}); }).catch(() => {});
  };
  /** Spend (or reuse) one search with prices for the area. Returns the search id or null. */
  const startSearch = async (a: Area, m?: Me): Promise<string | null> => {
    const who = m ?? await refreshMe();
    if (!who?.user || !(who.searchesLeft ?? 0)) { setSearchId(null); return null; }
    const r = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: a.lat, lon: a.lon }) });
    if (!r.ok) { setSearchId(null); return null; }
    const j = await r.json();
    setSearchId(j.searchId); setMe(x => x ? { ...x, searchesLeft: j.searchesLeft } : x);
    return j.searchId;
  };

  const GENERIC = ['המיקום שלך', 'האזור ששותף'];
  const loadArea = async (a: Area, keepOpen = false) => {
    track('area_view');
    if (GENERIC.includes(a.name)) localityAt(a.lat, a.lon).then(l => { if (l) setArea(cur => cur && cur.lat === a.lat && cur.lon === a.lon ? { ...cur, label: l.name, country: cur.country ?? l.country } : cur); });
    if (!a.country) countryAt(a.lat, a.lon).then(c => { if (c) setArea(cur => cur && cur.lat === a.lat && cur.lon === a.lon ? { ...cur, country: c } : cur); });
    setListPrices({}); setSearchId(null); setPricesLoading(true); areaRef.current = a; setArea(a); if (!keepOpen) { setOpen(null); setReporting(null); } setStatus('loading'); setMessage(''); setPicker(false); setOnlyKnown(false);
    try {
      // One edge request for places + counts; the direct OSM lookup is only the fallback.
      // The pre-React script may already have asked for this exact area (shared link or early pick).
      const ba = (window as any).__bootArea, early = ba && ba.lat === a.lat && ba.lon === a.lon ? ba.p as Promise<unknown> : null;
      (window as any).__bootArea = null;
      const j = await (early ?? fetch(`/api/area?lat=${a.lat}&lon=${a.lon}`).then(r => r.ok ? r.json() : null)).catch(() => null) as { places: Place[] | null; reported: (Place & { n: number })[]; counts: Record<string, number> } | null;
      const km = (p: { lat: number; lon: number }) => Math.hypot((p.lat - a.lat) * 111, (p.lon - a.lon) * 111 * Math.cos(a.lat * Math.PI / 180));
      const osm = j?.places?.length ? j.places.map(p => ({ ...p, distance: km(p) })) : await nearbyStays(a.lat, a.lon).catch(() => [] as Place[]);
      const reported = j?.reported ?? await fetch(`/api/reports?lat=${a.lat}&lon=${a.lon}`).then(r => r.json()).then(j => (j.places ?? []) as (Place & { n: number })[]).catch(() => []);
      const found = [...osm];
      for (const r of reported) if (!found.some(p => p.id === r.id)) {
        const d = Math.hypot((r.lat - a.lat) * 111, (r.lon - a.lon) * 111 * Math.cos(a.lat * Math.PI / 180));
        found.push({ id: r.id, name: r.name, kind: r.kind ?? 'guest_house', lat: r.lat, lon: r.lon, country: r.country ?? undefined, distance: d });
      }
      found.sort((x, y) => (x.distance ?? 0) - (y.distance ?? 0));
      setPhotos({ places: {}, area: [] });
      const ids = found.filter(p => p.id.startsWith('osm-')).slice(0, 60).map(p => p.id).join(',');
      fetch(`/api/photos?lat=${a.lat.toFixed(3)}&lon=${a.lon.toFixed(3)}&ids=${ids}`).then(r => r.json())
        .then(j => { if (areaRef.current === a) setPhotos({ places: j.places ?? {}, area: j.area ?? [] }); }).catch(() => {});
      setCounts({ ...Object.fromEntries(reported.map(r => [r.id, r.n])), ...(j?.counts ?? {}) });
      setPlaces(found); setStatus('ready');
      if (!found.length) { setPricesLoading(false); setMessage('לא נמצאו מקומות לינה במפה ברדיוס 2 ק״מ. אפשר לדווח ידנית.'); return; }
      const sid = await startSearch(a);
      await loadListPrices(found, sid);
      if (areaRef.current === a) setPricesLoading(false);
    } catch { setPricesLoading(false); setStatus('error'); setMessage('החיפוש במפה לא הצליח (אולי אין קליטה). נסה שוב או בחר אזור.'); }
  };
  const locate = (silent = false) => {
    if (!navigator.geolocation) { if (!silent) setMessage('המכשיר לא מאפשר מיקום. בחר אזור.'); setPicker(true); return; }
    setStatus('locating'); setMessage('');
    navigator.geolocation.getCurrentPosition(
      p => { const pos = { lat: p.coords.latitude, lon: p.coords.longitude }; setMyPos(pos); loadArea({ name: 'המיקום שלך', ...pos }); },
      () => { setStatus('idle'); if (!silent) setMessage('לא קיבלתי מיקום. אפשר לאשר מיקום בהגדרות הדפדפן, או לבחור אזור.'); setPicker(true); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
  };

  useEffect(() => {
    refreshMe();
    fetch('/api/rates').then(r => r.ok ? r.json() : null).then(j => j?.rates && setRates(j.rates)).catch(() => {});
    try { const d = localStorage.getItem('sp_disp'); if (d === 'USD' || d === 'ILS' || d === 'local') setDisp(d); } catch {}
    fetch('/api/geo').then(r => r.json()).then(j => setIpCountry(j.country ?? null)).catch(() => {});
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const h = (e: Event) => { e.preventDefault(); installEvtRef.current = e; setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    const onInstalled = () => { writeA2hs({ ...readA2hs(), installed: true }); setInstalled(true); setA2hs(null); installEvtRef.current = null; setInstallEvt(null); };
    window.addEventListener('appinstalled', onInstalled);
    setIos(isIOS()); setInstalled(isStandalone());
    let visits = 0; try { visits = Number(localStorage.getItem('sp_visits') ?? 0) + 1; localStorage.setItem('sp_visits', String(visits)); } catch {}
    // Good moment #1: a returning visitor, after they've had a few seconds with the app.
    const a2hsTimer = visits >= 2 ? setTimeout(() => offerInstall(), 25000) : null;
    const at = new URLSearchParams(location.search).get('at')?.split(',').map(Number);
    const lp = new URLSearchParams(location.search).get('login');
    if (lp === 'failed') say('ההתחברות עם Google לא הצליחה. נסה שוב.');
    if (lp === 'blocked') say('החשבון הזה חסום. אם זו טעות, פנה למנהל האתר.');
    if (lp === 'invite_required') say('ההרשמה כרגע בהזמנה בלבד. בקש קישור אישי מחבר שכבר בפנים 🎟️');
    const inv = new URLSearchParams(location.search).get('invite'), from = new URLSearchParams(location.search).get('from');
    try { const t = Number(localStorage.getItem('sp_invited') || 0); if (localStorage.getItem('sp_member') === '1' || (t && Date.now() - t < 29 * 864e5)) setCanJoin(true); } catch {}
    if (inv === 'bad' || lp === 'invite_required') { try { localStorage.removeItem('sp_invited'); } catch {} setCanJoin(false); }
    if (inv === 'ok') { setCanJoin(true); try { localStorage.setItem('sp_invited', String(Date.now())); } catch {} setInviteFrom(from ?? ''); try { localStorage.setItem('sp_onboarded', '1'); } catch {} }
    if (inv === 'bad') say('קישור ההזמנה כבר נוצל או בוטל. בקש קישור חדש ממי ששלח לך.');
    if (lp || inv) history.replaceState(null, '', '/');
    let seen = false; try { seen = localStorage.getItem('sp_onboarded') === '1'; } catch {}
    // Hand-off from the pre-React search box: finish its pick, or move its text into the real picker.
    const W = window as any; W.__hyd = true;
    const bootEl = document.getElementById('boot'), bootIn = bootEl?.querySelector('input');
    const bootPick = W.__boot?.pick as Suggestion | undefined, bootOpen = !!bootEl && !(bootEl.querySelector('.boot-search') as HTMLElement | null)?.hidden;
    const endBoot = () => { W.__bootGone = true; setBootOn(false); };
    W.__bootPick = (sg: Suggestion) => { endBoot(); window.scrollTo({ top: 0 }); try { localStorage.setItem('sp_onboarded', '1'); } catch {} pickSug(sg); };
    W.__bootBlur = (v: string) => { endBoot(); setPicker(true); if (v.trim()) { setSearch(v); setSugOpen(true); } };
    if (bootPick) W.__bootPick(bootPick);
    else if (bootOpen && document.activeElement !== bootIn) W.__bootBlur(bootIn?.value ?? '');
    else if (!bootOpen) endBoot();
    if (bootPick || bootOpen) { /* the user is already searching */ }
    else if (initialPlace) {
      history.replaceState({ place: initialPlace }, '', location.pathname);
      openPlace(initialPlace, false);
      if (Number.isFinite(initialPlace.lat)) loadArea({ name: initialPlace.locality ?? initialPlace.name, lat: initialPlace.lat, lon: initialPlace.lon, country: initialPlace.country }, true);
    }
    else if (at && at.length === 2 && at.every(Number.isFinite)) { history.replaceState(null, '', '/'); if (!seen) { try { localStorage.setItem('sp_onboarded', '1'); } catch {} } loadArea({ name: 'האזור ששותף', lat: at[0], lon: at[1] }); }
    else if (inv === 'ok') { /* the invite welcome comes first; location after it closes */ }
    else if (!seen) setOnboarding(true); else locate(true);
    return () => { window.removeEventListener('beforeinstallprompt', h); window.removeEventListener('appinstalled', onInstalled); if (a2hsTimer) clearTimeout(a2hsTimer); };
  }, []);
  // Remember where the list was scrolled, so closing a place lands back on the same row (like iOS back).
  const openRef = useRef<InitialPlace | null>(null);
  const listY = useRef(0);
  useEffect(() => {
    const wasOpen = openRef.current; openRef.current = open;
    if (open || reporting) { window.scrollTo({ top: 0 }); return; }
    if (wasOpen && listY.current > 0) { const y = listY.current; requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y }))); }
  }, [open, reporting]);

  const finishOnboarding = () => { try { localStorage.setItem('sp_onboarded', '1'); } catch {} setOnboarding(false); locate(); };
  const doSearch = async () => {
    if (!search.trim()) return;
    setStatus('loading'); setMessage('');
    const a = await findArea(search.trim());
    if (a) loadArea(a); else { setStatus('idle'); setMessage('לא מצאתי את המקום. נסה שם אחר או באנגלית.'); }
  };
  const pushedRef = useRef(false);
  const openPlace = async (p: InitialPlace, push = true) => {
    if (push) track('place_view');
    if (!openRef.current && typeof window !== 'undefined') listY.current = window.scrollY;
    setOpen(p);
    if (typeof window !== 'undefined') {
      const path = placePath(p);
      if (push && location.pathname !== path) { history.pushState({ place: p }, '', path); pushedRef.current = true; }
      document.title = `${p.name} · כמה ישראלים שילמו ללילה`;
    }
    setOpenState({ loading: true });
    const res = await fetch('/api/views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ placeId: p.id, placeName: p.name, lat: p.lat, lon: p.lon, searchId: searchRef.current }) });
    if (res.status === 401) { setOpenState({ loading: false, needLogin: true }); setLoginWhy('views'); setLoginPop(true); }
    else if (res.status === 402) setOpenState({ loading: false, locked: true });
    else if (res.ok) { const j = await res.json(); setOpenState({ loading: false, reports: j.reports }); if (j.anonLeft != null) setMe(x => x ? { ...x, anonLeft: j.anonLeft } : x); }
    else setOpenState({ loading: false, reports: [] });
  };
  const closePlace = () => {
    if (pushedRef.current && history.state?.place) { pushedRef.current = false; history.back(); return; }
    setOpen(null);
  };
  const sharePlace = async (p: InitialPlace) => {
    const url = SITE_URL + placePath(p);
    const text = `${p.name}${p.locality ? `, ${p.locality}` : ''} ${p.country ? flagOf(p.country) : ''}\nכמה ישראלים שילמו כאן ללילה? 👀`;
    track('share');
    if (navigator.share) { try { await navigator.share({ title: p.name, text, url }); return; } catch (e: any) { if (e?.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); say('הקישור הועתק. אפשר להדביק בוואטסאפ 👍'); }
    catch { window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank', 'noopener'); }
  };
  // Keep the URL in sync: a closed place page goes back to "/"; browser back/forward reopens or closes places.
  useEffect(() => {
    if (!open && typeof window !== 'undefined' && location.pathname.startsWith('/p/')) { history.replaceState(null, '', '/'); document.title = 'כמה ישראלים שילמו ללילה'; }
    if (!open && typeof document !== 'undefined') document.title = 'כמה ישראלים שילמו ללילה';
  }, [open]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { place?: InitialPlace } | null;
      setReporting(null);
      if (st?.place) openPlace(st.place, false); else { pushedRef.current = false; setOpen(null); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const vote = async (r: Report, v: 1 | -1) => {
    const next = r.my_vote === v ? 0 : v;
    const res = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: r.id, vote: next }) });
    if (res.status === 401) { setLoginWhy('report'); return setLoginPop(true); }
    if (!res.ok) return say('הדירוג לא נשמר.');
    const j = await res.json();
    setOpenState(s => ({ ...s, reports: s.reports?.map(x => x.id === r.id ? { ...x, up: j.up, down: j.down, my_vote: next || null } : x) }));
    setMe(x => x ? { ...x, searchesLeft: j.searchesLeft, likes: j.likes } : x);
    try { navigator.vibrate?.(10); } catch {}
    if (next === 1) {
      say('תודה! לייק נחשב כדיווח: קיבלת 5 חיפושים עם מחירים.');
      if (!searchRef.current && areaRef.current) { const sid = await startSearch(areaRef.current); loadListPrices(places, sid); }
    }
    if (next === -1 && open) { say('שילמת יותר? ספר כמה. הדיווח שלך ייחשב ויפתח 5 חיפושים.'); setReporting(open); }
  };
  const afterReport = async (msg: string, share?: ShareInfo) => {
    const p = reporting;
    setReporting(null); say(msg);
    if (share) setShareInfo(share);
    const m = await refreshMe();
    const sid = areaRef.current ? await startSearch(areaRef.current, m) : null;
    loadListPrices(places, sid ?? searchRef.current);
    if (p && p !== 'manual') openPlace(p);
    else if (open) openPlace(open);
  };
  /** "I'm sleeping here now": fresh GPS -> nearest stays -> pick -> short report form. */
  const sleepHere = () => {
    track('sleep_tap');
    if (!me?.user) { setLoginWhy('report'); setLoginPop(true); return; }
    if (!navigator.geolocation) { setReporting('manual'); return; }
    setSleepPick({ status: 'locating', places: [] });
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      setMyPos({ lat, lon });
      const [near, country] = await Promise.all([nearbyStays(lat, lon, 600).catch(() => [] as Place[]), countryAt(lat, lon)]);
      const list = near.slice(0, 6).map(p => ({ ...p, country: p.country ?? country ?? undefined }));
      setSleepPick(list.length ? { status: 'ready', places: list } : { status: 'error', places: [], msg: 'לא מצאתי מקומות לינה במפה ממש לידך. אפשר לדווח ידנית.' });
    }, () => setSleepPick({ status: 'error', places: [], msg: 'לא קיבלתי מיקום. אפשר לאשר מיקום בהגדרות הדפדפן, או לדווח ידנית.' }),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  };
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); setSearchId(null); setListPrices({}); refreshMe(); };

  const rs = openState.reports ?? [];
  const viewCountry = open?.country ?? area?.country ?? ipCountry;
  const localCur = currencyFor(viewCountry);
  const dispCur = disp === 'local' ? localCur : disp;
  const conv = (price: number, from: string): number | null => {
    if (from === dispCur) return price;
    if (!rates?.[from] || !rates?.[dispCur]) return null;
    const v = price / rates[from] * rates[dispCur];
    return v >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
  };
  const chooseDisp = (d: Disp) => { setDisp(d); try { localStorage.setItem('sp_disp', d); } catch {} };
  const summary = (() => {
    if (!rs.length) return null;
    const all = rs.map(r => conv(r.price, r.currency));
    if (all.every(v => v != null)) {
      const prices = all as number[];
      return { cur: dispCur, med: median(prices), min: Math.min(...prices), max: Math.max(...prices), n: prices.length };
    }
    const byCur: Record<string, Report[]> = {};
    for (const r of rs) (byCur[r.currency] ??= []).push(r);
    const top = Object.values(byCur).sort((x, y) => y.length - x.length)[0];
    const prices = top.map(r => r.price);
    return { cur: top[0].currency, med: median(prices), min: Math.min(...prices), max: Math.max(...prices), n: top.length };
  })();
  const DispSwitch = <select className="chip disp-select" value={disp} onChange={e => chooseDisp(e.target.value as Disp)} aria-label="מטבע להצגה">
    <option value="local">{flagOf(viewCountry)} {localCur}</option>
    {localCur !== 'USD' && <option value="USD">🇺🇸 USD</option>}
    {localCur !== 'ILS' && <option value="ILS">🇮🇱 ₪ ILS</option>}
  </select>;
  const listMedian = (id: string): string | null => {
    const ps = listPrices[id];
    if (!ps?.length) return null;
    const conv2 = ps.map(([p, c]) => conv(p, c));
    if (conv2.every(v => v != null)) { const m = median(conv2 as number[]); return money(m >= 100 ? Math.round(m) : Math.round(m * 100) / 100, dispCur); }
    const c0 = ps[0][1]; return money(median(ps.filter(x => x[1] === c0).map(x => x[0])), c0);
  };
  const reportCountry = (reporting && reporting !== 'manual' ? reporting.country : null) ?? open?.country ?? area?.country ?? ipCountry;
  const loggedIn = !!me?.user;
  const knownCount = places.filter(p => counts[p.id]).length;
  const shown = onlyKnown ? places.filter(p => counts[p.id]) : places;
  const showLanding = !area && !reporting && !open;
  // Status-bar tint follows what sits under it: dark over the landing photo (and the onboarding over it), light elsewhere.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]'); if (!meta) return;
    const set = () => meta.setAttribute('content', showLanding && window.scrollY < window.innerHeight * 0.6 ? '#2b2621' : '#f6f3ee');
    set(); window.addEventListener('scroll', set, { passive: true });
    return () => { window.removeEventListener('scroll', set); meta.setAttribute('content', '#f6f3ee'); };
  }, [showLanding]);
  const gate = !me || (loggedIn && pricesLoading && !me.unlimited) ? (meHint?.n || me?.user ? { t: 'טוען את המחירים שלך…', ok: true, wait: true } : null) : !loggedIn ? { t: `${me.anonLeft ?? 3} מתוך 3 צפיות חינם`, ok: (me.anonLeft ?? 3) > 0 }
    : me.unlimited ? { t: 'אדמין · חיפושים ללא הגבלה', ok: true }
    : searchId ? { t: `המחירים באזור פתוחים · נשארו ${me.searchesLeft ?? 0} חיפושים`, ok: true }
    : { t: 'דווח מחיר או תן 👍 כדי לפתוח 5 חיפושים', ok: false };

  const Header = ({ light = false }: { light?: boolean }) => <header className={`header ${light ? 'light' : ''} ${scrolled && !light ? 'scrolled' : ''}`}>
    <button className="brand" onClick={() => { setArea(null); setOpen(null); setReporting(null); setStatus('idle'); }}>
      <img src="/icons/v2/icon-96.webp" alt="" width="32" height="32" /><span>מחיר ללילה</span>
    </button>
    <nav>
      {!installed && (installEvt || ios) && <button className="chip" onClick={() => offerInstall(true)}>📲 התקן</button>}
      {DispSwitch}
      {me?.isAdmin && <a className="chip" href="/admin">אדמין</a>}
      {loggedIn ? <button className="avatar" onClick={() => setAcct(true)} title={me?.user?.email} aria-label="החשבון שלי והזמנות">{(me?.user?.name ?? me?.user?.email ?? '?').trim()[0]}</button>
        : !me ? (meHint?.n ? <span className="avatar pending" aria-hidden="true">{meHint.n}</span> : <span className="chip ghost-slot" aria-hidden="true" />)
        : <button className="chip strong" onClick={() => { setLoginWhy('plain'); setLoginPop(true); }}>{canJoin ? 'התחברות' : '🎟️ בהזמנה בלבד'}</button>}
    </nav>
  </header>;

  const Picker = <div className="picker">
    <div className="searchrow">
      <div className="ac">
        <input value={search} onChange={e => { setSearch(e.target.value); setSugOpen(true); }} onFocus={() => setSugOpen(true)} onBlur={() => setTimeout(() => setSugOpen(false), 150)}
          onKeyDown={e => { if (e.key === 'Enter') { if (liveSugs[0]) pickSug(liveSugs[0]); else doSearch(); } }} placeholder="עיר, שכונה או שם מלון" aria-label="חיפוש עיר, אזור או מקום לינה" enterKeyHint="search" autoComplete="off" role="combobox" aria-expanded={sugOpen && liveSugs.length > 0} aria-busy={sugBusy} />
        {sugBusy && <span className="ac-spin" aria-hidden="true" />}
        {sugOpen && sugBusy && <ul className="ac-list ac-wait" aria-hidden="true">{[0, 1, 2].map(i => <li key={i} className="ac-shimmer"><span /><span /></li>)}</ul>}
        {sugOpen && liveSugs.length > 0 && <ul className="ac-list" role="listbox">{liveSugs.map((sg, i) => <Fragment key={i}>
          {(i === 0 || liveSugs[i - 1].type !== sg.type) && <li className="ac-head" aria-hidden="true">{sg.type === 'stay' ? 'מקומות לינה' : 'ערים ואזורים'}</li>}
          <li role="option" aria-selected={false}>
          <button onMouseDown={e => e.preventDefault()} onClick={() => pickSug(sg)}>
            <span className={`ac-icon ${sg.type === 'stay' ? 'stay' : ''}`}>{sg.type === 'stay' ? (KIND_ICON[sg.kind ?? ''] ?? '🏨') : '📍'}</span>
            <span className="ac-text"><b dir="auto">{sg.name}</b>{sg.sub && <small dir="auto">{sg.sub}</small>}</span>
            <span className="ac-flag">{flagOf(sg.country)}</span></button>
        </li></Fragment>)}</ul>}
      </div>
      <button className="btn primary" onClick={() => liveSugs[0] ? pickSug(liveSugs[0]) : doSearch()}>חפש</button>
    </div>
    <div className="chips">{QUICK_AREAS.map(a => <button key={a.name} className="chip" onClick={() => loadArea(a)}>{flagOf(a.country)} {a.name}</button>)}</div>
  </div>;

  const Footer = <footer className="footer">
    <a className="gh" href={GITHUB_URL} target="_blank" rel="noopener"><GitHubIcon /> קוד פתוח ב-GitHub. רוצה לעזור? מוזמן לתרום</a>
    <p>מפה ומקומות: <bdi><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a></bdi></p>
    <p>שערי מטבע (יומי, להמחשה): <bdi><a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">Rates By Exchange Rate API</a></bdi></p>
    <p>תמונות: <bdi><a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a></bdi>, ברישיונות חופשיים. הקרדיט לכל תמונה בדף המקום. התמונות לא נשמרות אצלנו.</p>
    <p>אמוג׳י בכרטיס השיתוף: <bdi><a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener">Twemoji</a></bdi>, CC-BY 4.0</p>
    <p>המיקום משמש רק לחיפוש ולא נשמר. המחירים מוצגים בלי שם או מייל של המדווח.</p>
  </footer>;

  return <>
    {toast && <div key={toast} className={`toast${toastOut ? ' out' : ''}`} role="status" onClick={() => hideToast()}>{toast}</div>}

    {loginPop && !canJoin && <Sheet onClose={() => setLoginPop(false)}>{dismiss => <>
        <div className="sheet-step"><div className="sheet-icon">🎟️</div>
          <h2>האתר בהזמנה בלבד</h2>
          <p>{loginWhy === 'views' ? 'נגמרו 3 הצפיות החינמיות. ' : loginWhy === 'report' ? 'כדי לדווח צריך חשבון. ' : ''}כדי שהמחירים יישארו אמינים, מצטרפים רק דרך קישור אישי מחבר שכבר באתר. מכיר מישהו כזה? בקש ממנו קישור.</p></div>
        <button className="btn primary block" onClick={dismiss}>הבנתי</button>
        <div className="returning">
          <p className="returning-h">כבר יש לך חשבון?</p>
          <LoginNote onMore={() => setPrivacy(true)} />
          <a className="btn block" href="/api/auth/google">התחבר עם Google</a>
        </div>
      </>}</Sheet>}

    {loginPop && canJoin && <Sheet onClose={() => setLoginPop(false)}>{dismiss => <>
        <div className="sheet-step"><div className="sheet-icon">🔑</div><h2>{loginWhy === 'plain' ? 'התחברות' : loginWhy === 'invite' ? 'הוזמנת! נשאר רק להתחבר' : loginWhy === 'report' ? 'רק להתחבר, וממשיכים' : 'נגמרו 3 הצפיות החינמיות'}</h2>
        <p>{loginWhy === 'report' ? 'הדיווח מוצג בלי שם ובלי מייל.' : 'התחבר כדי להמשיך.'} אחרי ההתחברות, כל דיווח על מחיר ששילמת, או 👍 על דיווח של מישהו אחר, פותח לך 5 חיפושים עם מחירים.</p></div>
        <LoginNote onMore={() => setPrivacy(true)} />
        <a className="btn primary block" href="/api/auth/google">התחבר עם Google</a>
        <button className="btn ghost block" onClick={dismiss}>אחר כך</button>
      </>}</Sheet>}

    {acct && me?.user && <AccountSheet me={me.user} onClose={() => setAcct(false)} onLogout={logout} say={say} />}
    {shareInfo && <ShareSheet info={shareInfo} onClose={() => { setShareInfo(null); setTimeout(() => offerInstall(), 600); }} />}
    {a2hs && !shareInfo && !onboarding && inviteFrom === null && !loginPop && !sleepPick && <InstallSheet ios={a2hs === 'ios'} onInstall={doInstall} onClose={closeA2hs} />}

    {sleepPick && <Sheet onClose={() => setSleepPick(null)}>{dismiss => <>
        <div className="sheet-step"><div className="sheet-icon">😴</div><h2>איפה אתה ישן?</h2>
          {sleepPick.status === 'locating' && <p>מאתר את המיקום שלך ומחפש מה קרוב…</p>}
          {sleepPick.status === 'error' && <p>{sleepPick.msg}</p>}
          {sleepPick.status === 'ready' && <p>בחר את המקום, תכתוב מחיר, וזהו. 10 שניות.</p>}
        </div>
        {sleepPick.status === 'locating' && <ul className="places">{[0, 1, 2].map(i => <li key={i} className="card skeleton row-skel" />)}</ul>}
        {sleepPick.status === 'ready' && <ul className="sleep-list">{sleepPick.places.map((p, i) => <li key={p.id}>
          <button className={`sleep-opt ${i === 0 ? 'first' : ''}`} onClick={() => { setSleepPick(null); setOpen(null); setReporting(p); }}>
            <span className="sleep-kind">{KIND_ICON[p.kind] ?? '🏠'}</span>
            <span className="place-body"><span className="name" dir="auto">{p.name}</span><span className="muted small">{kindLabel(p.kind)} · {dist(p.distance)}</span></span>
            {i === 0 && <span className="badge known">הכי קרוב</span>}
          </button></li>)}</ul>}
        {sleepPick.status !== 'locating' && <button className="btn block" onClick={() => { setSleepPick(null); setOpen(null); setReporting('manual'); }}>המקום שלי לא ברשימה</button>}
        <button className="btn ghost block" onClick={dismiss}>ביטול</button>
      </>}</Sheet>}

    {inviteFrom !== null && <Sheet onClose={() => { setInviteFrom(null); locate(true); }} className="invite-sheet">{dismiss => <>
        <div className="invite-hero"><div className="invite-ticket" aria-hidden="true">🎟️</div>
          <p className="invite-kicker">הזמנה אישית</p>
          <h2>{inviteFrom ? <><bdi>{inviteFrom}</bdi> הזמין אותך</> : 'חבר הזמין אותך'}</h2>
          <p className="muted">למחיר ללילה: כמה ישראלים באמת שילמו על לינה</p></div>
        <ul className="invite-points">
          <li><span>🏡</span><p><b>מחירים אמיתיים ממטיילים</b>מלונות, הוסטלים, גסטהאוסים ולודג׳ים, לפי מקום וחודש. ככה יודעים על מה להתמקח.</p></li>
          <li><span>🤝</span><p><b>נותנים ומקבלים</b>מדווחים בעשר שניות כמה שילמתם, ובתמורה רואים את המחירים באזור.</p></li>
          <li><span>🗺️</span><p><b>על המפה, סביבך</b>מוצאים מה קרוב, גם בקליטה חלשה.</p></li>
        </ul>
        <LoginNote onMore={() => setPrivacy(true)} />
        <a className="btn primary block" href="/api/auth/google">הצטרף עם Google</a>
        <button className="btn ghost block" onClick={dismiss}>קודם אסתכל</button>
      </>}</Sheet>}

    {onboarding && <Sheet onClose={finishOnboarding}>{dismiss => <>
        {[
          { i: '👋', t: 'ברוך הבא', b: 'כאן מטיילים ישראלים משתפים כמה באמת שילמו ללילה, בכל מדינה: מלונות, הוסטלים, גסטהאוסים ולודג׳ים. ככה יודעים על מה להתמקח.' },
          { i: '🗺️', t: 'איך זה עובד', b: 'האפליקציה מוצאת את מקומות הלינה סביבך על המפה. 3 מקומות ראשונים פתוחים לצפייה, אפילו בלי להתחבר.' },
          { i: '🤝', t: 'נותנים ומקבלים', b: 'אחר כך מתחברים, וכל דיווח על מחיר ששילמת פותח 5 חיפושים עם מחירים. 👍 על דיווח (שילמתי אותו דבר) נחשב כמו דיווח. 👎 (שילמתי יותר)? ספר כמה, וזה ייחשב.' },
        ].map((s, i) => i === step && <div key={i} className="sheet-step"><div className="sheet-icon">{s.i}</div><h2>{s.t}</h2><p>{s.b}</p></div>)}
        <div className="dots">{[0, 1, 2].map(i => <span key={i} className={i === step ? 'on' : ''} />)}</div>
        {step < 2 ? <button className="btn primary block" onClick={() => setStep(step + 1)}>הבא</button>
          : <button className="btn primary block" onClick={finishOnboarding}>📍 מצא מחירים לידי</button>}
        <button className="btn ghost block" onClick={dismiss}>דלג</button>
        {step === 2 && <p className="muted small center">נבקש גישה למיקום כדי להראות מה קרוב אליך. המיקום לא נשמר.</p>}
      </>}</Sheet>}

    {privacy && <Sheet onClose={() => setPrivacy(false)} className="privacy-sheet">{dismiss => <>
        <h2>מה אנחנו שומרים</h2>
        <ul className="privacy-list">{PRIVACY_ITEMS.map(([i, t, b]) => <li key={t}><span aria-hidden="true">{i}</span><p><b>{t}</b>{b}</p></li>)}</ul>
        <p className="muted small">כתובות IP לא נשמרות, ושום דבר לא נמכר.</p>
        <p className="muted small">לא מאמינים? בדקו את <a href="https://github.com/YuvalHir/israeli-stay-prices" target="_blank" rel="noopener" className="linkish">הקוד</a> שלנו</p>
        <button className="btn primary block" onClick={dismiss}>הבנתי</button>
      </>}</Sheet>}

    {showLanding ? <div className="landing">
      <div className="hero hero-photo">
        <Header light />
        <div className="hero-text">
          <span className="pill">🌍 למטיילים ישראלים · בכל העולם</span>
          <h1>כמה ישראלים<br />שילמו ללילה?</h1>
          <p className="slogan-line">{SLOGAN} 😉</p>
          <p>מחירים אמיתיים ממטיילים כמוך, לפי המקום שבו אתה נמצא. תדע מה סביר לפני שאתה מתמקח.</p>
          <button className="btn primary big block" onClick={() => locate()}>{status === 'locating' ? 'מאתר את המיקום שלך…' : '📍 מצא מחירים לידי'}</button>
          <button className="btn glass big block" onClick={() => setPicker(!picker)}>🔎 בחר אזור</button>
          <button className="btn sleep big block" onClick={sleepHere}>😴 אני ישן כאן עכשיו · דיווח ב-10 שניות</button>
          {message && <p className="hero-msg">{message}</p>}
        </div>
      </div>
      <main className="wrap">
        {bootOn && <><div id="boot" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: BOOT_HTML }} /><script dangerouslySetInnerHTML={{ __html: BOOT_JS }} /></>}
        {(picker || status === 'error') && <section className="card"><h2>לאן?</h2>{Picker}</section>}
        <h2 className="section-title">איך זה עובד</h2>
        <section className="steps">
          {[
            ['🗺️', 'מוצאים לינה לידך', 'המלונות, ההוסטלים והגסטהאוסים באזור, על מפה, בכל מדינה.'],
            ['💸', 'רואים מה אחרים שילמו', 'מחיר ללילה במטבע המקומי, חדר פרטי או דורם, ומתי. 3 מקומות ראשונים חינם.'],
            ['🤝', 'מדווחים ופותחים חיפושים', 'כל דיווח (או 👍) פותח 5 חיפושים עם מחירים. אנונימי, בלי שם ובלי מייל.'],
          ].map(([i, t, b], n) => <div key={n} className="step reveal" style={{ ['--i' as any]: n }}><div className="step-icon">{i}</div><div><h3>{t}</h3><p>{b}</p></div></div>)}
        </section>
        <section className="card why reveal">
          <h3>למה זה עובד?</h3>
          <p><b>{SLOGAN}.</b> כל ישראלי שמדווח חוסך לבא אחריו כסף ומיקוח. ככל שיותר מדווחים ומדרגים 👍👎, המחירים מדויקים יותר.</p>
        </section>
        <section className="card oss reveal">
          <GitHubIcon />
          <div><h3>פרויקט קוד פתוח</h3><p>הקוד פתוח לכולם. מצאת באג או יש לך רעיון? <a href={GITHUB_URL} target="_blank" rel="noopener">בוא לתרום ב-GitHub</a>.</p></div>
        </section>
        <button className="btn ghost block" onClick={() => { setStep(0); setOnboarding(true); }}>איך זה עובד? הצג שוב את ההסבר</button>
        {Footer}
      </main>
    </div>

    : <>
      <Header />
      <main className="wrap app">
        {reporting ? <ReportForm place={reporting === 'manual' ? null : reporting} area={area?.name ?? ''} country={reportCountry} onDone={afterReport} onCancel={() => setReporting(null)} />

        : open ? <section className="detail">
            <div className="detail-top">
              <button className="back" onClick={closePlace}>→ חזרה לרשימה</button>
              <button className="chip share-btn" onClick={() => sharePlace(open)} aria-label="שתף את המקום"><ShareGlyph /> שתף</button>
            </div>
            <Thumb place={open} size="lg" photo={photos.places[open.id] ?? open.photo ?? photoFor(open)} />
            {(photos.places[open.id] ?? open.photo ?? photoFor(open)) && <PhotoCredit photo={(photos.places[open.id] ?? open.photo ?? photoFor(open))!} />}
            <h1 className="place-title" dir="auto">{open.name}</h1>
            {(open.locality || open.country) && <p className="muted place-where">{KIND_ICON[open.kind] ?? '🏠'} {kindLabel(open.kind)}{open.locality ? ` ב-${open.locality}` : ''}{open.country ? ` ${flagOf(open.country)}` : ''}{open.distance != null ? ` · ${dist(open.distance)}` : ''}{open.reports ? ` · ${open.reports === 1 ? 'דיווח מחיר 1' : `${open.reports} דיווחי מחיר`}` : ''}</p>}
            {Number.isFinite(open.lat) && <div className="maps">
              {[
                { name: 'Google Maps', domain: 'maps.google.com', href: `https://www.google.com/maps/dir/?api=1&destination=${open.lat},${open.lon}` },
                { name: 'Apple Maps', domain: 'maps.apple.com', href: `https://maps.apple.com/?daddr=${open.lat},${open.lon}&q=${encodeURIComponent(open.name)}` },
                { name: 'Mappy', domain: 'mappy.com', href: `https://fr.mappy.com/itineraire#/vers/${open.lat},${open.lon}/` },
              ].map((m) => (
                <a key={m.name} className="map-icon" href={m.href} target="_blank" rel="noopener" aria-label={`ניווט ב-${m.name}`} title={`ניווט ב-${m.name}`}>
                  {/* Official app icons are loaded from the services' own favicons, not bundled in this MIT repo. */}
                  <img src={`https://www.google.com/s2/favicons?domain=${m.domain}&sz=128`} alt={m.name} width={44} height={44} loading="lazy" referrerPolicy="no-referrer" />
                </a>
              ))}
            </div>}
            {!(open.locality || open.country) && <p className="muted place-where">{KIND_ICON[open.kind] ?? '🏠'} {kindLabel(open.kind)}{open.distance != null ? ` · ${dist(open.distance)} ממך` : ''}{(open.country ?? area?.country) ? ` ${flagOf(open.country ?? area?.country)}` : ''}</p>}

            {openState.loading ? <div className="detail-skel"><div className="skeleton sk-price" /><div className="skeleton sk-row" /><div className="skeleton sk-row" /></div>
            : openState.needLogin ? <div className="card cta">
                <h3>🔒 נגמרו 3 הצפיות החינמיות</h3>
                <p>{canJoin ? 'התחבר עם Google, ואז כל דיווח מחיר (או 👍 על דיווח) פותח לך 5 חיפושים עם מחירים.' : 'האתר בהזמנה בלבד. עם קישור אישי מחבר מצטרפים, וכל דיווח מחיר (או 👍 על דיווח) פותח 5 חיפושים עם מחירים.'}</p>
                <button className="btn primary block" onClick={() => { setLoginWhy('views'); setLoginPop(true); }}>{canJoin ? 'התחבר עם Google' : 'איך מצטרפים?'}</button>
              </div>
            : openState.locked ? <div className="card cta warn">
                <h3>🔒 המחירים נעולים</h3>
                <p>{(me?.searchesLeft ?? 0) > 0 ? 'המקום הזה מחוץ לאזור החיפוש הנוכחי. חפש את האזור שלו כדי לראות מחירים.' : 'כל דיווח על מחיר ששילמת פותח 5 חיפושים עם מחירים (חיפושים, לא מקומות). זה לוקח חצי דקה.'}</p>
                <button className="btn primary block" onClick={() => setReporting(open)}>שילמתי כאן, אדווח</button>
                <button className="btn block" onClick={() => setReporting('manual')}>דווח על מקום אחר</button>
              </div>
            : !rs.length ? <div className="card cta">
                <h3>עדיין אין דיווחים</h3>
                <p>היית כאן? הדיווח שלך יעזור לבא אחריך.</p>
                <button className="btn primary block" onClick={() => loggedIn ? setReporting(open) : (setLoginWhy('report'), setLoginPop(true))}>שילמתי כאן, אדווח</button>
              </div>
            : <>
                {summary && <div className="card price-card">
                  <span className="muted small">חציון ללילה</span>
                  <div className="big-price"><PriceTag amount={summary.med} cur={summary.cur} roll /></div>
                  <div className="muted small">{summary.cur !== dispCur ? 'אין שער המרה כרגע · ' : ''}{summary.n === 1 ? 'דיווח אחד' : `${summary.n} דיווחים`}{summary.n > 1 ? ` · טווח ${money(summary.min, summary.cur)} – ${money(summary.max, summary.cur)}` : ''}</div>
                </div>}
                <ul className="reports">{rs.map(r => { const c = conv(r.price, r.currency); const same = r.currency === dispCur || c == null; return <li key={r.id} className="card report">
                  <div className="report-top">
                    <b className="report-price">{same ? <PriceTag amount={r.price} cur={r.currency} /> : <PriceTag amount={c!} cur={dispCur} approx />} <span className="muted small">ללילה</span></b>
                    <span className="muted small">{monthLabel(r.stay_month)}</span>
                  </div>
                  <div className="muted small">{ROOM_HE[r.room]}{r.nights > 1 ? ` · ${r.nights} לילות` : ''}{!same ? ` · שולם ${money(r.price, r.currency)}` : ''}</div>
                  {r.note && <p className="report-note">{r.note}</p>}
                  <div className="votes">
                    {r.mine_report ? <span className="muted small">הדיווח שלך · 👍 {r.up ?? 0} · 👎 {r.down ?? 0}</span> : <>
                      <button className={`vote ${r.my_vote === 1 ? 'on up' : ''}`} onClick={() => vote(r, 1)}>👍 שילמתי אותו דבר <b>{r.up ?? 0}</b></button>
                      <button className={`vote ${r.my_vote === -1 ? 'on down' : ''}`} onClick={() => vote(r, -1)}>👎 שילמתי יותר <b>{r.down ?? 0}</b></button>
                    </>}
                  </div>
                </li>; })}</ul>
                <div className="card cta slogan"><h3>{SLOGAN} 😉</h3><p>שילמת כאן? הדיווח שלך עוזר לבא אחריך.</p>
                <button className="btn primary block" onClick={() => loggedIn ? setReporting(open) : (setLoginWhy('report'), setLoginPop(true))}>שילמתי כאן, אדווח</button></div>
              </>}
            <GoogleMapCard name={open.name} lat={open.lat} lon={open.lon} locality={open.locality} />
          </section>

        : <>
            <div className="area-head">
              <div>
                <p className="muted small">{area?.name === 'המיקום שלך' ? 'מקומות לינה לידך' : 'מקומות לינה'}</p>
                <h1 className="area-title">{area?.country && <span className="flag">{flagOf(area.country)}</span>}<bdi>{area?.label ?? (area?.name === 'המיקום שלך' ? 'לידך' : area?.name === 'האזור ששותף' ? 'האזור' : area?.name)}</bdi></h1>
              </div>
              <div className="row">
                <button className="icon-btn" onClick={() => locate()} aria-label="המיקום שלי">📍</button>
                <button className="icon-btn" onClick={() => setPicker(!picker)} aria-label="שנה אזור">🔎</button>
              </div>
            </div>
            {gate ? <div className={`gate ${gate.ok ? 'ok' : ''} ${'wait' in gate ? 'wait' : ''}`}>{'wait' in gate ? '' : gate.ok ? '🔓 ' : '🎟️ '}{gate.t}</div> : <div className="gate gate-slot" aria-hidden="true">&nbsp;</div>}
            <button className="btn sleep block" onClick={sleepHere}>😴 אני ישן כאן עכשיו · דיווח ב-10 שניות</button>
            {picker && <div className="card">{Picker}</div>}
            {area && <StayMap center={area} places={places} counts={counts} me={myPos} onSelect={openPlace} />}
            {message && <p className="muted">{message}</p>}
            {status === 'loading' && <ul className="places">{[0, 1, 2, 3].map(i => <li key={i} className="card skeleton row-skel" />)}</ul>}
            {status === 'ready' && places.length > 0 && <>
              <div className="seg filter">
                <button className={!onlyKnown ? 'on' : ''} onClick={() => setOnlyKnown(false)}>הכל ({places.length})</button>
                <button className={onlyKnown ? 'on' : ''} onClick={() => setOnlyKnown(true)}>עם מחירים ({knownCount})</button>
              </div>
              {onlyKnown && !knownCount && <p className="muted center">עוד אין מחירים באזור. תהיה הראשון לדווח!</p>}
              <ul className="places">{shown.map((p, i) => { const n = counts[p.id] ?? 0; return <li key={p.id} style={{ ['--i' as any]: Math.min(i, 12) }}><button className="card place" onClick={() => openPlace(p)}>
                <Thumb place={p} photo={photoFor(p)} />
                <span className="place-body"><span className="name" dir="auto">{p.name}</span><span className="muted small">{kindLabel(p.kind)} · {dist(p.distance)}</span></span>
                {n && listMedian(p.id) ? <span className="badge known price"><b>{listMedian(p.id)}</b><small>{n === 1 ? 'דיווח 1' : `חציון · ${n}`}</small></span>
                  : n && (pricesLoading || !me) ? <span className="badge price-wait" aria-label="טוען מחיר"><i /></span>
                  : n ? <span className="badge locked price"><b>🔒 ₪••</b><small>{n === 1 ? 'דיווח 1' : `${n} דיווחים`}</small></span>
                  : <span className="badge empty">עוד אין מחיר</span>}
              </button></li>; })}</ul>
            </>}
            {status === 'ready' && (photos.area.length > 0 || Object.keys(photos.places).length > 0) && <p className="photo-credit center">📷 תמונות חופשיות מ-Wikimedia Commons. תמונה עם תגית ״אזור״ היא של הסביבה, לא של המקום. קרדיט מלא בדף המקום.</p>}
            <div className="card cta">
              <h3>לא מופיע ברשימה?</h3>
              <button className="btn block" onClick={() => loggedIn ? setReporting('manual') : (setLoginWhy('report'), setLoginPop(true))}>דווח מחיר ידנית</button>
            </div>
          </>}
        {Footer}
      </main>
    </>}
  </>;
}

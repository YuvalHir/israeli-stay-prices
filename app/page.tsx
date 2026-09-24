'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { countryAt, findArea, kindLabel, nearbyStays, QUICK_AREAS, suggestPlaces, type Area, type Place, type Suggestion } from '@/lib/places';
import { currencyFor, currencyName, flagOf, FLAG_BY_CURRENCY, formatMoney } from '@/lib/currency';
import { drawShareCard, shareText, type ShareInfo } from '@/lib/shareCard';

const GITHUB_URL = 'https://github.com/YuvalHir/israeli-stay-prices';
const SLOGAN = 'התמקחת? ספר לחבריך';
type Disp = 'local' | 'USD' | 'ILS';

type Me = { user: { name: string | null; email: string } | null; isAdmin?: boolean; reports?: number; likes?: number; searchesLeft?: number; anonLeft?: number; unlimited?: boolean };
type Report = {
  id: string; place_name: string; price: number; currency: string; country?: string | null; room: 'dorm' | 'private'; nights: number;
  stay_month: string; note: string | null; up?: number; down?: number; my_vote?: number | null; mine_report?: number;
};

const StayMap = dynamic(() => import('@/components/StayMap'), { ssr: false, loading: () => <div className="map map-loading">טוען מפה…</div> });

const ROOM_HE = { dorm: 'מיטה בדורם', private: 'חדר פרטי' } as const;
const KIND_ICON: Record<string, string> = { hotel: '🏨', guest_house: '🏡', hostel: '🛏️', alpine_hut: '🏔️', motel: '🛣️' };
const curFlag = (c: string, country?: string | null) => country && currencyFor(country) === c ? flagOf(country) : (FLAG_BY_CURRENCY[c] ?? '💱');
const money = (price: number, c: string) => formatMoney(price, c);
const dist = (d?: number) => d == null ? '' : d < 1 ? `${Math.round(d * 1000)} מ׳` : `${d.toFixed(1)} ק״מ`;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const monthLabel = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }); };
const lastMonths = () => Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

function GitHubIcon() {
  return <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>;
}

function Thumb({ place, size = 'sm' }: { place: Pick<Place, 'kind'>; size?: 'sm' | 'lg' }) {
  return <div className={`thumb ${size} ph ph-${place.kind}`} aria-hidden="true"><span>{KIND_ICON[place.kind] ?? '🏠'}</span></div>;
}

function ReportForm({ place, area, country, onDone, onCancel }: { place: Place | null; area: string; country: string | null; onDone: (msg: string, share?: ShareInfo) => void; onCancel: () => void }) {
  const local = currencyFor(country);
  const options = Array.from(new Set([local, 'USD', 'ILS']));
  const [name, setName] = useState(place?.name ?? '');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<string>(local);
  const [room, setRoom] = useState<Report['room']>('private');
  const [nights, setNights] = useState(1);
  const [month, setMonth] = useState(lastMonths()[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const p = Number(price.replace(/[^\d.]/g, ''));
    if (!name.trim()) return setError('חסר שם המקום.');
    if (!(p > 0)) return setError('חסר מחיר ללילה.');
    setBusy(true); setError('');
    const res = await fetch('/api/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId: place?.id, placeName: name, placeKind: place?.kind, lat: place?.lat, lon: place?.lon, area, country, price: p, currency, room, nights, stayMonth: month, note }),
    });
    if (!res.ok) { setBusy(false); return setError(res.status === 401 ? 'צריך להתחבר קודם.' : 'השמירה לא הצליחה. נסה שוב.'); }
    setBusy(false); onDone('תודה! המחיר נשמר, וקיבלת 5 חיפושים עם מחירים.', { placeName: name.trim(), price: p, currency, country, room, nights, month, lat: place?.lat, lon: place?.lon });
  };
  return <section className="card form">
    <div className="form-head"><button className="icon-btn" onClick={onCancel} aria-label="חזרה">→</button><div><h2>כמה שילמת ללילה?</h2><p className="muted small form-sub">{SLOGAN} 😉</p></div></div>
    {place ? <p className="muted">{KIND_ICON[place.kind] ?? '🏠'} {place.name} · {kindLabel(place.kind)}</p> :
      <label className="field"><span>שם המקום</span><input value={name} onChange={e => setName(e.target.value)} placeholder="למשל Hotel Yog" /></label>}
    <label className="field"><span>מחיר ללילה</span>
      <div className="price-input"><input inputMode="decimal" autoFocus={!!place} value={price} onChange={e => setPrice(e.target.value)} placeholder="0" /><b>{curFlag(currency, country)} {currency}</b></div>
    </label>
    <div className="field"><span>מטבע</span>
      <div className="seg">{options.map(c => <button key={c} className={currency === c ? 'on' : ''} onClick={() => setCurrency(c)}>{curFlag(c, country)} {currencyName(c)}</button>)}</div></div>
    <div className="field"><span>סוג לינה</span>
      <div className="seg">{(['private', 'dorm'] as const).map(r => <button key={r} className={room === r ? 'on' : ''} onClick={() => setRoom(r)}>{ROOM_HE[r]}</button>)}</div></div>
    <div className="two">
      <div className="field"><span>כמה לילות</span>
        <div className="stepper"><button onClick={() => setNights(Math.max(1, nights - 1))} aria-label="פחות">−</button><b>{nights}</b><button onClick={() => setNights(Math.min(60, nights + 1))} aria-label="יותר">+</button></div></div>
      <label className="field"><span>מתי</span>
        <select value={month} onChange={e => setMonth(e.target.value)}>{lastMonths().map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
    </div>
    <label className="field"><span>הערה (לא חובה)</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="למשל: כולל ארוחת בוקר, התמקחתי מ-2000" /></label>
    {error && <div className="note warn">{error}</div>}
    <button className="btn primary block" disabled={busy} onClick={submit}>{busy ? 'שומר…' : 'שמור מחיר'}</button>
    <p className="muted small center">הדיווח מוצג בלי שם ובלי מייל.</p>
  </section>;
}


function ShareSheet({ info, onClose }: { info: ShareInfo; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    let u = '';
    drawShareCard(info).then(b => { setBlob(b); u = URL.createObjectURL(b); setUrl(u); }).catch(() => {});
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [info]);
  const text = shareText(info);
  const file = blob ? new File([blob], 'mechir-lalayla.png', { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });
  const share = async () => {
    if (canShareFile && file) { try { await navigator.share({ files: [file], text }); return; } catch (e: any) { if (e?.name === 'AbortError') return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  return <div className="sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
    <div className="sheet share-sheet" onClick={e => e.stopPropagation()}>
      <h2>ספר לחבריך 😉</h2>
      <p>שלח לקבוצת הטיול. ככה עוד חברים יידעו כמה לשלם, ויוסיפו מחירים משלהם.</p>
      <div className="share-preview">{url ? <img src={url} alt="כרטיס שיתוף עם המחיר ששילמת" /> : <div className="skeleton share-skel" />}</div>
      <button className="btn wa block big" onClick={share} disabled={!blob}><WhatsAppIcon /> שתף בוואטסאפ</button>
      {!canShareFile && url && <a className="btn block" href={url} download="mechir-lalayla.png">⬇️ שמור את התמונה</a>}
      <button className="btn ghost block" onClick={onClose}>אחר כך</button>
    </div>
  </div>;
}

function WhatsAppIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>;
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [myPos, setMyPos] = useState<{ lat: number; lon: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [searchId, setSearchIdState] = useState<string | null>(null);
  const searchRef = useRef<string | null>(null);
  const setSearchId = (v: string | null) => { searchRef.current = v; setSearchIdState(v); };
  const [loginPop, setLoginPop] = useState(false);
  const areaRef = useRef<Area | null>(null);
  const [listPrices, setListPrices] = useState<Record<string, [number, string][]>>({});
  const [status, setStatus] = useState<'idle' | 'locating' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Place | null>(null);
  const [openState, setOpenState] = useState<{ loading: boolean; locked?: boolean; needLogin?: boolean; reports?: Report[] }>({ loading: false });
  const [reporting, setReporting] = useState<Place | 'manual' | null>(null);
  const [toast, setToast] = useState('');
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [step, setStep] = useState(0);
  const [picker, setPicker] = useState(false);
  const [onlyKnown, setOnlyKnown] = useState(false);
  const [ipCountry, setIpCountry] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [disp, setDisp] = useState<Disp>('local');
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [sugOpen, setSugOpen] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [loginWhy, setLoginWhy] = useState<'views' | 'report'>('views');
  const [sleepPick, setSleepPick] = useState<{ status: 'locating' | 'ready' | 'error'; places: Place[]; msg?: string } | null>(null);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSugs([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => { suggestPlaces(q, area ?? myPos, ctl.signal).then(r => { if (!ctl.signal.aborted) setSugs(r); }); }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [search]);
  const pickSug = (sg: Suggestion) => { setSugOpen(false); setSearch(''); setSugs([]); loadArea({ name: sg.name, lat: sg.lat, lon: sg.lon, country: sg.country }); };

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(t => t === m ? '' : t), 4500); };
  const refreshMe = () => fetch('/api/auth/me').then(r => r.json()).then((m: Me) => { setMe(m); return m; }).catch(() => { const m = { user: null }; setMe(m); return m as Me; });
  const loadListPrices = (list: Place[], sid: string | null) => {
    if (!list.length) return;
    fetch(`/api/reports?placeIds=${encodeURIComponent(list.map(p => p.id).join(','))}${sid ? `&searchId=${sid}` : ''}`)
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

  const loadArea = async (a: Area) => {
    if (!a.country) countryAt(a.lat, a.lon).then(c => { if (c) setArea(cur => cur && cur.lat === a.lat && cur.lon === a.lon ? { ...cur, country: c } : cur); });
    setListPrices({}); setSearchId(null); areaRef.current = a; setArea(a); setOpen(null); setReporting(null); setStatus('loading'); setMessage(''); setPicker(false); setOnlyKnown(false);
    try {
      const [osm, reported] = await Promise.all([
        nearbyStays(a.lat, a.lon).catch(() => [] as Place[]),
        fetch(`/api/reports?lat=${a.lat}&lon=${a.lon}`).then(r => r.json()).then(j => (j.places ?? []) as (Place & { n: number })[]).catch(() => []),
      ]);
      const found = [...osm];
      for (const r of reported) if (!found.some(p => p.id === r.id)) {
        const d = Math.hypot((r.lat - a.lat) * 111, (r.lon - a.lon) * 111 * Math.cos(a.lat * Math.PI / 180));
        found.push({ id: r.id, name: r.name, kind: r.kind ?? 'guest_house', lat: r.lat, lon: r.lon, country: r.country ?? undefined, distance: d });
      }
      found.sort((x, y) => (x.distance ?? 0) - (y.distance ?? 0));
      setCounts(Object.fromEntries(reported.map(r => [r.id, r.n])));
      setPlaces(found); setStatus('ready');
      if (!found.length) { setMessage('לא נמצאו מקומות לינה במפה ברדיוס 2 ק״מ. אפשר לדווח ידנית.'); return; }
      const sid = await startSearch(a);
      loadListPrices(found, sid);
    } catch { setStatus('error'); setMessage('החיפוש במפה לא הצליח (אולי אין קליטה). נסה שוב או בחר אזור.'); }
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
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    const at = new URLSearchParams(location.search).get('at')?.split(',').map(Number);
    const lp = new URLSearchParams(location.search).get('login');
    if (lp === 'failed') say('ההתחברות עם Google לא הצליחה. נסה שוב.');
    if (lp) history.replaceState(null, '', '/');
    let seen = false; try { seen = localStorage.getItem('sp_onboarded') === '1'; } catch {}
    if (at && at.length === 2 && at.every(Number.isFinite)) { history.replaceState(null, '', '/'); if (!seen) { try { localStorage.setItem('sp_onboarded', '1'); } catch {} } loadArea({ name: 'האזור ששותף', lat: at[0], lon: at[1] }); }
    else if (!seen) setOnboarding(true); else locate(true);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  useEffect(() => { if (open || reporting) window.scrollTo({ top: 0 }); }, [open, reporting]);

  const finishOnboarding = () => { try { localStorage.setItem('sp_onboarded', '1'); } catch {} setOnboarding(false); locate(); };
  const doSearch = async () => {
    if (!search.trim()) return;
    setStatus('loading'); setMessage('');
    const a = await findArea(search.trim());
    if (a) loadArea(a); else { setStatus('idle'); setMessage('לא מצאתי את המקום. נסה שם אחר או באנגלית.'); }
  };
  const openPlace = async (p: Place) => {
    setOpen(p);
    setOpenState({ loading: true });
    const res = await fetch('/api/views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ placeId: p.id, placeName: p.name, lat: p.lat, lon: p.lon, searchId: searchRef.current }) });
    if (res.status === 401) { setOpenState({ loading: false, needLogin: true }); setLoginWhy('views'); setLoginPop(true); }
    else if (res.status === 402) setOpenState({ loading: false, locked: true });
    else if (res.ok) { const j = await res.json(); setOpenState({ loading: false, reports: j.reports }); if (j.anonLeft != null) setMe(x => x ? { ...x, anonLeft: j.anonLeft } : x); }
    else setOpenState({ loading: false, reports: [] });
  };
  const vote = async (r: Report, v: 1 | -1) => {
    const next = r.my_vote === v ? 0 : v;
    const res = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: r.id, vote: next }) });
    if (res.status === 401) { setLoginWhy('report'); return setLoginPop(true); }
    if (!res.ok) return say('הדירוג לא נשמר.');
    const j = await res.json();
    setOpenState(s => ({ ...s, reports: s.reports?.map(x => x.id === r.id ? { ...x, up: j.up, down: j.down, my_vote: next || null } : x) }));
    setMe(x => x ? { ...x, searchesLeft: j.searchesLeft, likes: j.likes } : x);
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
    <option value="local">{flagOf(viewCountry)} {localCur === 'USD' || localCur === 'ILS' ? localCur : `מקומי (${localCur})`}</option>
    <option value="USD">🇺🇸 דולר</option>
    <option value="ILS">🇮🇱 שקל</option>
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
  const gate = !me ? null : !loggedIn ? { t: `${me.anonLeft ?? 3} מתוך 3 צפיות חינם`, ok: (me.anonLeft ?? 3) > 0 }
    : me.unlimited ? { t: 'אדמין · חיפושים ללא הגבלה', ok: true }
    : searchId ? { t: `המחירים באזור פתוחים · נשארו ${me.searchesLeft ?? 0} חיפושים`, ok: true }
    : { t: 'דווח מחיר או תן 👍 כדי לפתוח 5 חיפושים', ok: false };

  const Header = ({ light = false }: { light?: boolean }) => <header className={`header ${light ? 'light' : ''}`}>
    <button className="brand" onClick={() => { setArea(null); setOpen(null); setReporting(null); setStatus('idle'); }}>
      <img src="/icons/icon-192.png" alt="" /><span>מחיר ללילה</span>
    </button>
    <nav>
      {installEvt && <button className="chip" onClick={() => { installEvt.prompt(); setInstallEvt(null); }}>התקן</button>}
      {DispSwitch}
      {me?.isAdmin && <a className="chip" href="/admin">אדמין</a>}
      {loggedIn ? <button className="avatar" onClick={logout} title={`התנתק (${me?.user?.email})`}>{(me?.user?.name ?? me?.user?.email ?? '?').trim()[0]}</button>
        : <a className="chip strong" href="/api/auth/google">התחברות</a>}
    </nav>
  </header>;

  const Picker = <div className="picker">
    <div className="searchrow">
      <div className="ac">
        <input value={search} onChange={e => { setSearch(e.target.value); setSugOpen(true); }} onFocus={() => setSugOpen(true)} onBlur={() => setTimeout(() => setSugOpen(false), 150)}
          onKeyDown={e => { if (e.key === 'Enter') { if (sugs[0]) pickSug(sugs[0]); else doSearch(); } }} placeholder="חפש עיר, כפר או שכונה בעולם" aria-label="חיפוש אזור" autoComplete="off" role="combobox" aria-expanded={sugOpen && sugs.length > 0} />
        {sugOpen && sugs.length > 0 && <ul className="ac-list" role="listbox">{sugs.map((sg, i) => <li key={i} role="option" aria-selected={false}>
          <button onMouseDown={e => e.preventDefault()} onClick={() => pickSug(sg)}><span className="ac-flag">{flagOf(sg.country)}</span><span><b>{sg.name}</b>{sg.sub && <small>{sg.sub}</small>}</span></button>
        </li>)}</ul>}
      </div>
      <button className="btn primary" onClick={() => sugs[0] ? pickSug(sugs[0]) : doSearch()}>חפש</button>
    </div>
    <div className="chips">{QUICK_AREAS.map(a => <button key={a.name} className="chip" onClick={() => loadArea(a)}>{flagOf(a.country)} {a.name}</button>)}</div>
  </div>;

  const Footer = <footer className="footer">
    <a className="gh" href={GITHUB_URL} target="_blank" rel="noopener"><GitHubIcon /> קוד פתוח ב-GitHub. רוצה לעזור? מוזמן לתרום</a>
    <p>מפה ומקומות: <bdi><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a></bdi></p>
    <p>שערי מטבע (יומי, להמחשה): <bdi><a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">Rates By Exchange Rate API</a></bdi></p>
    <p>אמוג׳י בכרטיס השיתוף: <bdi><a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener">Twemoji</a></bdi>, CC-BY 4.0</p>
    <p>המיקום משמש רק לחיפוש ולא נשמר. המחירים מוצגים בלי שם או מייל של המדווח.</p>
  </footer>;

  return <>
    {toast && <div className="toast" role="status">{toast}</div>}

    {loginPop && <div className="sheet-backdrop" role="dialog" aria-modal="true" onClick={() => setLoginPop(false)}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-step"><div className="sheet-icon">🔑</div><h2>{loginWhy === 'report' ? 'רק להתחבר, וממשיכים' : 'נגמרו 3 הצפיות החינמיות'}</h2>
        <p>{loginWhy === 'report' ? 'הדיווח אנונימי: לא מוצגים שם או מייל. ההתחברות רק מונעת דיווחים כפולים.' : 'התחבר כדי להמשיך.'} אחרי ההתחברות, כל דיווח על מחיר ששילמת, או 👍 על דיווח של מישהו אחר, פותח לך 5 חיפושים עם מחירים.</p></div>
        <a className="btn primary block" href="/api/auth/google">התחבר עם Google</a>
        <button className="btn ghost block" onClick={() => setLoginPop(false)}>אחר כך</button>
      </div>
    </div>}

    {shareInfo && <ShareSheet info={shareInfo} onClose={() => setShareInfo(null)} />}

    {sleepPick && <div className="sheet-backdrop" role="dialog" aria-modal="true" onClick={() => setSleepPick(null)}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-step"><div className="sheet-icon">😴</div><h2>איפה אתה ישן?</h2>
          {sleepPick.status === 'locating' && <p>מאתר את המיקום שלך ומחפש מה קרוב…</p>}
          {sleepPick.status === 'error' && <p>{sleepPick.msg}</p>}
          {sleepPick.status === 'ready' && <p>בחר את המקום, תכתוב מחיר, וזהו. 10 שניות.</p>}
        </div>
        {sleepPick.status === 'locating' && <ul className="places">{[0, 1, 2].map(i => <li key={i} className="card skeleton row-skel" />)}</ul>}
        {sleepPick.status === 'ready' && <ul className="sleep-list">{sleepPick.places.map((p, i) => <li key={p.id}>
          <button className={`sleep-opt ${i === 0 ? 'first' : ''}`} onClick={() => { setSleepPick(null); setOpen(null); setReporting(p); }}>
            <span className="sleep-kind">{KIND_ICON[p.kind] ?? '🏠'}</span>
            <span className="place-body"><span className="name">{p.name}</span><span className="muted small">{kindLabel(p.kind)} · {dist(p.distance)}</span></span>
            {i === 0 && <span className="badge known">הכי קרוב</span>}
          </button></li>)}</ul>}
        {sleepPick.status !== 'locating' && <button className="btn block" onClick={() => { setSleepPick(null); setOpen(null); setReporting('manual'); }}>המקום שלי לא ברשימה</button>}
        <button className="btn ghost block" onClick={() => setSleepPick(null)}>ביטול</button>
      </div>
    </div>}

    {onboarding && <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet">
        {[
          { i: '👋', t: 'ברוך הבא', b: 'כאן מטיילים ישראלים משתפים כמה באמת שילמו ללילה, בכל מדינה: מלונות, הוסטלים, גסטהאוסים ולודג׳ים. ככה יודעים על מה להתמקח.' },
          { i: '🗺️', t: 'איך זה עובד', b: 'האפליקציה מוצאת את מקומות הלינה סביבך על המפה. 3 מקומות ראשונים פתוחים לצפייה, אפילו בלי להתחבר.' },
          { i: '🤝', t: 'נותנים ומקבלים', b: 'אחר כך מתחברים, וכל דיווח על מחיר ששילמת פותח 5 חיפושים עם מחירים. 👍 על דיווח (שילמתי אותו דבר) נחשב כמו דיווח. 👎 (שילמתי יותר)? ספר כמה, וזה ייחשב.' },
        ].map((s, i) => i === step && <div key={i} className="sheet-step"><div className="sheet-icon">{s.i}</div><h2>{s.t}</h2><p>{s.b}</p></div>)}
        <div className="dots">{[0, 1, 2].map(i => <span key={i} className={i === step ? 'on' : ''} />)}</div>
        {step < 2 ? <button className="btn primary block" onClick={() => setStep(step + 1)}>הבא</button>
          : <button className="btn primary block" onClick={finishOnboarding}>📍 מצא מחירים לידי</button>}
        <button className="btn ghost block" onClick={finishOnboarding}>דלג</button>
        {step === 2 && <p className="muted small center">נבקש גישה למיקום כדי להראות מה קרוב אליך. המיקום לא נשמר.</p>}
      </div>
    </div>}

    {showLanding ? <div className="landing">
      <div className="hero" style={{ backgroundImage: 'linear-gradient(180deg, rgba(14,12,10,.35) 0%, rgba(14,12,10,.05) 30%, rgba(14,12,10,.85) 100%), url(/teahouse.jpg)' }}>
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
        {(picker || status === 'error') && <section className="card"><h2>לאן?</h2>{Picker}</section>}
        <h2 className="section-title">איך זה עובד</h2>
        <section className="steps">
          {[
            ['🗺️', 'מוצאים לינה לידך', 'המלונות, ההוסטלים והגסטהאוסים באזור, על מפה, בכל מדינה.'],
            ['💸', 'רואים מה אחרים שילמו', 'מחיר ללילה במטבע המקומי, חדר פרטי או דורם, ומתי. 3 מקומות ראשונים חינם.'],
            ['🤝', 'מדווחים ופותחים חיפושים', 'כל דיווח (או 👍) פותח 5 חיפושים עם מחירים. אנונימי, בלי שם ובלי מייל.'],
          ].map(([i, t, b], n) => <div key={n} className="step"><div className="step-icon">{i}</div><div><h3>{t}</h3><p>{b}</p></div></div>)}
        </section>
        <section className="card why">
          <h3>למה זה עובד?</h3>
          <p><b>{SLOGAN}.</b> כל ישראלי שמדווח חוסך לבא אחריו כסף ומיקוח. ככל שיותר מדווחים ומדרגים 👍👎, המחירים מדויקים יותר.</p>
        </section>
        <section className="card oss">
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
            <button className="back" onClick={() => setOpen(null)}>→ חזרה לרשימה</button>
            <Thumb place={open} size="lg" />
            <h1 className="place-title">{open.name}</h1>
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
            <div className="chips static">
              <span className="chip">{KIND_ICON[open.kind] ?? '🏠'} {kindLabel(open.kind)}</span>
              {open.distance != null && <span className="chip">📍 {dist(open.distance)}</span>}
              {(open.country ?? area?.country) && <span className="chip">{flagOf(open.country ?? area?.country)}</span>}
            </div>

            {openState.loading ? <div className="card skeleton" />
            : openState.needLogin ? <div className="card cta">
                <h3>🔒 נגמרו 3 הצפיות החינמיות</h3>
                <p>התחבר עם Google, ואז כל דיווח מחיר (או 👍 על דיווח) פותח לך 5 חיפושים עם מחירים.</p>
                <a className="btn primary block" href="/api/auth/google">התחבר עם Google</a>
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
                  <div className="big-price">{curFlag(summary.cur, viewCountry)} {money(summary.med, summary.cur)}</div>
                  <div className="muted small">{summary.cur !== dispCur ? 'אין שער המרה כרגע · ' : ''}{summary.n === 1 ? 'דיווח אחד' : `${summary.n} דיווחים`}{summary.n > 1 ? ` · טווח ${money(summary.min, summary.cur)} – ${money(summary.max, summary.cur)}` : ''}</div>
                </div>}
                <ul className="reports">{rs.map(r => { const c = conv(r.price, r.currency); const same = r.currency === dispCur || c == null; return <li key={r.id} className="card report">
                  <div className="report-top">
                    <b>{same ? `${curFlag(r.currency, r.country)} ${money(r.price, r.currency)}` : `${curFlag(dispCur, viewCountry)} ≈${money(c!, dispCur)}`} <span className="muted small">ללילה</span></b>
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
          </section>

        : <>
            <div className="area-head">
              <div>
                <p className="muted small">מקומות לינה</p>
                <h1>{area?.country ? flagOf(area.country) + ' ' : ''}{area?.name === 'המיקום שלך' ? 'לידך' : area?.name}</h1>
              </div>
              <div className="row">
                <button className="icon-btn" onClick={() => locate()} aria-label="המיקום שלי">📍</button>
                <button className="icon-btn" onClick={() => setPicker(!picker)} aria-label="שנה אזור">🔎</button>
              </div>
            </div>
            {gate && <div className={`gate ${gate.ok ? 'ok' : ''}`}>{gate.ok ? '🔓' : '🎟️'} {gate.t}</div>}
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
              <ul className="places">{shown.map(p => { const n = counts[p.id] ?? 0; return <li key={p.id}><button className="card place" onClick={() => openPlace(p)}>
                <Thumb place={p} />
                <span className="place-body"><span className="name">{p.name}</span><span className="muted small">{kindLabel(p.kind)} · {dist(p.distance)}</span></span>
                {n && listMedian(p.id) ? <span className="badge known price"><b>{listMedian(p.id)}</b><small>{n === 1 ? 'דיווח 1' : `חציון · ${n}`}</small></span>
                  : n ? <span className="badge locked price"><b>🔒 ₪••</b><small>{n === 1 ? 'דיווח 1' : `${n} דיווחים`}</small></span>
                  : <span className="badge">אין דיווחים</span>}
              </button></li>; })}</ul>
            </>}
            <div className="card cta">
              <h3>לא מופיע ברשימה?</h3>
              <button className="btn block" onClick={() => loggedIn ? setReporting('manual') : (location.href = '/api/auth/google')}>דווח מחיר ידנית</button>
            </div>
          </>}
        {Footer}
      </main>
    </>}
  </>;
}

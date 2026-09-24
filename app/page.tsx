'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { countryAt, findArea, kindLabel, nearbyStays, QUICK_AREAS, suggestPlaces, type Area, type Place, type Suggestion } from '@/lib/places';
import { currencyFor, currencyName, flagOf, FLAG_BY_CURRENCY, formatMoney } from '@/lib/currency';

const GITHUB_URL = 'https://github.com/YuvalHir/israeli-stay-prices';
const SLOGAN = 'התמקחת? ספר לחבריך';
type Disp = 'local' | 'USD' | 'ILS';

type Me = { user: { name: string | null; email: string } | null; isAdmin?: boolean; reports?: number; unlocked?: boolean; viewsLeft?: number };
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

function ReportForm({ place, area, country, onDone, onCancel }: { place: Place | null; area: string; country: string | null; onDone: (msg: string) => void; onCancel: () => void }) {
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
    setBusy(false); onDone('תודה! המחיר נשמר ועכשיו כל המחירים פתוחים בשבילך.');
  };
  return <section className="card form">
    <div className="form-head"><button className="icon-btn" onClick={onCancel} aria-label="חזרה">→</button><div><h2>כמה שילמת ללילה?</h2><p className="muted small form-sub">{SLOGAN} 😉</p></div></div>
    {place ? <p className="muted">{KIND_ICON[place.kind] ?? '🏠'} {place.name} · {kindLabel(place.kind)}</p> :
      <label className="field"><span>שם המקום</span><input value={name} onChange={e => setName(e.target.value)} placeholder="למשל Hotel Yog" /></label>}
    <label className="field"><span>מחיר ללילה</span>
      <div className="price-input"><input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" /><b>{curFlag(currency, country)} {currency}</b></div>
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


export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [myPos, setMyPos] = useState<{ lat: number; lon: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [listPrices, setListPrices] = useState<Record<string, [number, string][]>>({});
  const [status, setStatus] = useState<'idle' | 'locating' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Place | null>(null);
  const [openState, setOpenState] = useState<{ loading: boolean; locked?: boolean; reports?: Report[] }>({ loading: false });
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

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSugs([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => { suggestPlaces(q, area ?? myPos, ctl.signal).then(r => { if (!ctl.signal.aborted) setSugs(r); }); }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [search]);
  const pickSug = (sg: Suggestion) => { setSugOpen(false); setSearch(''); setSugs([]); loadArea({ name: sg.name, lat: sg.lat, lon: sg.lon, country: sg.country }); };

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(t => t === m ? '' : t), 4500); };
  const refreshMe = () => fetch('/api/auth/me').then(r => r.json()).then(setMe).catch(() => setMe({ user: null }));

  const loadArea = async (a: Area) => {
    if (!a.country) countryAt(a.lat, a.lon).then(c => { if (c) setArea(cur => cur && cur.lat === a.lat && cur.lon === a.lon ? { ...cur, country: c } : cur); });
    setListPrices({}); setArea(a); setOpen(null); setReporting(null); setStatus('loading'); setMessage(''); setPicker(false); setOnlyKnown(false);
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
      const ids = encodeURIComponent(found.map(p => p.id).join(','));
      fetch(`/api/reports?placeIds=${ids}`).then(r => r.json()).then(j => { setCounts(j.counts ?? {}); setListPrices(j.prices ?? {}); }).catch(() => {});
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
    const lp = new URLSearchParams(location.search).get('login');
    if (lp === 'failed') say('ההתחברות עם Google לא הצליחה. נסה שוב.');
    if (lp) history.replaceState(null, '', '/');
    let seen = false; try { seen = localStorage.getItem('sp_onboarded') === '1'; } catch {}
    if (!seen) setOnboarding(true); else locate(true);
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
    if (!me?.user) { setOpenState({ loading: false }); return; }
    setOpenState({ loading: true });
    const res = await fetch('/api/views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ placeId: p.id, placeName: p.name }) });
    if (res.status === 402) setOpenState({ loading: false, locked: true });
    else if (res.ok) { const j = await res.json(); setOpenState({ loading: false, reports: j.reports }); refreshMe(); }
    else setOpenState({ loading: false, reports: [] });
  };
  const vote = async (r: Report, v: 1 | -1) => {
    const next = r.my_vote === v ? 0 : v;
    const res = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: r.id, vote: next }) });
    if (!res.ok) return say('הדירוג לא נשמר.');
    const j = await res.json();
    setOpenState(s => ({ ...s, reports: s.reports?.map(x => x.id === r.id ? { ...x, up: j.up, down: j.down, my_vote: next || null } : x) }));
  };
  const afterReport = async (msg: string) => {
    const p = reporting;
    setReporting(null); say(msg);
    await refreshMe();
    if (places.length) fetch(`/api/reports?placeIds=${encodeURIComponent(places.map(x => x.id).join(','))}`).then(r => r.json()).then(j => { setCounts(j.counts ?? {}); setListPrices(j.prices ?? {}); }).catch(() => {});
    if (p && p !== 'manual') openPlace(p);
    else if (open) openPlace(open);
  };
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); refreshMe(); };

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
  const gate = !loggedIn ? null : me?.unlocked ? { t: 'כל המחירים פתוחים', ok: true } : { t: `${me?.viewsLeft ?? 3} מתוך 3 צפיות חינם`, ok: false };

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
    <p>המיקום משמש רק לחיפוש ולא נשמר. המחירים מוצגים בלי שם או מייל של המדווח.</p>
  </footer>;

  return <>
    {toast && <div className="toast" role="status">{toast}</div>}

    {onboarding && <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet">
        {[
          { i: '👋', t: 'ברוך הבא', b: 'כאן מטיילים ישראלים משתפים כמה באמת שילמו ללילה, בכל מדינה: מלונות, הוסטלים, גסטהאוסים ולודג׳ים. ככה יודעים על מה להתמקח.' },
          { i: '🗺️', t: 'איך זה עובד', b: 'האפליקציה מוצאת את מקומות הלינה סביבך על המפה. 3 מקומות ראשונים פתוחים לצפייה אחרי התחברות עם Google.' },
          { i: '🤝', t: 'נותנים ומקבלים', b: 'אחרי 3 צפיות, מדווחים כמה שילמת על לילה אחד, במטבע המקומי, בדולר או בשקל, וכל המחירים נפתחים. אפשר גם לסמן 👍 אם שילמת אותו מחיר או 👎 אם שילמת יותר.' },
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
            ['🤝', 'מדווחים ופותחים הכל', 'דיווח אחד על מה ששילמת, אנונימי, וכל המחירים פתוחים בשבילך.'],
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
              <a className="map-btn" href={`https://www.google.com/maps/search/?api=1&query=${open.lat},${open.lon}`} target="_blank" rel="noopener"><b>Google Maps</b><small>פתח מיקום</small></a>
              <a className="map-btn" href={`https://maps.apple.com/?q=${encodeURIComponent(open.name)}&ll=${open.lat},${open.lon}`} target="_blank" rel="noopener"><b>Apple Maps</b><small>פתח מיקום</small></a>
              <a className="map-btn nav" href={`https://www.google.com/maps/dir/?api=1&destination=${open.lat},${open.lon}`} target="_blank" rel="noopener"><b>🧭 ניווט</b><small>Google Maps</small></a>
              <a className="map-btn nav" href={`https://maps.apple.com/?daddr=${open.lat},${open.lon}&q=${encodeURIComponent(open.name)}`} target="_blank" rel="noopener"><b>🧭 ניווט</b><small>Apple Maps</small></a>
            </div>}
            <div className="chips static">
              <span className="chip">{KIND_ICON[open.kind] ?? '🏠'} {kindLabel(open.kind)}</span>
              {open.distance != null && <span className="chip">📍 {dist(open.distance)}</span>}
              {(open.country ?? area?.country) && <span className="chip">{flagOf(open.country ?? area?.country)}</span>}
            </div>

            {!loggedIn ? <div className="card cta">
                <h3>🔒 המחירים פתוחים אחרי התחברות</h3>
                <p>3 מקומות ראשונים חינם, ואחרי שתדווח מחיר אחד הכל פתוח.</p>
                <a className="btn primary block" href="/api/auth/google">התחבר עם Google</a>
              </div>
            : openState.loading ? <div className="card skeleton" />
            : openState.locked ? <div className="card cta warn">
                <h3>נגמרו 3 הצפיות החינמיות</h3>
                <p>דווח כמה שילמת על לילה באחד המקומות שהיית בהם, וכל המחירים ייפתחו. זה לוקח חצי דקה.</p>
                <button className="btn primary block" onClick={() => setReporting(open)}>שילמתי כאן, אדווח</button>
                <button className="btn block" onClick={() => setReporting('manual')}>דווח על מקום אחר</button>
              </div>
            : !rs.length ? <div className="card cta">
                <h3>עדיין אין דיווחים</h3>
                <p>היית כאן? הדיווח שלך יעזור לבא אחריך.</p>
                <button className="btn primary block" onClick={() => setReporting(open)}>שילמתי כאן, אדווח</button>
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
                <button className="btn primary block" onClick={() => setReporting(open)}>שילמתי כאן, אדווח</button></div>
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
                {n && listMedian(p.id) ? <span className="badge known price"><b>{listMedian(p.id)}</b><small>{n === 1 ? 'דיווח 1' : `חציון · ${n}`}</small></span> : <span className="badge">אין דיווחים</span>}
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

'use client';
import { useEffect, useMemo, useState } from 'react';
import { flagOf, formatMoney } from '@/lib/currency';
import { placePath } from '@/lib/placeUrl';
import { EVENTS, type EventName } from '@/lib/events';

type U = { id: string; email: string; name: string | null; is_admin: number; banned: number; created_at: string; reports: number; reports24: number; views: number; votes: number; last_seen: string | null };
type R = { id: string; user_id: string; place_id: string; place_name: string; area: string | null; country: string | null; price: number; currency: string; room: string; nights: number; stay_month: string; note: string | null; created_at: string; hidden: number; email: string; banned: number; up: number; down: number };
type V = { report_id: string; user_id: string; vote: number; created_at: string; email: string; place_name: string; price: number; currency: string; author_id: string };
type Day = { day: string; reports: number; users: number; views: number; votes: number };
type Data = { me: string; meId: string; stats: Record<string, number>; users: U[]; reports: R[]; byCountry: { country: string; n: number }[]; daily: Day[]; votes: V[]; topPlaces: { place_id: string; name: string; country: string | null; n: number }[]; events?: { day: string; name: string; n: number }[] };
type Flag = { k: string; t: string };

const toDate = (s: string) => new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
const when = (s: string) => toDate(s).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
const ago = (s: string | null) => {
  if (!s) return 'אף פעם';
  const m = (Date.now() - toDate(s).getTime()) / 60000;
  if (m < 60) return `לפני ${Math.max(1, Math.round(m))} דק׳`;
  if (m < 1440) return `לפני ${Math.round(m / 60)} שע׳`;
  return `לפני ${Math.round(m / 1440)} ימים`;
};
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
const LINK = /(https?:\/\/|www\.|\.(com|net|org|io|ru)\b|t\.me|wa\.me)/i;

function reportFlags(reports: R[], users: U[]): Map<string, Flag[]> {
  const out = new Map<string, Flag[]>();
  const groups = new Map<string, number[]>();
  const wide = new Map<string, number[]>();
  const dup = new Map<string, number>();
  for (const r of reports) {
    const k = `${r.place_id}|${r.currency}|${r.room}`; groups.set(k, [...(groups.get(k) ?? []), r.price]);
    const w = `${r.country}|${r.currency}|${r.room}`; wide.set(w, [...(wide.get(w) ?? []), r.price]);
    const d = `${r.user_id}|${r.place_id}`; dup.set(d, (dup.get(d) ?? 0) + 1);
  }
  const burst = new Set(users.filter(u => u.reports24 >= 5).map(u => u.id));
  for (const r of reports) {
    const f: Flag[] = [];
    const g = groups.get(`${r.place_id}|${r.currency}|${r.room}`)!;
    const w = wide.get(`${r.country}|${r.currency}|${r.room}`)!;
    const [base, n, hi, lo] = g.length >= 3 ? [median(g), g.length, 2.5, 0.4] : [median(w), w.length, 4, 0.25];
    if (n >= 3 && r.price > base * hi) f.push({ k: 'hi', t: `יקר פי ${(r.price / base).toFixed(1)} מהחציון` });
    if (n >= 3 && r.price < base * lo) f.push({ k: 'lo', t: `זול פי ${(base / r.price).toFixed(1)} מהחציון` });
    if ((dup.get(`${r.user_id}|${r.place_id}`) ?? 0) > 1) f.push({ k: 'dup', t: 'דיווח כפול מאותו משתמש' });
    if (burst.has(r.user_id)) f.push({ k: 'burst', t: '5+ דיווחים ב-24 שעות' });
    if (r.note && LINK.test(r.note)) f.push({ k: 'link', t: 'קישור בהערה' });
    if (r.down >= 3 && r.down > r.up) f.push({ k: 'down', t: 'הרבה 👎' });
    if (r.banned) f.push({ k: 'ban', t: 'משתמש חסום' });
    if (f.length) out.set(r.id, f);
  }
  return out;
}
function userFlags(u: U, votes: V[]): Flag[] {
  const f: Flag[] = [];
  if (u.reports24 >= 5) f.push({ k: 'burst', t: `${u.reports24} דיווחים ב-24 שעות` });
  const mine = votes.filter(v => v.user_id === u.id);
  if (mine.length >= 5) {
    const by = new Map<string, number>(); mine.forEach(v => by.set(v.author_id, (by.get(v.author_id) ?? 0) + 1));
    const top = Math.max(...by.values());
    if (top / mine.length >= 0.8) f.push({ k: 'ring', t: 'רוב הלייקים למשתמש אחד' });
  }
  if (u.banned) f.push({ k: 'ban', t: 'חסום' });
  return f;
}

function Spark({ values, color = 'var(--teal)' }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values), w = 100, h = 28;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 3) - 1.5}`).join(' ');
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
    <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity=".12" />
    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

const METRICS: [keyof Omit<Day, 'day'>, string][] = [['reports', 'דיווחים'], ['views', 'חיפושים'], ['users', 'משתמשים חדשים'], ['votes', 'הצבעות']];
function Chart({ daily }: { daily: Day[] }) {
  const [m, setM] = useState<keyof Omit<Day, 'day'>>('reports');
  const [hover, setHover] = useState<number | null>(null);
  const vals = daily.map(d => d[m]); const max = Math.max(1, ...vals); const total = vals.reduce((a, b) => a + b, 0);
  const i = hover ?? daily.length - 1; const d = daily[i];
  return <section className="adm-card">
    <div className="adm-card-head">
      <div><h2>30 הימים האחרונים</h2><p className="muted small">{total} {METRICS.find(x => x[0] === m)![1]} · {d ? `${new Date(d.day).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}: ${d[m]}` : ''}</p></div>
      <div className="seg adm-seg">{METRICS.map(([k, l]) => <button key={k} className={m === k ? 'on' : ''} onClick={() => setM(k)}>{l}</button>)}</div>
    </div>
    <div className="adm-chart" onMouseLeave={() => setHover(null)} dir="ltr">
      {daily.map((x, j) => <button key={x.day} className={`bar ${j === i ? 'sel' : ''}`} onMouseEnter={() => setHover(j)} onClick={() => setHover(j)} aria-label={`${x.day}: ${x[m]}`}>
        <span style={{ height: `${Math.max(2, (x[m] / max) * 100)}%`, animationDelay: `${j * 12}ms` }} /></button>)}
    </div>
  </section>;
}

/** Anonymous action counters: 7-day total, change vs the week before, and a 30-day trend per action. */
function Events({ rows, days }: { rows: { day: string; name: string; n: number }[]; days: string[] }) {
  const by = new Map<string, Map<string, number>>();
  for (const r of rows) { if (!by.has(r.name)) by.set(r.name, new Map()); by.get(r.name)!.set(r.day, r.n); }
  const list = (Object.keys(EVENTS) as EventName[]).map(k => {
    const vals = days.map(d => by.get(k)?.get(d) ?? 0);
    const w = vals.slice(-7).reduce((a, b) => a + b, 0), prev = vals.slice(-14, -7).reduce((a, b) => a + b, 0);
    return { k, vals, w, prev, total: vals.reduce((a, b) => a + b, 0) };
  }).sort((a, b) => b.w - a.w || b.total - a.total);
  return <section className="adm-card"><h2>פעולות באתר</h2><p className="muted small">ספירה אנונימית ליום, בלי שם משתמש ובלי כתובת. המספר: השבוע האחרון, והחץ: שינוי מול השבוע שלפני.</p>
    <ul className="adm-events">{list.map(x => <li key={x.k}>
      <span className="ev-name">{EVENTS[x.k]}</span>
      <b className="ev-n">{x.w.toLocaleString('en-US')}</b>
      <span className={`ev-d ${x.w > x.prev ? 'up' : x.w < x.prev ? 'down' : ''}`}>{x.prev || x.w ? (x.w >= x.prev ? '▲' : '▼') + ' ' + Math.abs(x.w - x.prev) : '–'}</span>
      <Spark values={x.vals} />
    </li>)}</ul>
  </section>;
}

function toCsv(rows: R[]) {
  const head = ['created_at', 'place', 'country', 'area', 'price', 'currency', 'room', 'nights', 'month', 'up', 'down', 'hidden', 'email', 'note'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [head.join(','), ...rows.map(r => [r.created_at, r.place_name, r.country, r.area, r.price, r.currency, r.room, r.nights, r.stay_month, r.up, r.down, r.hidden, r.email, r.note].map(esc).join(','))].join('\n');
}

export default function Admin() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'reports' | 'users' | 'votes'>('reports');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'flagged' | 'hidden'>('all');
  const [country, setCountry] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');
  const load = () => fetch('/api/admin').then(async r => {
    if (r.status === 403) { setErr('אין לך הרשאת אדמין. צריך להתחבר עם חשבון האדמין.'); return; }
    if (!r.ok) throw new Error(); setData(await r.json());
  }).catch(() => setErr('הטעינה נכשלה.'));
  useEffect(() => { load(); }, []);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(t => t === m ? '' : t), 2600); };
  const act = async (body: object, confirmText?: string, done?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    say(r.ok ? (done ?? 'בוצע') : 'הפעולה לא הצליחה'); setSel(new Set()); load();
  };

  const flags = useMemo(() => data ? reportFlags(data.reports, data.users) : new Map<string, Flag[]>(), [data]);
  const ql = q.trim().toLowerCase();
  const reports = useMemo(() => (data?.reports ?? []).filter(r =>
    (filter === 'all' || (filter === 'flagged' ? flags.has(r.id) : r.hidden)) && (!country || r.country === country) &&
    (!ql || [r.place_name, r.area, r.email, r.note, r.country].some(x => x?.toLowerCase().includes(ql)))), [data, filter, country, ql, flags]);
  const users = useMemo(() => (data?.users ?? []).map(u => ({ u, f: userFlags(u, data!.votes) })).filter(({ u, f }) =>
    (filter === 'all' || (filter === 'flagged' ? f.length > 0 : u.banned)) && (!ql || [u.email, u.name].some(x => x?.toLowerCase().includes(ql)))), [data, filter, ql]);
  const votes = useMemo(() => (data?.votes ?? []).filter(v => !ql || [v.email, v.place_name].some(x => x?.toLowerCase().includes(ql))), [data, ql]);

  if (err) return <main className="wrap adm"><div className="adm-top"><a className="brand" href="/">מחיר ללילה</a></div><div className="adm-card center"><div className="sheet-icon">🔒</div><h2>{err}</h2><a className="btn primary" href="/api/auth/google">התחבר עם Google</a></div></main>;
  if (!data) return <main className="wrap adm"><div className="adm-top"><span className="brand">מחיר ללילה · ניהול</span></div><div className="kpis">{[0, 1, 2, 3].map(i => <div key={i} className="kpi skeleton" style={{ height: 104 }} />)}</div><div className="adm-card skeleton" style={{ height: 220 }} /></main>;

  const s = data.stats;
  const series = (k: keyof Omit<Day, 'day'>) => data.daily.map(d => d[k]);
  const flaggedCount = flags.size;
  const countries = data.byCountry.filter(c => c.country !== '?');
  const cMax = Math.max(1, ...data.byCountry.map(c => c.n));
  const allSel = reports.length > 0 && reports.slice(0, 300).every(r => sel.has(r.id));
  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const csv = () => { const b = new Blob(['\ufeff' + toCsv(reports)], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); };

  return <main className="wrap adm">
    {toast && <div className="toast" role="status">{toast}</div>}
    <div className="adm-top"><a className="brand" href="/">מחיר ללילה · ניהול</a><span className="muted small">{data.me}</span></div>

    <div className="kpis">
      {([['משתמשים', s.users, s.users7, 'users'], ['דיווחים', s.reports, s.reports7, 'reports'], ['חיפושים', s.views, s.views7, 'views'], ['הצבעות', s.votes, s.votes7, 'votes']] as const).map(([l, v, w, k]) =>
        <div key={l} className="kpi"><div className="kl">{l}</div><div className="kv">{v.toLocaleString('en-US')}</div><div className="ks">{w ? `+${w} השבוע` : 'אין חדש השבוע'}</div><Spark values={series(k)} /></div>)}
    </div>
    <div className="adm-pills">
      <span className="adm-pill">📍 {s.places} מקומות עם מחיר</span>
      <span className="adm-pill">👀 {s.anonViews} צפיות אנונימיות</span>
      <button className={`adm-pill ${flaggedCount ? 'warn' : ''}`} onClick={() => { setTab('reports'); setFilter('flagged'); }}>🚩 {flaggedCount} חשודים</button>
      <button className="adm-pill" onClick={() => { setTab('reports'); setFilter('hidden'); }}>🙈 {s.hidden} מוסתרים</button>
      <button className="adm-pill" onClick={() => { setTab('users'); setFilter('hidden'); }}>⛔ {s.banned} חסומים</button>
    </div>

    <Chart daily={data.daily} />
    <Events rows={data.events ?? []} days={data.daily.map(d => d.day)} />

    <div className="adm-grid">
      <section className="adm-card"><h2>לפי מדינה</h2>
        {countries.length ? <ul className="adm-bars">{data.byCountry.slice(0, 8).map(c => <li key={c.country}><button onClick={() => { setTab('reports'); setCountry(c.country === '?' ? '' : c.country); setFilter('all'); }}>
          <span className="lbl">{c.country === '?' ? '🌍 לא ידוע' : `${flagOf(c.country)} ${c.country}`}</span><span className="track"><span style={{ width: `${(c.n / cMax) * 100}%` }} /></span><b>{c.n}</b></button></li>)}</ul> : <p className="muted">עוד אין נתונים.</p>}
      </section>
      <section className="adm-card"><h2>המקומות הכי מדווחים</h2>
        {data.topPlaces.length ? <ol className="adm-top-places">{data.topPlaces.map(p => <li key={p.place_id}><a href={placePath({ id: p.place_id, name: p.name })} target="_blank" rel="noopener"><bdi>{p.name}</bdi></a> <span className="muted small">{flagOf(p.country)} · {p.n}</span></li>)}</ol> : <p className="muted">עוד אין נתונים.</p>}
      </section>
    </div>

    <div className="adm-toolbar">
      <div className="seg adm-tabs">
        <button className={tab === 'reports' ? 'on' : ''} onClick={() => { setTab('reports'); setSel(new Set()); }}>דיווחים</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>משתמשים</button>
        <button className={tab === 'votes' ? 'on' : ''} onClick={() => setTab('votes')}>הצבעות</button>
      </div>
      <input className="adm-search" type="search" placeholder={tab === 'users' ? 'חיפוש לפי מייל או שם' : 'חיפוש מקום, אזור, מייל, הערה'} value={q} onChange={e => setQ(e.target.value)} />
      {tab !== 'votes' && <div className="adm-chips">
        {([['all', 'הכל'], ['flagged', '🚩 חשודים'], ['hidden', tab === 'users' ? '⛔ חסומים' : '🙈 מוסתרים']] as const).map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
        {tab === 'reports' && <select className="chip" value={country} onChange={e => setCountry(e.target.value)} aria-label="מדינה"><option value="">כל המדינות</option>{countries.map(c => <option key={c.country} value={c.country}>{flagOf(c.country)} {c.country}</option>)}</select>}
        {tab === 'reports' && <button className="chip" onClick={csv}>⬇️ CSV</button>}
      </div>}
    </div>

    {tab === 'reports' && <>
      {sel.size > 0 && <div className="adm-bulk"><b>{sel.size} נבחרו</b>
        <button className="btn small" onClick={() => act({ action: 'hideReport', ids: [...sel], value: true }, undefined, 'הוסתרו')}>הסתר</button>
        <button className="btn small" onClick={() => act({ action: 'hideReport', ids: [...sel], value: false }, undefined, 'מוצגים שוב')}>הצג</button>
        <button className="btn small danger" onClick={() => act({ action: 'deleteReport', ids: [...sel] }, `למחוק ${sel.size} דיווחים? אי אפשר לבטל.`, 'נמחקו')}>מחק</button>
        <button className="btn small ghost" onClick={() => setSel(new Set())}>ביטול</button></div>}
      <div className="adm-count muted small"><label><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(reports.slice(0, 300).map(r => r.id)))} /> בחר הכל</label> · {reports.length} דיווחים</div>
      {reports.length ? <ul className="adm-list">{reports.slice(0, 300).map(r => { const f = flags.get(r.id); return <li key={r.id} className={`adm-row ${r.hidden ? 'is-hidden' : ''} ${f ? 'is-flagged' : ''}`}>
        <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label="בחר" />
        <div className="adm-main">
          <div className="adm-line"><b dir="auto">{flagOf(r.country)} {r.place_name}</b><span className="adm-price" dir="ltr">{formatMoney(r.price, r.currency)}</span></div>
          <div className="muted small">{r.room === 'dorm' ? 'דורם' : 'חדר פרטי'} · {r.nights} {r.nights === 1 ? 'לילה' : 'לילות'} · {r.stay_month}{r.area ? ` · ${r.area}` : ''} · 👍 {r.up} · 👎 {r.down}</div>
          {r.note && <div className="adm-note" dir="auto">{r.note}</div>}
          <div className="muted small">{r.email} · {when(r.created_at)}{r.hidden ? ' · מוסתר' : ''}</div>
          {f && <div className="adm-flags">{f.map(x => <span key={x.k} className={`adm-flag ${x.k}`}>{x.t}</span>)}</div>}
        </div>
        <div className="adm-actions">
          <button className="btn small" onClick={() => act({ action: 'hideReport', id: r.id, value: !r.hidden }, undefined, r.hidden ? 'מוצג שוב' : 'הוסתר')}>{r.hidden ? 'הצג' : 'הסתר'}</button>
          <button className="btn small danger" onClick={() => act({ action: 'deleteReport', id: r.id }, `למחוק את הדיווח על ${r.place_name}? אי אפשר לבטל.`, 'נמחק')}>מחק</button>
        </div>
      </li>; })}</ul> : <div className="adm-empty">אין דיווחים שמתאימים לסינון.</div>}
    </>}

    {tab === 'users' && (users.length ? <ul className="adm-list">{users.slice(0, 300).map(({ u, f }) => <li key={u.id} className={`adm-row ${u.banned ? 'is-hidden' : ''} ${f.length ? 'is-flagged' : ''}`}>
      <div className="adm-avatar">{(u.name ?? u.email).slice(0, 1).toUpperCase()}</div>
      <div className="adm-main">
        <div className="adm-line"><b>{u.name ?? u.email}</b>{u.is_admin ? <span className="adm-flag admin">אדמין</span> : null}</div>
        <div className="muted small">{u.email}</div>
        <div className="muted small">{u.reports} דיווחים · {u.votes} הצבעות · {u.views} חיפושים · נראה {ago(u.last_seen)} · הצטרף {when(u.created_at)}</div>
        {f.length > 0 && <div className="adm-flags">{f.map(x => <span key={x.k} className={`adm-flag ${x.k}`}>{x.t}</span>)}</div>}
      </div>
      <div className="adm-actions">
        <button className="btn small" onClick={() => { setTab('reports'); setQ(u.email); setFilter('all'); }}>דיווחים</button>
        <button className="btn small" onClick={() => act({ action: 'resetViews', id: u.id }, 'להחזיר למשתמש את כל החיפושים שניצל?', 'החיפושים אופסו')}>אפס חיפושים</button>
        {u.id !== data.meId && <button className="btn small" onClick={() => act({ action: 'setAdmin', id: u.id, value: !u.is_admin }, u.is_admin ? 'להסיר הרשאת אדמין?' : 'לתת הרשאת אדמין?')}>{u.is_admin ? 'הסר אדמין' : 'הפוך לאדמין'}</button>}
        {u.id !== data.meId && <button className={`btn small ${u.banned ? '' : 'danger'}`} onClick={() => act({ action: 'ban', id: u.id, value: !u.banned }, u.banned ? 'לבטל את החסימה ולהציג שוב את הדיווחים שלו?' : 'לחסום? הדיווחים שלו יוסתרו, והוא לא יוכל לדווח או להצביע.', u.banned ? 'החסימה בוטלה' : 'נחסם')}>{u.banned ? 'בטל חסימה' : 'חסום'}</button>}
      </div>
    </li>)}</ul> : <div className="adm-empty">אין משתמשים שמתאימים לסינון.</div>)}

    {tab === 'votes' && (votes.length ? <ul className="adm-list">{votes.slice(0, 300).map(v => <li key={v.report_id + v.user_id} className="adm-row">
      <div className={`adm-vote ${v.vote === 1 ? 'up' : 'down'}`}>{v.vote === 1 ? '👍' : '👎'}</div>
      <div className="adm-main">
        <div className="adm-line"><b dir="auto">{v.place_name}</b><span className="adm-price" dir="ltr">{formatMoney(v.price, v.currency)}</span></div>
        <div className="muted small">{v.email} · {when(v.created_at)}</div>
      </div>
      <div className="adm-actions"><button className="btn small danger" onClick={() => act({ action: 'deleteVote', id: v.report_id, userId: v.user_id }, 'למחוק את ההצבעה?', 'ההצבעה נמחקה')}>מחק</button></div>
    </li>)}</ul> : <div className="adm-empty">אין הצבעות.</div>)}
  </main>;
}

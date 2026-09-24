'use client';
import { useEffect, useState } from 'react';
import { flagOf, formatMoney } from '@/lib/currency';

type U = { id: string; email: string; name: string | null; is_admin: number; created_at: string; reports: number; views: number };
type R = { id: string; place_name: string; area: string | null; country: string | null; price: number; currency: string; room: string; nights: number; stay_month: string; note: string | null; created_at: string; email: string; up: number; down: number };
type Data = { me: string; stats: Record<string, number>; users: U[]; reports: R[]; byCountry: { country: string; n: number }[] };

const when = (s: string) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });

export default function Admin() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'reports' | 'users'>('reports');
  const load = () => fetch('/api/admin').then(async r => {
    if (r.status === 403) { setErr('אין לך הרשאת אדמין. צריך להתחבר עם חשבון האדמין.'); return; }
    setData(await r.json());
  }).catch(() => setErr('הטעינה נכשלה.'));
  useEffect(() => { load(); }, []);
  const act = async (body: object, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) alert('הפעולה לא הצליחה'); load();
  };

  if (err) return <main className="wrap"><div className="topbar"><a className="brand" href="/">מחיר ללילה</a></div><div className="note warn">{err}</div><a className="btn" href="/api/auth/google">התחבר עם Google</a></main>;
  if (!data) return <main className="wrap"><p className="muted">טוען…</p></main>;
  const s = data.stats;
  return <main className="wrap admin">
    <div className="topbar"><a className="brand" href="/">מחיר ללילה · אדמין</a><span className="muted small">{data.me}</span></div>
    <div className="kpis">
      {[['משתמשים', s.users, `+${s.users7} השבוע`], ['דיווחים', s.reports, `+${s.reports7} השבוע`], ['מקומות עם מחיר', s.places, ''], ['חיפושים', s.views, '']].map(([l, v, sub]) =>
        <div key={l as string} className="kpi"><div className="kv">{v}</div><div className="kl">{l}</div>{sub && <div className="ks">{sub}</div>}</div>)}
    </div>
    {data.byCountry.length > 0 && <p className="muted">{data.byCountry.map(c => `${flagOf(c.country === '?' ? null : c.country)} ${c.n}`).join('  ·  ')}</p>}
    <div className="row">
      <button className={`btn small ${tab === 'reports' ? 'selected' : ''}`} onClick={() => setTab('reports')}>דיווחים ({data.reports.length})</button>
      <button className={`btn small ${tab === 'users' ? 'selected' : ''}`} onClick={() => setTab('users')}>משתמשים ({data.users.length})</button>
    </div>
    {tab === 'reports' ? (data.reports.length ? <ul className="list">{data.reports.map(r => <li key={r.id}><div className="li">
      <span><div className="name">{flagOf(r.country)} {r.place_name} · {formatMoney(r.price, r.currency)}</div>
        <div className="detail">{r.room === 'dorm' ? 'דורם' : 'פרטי'} · {r.stay_month}{r.area ? ` · ${r.area}` : ''}{r.note ? ` · ${r.note}` : ''}</div>
        <div className="detail">👍 {r.up} · 👎 {r.down} · {r.email} · {when(r.created_at)}</div></span>
      <button className="btn small" onClick={() => act({ action: 'deleteReport', id: r.id }, `למחוק את הדיווח על ${r.place_name}?`)}>מחק</button>
    </div></li>)}</ul> : <p className="muted">עדיין אין דיווחים.</p>)
    : <ul className="list">{data.users.map(u => <li key={u.id}><div className="li">
      <span><div className="name">{u.name ?? u.email}{u.is_admin ? ' · אדמין' : ''}</div>
        <div className="detail">{u.email}</div>
        <div className="detail">{u.reports} דיווחים · {u.views} חיפושים · הצטרף {when(u.created_at)}</div></span>
      <span className="row" style={{ margin: 0, flexDirection: 'column' }}>
        <button className="btn small" onClick={() => act({ action: 'resetViews', id: u.id }, 'להחזיר למשתמש את כל החיפושים שניצל?')}>אפס חיפושים</button>
        {u.email !== data.me && <button className="btn small" onClick={() => act({ action: 'setAdmin', id: u.id, value: !u.is_admin }, u.is_admin ? 'להסיר הרשאת אדמין?' : 'לתת הרשאת אדמין?')}>{u.is_admin ? 'הסר אדמין' : 'הפוך לאדמין'}</button>}
      </span>
    </div></li>)}</ul>}
  </main>;
}

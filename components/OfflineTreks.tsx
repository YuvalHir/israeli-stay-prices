'use client';
import { useEffect, useState } from 'react';
import { OFFLINE_ROUTES, type OfflineRoute } from '@/lib/offlineRoutes';
import { deleteOfflinePack, listOfflinePacks, putOfflinePack, visibleOfflinePrices, packIsCurrent, MAX_PACKS, type OfflinePack } from '@/lib/offlinePack';
import { findArea, type Area, type Place } from '@/lib/places';
import { ReportForm } from '@/components/Extras';
import { listPendingReports, syncPendingReports, removePendingReport, type PendingReport } from '@/lib/offlineReports';

/** Only the deliberate Save button spends a credit; refresh reuses the same entitlement. */
export default function OfflineTreks({ loggedIn, owner, searchesLeft, onCreditChange }: { loggedIn: boolean; owner: string | null; searchesLeft: number; onCreditChange: (n: number) => void }) {
  const [pending, setPending] = useState<PendingReport[]>([]);
  const [reportPlace, setReportPlace] = useState<{ place: Place | null; stop: OfflinePack['stops'][number] } | null>(null);
  const [reportMessage, setReportMessage] = useState('');
  const [packs, setPacks] = useState<OfflinePack[]>([]);
  const [selected, setSelected] = useState<OfflinePack | null>(null);
  const [route, setRoute] = useState<OfflineRoute | null>(null);
  const [stops, setStops] = useState<Area[]>([]);
  const [trekDays, setTrekDays] = useState(14);
  const [addName, setAddName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const reloadPending = () => listPendingReports().then(all => setPending(all.filter(p => p.owner === owner))).catch(() => {});
  const reload = () => listOfflinePacks().then(all => setPacks(all.filter(p => p.owner === owner))).catch(() => setError('הדפדפן לא מאפשר לשמור מסלולים במכשיר.'));
  useEffect(() => { setSelected(null); reload(); reloadPending(); const on = () => { setOnline(navigator.onLine); reloadPending(); }; window.addEventListener('online', on); window.addEventListener('offline', on); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); }; }, [owner]);
  const sendPending = async () => { if (busy) return; setBusy(true); setError(''); try { const r = await syncPendingReports(); await reloadPending(); setReportMessage(r.sent ? `${r.sent} דיווחים עלו לאתר.` : 'הדיווחים עדיין ממתינים. ודא שיש חיבור ושהחשבון מחובר, ואז נסה שוב.'); } catch { setError('לא הצלחתי לסנכרן. נסה שוב כשיש רשת.'); } finally { setBusy(false); } };
  const choose = (r: OfflineRoute) => { setPendingKey(null); setRoute(r); setStops([...r.stops]); setTrekDays(Math.min(30, Math.max(1, r.stops.length + 2))); setError(''); };
  const add = async () => {
    if (!addName.trim()) return;
    setBusy(true); setError('');
    const a = await findArea(`${addName.trim()}, Nepal`).catch(() => null);
    setBusy(false);
    if (!a || a.country !== 'NP' || a.lat < 26 || a.lat > 31 || a.lon < 80 || a.lon > 89) return setError('לא מצאתי עצירה בנפאל. נסה שם מקום מדויק יותר.');
    if (stops.some(s => Math.hypot(s.lat - a.lat, s.lon - a.lon) < .001)) return setError('העצירה כבר ברשימה.');
    setPendingKey(null); setStops(v => [...v, a]); setAddName('');
  };
  const fetchPack = async (key: string, r: OfflineRoute, ss: Area[], days: number) => {
    const res = await fetch('/api/offline-route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeKey: r.key, requestId: key, trekDays: days, stops: ss.map(x => ({ name: x.name, lat: x.lat, lon: x.lon })) }) });
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error(j?.error === 'report_required' ? 'אין כרגע חיפוש פנוי. דיווח או 👍 פותחים עוד 5 חיפושים.' : j?.error === 'no_lodges' ? 'לא נמצאו לודג׳ים בעצירות האלה. לא חויבת.' : j?.error === 'lookup_unavailable' ? 'לא הצלחנו להביא את הלודג׳ים. לא חויבת; נסה שוב כשיש רשת.' : 'שמירת המסלול לא הצליחה. נסה שוב.');
    return j as OfflinePack & { searchesLeft: number };
  };
  const save = async () => {
    if (!route || stops.length < 2 || !online || !loggedIn || !owner || searchesLeft < 1 || packs.length >= MAX_PACKS || busy) return;
    setBusy(true); setError('');
    const draft = `sp_route_draft:${owner}:${route.key}:${JSON.stringify({ stops: stops.map(x => ({ name: x.name, lat: x.lat, lon: x.lon })), trekDays })}`;
    let key = pendingKey;
    try { key = localStorage.getItem(draft) ?? key; } catch {}
    key ??= `${route.key}:${crypto.randomUUID()}`;
    setPendingKey(key);
    try { localStorage.setItem(draft, key); } catch {}
    try { const pack = await fetchPack(key, route, stops, trekDays); onCreditChange(pack.searchesLeft); const owned = { ...pack, owner: owner ?? undefined }; await putOfflinePack(owned); await reload(); setSelected(owned); setRoute(null); setPendingKey(null); try { localStorage.removeItem(draft); } catch {} }
    catch (e) { setError(String(e instanceof Error ? e.message : 'השמירה נכשלה')); }
    finally { setBusy(false); }
  };
  const refresh = async (p: OfflinePack) => {
    if (!online || busy) return;
    const r = OFFLINE_ROUTES.find(x => x.key === p.key.split(':')[0]);
    if (!r) return setError('לא ניתן לעדכן את המסלול הזה.');
    setBusy(true); setError('');
    try { const updated = { ...await fetchPack(p.key, r, p.stops, p.trekDays), owner: owner ?? undefined }; await putOfflinePack(updated); setSelected(updated); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'העדכון נכשל'); }
    finally { setBusy(false); }
  };
  return <div className="card offline-panel">
    <h2>🏔️ מסלולים לאופליין</h2>
    <p className="muted small">שומרים לודג׳ים ומחירים במכשיר לפני היציאה. זו רשימת עצירות, לא מפת ניווט. המחירים נשמרים פי 2 ממשך הטרק שבחרת, והמפה אינה נשמרת.</p>
    {error && <p className="note warn">{error}</p>}
    {reportMessage && <p className="note">{reportMessage}</p>}
    {!!pending.length && <div className="offline-pending"><h3>דיווחים שמורים במכשיר ({pending.length})</h3><p className="muted small">דיווחים ממתינים יעלו אוטומטית כשיש רשת וחשבון מחובר. אם נדרש תיקון, אפשר למחוק ולדווח שוב. מחיקה לא מבטלת דיווח שכבר הגיע לשרת.</p>{pending.map(p => <div className="offline-pending-row" key={p.clientReportId}><span>{String(p.body.placeName ?? 'דיווח')} · {p.state === 'needs_review' ? 'דורש בדיקה' : 'ממתין לשליחה'}</span><button className="chip" onClick={async () => { await removePendingReport(p.clientReportId); reloadPending(); }}>מחק</button></div>)}<button className="btn block" disabled={busy} onClick={sendPending}>נסה לשלוח דיווחים</button></div>}
    {!!packs.length && <><h3>שמורים במכשיר</h3>{packs.map(p => <button key={p.key} className="btn block offline-row" onClick={() => { setSelected(p); setRoute(null); }}><b>{p.name}</b><span>{p.stops.length} עצירות · {p.stops.reduce((n, s) => n + s.lodges.length, 0)} לודג׳ים</span></button>)}</>}
    {reportPlace && owner && <ReportForm key={reportPlace.place?.id ?? `manual-${reportPlace.stop.name}`} place={reportPlace.place} area={reportPlace.stop.name} areaLat={reportPlace.stop.lat} areaLon={reportPlace.stop.lon} country="NP" owner={owner} onDone={msg => { setReportPlace(null); setReportMessage(msg); reloadPending(); }} onCancel={() => setReportPlace(null)} />}
    {selected && !reportPlace && <div className="offline-stops"><h3>{selected.name}</h3><p className="muted small">{online ? packIsCurrent(selected) ? '🟢 נשמר ב־24 השעות האחרונות' : '🟠 כדאי לרענן' : '📵 אופליין'} · עודכן במכשיר {new Date(selected.savedAt).toLocaleString('he-IL')} · {Date.now() >= selected.pricesExpireAt ? 'המחירים פגו והוסתרו' : `מחירים עד ${new Date(selected.pricesExpireAt).toLocaleDateString('he-IL')}`}</p>
      {online && loggedIn && packIsCurrent(selected) && <button className="btn block" disabled={busy} onClick={() => refresh(selected)}>↻ עדכן עכשיו, בלי חיפוש נוסף</button>}
      {selected.stops.map((s, i) => <details key={i}><summary>{s.name} · {s.lodges.length} לודג׳ים</summary>{owner && <button className="chip" onClick={() => setReportPlace({ place: null, stop: s })}>דווח על מקום שלא ברשימה</button>}<ul>{s.lodges.map(l => <li key={l.id}>{l.name} {visibleOfflinePrices(selected).filter(p => p.placeId === l.id).map((p, j) => <span key={j}>{p.israeliDeal ? ' · לינה חינם, ארוחות בתשלום' : ` · ${p.price} ${p.currency} ${p.room === 'dorm' ? 'למיטה ללילה' : 'לכל החדר ללילה*'}`} {p.room === 'private' && p.beds && !p.israeliDeal ? ` · כ־${Math.round(p.price / p.beds)} ${p.currency} לאדם בחדר מלא` : ''}</span>)}{owner && <button className="chip" onClick={() => setReportPlace({ place: l, stop: s })}>דווח על הלינה</button>}</li>)}</ul></details>)}
      {online && packs.length < MAX_PACKS && <button className="btn block" onClick={() => { const r = OFFLINE_ROUTES.find(x => x.key === selected.key.split(':')[0]); if (!r) return; setRoute(r); setStops(selected.stops.map(({ name, lat, lon }) => ({ name, lat, lon, country: 'NP' }))); setTrekDays(selected.trekDays); setPendingKey(null); setError('עריכה של מסלול שמור היא חיפוש חדש אחד. המסלול הישן נשאר עד שתמחק אותו.'); }}>ערוך עצירות · חיפוש חדש אחד</button>}
      <button className="btn block" onClick={async () => { await deleteOfflinePack(selected.key); setSelected(null); reload(); }}>מחק מסלול מהמכשיר</button>
    </div>}
    <h3>שמור מסלול חדש</h3>
    {OFFLINE_ROUTES.map(r => <button key={r.key} className={`btn block offline-row ${route?.key === r.key ? 'offline-chosen' : ''}`} onClick={() => choose(r)}><b>{r.name}</b><span>{r.stops.length} עצירות</span></button>)}
    {route && <div className="offline-edit"><h3>{route.name}</h3><p className="muted small">אפשר להוסיף ולהסיר עצירות. בכל עצירה יישמרו לודג׳ים בטווח 2 ק״מ; בין העצירות לא מובטח כיסוי.</p>
      <ol>{stops.map((s, i) => <li key={`${s.name}-${i}`}>{s.name}<button type="button" className="chip" onClick={() => { setPendingKey(null); setStops(v => v.filter((_, n) => n !== i)); }}>הסר</button></li>)}</ol>
      <div className="offline-add"><input value={addName} onChange={e => setAddName(e.target.value)} placeholder="הוסף עצירה בנפאל" aria-label="שם עצירה חדשה" /><button className="btn" disabled={busy} onClick={add}>הוסף</button></div>
      <label className="field"><span>אורך הטרק בימים</span><input type="number" min="1" max="30" value={trekDays} onChange={e => { setPendingKey(null); setTrekDays(Math.min(30, Math.max(1, Number(e.target.value) || 1))); }} /></label>
      <p className="muted small">מחירים עד {trekDays * 2} ימים · שמירת המסלול עולה חיפוש אחד. נדרש חיפוש פנוי.</p>
      <button className="btn primary block" disabled={busy || !online || !loggedIn || !owner || searchesLeft < 1 || stops.length < 2 || packs.length >= MAX_PACKS} onClick={save}>{busy ? 'שומר…' : 'שמור את המסלול · חיפוש אחד'}</button>
      {!online && <p className="muted small">כדי לשמור מסלול חדש צריך רשת. מסלולים קיימים זמינים אופליין.</p>}
      {!loggedIn && <p className="muted small">כדי לשמור מחירים צריך להתחבר.</p>}
    </div>}
  </div>;
}

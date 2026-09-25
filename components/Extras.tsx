'use client';
// Sheets and forms that only open after a tap. Loaded on demand to keep the first download small.
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/track';
import { drawShareCard, shareText, type ShareInfo } from '@/lib/shareCard';
import { ROOM_HE, KIND_ICON, curFlag, money, monthLabel, lastMonths, Sheet, WhatsAppIcon, SLOGAN, type Report, ShareGlyph } from '@/components/ui';
import { kindLabel, type Place } from '@/lib/places';
import { currencyFor, currencyName } from '@/lib/currency';
import { SITE_URL } from '@/lib/placeUrl';
import { trekDealRegion } from '@/lib/trekDeal';
import { queueReport } from '@/lib/offlineReports';

export function ReportForm({ place, area, areaLat, areaLon, country, owner, onDone, onCancel }: { place: Place | null; area: string; areaLat?: number; areaLon?: number; country: string | null; owner: string | null; onDone: (msg: string, share?: ShareInfo) => void; onCancel: () => void }) {
  const local = currencyFor(country);
  const options = Array.from(new Set([local, 'USD', 'ILS']));
  const [name, setName] = useState(place?.name ?? '');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<string>(local);
  const [room, setRoom] = useState<Report['room']>('private');
  const [beds, setBeds] = useState<number | ''>('');
  const [israeliDeal, setIsraeliDeal] = useState(false);
  const [dealHelp, setDealHelp] = useState(false);
  const region = trekDealRegion(place?.lat ?? areaLat, place?.lon ?? areaLon);
  const [nights, setNights] = useState(1);
  const [month, setMonth] = useState(lastMonths()[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const p = israeliDeal ? 0 : Number(price.replace(/[^\d.]/g, ''));
    if (!name.trim()) return setError('חסר שם המקום.');
    if (!israeliDeal && !(p > 0)) return setError('חסר מחיר ללילה.');
    if (!beds) return setError('חסר מספר המיטות בחדר.');
    setBusy(true); setError('');
    const body = { clientReportId: crypto.randomUUID(), placeId: place?.id, placeName: name, placeKind: place?.kind, lat: place?.lat ?? areaLat, lon: place?.lon ?? areaLon, area, country, price: p, currency, room, beds, israeliDeal, nights, stayMonth: month, note };
    if (!navigator.onLine) {
      if (!owner) { setBusy(false); setError('כדי לשמור דיווח אופליין צריך להתחבר כשיש רשת.'); return; }
      try { await queueReport(body, owner); setBusy(false); onDone('הדיווח נשמר רק במכשיר ויעלה אוטומטית כשיהיה אינטרנט. עדיין לא קיבלת חיפושים.'); }
      catch { setBusy(false); setError('לא הצלחתי לשמור במכשיר. בדוק מקום פנוי ונסה שוב.'); }
      return;
    }
    let res: Response;
    try { res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch { if (owner) { try { await queueReport(body, owner); setBusy(false); onDone('החיבור התנתק. שמרנו את הדיווח במכשיר עם אותו מזהה, והוא ייבדק שוב כשיהיה אינטרנט.'); return; } catch {} } setBusy(false); setError('החיבור התנתק ולא הצלחנו לשמור במכשיר. בדוק כשיש חיבור לפני שתשלח שוב.'); return; }
    if (!res.ok) { setBusy(false); return setError(res.status === 401 ? 'צריך להתחבר קודם.' : res.status === 409 ? 'כבר דיווחת על המקום הזה לחודש הזה. אפשר לדווח שוב על חודש אחר.' : res.status === 429 ? 'הגעת למגבלת הדיווחים להיום. נסה שוב מחר.' : 'השמירה לא הצליחה. נסה שוב.'); }
    setBusy(false); try { navigator.vibrate?.([12, 40, 18]); } catch {} onDone('תודה! הדיווח נשמר, וקיבלת 5 חיפושים עם מחירים.', { placeName: name.trim(), price: p, currency, country, room, beds, israeliDeal, nights, month, lat: place?.lat ?? areaLat, lon: place?.lon ?? areaLon });
  };
  return <section className="card form">
    <div className="form-head"><button className="icon-btn" onClick={onCancel} aria-label="חזרה">→</button><div><h2>איך הייתה הלינה?</h2><p className="muted small form-sub">{SLOGAN} 😉</p></div></div>
    {place ? <p className="muted">{KIND_ICON[place.kind] ?? '🏠'} {place.name} · {kindLabel(place.kind)}</p> :
      <label className="field"><span>שם המקום</span><input value={name} onChange={e => setName(e.target.value)} placeholder="למשל Hotel Yog" /></label>}
    {!israeliDeal && <><label className="field"><span>{room === 'dorm' ? 'מחיר למיטה ללילה' : 'מחיר לחדר ללילה'}</span>
      <div className="price-input"><input inputMode="decimal" dir="ltr" autoFocus={!!place} value={price} onChange={e => setPrice(e.target.value)} placeholder="0" /><b>{curFlag(currency, country)} {currency}</b></div>
    </label>
    <div className="field"><span>מטבע</span>
      <div className="seg">{options.map(c => <button key={c} className={currency === c ? 'on' : ''} onClick={() => setCurrency(c)}>{curFlag(c, country)} {c === 'USD' ? 'דולר' : c === 'ILS' ? 'שקל' : currencyName(c)}</button>)}</div></div></>}
    <div className="field"><span>סוג לינה</span>
      <div className="seg">{(['private', 'dorm'] as const).map(r => <button key={r} className={room === r ? 'on' : ''} onClick={() => setRoom(r)}>{ROOM_HE[r]}</button>)}</div></div>
    <label className="field"><span>כמה מיטות בחדר</span><select value={beds} onChange={e => setBeds(e.target.value ? Number(e.target.value) : '')}><option value="">בחר מספר מיטות</option>{Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
    {region && <div className="deal-field"><label className="deal-label"><input type="checkbox" checked={israeliDeal} onChange={e => setIsraeliDeal(e.target.checked)} /><span>הדיל הישראלי</span></label><button type="button" className="deal-help" aria-label="מה זה הדיל הישראלי?" aria-expanded={dealHelp} onClick={() => setDealHelp(!dealHelp)}>?</button>{dealHelp && <p className="deal-explain">הלינה בחינם, בתנאי שאוכלים ארוחת בוקר וערב בלודג׳. הארוחות בתשלום; המחיר שלהן לא כלול בדיווח.</p>}</div>}
    <div className="two">
      <div className="field"><span>כמה לילות</span>
        <div className="stepper"><button onClick={() => setNights(Math.max(1, nights - 1))} aria-label="פחות">−</button><b key={nights} className="tick">{nights}</b><button onClick={() => setNights(Math.min(60, nights + 1))} aria-label="יותר">+</button></div></div>
      <label className="field"><span>מתי</span>
        <select value={month} onChange={e => setMonth(e.target.value)}>{lastMonths().map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
    </div>
    <label className="field"><span>הערה (לא חובה)</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="למשל: כולל ארוחת בוקר, התמקחתי מ-2000" /></label>
    {error && <div className="note warn">{error}</div>}
    <div className="form-actions"><button className="btn primary block big" disabled={busy} onClick={submit}>{busy ? <span className="spinner" aria-hidden="true" /> : null}{busy ? 'שומר…' : 'שמור דיווח'}</button>
    <p className="muted small center anon-note">🔒 הדיווח מוצג בלי שם ובלי מייל.</p></div>
  </section>;
}


export function ShareSheet({ info, onClose }: { info: ShareInfo; onClose: () => void }) {
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
    track('share');
    if (canShareFile && file) { try { await navigator.share({ files: [file], text }); return; } catch (e: any) { if (e?.name === 'AbortError') return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  return <Sheet onClose={onClose} className="share-sheet">{dismiss => <>
      <h2>ספר לחבריך 😉</h2>
      <p>שלח לקבוצת הטיול. ככה עוד חברים יידעו כמה לשלם, ויוסיפו מחירים משלהם.</p>
      <div className="share-preview">{url ? <img src={url} alt="כרטיס שיתוף עם המחיר ששילמת" /> : <div className="skeleton share-skel" />}</div>
      <button className="btn wa block big" onClick={share} disabled={!blob}><WhatsAppIcon /> שתף בוואטסאפ</button>
      {!canShareFile && url && <a className="btn block" href={url} download="mechir-lalayla.png">⬇️ שמור את התמונה</a>}
      <button className="btn ghost block" onClick={dismiss}>אחר כך</button>
    </>}</Sheet>;
}

/** Add-to-home-screen offer: native prompt on Android/Chrome, instructions on iOS. Shown at a good moment, never when installed. */
export function InstallSheet({ ios, onInstall, onClose }: { ios: boolean; onInstall: () => void; onClose: () => void }) {
  const safari = ios && !/CriOS|FxiOS|EdgiOS|GSA\//.test(navigator.userAgent);
  return <Sheet onClose={onClose}>{dismiss => <>
      <div className="sheet-step">
        <img className="a2hs-icon" src="/icons/v2/icon-96.webp" alt="" />
        <h2>שים את מחיר ללילה במסך הבית</h2>
        <p>נפתח בלחיצה כמו אפליקציה, במסך מלא, בלי לחפש את הלינק. בלי חנות ובלי הורדה.</p>
      </div>
      {ios ? <ol className="a2hs-steps">
        <li><span>1</span><div>לוחצים על כפתור השיתוף <b className="a2hs-glyph"><ShareGlyph /></b> {safari ? 'בסרגל של ספארי' : 'בדפדפן (בכרום הוא ליד שורת הכתובת)'}</div></li>
        <li><span>2</span><div>גוללים ובוחרים <b>״הוספה למסך הבית״</b> <b className="a2hs-glyph">⊞</b></div></li>
        <li><span>3</span><div>לוחצים <b>״הוספה״</b> למעלה, וזהו</div></li>
      </ol>
      : <button className="btn primary block big" onClick={onInstall}>📲 הוסף למסך הבית</button>}
      <button className="btn ghost block" onClick={dismiss}>{ios ? 'הבנתי' : 'לא עכשיו'}</button>
    </>}</Sheet>;
}

/**
 * Bottom sheet with iOS-like manners: slides away on close instead of vanishing,
 * and can be dragged down to dismiss. `children` gets a `dismiss` that animates out first.
 */
type InviteState = { invites: { code: string; created_at: string; used: boolean; revoked: boolean; used_name: string | null }[]; quota: number; left: number; unlimited: boolean };
/** Account sheet: personal invite links (single use, 10 per person) and sign out. */
export function AccountSheet({ me, onClose, onLogout, say }: { me: { name?: string | null; email?: string }; onClose: () => void; onLogout: () => void; say: (m: string) => void }) {
  const [st, setSt] = useState<InviteState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch('/api/invites').then(r => r.ok ? r.json() : null).then(setSt).catch(() => {}); }, []);
  const link = (c: string) => `${SITE_URL}/i/${c}`;
  const send = async (code: string) => {
    const url = link(code); const text = 'הזמנה אישית לאתר של ישראלים שמשתפים כמה שילמו על לינה 🏡 הקישור עובד פעם אחת:';
    track('share');
    if (navigator.share) { try { await navigator.share({ text, url }); return; } catch (e: any) { if (e?.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(`${text} ${url}`); say('קישור ההזמנה הועתק 👍'); } catch { say(url); }
  };
  const create = async () => {
    setBusy(true);
    const r = await fetch('/api/invites', { method: 'POST' }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null; setBusy(false);
    if (!r?.ok || !j?.code) { say(j?.error === 'no_invites_left' ? 'נגמרו ההזמנות שלך' : 'לא הצלחתי ליצור קישור. נסה שוב.'); return; }
    setSt(j); send(j.code);
  };
  const open = st?.invites.filter(i => !i.used && !i.revoked) ?? [];
  const used = st?.invites.filter(i => i.used) ?? [];
  return <Sheet onClose={onClose} className="acct-sheet">{dismiss => <>
    <div className="sheet-step"><div className="sheet-icon">🎟️</div><h2>הזמן חברים</h2>
      <p>האתר כרגע בהזמנה בלבד. כל קישור אישי עובד פעם אחת, וכל מי שמצטרף מקבל 10 הזמנות משלו.</p></div>
    {!st ? <div className="skeleton row-skel" /> : <>
      <div className="inv-count"><b>{st.unlimited ? '∞' : st.left}</b><span>{st.unlimited ? 'הזמנות ללא הגבלה (אדמין)' : `הזמנות נשארו מתוך ${st.quota}`}</span></div>
      <button className="btn primary block" disabled={busy || st.left <= 0} onClick={create}>{busy ? 'יוצר קישור…' : st.left > 0 ? 'צור קישור הזמנה ושלח' : 'נגמרו ההזמנות'}</button>
      {open.length > 0 && <><h3 className="inv-h">קישורים שעוד לא נוצלו</h3><ul className="inv-list">{open.slice(0, 10).map(i => <li key={i.code}><code dir="ltr">/i/{i.code}</code><button className="chip" onClick={() => send(i.code)}>שלח שוב</button></li>)}</ul></>}
      {used.length > 0 && <><h3 className="inv-h">הצטרפו דרכך</h3><ul className="inv-list">{used.map(i => <li key={i.code}><span>✅ {i.used_name ?? 'מישהו'}</span></li>)}</ul></>}
    </>}
    <p className="muted small center">מחובר כ-{me.email}</p>
    <button className="btn ghost block" onClick={() => { dismiss(); onLogout(); }}>התנתק</button>
  </>}</Sheet>;
}


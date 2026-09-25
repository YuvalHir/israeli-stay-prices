/** Draws the "I paid X here" share card on a canvas (client only). Canvas handles RTL + emoji natively. */
import { currencyName, flagOf } from './currency';

export type ShareInfo = { placeName: string; price: number; currency: string; country: string | null; room: 'dorm' | 'private'; beds?: number | ''; israeliDeal?: boolean; nights: number; month: string; lat?: number; lon?: number };

export const SITE = 'https://israeli-stay-prices.hyuval1511.workers.dev';
const SLOGAN = 'התמקחת? ספר לחבריך';

export function shareUrl(s: ShareInfo) {
  return s.lat != null && s.lon != null ? `${SITE}/?at=${s.lat.toFixed(4)},${s.lon.toFixed(4)}` : SITE;
}
export function shareText(s: ShareInfo) {
  const flag = s.country ? flagOf(s.country) + ' ' : '';
  return s.israeliDeal ? `ישנתי בחינם ב-${s.placeName} במסגרת הדיל הישראלי (ארוחת בוקר וערב בתשלום) 👀 ${flag}\n${SLOGAN} 👇\n${shareUrl(s)}` : `שילמתי ${s.price.toLocaleString('en-US')} ${currencyName(s.currency)} ללילה ב-${s.placeName} 👀 ${flag}\n${SLOGAN} 👇\n${shareUrl(s)}`;
}


function fit(ctx: CanvasRenderingContext2D, text: string, max: number, size: number, weight: number, font: string) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${font}`; if (ctx.measureText(text).width <= max) break; s -= 4; } while (s > 28);
  if (ctx.measureText(text).width > max) { let t = text; while (t.length > 3 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; }
  return text;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const TWEMOJI = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/';
const emojiUrl = (e: string) => TWEMOJI + Array.from(e).map(ch => ch.codePointAt(0)!.toString(16)).filter(cp => cp !== 'fe0f').join('-') + '.svg';
const loadImg = (src: string, cors = false) => new Promise<HTMLImageElement | null>(res => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export async function drawShareCard(s: ShareInfo): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const font = `${getComputedStyle(document.documentElement).fontFamily}, sans-serif`;
  try { await (document as any).fonts?.ready; } catch {}
  const flag = s.country ? flagOf(s.country) : '';
  const [photo, icon, flagImg, eyes, wink] = await Promise.all([
    loadImg('/teahouse.jpg'), loadImg('/icons/v2/icon-192.png'),
    flag && flag !== '🌍' ? loadImg(emojiUrl(flag), true) : Promise.resolve(null), loadImg(emojiUrl('👀'), true), loadImg(emojiUrl('😉'), true),
  ]);

  // Background: photo + dark gradient + warm glow
  ctx.fillStyle = '#17130f'; ctx.fillRect(0, 0, W, H);
  if (photo) { const sc = Math.max(W / photo.width, H / photo.height); const pw = photo.width * sc, ph = photo.height * sc; ctx.drawImage(photo, (W - pw) / 2, (H - ph) / 2, pw, ph); }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(14,12,10,.6)'); g.addColorStop(.3, 'rgba(14,12,10,.4)'); g.addColorStop(.55, 'rgba(14,12,10,.78)'); g.addColorStop(1, 'rgba(14,12,10,.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * .75, H * .58, 20, W * .75, H * .58, 650);
  glow.addColorStop(0, 'rgba(224,99,63,.42)'); glow.addColorStop(1, 'rgba(224,99,63,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  const R = W - 80, maxW = W - 160;

  // Top pill
  ctx.font = `700 34px ${font}`;
  const pill = 'דיווח אמיתי ממטייל ישראלי';
  const pw = ctx.measureText(pill).width + 56;
  rr(ctx, R - pw, 80, pw, 72, 36); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillText(pill, R - 28, 128);

  // Big flag, tilted sticker
  if (flagImg) {
    ctx.save(); ctx.translate(170, 190); ctx.rotate(-0.12);
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.drawImage(flagImg, -90, -90, 180, 180); ctx.restore();
  }

  // "שילמתי 👀"
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `700 66px ${font}`;
  ctx.fillText(s.israeliDeal ? 'הדיל הישראלי' : 'שילמתי', R, 640);
  const tw = ctx.measureText(s.israeliDeal ? 'הדיל הישראלי' : 'שילמתי').width;
  if (eyes) ctx.drawImage(eyes, R - tw - 90, 582, 70, 70);

  // Price: big number + currency code
  const num = s.israeliDeal ? 'חינם' : s.price.toLocaleString('en-US');
  ctx.save(); ctx.direction = 'ltr'; ctx.textAlign = 'left';
  ctx.font = `800 70px ${font}`; const cw = s.israeliDeal ? 0 : ctx.measureText(s.currency).width;
  let size = 230; ctx.font = `800 ${size}px ${font}`;
  while (ctx.measureText(num).width + cw + 30 > maxW && size > 90) { size -= 10; ctx.font = `800 ${size}px ${font}`; }
  const nw = ctx.measureText(num).width;
  const x0 = R - nw - cw - 24;
  ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(224,99,63,.85)'; ctx.shadowBlur = 50;
  ctx.fillText(num, x0 + cw + 24, 850);
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffb59c'; ctx.font = `800 70px ${font}`; if (!s.israeliDeal) ctx.fillText(s.currency, x0, 850);
  ctx.restore(); ctx.direction = 'rtl'; ctx.textAlign = 'right';
  ctx.fillStyle = '#ffb59c'; ctx.font = `700 48px ${font}`;
  ctx.fillText(s.israeliDeal ? 'לינה חינם · בוקר וערב בתשלום' : `ללילה · ${currencyName(s.currency)}`, R, 925);

  // Place name
  ctx.fillStyle = '#fff';
  const pn = fit(ctx, `ב-${s.placeName}`, maxW, 80, 800, font);
  ctx.fillText(pn, R, 1035);

  // Detail chips
  const [y, m] = s.month.split('-').map(Number);
  const monthHe = y && m ? new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1)) : '';
  const chips = [s.room === 'dorm' ? 'מיטה בדורם' : 'חדר פרטי', s.nights === 1 ? 'לילה אחד' : `${s.nights} לילות`, monthHe].filter(Boolean) as string[];
  let x = R; ctx.font = `600 36px ${font}`;
  for (const ch of chips) {
    const w = ctx.measureText(ch).width + 48;
    if (x - w < 80) break;
    rr(ctx, x - w, 1072, w, 66, 33); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(ch, x - 24, 1117); x -= w + 14;
  }

  // Footer: slogan + app
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(80, 1170, W - 160, 2);
  ctx.fillStyle = '#fff'; ctx.font = `800 54px ${font}`; ctx.fillText(SLOGAN, R, 1250);
  const sw = ctx.measureText(SLOGAN).width;
  if (wink) ctx.drawImage(wink, R - sw - 72, 1203, 56, 56);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `500 32px ${font}`; ctx.fillText('מחיר ללילה · כמה ישראלים שילמו', R, 1298);
  if (icon) { ctx.save(); rr(ctx, 80, 1196, 108, 108, 26); ctx.clip(); ctx.drawImage(icon, 80, 1196, 108, 108); ctx.restore(); }

  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'));
}

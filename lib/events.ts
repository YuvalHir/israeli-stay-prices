/** Anonymous action counters. The list is closed: anything else is ignored. */
export const EVENTS = {
  area_view: 'אזורים שנפתחו',
  place_view: 'דפי מקום',
  search_pick: 'בחירה מהחיפוש',
  report_open: 'פתחו דיווח',
  report_sent: 'דיווחים שנשלחו',
  sleep_tap: '"אני ישן כאן"',
  share: 'שיתופים',
  login_open: 'חלון התחברות',
  signup: 'הרשמות',
  unlock: 'חיפושים עם מחירים',
  gmap_open: 'פתחו בגוגל מפות',
  install: 'התקנות',
} as const;
export type EventName = keyof typeof EVENTS;

/** Server side: bump today's counter. Never throws. */
export async function countEvent(DB: { prepare(q: string): any }, name: EventName) {
  try {
    await DB.prepare(`INSERT INTO event_counts (day, name, n) VALUES (date('now'), ?, 1) ON CONFLICT(day, name) DO UPDATE SET n = n + 1`).bind(name).run();
  } catch { /* table missing or DB busy: analytics must never break the app */ }
}

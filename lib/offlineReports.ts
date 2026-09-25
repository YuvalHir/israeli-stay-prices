/** Explicitly queued reports, stored only on this device until confirmed by the server. */
export type PendingReport = { clientReportId: string; queuedAt: number; owner: string; body: Record<string, unknown>; state: 'pending' | 'needs_review'; error?: string };
const NAME = 'stay-offline-reports', STORE = 'reports';
function db(): Promise<IDBDatabase> { return new Promise((ok, fail) => { const q = indexedDB.open(NAME, 1); q.onupgradeneeded = () => { if (!q.result.objectStoreNames.contains(STORE)) q.result.createObjectStore(STORE, { keyPath: 'clientReportId' }); }; q.onsuccess = () => ok(q.result); q.onerror = () => fail(q.error); }); }
async function work<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore, done: (x: T) => void, fail: (e: unknown) => void) => void): Promise<T> {
  const d = await db(); return new Promise((resolve, reject) => { const tx = d.transaction(STORE, mode); const done = (x: T) => { d.close(); resolve(x); }; const fail = (e: unknown) => { d.close(); reject(e); }; tx.onerror = () => fail(tx.error); f(tx.objectStore(STORE), done, fail); });
}
export const listPendingReports = () => work<PendingReport[]>('readonly', (s, done, fail) => { const q = s.getAll(); q.onsuccess = () => done(q.result); q.onerror = () => fail(q.error); });
export async function queueReport(body: Record<string, unknown>, owner: string) {
  if ((await listPendingReports()).filter(x => x.owner === owner).length >= 20) throw new Error('too_many_pending');
  const report: PendingReport = { clientReportId: typeof body.clientReportId === 'string' ? body.clientReportId : crypto.randomUUID(), queuedAt: Date.now(), owner, body, state: 'pending' };
  await work<void>('readwrite', (s, done, fail) => { const q = s.put(report); q.onsuccess = () => done(); q.onerror = () => fail(q.error); });
  return report;
}
export const removePendingReport = (id: string) => work<void>('readwrite', (s, done, fail) => { const q = s.delete(id); q.onsuccess = () => done(); q.onerror = () => fail(q.error); });
export const savePendingReport = (report: PendingReport) => work<void>('readwrite', (s, done, fail) => { const q = s.put(report); q.onsuccess = () => done(); q.onerror = () => fail(q.error); });
export const clearPendingReports = () => work<void>('readwrite', (s, done, fail) => { const q = s.clear(); q.onsuccess = () => done(); q.onerror = () => fail(q.error); });

let syncing = false;
export async function syncPendingReports(): Promise<{ sent: number; review: number }> {
  if (syncing) return { sent: 0, review: 0 };
  const me = await fetch('/api/auth/me').then(r => r.ok ? r.json() : null).catch(() => null);
  if (!me?.user) return { sent: 0, review: 0 };
  syncing = true; let sent = 0, review = 0;
  try {
    for (const report of await listPendingReports()) {
      if (report.owner !== me.user.email) continue;
      if (report.state !== 'pending') { review++; continue; }
      try {
        const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...report.body, clientReportId: report.clientReportId }) });
        if (res.ok) { await removePendingReport(report.clientReportId); sent++; continue; }
        if ([400, 403, 409, 422].includes(res.status)) { await savePendingReport({ ...report, state: 'needs_review', error: `HTTP ${res.status}` }); review++; continue; }
        break; // Retry later on signed-out state, rate limit or server failure.
      } catch { break; }
    }
  } finally { syncing = false; }
  return { sent, review };
}

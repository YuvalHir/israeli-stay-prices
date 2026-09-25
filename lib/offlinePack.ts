/** Local, opt-in trek snapshot storage. No prices are cached by the service worker. */
export type OfflineLodge = { id: string; name: string; kind: string; lat: number; lon: number; country?: string; reports: number };
export type OfflineStop = { name: string; lat: number; lon: number; lodges: OfflineLodge[] };
export type OfflinePrice = { placeId: string; price: number; currency: string; room: 'private' | 'dorm'; beds: number | null; israeliDeal: number };
export type OfflinePack = {
  key: string; name: string; savedAt: number; pricesExpireAt: number; stops: OfflineStop[]; prices: OfflinePrice[]; trekDays: number; entitlementId?: string; owner?: string;
  /** One credit charged for an authenticated pack, unless it is only a public lodge list. */
  creditsUsed: number;
};
const DB_NAME = 'stay-trek-packs';
const DB_VERSION = 1;
const STORE = 'packs';
export const MAX_PACKS = 5;

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'key' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transaction<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: unknown) => void) => void): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const done = (v: T) => { db.close(); resolve(v); };
    const fail = (e: unknown) => { db.close(); reject(e); };
    tx.onerror = () => fail(tx.error);
    fn(tx.objectStore(STORE), done, fail);
  });
}
export async function listOfflinePacks(): Promise<OfflinePack[]> {
  return transaction('readonly', (store, done, fail) => {
    const req = store.getAll(); req.onsuccess = () => done((req.result as OfflinePack[]).sort((a, b) => b.savedAt - a.savedAt)); req.onerror = () => fail(req.error);
  });
}
export async function getOfflinePack(key: string): Promise<OfflinePack | null> {
  return transaction('readonly', (store, done, fail) => {
    const req = store.get(key); req.onsuccess = () => done(req.result ?? null); req.onerror = () => fail(req.error);
  });
}
export async function putOfflinePack(pack: OfflinePack): Promise<void> {
  if (pack.stops.length > 40 || pack.stops.some(s => s.lodges.length > 100) || pack.prices.length > 3000) throw new Error('snapshot too large');
  const existing = await listOfflinePacks();
  if (!existing.some(x => x.key === pack.key) && existing.filter(x => x.owner === pack.owner).length >= MAX_PACKS) throw new Error('too many saved routes');
  return transaction('readwrite', (store, done, fail) => {
    const req = store.put(pack); req.onsuccess = () => done(); req.onerror = () => fail(req.error);
  });
}
export async function deleteOfflinePack(key: string): Promise<void> {
  return transaction('readwrite', (store, done, fail) => {
    const req = store.delete(key); req.onsuccess = () => done(); req.onerror = () => fail(req.error);
  });
}
export async function clearOfflinePacks(): Promise<void> {
  return transaction('readwrite', (store, done, fail) => {
    const req = store.clear(); req.onsuccess = () => done(); req.onerror = () => fail(req.error);
  });
}
/** Even a saved price cannot be displayed after the server-authorized expiry. */
export function visibleOfflinePrices(pack: OfflinePack, now = Date.now()): OfflinePrice[] {
  return now < pack.pricesExpireAt && now >= pack.savedAt ? pack.prices : [];
}
export function packIsCurrent(pack: OfflinePack, now = Date.now()): boolean {
  return now < pack.pricesExpireAt && now - pack.savedAt < 24 * 60 * 60 * 1000;
}

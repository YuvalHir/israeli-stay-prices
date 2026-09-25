import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { OFFLINE_ROUTES } from '../lib/offlineRoutes';
import { visibleOfflinePrices, packIsCurrent, type OfflinePack } from '../lib/offlinePack';
import { offlineNearby } from '../lib/offlineNearby';
assert.ok(OFFLINE_ROUTES.some(r => r.key === 'gokyo-two-passes'));
for (const r of OFFLINE_ROUTES) {
  assert.ok(r.stops.length >= 2 && r.stops.length <= 30);
  assert.ok(r.stops.every(s => s.lat > 26 && s.lat < 31 && s.lon > 80 && s.lon < 89));
}
const p = { key: 'r', name: 'Trek', savedAt: 1000, pricesExpireAt: 2000, stops: [], prices: [{ placeId: 'p', price: 300, currency: 'NPR', room: 'private' as const, beds: 3, israeliDeal: 0 }], trekDays: 1, creditsUsed: 1 } satisfies OfflinePack;
assert.equal(visibleOfflinePrices(p, 1500).length, 1);
assert.equal(visibleOfflinePrices(p, 2000).length, 0);
assert.equal(packIsCurrent(p, 1500), true);
const locationPack = { ...p, owner: 'owner@example.com', stops: [{ name: 'Stop', lat: 27.717, lon: 85.324, lodges: [
  { id: 'p', name: 'Lodge', kind: 'guest_house', lat: 27.718, lon: 85.324, reports: 1 },
  { id: 'far', name: 'Far', kind: 'guest_house', lat: 27.77, lon: 85.324, reports: 1 },
] }] };
assert.equal(offlineNearby([locationPack], 'owner@example.com', 27.717, 85.324, 1500).length, 1);
assert.equal(offlineNearby([locationPack], 'owner@example.com', 27.717, 85.324, 1500)[0].prices.length, 1);
assert.equal(offlineNearby([locationPack], 'other@example.com', 27.717, 85.324, 1500).length, 0);
assert.equal(offlineNearby([locationPack], null, 27.717, 85.324, 1500).length, 0);
assert.equal(offlineNearby([locationPack], 'owner@example.com', 27.717, 85.324, 2000)[0].prices.length, 0);
const result = execFileSync('python3', ['-c', `
import sqlite3,pathlib,uuid
c=sqlite3.connect(':memory:');c.execute('PRAGMA foreign_keys=ON')
for p in sorted(pathlib.Path('migrations').glob('*.sql')):c.executescript(p.read_text())
c.execute("INSERT INTO users(id,email) VALUES('u','u@example.com')")
c.execute("INSERT INTO reports(id,user_id,place_id,place_name,price,currency,room,stay_month) VALUES('r','u','p','P',100,'NPR','private','2026-09')");c.commit()
q='''INSERT OR IGNORE INTO offline_route_searches (id,user_id,route_key,request_id,stops_hash,expires_at)
SELECT ?1,?2,?3,?4,?5,?6 WHERE ((SELECT COUNT(*) FROM reports WHERE user_id=?2)+(SELECT COUNT(*) FROM report_votes v JOIN reports r ON r.id=v.report_id WHERE v.user_id=?2 AND v.vote=1 AND r.user_id<>?2))*?7 > ((SELECT COUNT(*) FROM searches WHERE user_id=?2)+(SELECT COUNT(*) FROM offline_route_searches WHERE user_id=?2))'''
for i in range(5):
 assert c.execute(q,(str(uuid.uuid4()),'u','ebc',str(uuid.uuid4()),'hash','2026-11-10',5)).rowcount==1
assert c.execute(q,(str(uuid.uuid4()),'u','ebc',str(uuid.uuid4()),'hash','2026-11-10',5)).rowcount==0
assert c.execute('select count(*) from offline_route_searches').fetchone()[0]==5
print('offline credit constraint passed')
`], { encoding: 'utf8' });
assert.match(result, /offline credit constraint passed/);
console.log('offline tests passed');

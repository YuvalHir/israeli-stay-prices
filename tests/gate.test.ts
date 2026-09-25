// Run: npx tsx tests/gate.test.ts
import assert from 'node:assert/strict';
import { searchCovers, searchValid } from '../lib/gate';

// Fake D1: one fresh search at Thamel, Kathmandu.
const db = { prepare: () => ({ bind: (id: string, user: string) => ({ first: async () => (id === 's1' && user === 'u1' ? { lat: 27.715, lon: 85.312 } : null) }) }) } as any;

(async () => {
  assert.equal(await searchCovers(db, 'u1', 's1', 27.716, 85.313), true, 'place inside the circle is covered');
  assert.equal(await searchCovers(db, 'u1', 's1', 27.99, 86.9), false, 'place far away is not covered');
  assert.equal(await searchCovers(db, 'u1', 's1', null, null), false, 'unknown location is not covered');
  assert.equal(await searchCovers(db, 'u1', 's1', NaN, 85.3), false, 'bad coordinates are not covered');
  assert.equal(await searchCovers(db, 'u2', 's1', 27.716, 85.313), false, "another user's search does not count");
  assert.equal(await searchCovers(db, 'u1', undefined, 27.716, 85.313), false, 'no search, no prices');
  assert.equal(await searchCovers(db, 'u1', undefined, null, null, true), true, 'admin sees everything');
  assert.equal(await searchValid(db, 'u1', 's1'), true);
  assert.equal(await searchValid(db, 'u1', 'nope'), false);
  console.log('gate tests passed');
})();

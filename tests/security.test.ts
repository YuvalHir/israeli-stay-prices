// Run: npx tsx tests/security.test.ts
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { readJson, sameOrigin, validCoord, clientIp } from '../lib/security';

const APP = 'https://israeli-stay-prices.hyuval1511.workers.dev';
const req = (body: string, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new NextRequest(APP + '/api/x', { method: 'POST', body, headers });

(async () => {
  assert.deepEqual(await readJson(req('{"a":1}')), { a: 1 });
  assert.equal(await readJson(req('{bad')), null, 'bad JSON');
  assert.equal(await readJson(req('[1,2]')), null, 'arrays are refused');
  assert.equal(await readJson(req('null')), null, 'null is refused');
  assert.equal(await readJson(req('{"a":1}', { 'content-type': 'text/plain' })), null, 'non-JSON content type');
  assert.equal(sameOrigin(req('{}', { origin: APP }), APP), true);
  assert.equal(sameOrigin(req('{}', { origin: 'https://evil.example' }), APP), false, 'cross-site write');
  assert.equal(sameOrigin(req('{}'), APP), true, 'no Origin (same-origin in old browsers)');
  assert.equal(validCoord(27.7, 85.3), true);
  assert.equal(validCoord(91, 0), false);
  assert.equal(validCoord('27' as unknown, 85), false);
  assert.equal(clientIp(req('{}', { 'x-forwarded-for': '6.6.6.6' })), '0.0.0.0', 'X-Forwarded-For is ignored');
  assert.equal(clientIp(req('{}', { 'cf-connecting-ip': '1.2.3.4' })), '1.2.3.4');
  console.log('security tests passed');
})();

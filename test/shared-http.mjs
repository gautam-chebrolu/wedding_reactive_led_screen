// Optional real-HTTP check: node test/shared-http.mjs (opens only an ephemeral localhost port).
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
const directory = await mkdtemp(path.join(tmpdir(), 'afterglow-http-'));
const app = await createAppServer({ directory, setupKey: 'http-test-setup-key' });
let base, abort;
const request = (route, token, method = 'GET', data) => fetch(base + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
try {
  await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await request('/')).status, 200); assert.equal((await request('/api/portraits')).status, 200);
  assert.equal((await request('/server/show-store.js')).status, 404); assert.equal((await request('/.afterglow-data/anything')).status, 404);
  const created = await request('/api/shows', null, 'POST', { name: 'HTTP test', password: 'http-test-password', setupKey: 'http-test-setup-key' });
  assert.equal(created.status, 201); const room = await created.json(), endpoint = `/api/shows/${room.id}`;
  assert.equal((await request(endpoint, room.wallKey, 'PATCH', { blackout: true })).status, 403);
  abort = new AbortController();
  const stream = await fetch(base + endpoint + '/events', { headers: { Authorization: `Bearer ${room.wallKey}` }, signal: abort.signal });
  const reader = stream.body.getReader(), decoder = new TextDecoder(); let events = decoder.decode((await reader.read()).value);
  assert.ok(events.includes('event: state'));
  assert.equal((await request(endpoint, room.token, 'PATCH', { settings: { scene: 'dvd' }, blackout: true })).status, 200);
  while (!events.includes('"blackout":true')) events += decoder.decode((await reader.read()).value);
  assert.ok(events.includes('"scene":"dvd"'));
  const login = await request(endpoint + '/login', null, 'POST', { password: 'http-test-password' }); assert.equal(login.status, 200);
  console.log('PASS: real HTTP static routes, protected storage, password login, read-only wall, and live SSE changes.');
} finally {
  abort?.abort(); app.close(); app.server.closeAllConnections?.(); await rm(directory, { recursive: true, force: true });
}

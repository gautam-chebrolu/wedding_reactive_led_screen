import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ShowAPI, RateLimit } from '../server/show-api.js';
import { ShowStore } from '../server/show-store.js';
import { RedisShowStore } from '../server/redis-store.js';
import { initialShowState, validateShowPatch, applyShowPatch, sceneAt, portraitAt } from '../src/show-state.js';
import { mergePatches, SharedShow } from '../src/show-client.js';
import { TapClock } from '../src/beat.js';

class Response extends EventEmitter {
  constructor() { super(); this.status = 200; this.headers = {}; this.chunks = []; this.writableLength = 0; }
  writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); this.headersSent = true; return this; }
  write(data) { this.chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data)); }
  end(data) { if (data) this.write(data); this.ended = true; this.emit('close'); }
  destroy() { this.end(); }
  get bytes() { return Buffer.concat(this.chunks); }
  get json() { return JSON.parse(this.bytes.toString()); }
}
async function fixture(run, { polling = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'afterglow-show-'));
  const api = new ShowAPI({ directory, setupKey: 'server-setup-key', polling }); await api.init();
  const call = async (pathname, { method = 'GET', body, token, headers = {} } = {}) => {
    const req = { method, body, headers: { host: 'localhost', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, socket: { remoteAddress: 'test-client' } };
    const res = new Response(); await api.handle(req, res, new URL(pathname, 'http://localhost')); return res;
  };
  try { await run({ api, call, directory }); }
  finally { api.close(); await rm(directory, { recursive: true, force: true }); }
}
const create = call => call('/api/shows', { method: 'POST', body: { name: 'Wedding', password: 'a-good-show-password', setupKey: 'server-setup-key' } });

test('show creation and password login enforce server-side authentication without leaking hashes', () => fixture(async ({ api, call, directory }) => {
  assert.equal((await call('/api/shows', { method: 'POST', body: { name: 'No', password: 'a-good-show-password' } })).status, 403);
  const created = await create(call); assert.equal(created.status, 201); const room = created.json;
  assert.equal((await call(`/api/shows/${room.id}`)).status, 401);
  assert.equal((await call(`/api/shows/${room.id}/login`, { method: 'POST', body: { password: 'incorrect' } })).status, 401);
  const loggedIn = await call(`/api/shows/${room.id}/login`, { method: 'POST', body: { password: 'a-good-show-password' } }); assert.equal(loggedIn.status, 200);
  assert.ok(!created.bytes.includes(Buffer.from('passwordHash'))); assert.ok(!loggedIn.bytes.includes(Buffer.from('sessionKey')));
  const stored = await readFile(path.join(directory, `show-${room.id}.json`), 'utf8'); assert.ok(!stored.includes('a-good-show-password'));
  const other = await api.store.create('Other show', 'another-good-password');
  assert.equal((await call(`/api/shows/${other.id}`, { token: room.token })).status, 401);
  assert.throws(() => api.store.role(api.store.get(room.id), room.token, Date.now() + 13 * 3600000), /Sign in/);
}));

test('wall access is read-only, while two controllers can merge independent settings', () => fixture(async ({ call }) => {
  const room = (await create(call)).json, endpoint = `/api/shows/${room.id}`;
  const wall = await call(endpoint, { token: room.wallKey }); assert.equal(wall.status, 200); assert.equal(wall.json.wallKey, undefined);
  assert.equal((await call(endpoint, { method: 'PATCH', token: room.wallKey, body: { blackout: true } })).status, 403);
  await Promise.all([
    call(endpoint, { method: 'PATCH', token: room.token, body: { settings: { scene: 'dvd' } } }),
    call(endpoint, { method: 'PATCH', token: room.token, body: { settings: { brightness: 0.35 } } })
  ]);
  const latest = (await call(endpoint, { token: room.wallKey })).json;
  assert.equal(latest.state.settings.scene, 'dvd'); assert.equal(latest.state.settings.brightness, 0.35); assert.equal(latest.revision, 3);
  assert.equal((await call(endpoint, { method: 'PATCH', token: room.token, body: { owner: 'attacker' } })).status, 400);
  assert.equal((await call(endpoint, { method: 'PATCH', token: room.token, body: { settings: { brightness: 4000 } } })).status, 400);
  assert.equal((await call(endpoint, { method: 'PATCH', token: room.token, headers: { origin: 'https://attacker.example' }, body: { blackout: true } })).status, 403);
}));

test('SSE delivers initial state, blackout and cues, and reconnect sends the latest snapshot', () => fixture(async ({ call }) => {
  const room = (await create(call)).json, endpoint = `/api/shows/${room.id}`;
  const wall = await call(`${endpoint}/events`, { token: room.wallKey }); assert.equal(wall.headers['Content-Type'], 'text/event-stream');
  await call(endpoint, { method: 'PATCH', token: room.token, body: { blackout: true, cue: { type: 'reset-dvd', id: 'test-cue-123456' } } });
  assert.ok(wall.bytes.toString().includes('"blackout":true')); assert.ok(wall.bytes.toString().includes('test-cue-123456'));
  wall.end();
  const reconnected = await call(`${endpoint}/events`, { token: room.wallKey }); assert.ok(reconnected.bytes.toString().includes('"revision":2')); reconnected.end();
}));

test('Vercel transport chooses short polling and snapshots include wall telemetry', () => fixture(async ({ call }) => {
  const room = (await create(call)).json, endpoint = `/api/shows/${room.id}`;
  assert.equal((await call(`${endpoint}/events`, { token: room.wallKey })).json.transport, 'poll');
  assert.equal((await call(`${endpoint}/telemetry`, { method: 'POST', token: room.token, body: { level: 0.5 } })).status, 403);
  await call(`${endpoint}/telemetry`, { method: 'POST', token: room.wallKey, body: { level: 0.7, cameraReady: true, audioMode: 'microphone' } });
  const latest = (await call(endpoint, { token: room.token })).json; assert.equal(latest.telemetry.level, 0.7); assert.equal(latest.telemetry.cameraReady, true);
}, { polling: true }));

test('shared image uploads require controller access and are retrievable only through show authentication', () => fixture(async ({ call }) => {
  const room = (await create(call)).json, endpoint = `/api/shows/${room.id}`;
  const photo = await readFile(new URL('../assets/portraits/gautam.jpg', import.meta.url));
  assert.equal((await call(`${endpoint}/portraits`, { method: 'POST', token: room.wallKey, body: photo })).status, 403);
  assert.equal((await call(`${endpoint}/portraits`, { method: 'POST', token: room.token, body: Buffer.from('<svg/>') })).status, 400);
  const uploaded = await call(`${endpoint}/portraits`, { method: 'POST', token: room.token, body: photo, headers: { 'x-portrait-name': 'Gautam.jpg' } });
  assert.equal(uploaded.status, 201); assert.equal(uploaded.json.state.settings.portraitId, uploaded.json.portrait.id);
  const src = uploaded.json.portrait.src; assert.equal((await call(src)).status, 401);
  const received = await call(src, { token: room.wallKey }); assert.ok(received.bytes.equals(photo)); assert.equal(received.headers['Content-Type'], 'image/jpeg');
}));

test('saved settings and login credentials survive standalone server restarts', () => fixture(async ({ api, call, directory }) => {
  const room = (await create(call)).json;
  await api.store.patch(room.id, { settings: { palette: 'rose' }, blackout: true });
  const restored = new ShowStore(directory); await restored.init();
  assert.equal(restored.get(room.id).state.settings.palette, 'rose'); assert.equal(restored.get(room.id).state.blackout, true);
  assert.equal(restored.role(restored.get(room.id), room.token), 'control'); assert.ok(await restored.login(room.id, 'a-good-show-password'));
}));

test('shared timelines agree after late joins, and unrelated changes do not restart cycling', () => {
  const start = 100000, state = initialShowState({ autoCycle: true, cycleSeconds: 15, portraitCycle: true, portraitCycleSeconds: 6 }, start);
  assert.equal(sceneAt(state, start + 30000, false), 'kaleidoscope');
  assert.equal(portraitAt(state, ['a', 'b', 'c'], start + 13000), 'c');
  const changed = applyShowPatch(state, { settings: { brightness: 0.4 } }, start + 31000);
  assert.equal(changed.sceneAnchor, start); assert.equal(changed.portraitAnchor, start);
  assert.equal(sceneAt(changed, start + 30000, false), sceneAt(state, start + 30000, false));
  const chosen = applyShowPatch(changed, { settings: { scene: 'dvd' } }, start + 31000);
  assert.equal(chosen.sceneAnchor, start + 31000);
  assert.throws(() => validateShowPatch({ tempo: { bpm: 10000, anchorAt: Date.now() } }));
});

test('queued controller patches preserve newer edits and each person’s calibration', () => {
  const patch = mergePatches({ settings: { brightness: 0.4, portraitMouths: { a: { mouthY: 0.3 } } } }, { settings: { brightness: 0.8, palette: 'rose', portraitMouths: { b: { mouthY: 0.5 } } } });
  assert.equal(patch.settings.brightness, 0.8); assert.equal(patch.settings.palette, 'rose'); assert.equal(Object.keys(patch.settings.portraitMouths).length, 2);
  const client = new SharedShow(); client.session = { role: 'wall' }; client.publish({ blackout: true }); assert.deepEqual(client.pending, {});
  const clock = new TapClock(); clock.setTempo(120, 1000); assert.equal(clock.update(2500).beatInBar, 4);
});

test('failed login attempts are rate limited and stale snapshots cannot replace newer settings', () => {
  const limiter = new RateLimit(); limiter.take('login:test', 2, 60000); limiter.take('login:test', 2, 60000);
  assert.throws(() => limiter.take('login:test', 2, 60000), error => error.status === 429);
  const client = new SharedShow();
  client.receive({ id: 'test', revision: 3, serverTime: Date.now(), state: initialShowState({ brightness: 0.4 }, Date.now()) });
  client.receive({ id: 'test', revision: 2, serverTime: Date.now(), state: initialShowState({ brightness: 0.9 }, Date.now()) });
  assert.equal(client.state.settings.brightness, 0.4);
  client.disconnect(); assert.equal(client.state, null);
});

test('Redis compare-and-set retries preserve a concurrent operator’s change', async () => {
  const room = { id: 'a'.repeat(32), revision: 1, updatedAt: 0, state: initialShowState({}, 0) }; let raw = JSON.stringify(room), conflicts = 0;
  const store = new RedisShowStore({ url: 'https://test.upstash.io', token: 'test' });
  store.command = async (command, ...args) => {
    if (command === 'GET') return raw;
    if (command === 'EVAL') {
      if (!conflicts++) { const other = JSON.parse(raw); other.state.settings.palette = 'rose'; other.revision++; raw = JSON.stringify(other); return 0; }
      const expected = args[3], updated = args[4];
      if (raw === expected) { raw = updated; return 1; } return 0;
    }
  };
  const updated = await store.patch(room.id, { settings: { scene: 'dvd' } });
  assert.equal(updated.state.settings.scene, 'dvd'); assert.equal(updated.state.settings.palette, 'rose'); assert.equal(updated.revision, 3);
});

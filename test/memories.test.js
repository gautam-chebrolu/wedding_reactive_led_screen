import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAlbum, MAX_MEMORIES } from '../src/memories.js';
import { MemorySequence, MemoriesScene, memoryPlacement, MAX_MEMORY_LAYERS } from '../src/scenes/memories.js';
import { sanitizeSettings } from '../src/settings.js';
import { initialShowState, sceneAt, validateShowPatch } from '../src/show-state.js';
import { handlePhotoAPI } from '../server/photo-api.js';
import { seededRandom } from '../src/math.js';

const image = { naturalWidth: 640, naturalHeight: 800 };
const items = Array.from({ length: 15 }, (_, i) => ({ id: `photo-${i}`, image }));
const page = (items, next = null, galleryEnabled = true) => new Response(JSON.stringify({ items, next, galleryEnabled }), { headers: { 'Content-Type': 'application/json' } });

test('default photo fetch preserves the browser global receiver', async () => {
  const original = globalThis.fetch; let requests = 0;
  globalThis.fetch = function () {
    assert.equal(this, globalThis, 'Window.fetch must not receive the MemoryAlbum instance'); requests++;
    return Promise.resolve(page([{ id: 'approved' }]));
  };
  try {
    const album = new MemoryAlbum({ loadImage: async () => image });
    await album.refresh(0);
    assert.equal(requests, 1); assert.equal(album.state, 'ready'); assert.equal(album.items.length, 1);
  } finally { globalThis.fetch = original; }
});

test('empty canvas distinguishes connection failures from a closed album', () => {
  const messages = [], ctx = new Proxy({ createRadialGradient: () => ({ addColorStop() {} }), fillText: text => messages.push(text) }, { get: (obj, key) => obj[key] || (() => {}) });
  const scene = new MemoriesScene(), settings = sanitizeSettings(null);
  const frame = { ctx, width: 1920, height: 1080, time: 0, audio: { beat: false, beatCount: 0 }, settings };
  scene.render({ ...frame, memories: { items: [], state: 'error' } });
  assert.ok(messages.some(text => text.includes('couldn’t load')));
  assert.ok(messages.some(text => text.includes('Refresh photos')));
  messages.length = 0;
  scene.render({ ...frame, memories: { items: [], state: 'closed' } });
  assert.ok(messages.some(text => text.includes('album is resting')));
});

test('album follows empty pages, encodes cursors, deduplicates records and retries broken photos', async () => {
  const calls = [], loads = []; let broken = true;
  const album = new MemoryAlbum({
    fetcher: async url => { calls.push(url); return calls.length % 2 ? page([], 'page + 2') : page([{ id: 'a' }, { id: 'a' }, { id: 'b' }, { id: '../secret' }]); },
    loadImage: async src => { loads.push(src); if (src.endsWith('/b') && broken) throw new Error('Unavailable'); return image; }
  });
  await album.refresh(0);
  assert.equal(calls[1], '/api/memories/gallery?cursor=page%20%2B%202');
  assert.deepEqual(album.items.map(item => item.id), ['a']);
  assert.match(album.status, /1 unavailable/); assert.equal(loads.length, 2);
  broken = false; await album.refresh(30000);
  assert.deepEqual(album.items.map(item => item.id), ['a', 'b']);
  assert.equal(loads.filter(url => url.endsWith('/a')).length, 1, 'Retained thumbnails are reused');
});

test('successful polls remove revoked photos, closure clears the wall, and outages retain the last album', async () => {
  let response = () => page([{ id: 'a' }, { id: 'b' }]);
  const album = new MemoryAlbum({ fetcher: async () => response(), loadImage: async () => image });
  await album.refresh(0); assert.equal(album.items.length, 2);
  response = () => { throw new Error('Offline'); }; await album.refresh(30000);
  assert.equal(album.items.length, 2); assert.match(album.status, /Offline/);
  response = () => page([{ id: 'b' }]); await album.refresh(60000);
  assert.deepEqual(album.items.map(item => item.id), ['b']);
  response = () => page([], null, false); await album.refresh(90000);
  assert.deepEqual(album.items, []); assert.match(album.status, /closed/);
});

test('photo decoding has bounded concurrency and storage; stopping ignores late results', async () => {
  let active = 0, peak = 0, resolve;
  const album = new MemoryAlbum({ fetcher: async () => page(Array.from({ length: 200 }, (_, i) => ({ id: `p${i}` }))), loadImage: async () => {
    peak = Math.max(peak, ++active); await new Promise(resolve => setImmediate(resolve)); active--; return image;
  } });
  await album.refresh(0); assert.equal(album.items.length, MAX_MEMORIES); assert.equal(peak, 4);
  const late = new MemoryAlbum({ fetcher: async () => page([{ id: 'a' }]), loadImage: () => new Promise(done => { resolve = done; }) });
  const pending = late.refresh(0); while (!resolve) await new Promise(done => setImmediate(done));
  late.stop(); resolve(image); await pending; assert.equal(late.items.length, 0);
});

function step(sequence, time, beatCount, settings, beat = true, photos = items) {
  return sequence.update(photos, time, { beat, beatCount }, settings);
}
test('photos arrive every four distinct beats, grow beyond the old slot count, and recover from silence', () => {
  const sequence = new MemorySequence(), settings = sanitizeSettings({ memoryCount: '6' });
  assert.equal(step(sequence, 0, 0, settings, false), true);
  const first = sequence.cards[0].id;
  for (let beat = 1; beat <= 24; beat++) {
    assert.equal(step(sequence, beat / 2, beat, settings), beat % 4 === 0);
    assert.equal(step(sequence, beat / 2 + 0.01, beat, settings), false, 'A repeated telemetry beat is counted once');
    assert.equal(new Set(sequence.cards.map(card => card.id)).size, sequence.cards.length);
  }
  assert.equal(sequence.cards.length, 7);
  assert.equal(sequence.cards[0].id, first, 'Early prints stay under the new arrivals');
  for (let time = 12.05; time < 18; time += 0.05) step(sequence, time, 24, settings, false);
  assert.equal(step(sequence, 18.1, 24, settings, false), true, 'Silence uses the timed fallback');
  sequence.update(items.slice(10), 18.2, { beat: false, beatCount: 24 }, settings);
  assert.ok(sequence.cards.every(card => Number(card.id.split('-')[1]) >= 10), 'Revoked cards disappear immediately');
});

test('photo passes shuffle independently, show each photo once, and avoid adjacent repeats', () => {
  const sequence = new MemorySequence(seededRandom(73)), settings = sanitizeSettings({ memoryBeats: '1' });
  const order = [];
  for (let beat = 0; beat < items.length * 2; beat++) {
    step(sequence, beat * 0.5, beat, settings);
    order.push(sequence.cards.at(-1).id);
  }
  const first = order.slice(0, items.length), second = order.slice(items.length);
  assert.deepEqual([...first].sort(), items.map(item => item.id).sort());
  assert.deepEqual([...second].sort(), [...first].sort());
  assert.notDeepEqual(first, items.map(item => item.id));
  assert.notDeepEqual(first, second);
  assert.ok(order.every((id, index) => index === 0 || id !== order[index - 1]));
});

test('album refreshes preserve the shuffle pass, include new approvals, and drop removed photos', () => {
  const sequence = new MemorySequence(seededRandom(44)), settings = sanitizeSettings({ memoryBeats: '1' });
  step(sequence, 0, 0, settings, false, items.slice(0, 4));
  const first = sequence.cards.at(-1).id;
  const updated = items.slice(0, 5).filter(item => item.id !== first).reverse();
  const order = [];
  for (let beat = 1; beat <= updated.length; beat++) {
    step(sequence, beat * 0.5, beat, settings, true, updated);
    order.push(sequence.cards.at(-1).id);
  }
  assert.deepEqual([...order].sort(), updated.map(item => item.id).sort());
  assert.ok(!sequence.cards.some(card => card.id === first));
});

test('gentle motion spaces fast beats apart and scene re-entry does not dump missed photos', () => {
  const sequence = new MemorySequence(), settings = sanitizeSettings({ memoryBeats: '1', reducedMotion: true });
  step(sequence, 0, 0, settings, false);
  for (let i = 1; i < 8; i++) assert.equal(step(sequence, i * 0.25, i, settings), false);
  assert.equal(step(sequence, 2, 8, settings), true);
  assert.equal(step(sequence, 100, 500, settings), false);
  assert.equal(sequence.cards.length, 2);
});

test('every-beat mode follows fast music, while slow music waits for all eight beats', () => {
  const fast = new MemorySequence(), fastSettings = sanitizeSettings({ memoryBeats: '1' });
  step(fast, 0, 0, fastSettings, false);
  for (let beat = 1; beat < 6; beat++) assert.equal(step(fast, beat * 0.3, beat, fastSettings), true);
  const slow = new MemorySequence(), slowSettings = sanitizeSettings({ memoryBeats: '8' });
  step(slow, 0, 0, slowSettings, false);
  for (let frame = 1; frame <= 120; frame++) {
    const time = frame / 10, beat = frame % 15 === 0;
    assert.equal(step(slow, time, Math.floor(frame / 15), slowSettings, beat), frame === 120);
  }
});

test('small albums continue piling up, and long shows retire only the deepest layers', () => {
  const sequence = new MemorySequence(), settings = sanitizeSettings({ memoryBeats: '1' });
  step(sequence, 0, 0, settings, false, items.slice(0, 2));
  for (let beat = 1; beat <= 60; beat++) step(sequence, beat * 0.5, beat, settings, true, items.slice(0, 2));
  assert.equal(sequence.cards.length, MAX_MEMORY_LAYERS);
  assert.equal(sequence.cards.at(-1).arrival, 60);
  assert.equal(sequence.cards[0].arrival, 61 - MAX_MEMORY_LAYERS);
  assert.notEqual(sequence.cards.at(-1).id, sequence.cards.at(-2).id);
});

test('large overlapping prints preserve proportions across wall ratios and size controls', () => {
  for (const [width, height] of [[720, 1280], [1920, 1080], [3840, 1080], [8000, 360]]) {
    for (const size of ['6', '9', '12']) {
      for (let arrival = 0; arrival < 40; arrival++) {
        for (const ratio of [0.3, 0.8, 1.5, 3]) {
          const print = memoryPlacement(width, height, arrival, size, ratio);
          assert.deepEqual(print, memoryPlacement(width, height, arrival, size, ratio));
          assert.ok(Math.abs(print.width / print.height - ratio) < 0.0001);
          assert.ok(print.x >= 0 && print.x <= width && print.y >= 0 && print.y <= height);
          assert.ok(print.height >= height * 0.70 || print.width >= width * 0.64);
        }
      }
    }
  }
  assert.ok(memoryPlacement(1920, 1080, 0, '6').height > memoryPlacement(1920, 1080, 0, '9').height);
  assert.ok(memoryPlacement(1920, 1080, 0, '9').height > memoryPlacement(1920, 1080, 0, '12').height);
});

test('canvas renders complete photos and stable gentle-motion arrivals', () => {
  const calls = [], ctx = new Proxy({ createRadialGradient: () => ({ addColorStop() {} }), drawImage: (...args) => calls.push(args) }, { get: (obj, key) => obj[key] || (() => {}) });
  const scene = new MemoriesScene(() => ({ getContext: () => ctx })), settings = sanitizeSettings({ reducedMotion: true });
  const frame = { ctx, width: 1920, height: 1080, time: 0, audio: { beat: false, beatCount: 0 }, settings, memories: { items } };
  scene.render(frame); scene.render({ ...frame, time: 0.8 });
  const [source, , , width, height] = calls.at(-1);
  assert.equal(source, image); assert.ok(Math.abs(width / height - 0.8) < 0.0001);
});

test('photo scene and controls survive settings import and shared-show validation/cycling', () => {
  const settings = sanitizeSettings({ scene: 'memories', memoryBeats: '8', memoryCount: '12' });
  assert.equal(settings.scene, 'memories'); assert.equal(settings.memoryCount, '12');
  assert.doesNotThrow(() => validateShowPatch({ settings: { scene: 'memories', memoryBeats: '8', memoryCount: '12' } }));
  assert.equal(sanitizeSettings({ memoryBeats: '0', memoryCount: '10000' }).memoryCount, '9');
  assert.throws(() => validateShowPatch({ settings: { memoryBeats: '0' } }));
  const state = initialShowState({ scene: 'chapel', autoCycle: true, cycleSeconds: 30 }, 0);
  assert.equal(sceneAt(state, 30000, false), 'memories');
});

function reply() { return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); }, end(body) { this.body = body; } }; }
test('read-only photo proxy uses public routes and thumbnails without forwarding credentials or destinations', async () => {
  let called = 0;
  const fetcher = async (url, options) => {
    called++; assert.equal(url.origin, 'https://priya-gautam-photos.web.app'); assert.equal(options.headers, undefined);
    assert.equal(url.pathname, '/api/photos/public/files/approved'); assert.equal(url.search, '?thumb=1');
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } });
  };
  const res = reply();
  await handlePhotoAPI({ method: 'GET', headers: { authorization: 'secret' } }, res, new URL('http://localhost/api/memories/files/approved?url=https://elsewhere'), { fetcher });
  assert.equal(res.status, 200); assert.equal(res.headers['Cache-Control'], 'no-store'); assert.equal(res.body.length, 3);
  for (const [method, path, expected] of [['POST', 'gallery', 405], ['GET', 'private', 404], ['GET', 'files/a%2Fb', 404]]) {
    const denied = reply(); await handlePhotoAPI({ method }, denied, new URL('http://localhost/api/memories/' + path), { fetcher }); assert.equal(denied.status, expected);
  }
  assert.equal(called, 1);
});

test('photo proxy rejects bad responses, preserves missing-photo status, and encodes gallery cursors', async () => {
  for (const [response, expected] of [[new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }), 503], [new Response('', { status: 404 }), 404], [new Response('', { status: 500 }), 503]]) {
    const res = reply(); await handlePhotoAPI({ method: 'GET' }, res, new URL('http://localhost/api/memories/gallery'), { fetcher: async () => response }); assert.equal(res.status, expected);
  }
  const res = reply();
  await handlePhotoAPI({ method: 'GET' }, res, new URL('http://localhost/api/memories/gallery?cursor=a%2Bb'), { fetcher: async url => { assert.equal(url.searchParams.get('cursor'), 'a+b'); return page([]); } });
  assert.equal(res.status, 200);
});

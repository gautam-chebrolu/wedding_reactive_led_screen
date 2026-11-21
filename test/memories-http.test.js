import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
import handler from '../api/handler.js';

const thumbnail = new Uint8Array([255, 216, 255, 0]);
const photoFetch = async url => url.pathname.endsWith('/gallery')
  ? new Response(JSON.stringify({ galleryEnabled: true, items: [{ id: 'test-memory' }], next: null }), { headers: { 'Content-Type': 'application/json' } })
  : new Response(thumbnail, { headers: { 'Content-Type': 'image/jpeg' } });

test('Node HTTP serves the photo bridge, scene code and controls alongside protected shared-show storage', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'afterglow-photo-http-'));
  const app = await createAppServer({ directory, photos: { fetcher: photoFetch } });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const gallery = await fetch(base + '/api/memories/gallery');
    assert.equal(gallery.status, 200); assert.equal((await gallery.json()).items[0].id, 'test-memory');
    const image = await fetch(base + '/api/memories/files/test-memory');
    assert.equal(image.status, 200); assert.deepEqual(new Uint8Array(await image.arrayBuffer()), thumbnail);
    assert.equal((await fetch(base + '/api/memories/gallery', { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '/server/photo-api.js')).status, 404);
    assert.match(await (await fetch(base + '/src/scenes/memories.js')).text(), /class MemoriesScene/);
    assert.match(await (await fetch(base + '/')).text(), /id="memoryBeats"/);
  } finally { app.close(); app.server.closeAllConnections?.(); await rm(directory, { recursive: true, force: true }); }
});

test('Vercel rewritten photo routes work without shared-show keys or Redis and preserve the cursor', async () => {
  const original = globalThis.fetch; let actual;
  globalThis.fetch = async url => { actual = url; return photoFetch(url); };
  const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); }, end(body) { this.body = body; } };
  try {
    await handler({ method: 'GET', url: '/api/handler?route=memories/gallery&cursor=next%2Bpage', query: { route: 'memories/gallery' } }, res);
    assert.equal(res.status, 200); assert.equal(actual.searchParams.get('cursor'), 'next+page');
    assert.equal(JSON.parse(res.body.toString()).galleryEnabled, true);
  } finally { globalThis.fetch = original; }
});

import { ShowStore, randomKey, safeEqual, httpError } from './show-store.js';

const MAX_IMAGE = 3 * 1024 * 1024;
export class RateLimit {
  constructor() { this.buckets = new Map(); }
  take(key, limit, windowMs) {
    const now = Date.now();
    for (const [k, value] of this.buckets) if (value.until < now) this.buckets.delete(k);
    const entry = this.buckets.get(key) || { count: 0, until: now + windowMs };
    if (entry.count >= limit || this.buckets.size > 10000) throw httpError(429, 'Too many attempts. Wait a few minutes and try again.');
    entry.count++; this.buckets.set(key, entry);
  }
}
export function imageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw httpError(400, 'Use a JPG, PNG or WebP image.');
}
export function readBody(req, maximum = 160000) {
  if (req.body !== undefined) {
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    if (bytes.length > maximum) return Promise.reject(httpError(413, 'Use portrait images smaller than 3 MB.'));
    return Promise.resolve(bytes);
  }
  return new Promise((resolve, reject) => {
    let size = 0, tooLarge = false; const chunks = [];
    req.on('data', chunk => { size += chunk.length; if (size > maximum) { tooLarge = true; chunks.length = 0; } else if (!tooLarge) chunks.push(chunk); });
    req.on('end', () => tooLarge ? reject(httpError(413, 'Use portrait images smaller than 3 MB.')) : resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function jsonBody(req) { try { return JSON.parse((await readBody(req)).toString('utf8')); } catch (error) { if (error.status) throw error; throw httpError(400, 'Invalid JSON.'); } }
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }

export class ShowAPI {
  constructor({ directory, setupKey = '', publicOrigin = '', store, polling = false }) {
    this.store = store || new ShowStore(directory); this.setupKey = setupKey; this.publicOrigin = publicOrigin; this.polling = polling;
    this.clients = new Map(); this.telemetry = new Map(); this.rate = store?.take ? store : new RateLimit();
  }
  async init() { await this.store.init(); }
  broadcast(id, event, data) {
    for (const client of this.clients.get(id) || []) {
      if (client.writableLength > 1024 * 1024) { client.destroy(); continue; }
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }
  changed(room) { this.broadcast(room.id, 'state', this.store.snapshot(room)); }
  async handle(req, res, url) {
    if (!url.pathname.startsWith('/api/shows')) return false;
    try {
      if (req.headers['sec-fetch-site'] === 'cross-site') throw httpError(403, 'Open the controller on the show website.');
      if (req.headers.origin) {
        let origin; try { origin = new URL(req.headers.origin); } catch { throw httpError(403, 'Invalid origin.'); }
        if (origin.host !== req.headers.host || (this.publicOrigin && origin.origin !== this.publicOrigin)) throw httpError(403, 'Open the controller on the show website.');
      }
      const ip = req.socket.remoteAddress || 'unknown';
      if (url.pathname === '/api/shows' && req.method === 'POST') {
        await this.rate.take(`create:${ip}`, 5, 15 * 60000);
        const body = await jsonBody(req);
        if (this.setupKey && !safeEqual(body.setupKey, this.setupKey)) throw httpError(403, 'Enter the server setup key to create a show.');
        const room = await this.store.create(body.name, body.password, body.settings);
        json(res, 201, { ...this.store.snapshot(room), token: this.store.token(room), wallKey: room.wallKey }); return true;
      }
      const match = url.pathname.match(/^\/api\/shows\/([A-Za-z0-9_-]{32})(?:\/(login|events|telemetry|portraits)(?:\/([A-Za-z0-9_-]{32}))?)?$/);
      if (!match) throw httpError(404, 'Show endpoint not found.');
      const [, id, action, assetId] = match;
      if (action === 'login' && req.method === 'POST') {
        await this.rate.take(`login:${ip}`, 20, 15 * 60000);
        const body = await jsonBody(req), token = await this.store.login(id, body.password), room = await this.store.get(id);
        json(res, 200, { ...this.store.snapshot(room), token, wallKey: room.wallKey }); return true;
      }
      const room = await this.store.get(id), token = req.headers.authorization?.replace(/^Bearer /, ''), role = this.store.role(room, token);
      if (!action && req.method === 'GET') {
        const telemetry = this.store.getTelemetry ? await this.store.getTelemetry(id) : this.telemetry.get(id);
        json(res, 200, { ...this.store.snapshot(room), telemetry: telemetry || null, ...(role === 'control' ? { wallKey: room.wallKey } : {}) }); return true;
      }
      if (action === 'events' && req.method === 'GET') {
        if (this.polling) { json(res, 200, { transport: 'poll', ...this.store.snapshot(room) }); return true; }
        const clients = this.clients.get(id) || new Set();
        if (clients.size >= 40) throw httpError(429, 'This show has too many open connections.');
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`event: state\ndata: ${JSON.stringify(this.store.snapshot(room))}\n\n`);
        if (this.telemetry.has(id)) res.write(`event: telemetry\ndata: ${JSON.stringify(this.telemetry.get(id))}\n\n`);
        clients.add(res); this.clients.set(id, clients);
        const heartbeat = setInterval(async () => {
          try { this.store.role(await this.store.get(id), token); res.write(`event: heartbeat\ndata: {"serverTime":${Date.now()}}\n\n`); }
          catch { res.end(); }
        }, 15000); heartbeat.unref();
        res.on('close', () => { clearInterval(heartbeat); clients.delete(res); if (!clients.size) this.clients.delete(id); }); return true;
      }
      if (action === 'telemetry' && req.method === 'POST') {
        if (role !== 'wall') throw httpError(403, 'Only a wall device can report its input status.');
        await this.rate.take(`telemetry:${id}`, 20, 1000);
        const body = await jsonBody(req), meter = {};
        for (const key of ['level', 'bass', 'mid', 'treble', 'pulse', 'confidence']) meter[key] = Math.max(0, Math.min(1, Number(body[key]) || 0));
        for (const key of ['bpm', 'beatCount', 'beatInBar', 'fps']) meter[key] = Math.max(0, Math.min(100000000, Number(body[key]) || 0));
        meter.cameraReady = body.cameraReady === true; meter.audioMode = ['demo', 'idle', 'microphone', 'shared', 'file'].includes(body.audioMode) ? body.audioMode : 'idle';
        meter.audioLabel = String(body.audioLabel || '').slice(0, 120); meter.at = Date.now();
        if (this.store.setTelemetry) await this.store.setTelemetry(id, meter); else this.telemetry.set(id, meter);
        this.broadcast(id, 'telemetry', meter); json(res, 200, { ok: true }); return true;
      }
      if (action === 'portraits' && assetId && req.method === 'GET') {
        const portrait = room.portraits.find(entry => entry.assetId === assetId); if (!portrait) throw httpError(404, 'Portrait not found.');
        const bytes = await this.store.readPortrait(id, assetId);
        res.writeHead(200, { 'Content-Type': portrait.type, 'Cache-Control': 'private, max-age=3600' }); res.end(bytes); return true;
      }
      if (role !== 'control') throw httpError(403, 'This is a read-only wall link. Use the controller link and show password to change settings.');
      await this.rate.take(`control:${id}:${ip}`, 80, 1000);
      if (!action && req.method === 'PATCH') {
        const updated = await this.store.patch(id, await jsonBody(req)); this.changed(updated); json(res, 200, this.store.snapshot(updated)); return true;
      }
      if (action === 'portraits' && !assetId && req.method === 'POST') {
        if (room.portraits.length >= 50) throw httpError(409, 'A shared show supports up to 50 uploaded portraits.');
        const bytes = await readBody(req, MAX_IMAGE), type = imageType(bytes), key = randomKey();
        let name; try { name = decodeURIComponent(req.headers['x-portrait-name'] || 'Portrait'); } catch { name = 'Portrait'; }
        name = name.replace(/\.[^.]+$/, '').slice(0, 80);
        const entry = { id: `shared:${key}`, assetId: key, name: name || 'Portrait', src: `/api/shows/${id}/portraits/${key}`, shared: true, type };
        await this.store.savePortrait(id, key, bytes);
        const updated = await this.store.mutate(id, current => {
          if (current.portraits.length >= 50) throw httpError(409, 'This show has reached its portrait limit.');
          current.portraits.push(entry);
          current.state = { ...current.state, settings: { ...current.state.settings, portraitId: entry.id }, portraitAnchor: Date.now() };
        });
        this.changed(updated); json(res, 201, { portrait: entry, ...this.store.snapshot(updated) }); return true;
      }
      throw httpError(405, 'Method not allowed.');
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'The show server could not complete this request.' });
      else res.end();
      return true;
    }
  }
  close() { for (const clients of this.clients.values()) for (const client of clients) client.end(); }
}

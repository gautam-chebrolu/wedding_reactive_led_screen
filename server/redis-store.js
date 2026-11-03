import { ShowStore, httpError } from './show-store.js';

// Redis REST works in Vercel Functions without a persistent socket or an SDK dependency.
export class RedisShowStore extends ShowStore {
  constructor({ url, token, prefix = 'afterglow:' }) { super(''); this.url = url; this.redisToken = token; this.prefix = prefix; }
  async command(...command) {
    const response = await fetch(this.url, { method: 'POST', headers: { Authorization: `Bearer ${this.redisToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw httpError(503, 'Show storage is unavailable. The wall will keep its last settings.');
    const data = await response.json();
    if (data.error) throw httpError(503, 'Show storage rejected the request. Check the server’s Redis configuration.');
    return data.result;
  }
  async init() {
    if (!this.url?.startsWith('https://') || !this.redisToken) throw new Error('Connect an Upstash Redis store in Vercel Storage and set KV_REST_API_URL / KV_REST_API_TOKEN (or their UPSTASH_REDIS_REST equivalents).');
  }
  async get(id) { const raw = await this.command('GET', `${this.prefix}show:${id}`); if (!raw) throw httpError(404, 'Show not found. Check your show link.'); return JSON.parse(raw); }
  async save(room) {
    const script = 'if tonumber(redis.call("GET", KEYS[2]) or "0") >= 100 then return -1 end; if redis.call("EXISTS", KEYS[1]) == 1 then return 0 end; redis.call("SET", KEYS[1], ARGV[1]); redis.call("INCR", KEYS[2]); return 1';
    const saved = await this.command('EVAL', script, 2, `${this.prefix}show:${room.id}`, `${this.prefix}show-count`, JSON.stringify(room));
    if (saved !== 1) throw httpError(409, 'This server has reached its show limit.');
  }
  async login(id, password) {
    const room = await this.get(id);
    // Reuse the same scrypt/password and session-signing code as the local server.
    const local = new ShowStore(''); local.rooms.set(id, room); return local.login(id, password);
  }
  async mutate(id, update) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const key = `${this.prefix}show:${id}`, raw = await this.command('GET', key);
      if (!raw) throw httpError(404, 'Show not found.');
      const room = JSON.parse(raw); await update(room); room.revision++; room.updatedAt = Date.now();
      const saved = await this.command('EVAL', 'if redis.call("GET", KEYS[1]) == ARGV[1] then redis.call("SET", KEYS[1], ARGV[2]); return 1 else return 0 end', 1, key, raw, JSON.stringify(room));
      if (saved === 1) return room;
    }
    throw httpError(409, 'Another controller is updating this show. Please try that change again.');
  }
  async savePortrait(id, key, bytes) { await this.command('SET', `${this.prefix}portrait:${id}:${key}`, bytes.toString('base64')); }
  async readPortrait(id, key) { const data = await this.command('GET', `${this.prefix}portrait:${id}:${key}`); if (!data) throw httpError(404, 'Portrait not found.'); return Buffer.from(data, 'base64'); }
  async setTelemetry(id, data) { await this.command('SET', `${this.prefix}telemetry:${id}`, JSON.stringify(data), 'EX', 20); }
  async getTelemetry(id) { const data = await this.command('GET', `${this.prefix}telemetry:${id}`); return data ? JSON.parse(data) : null; }
  async take(key, limit, windowMs) {
    const count = await this.command('EVAL', 'local n = redis.call("INCR", KEYS[1]); if n == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end; return n', 1, `${this.prefix}limit:${key}`, windowMs);
    if (count > limit) throw httpError(429, 'Too many attempts. Wait a few minutes and try again.');
  }
}

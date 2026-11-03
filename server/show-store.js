import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { initialShowState, applyShowPatch, validateShowPatch } from '../src/show-state.js';

const scrypt = promisify(scryptCallback);
export const randomKey = () => randomBytes(24).toString('base64url');
export const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length > 4096 || b.length > 4096) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export function httpError(status, message) { return Object.assign(new Error(message), { status }); }

export class ShowStore {
  constructor(directory) { this.directory = directory; this.rooms = new Map(); this.locks = new Map(); }
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    for (const file of await readdir(this.directory)) {
      if (!/^show-[A-Za-z0-9_-]{32}\.json$/.test(file)) continue;
      const room = JSON.parse(await readFile(path.join(this.directory, file), 'utf8'));
      if (room.version !== 1 || !room.id || !room.passwordHash || !room.sessionKey) throw new Error('A saved show is invalid. Restore the show data directory from a backup.');
      this.rooms.set(room.id, room);
    }
  }
  get(id) { const room = this.rooms.get(id); if (!room) throw httpError(404, 'Show not found. Check your show link.'); return room; }
  async save(room) {
    const filename = path.join(this.directory, `show-${room.id}.json`), temporary = `${filename}.${randomKey()}.tmp`;
    await writeFile(temporary, JSON.stringify(room), { mode: 0o600 }); await rename(temporary, filename);
    this.rooms.set(room.id, room);
  }
  async create(name, password, settings) {
    if (this.rooms.size >= 100) throw httpError(409, 'This server has reached its 100-show limit.');
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw httpError(400, 'Use a show password of 10–128 characters.');
    if (typeof name !== 'string' || !name.trim() || name.length > 80) throw httpError(400, 'Use a show name of 1–80 characters.');
    const salt = randomKey(), hash = await scrypt(password, salt, 32), now = Date.now();
    const room = { version: 1, id: randomKey(), name: name.trim(), salt, passwordHash: hash.toString('hex'), sessionKey: randomKey(), wallKey: randomKey(), state: initialShowState(settings, now), revision: 1, updatedAt: now, portraits: [] };
    await this.save(room); return room;
  }
  async login(id, password) {
    const room = this.get(id);
    if (typeof password !== 'string' || password.length > 128) throw httpError(401, 'Incorrect show password.');
    const hash = (await scrypt(password, room.salt, 32)).toString('hex');
    if (!safeEqual(hash, room.passwordHash)) throw httpError(401, 'Incorrect show password.');
    return this.token(room);
  }
  token(room, now = Date.now()) {
    const payload = Buffer.from(JSON.stringify({ show: room.id, role: 'control', expires: now + 12 * 3600000, nonce: randomKey() })).toString('base64url');
    const signature = createHmac('sha256', room.sessionKey).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }
  role(room, token, now = Date.now()) {
    if (!token || token.length > 2048) throw httpError(401, 'Sign in to this show again.');
    if (safeEqual(token, room.wallKey)) return 'wall';
    try {
      const [payload, signature, extra] = token.split('.');
      if (extra || !safeEqual(signature, createHmac('sha256', room.sessionKey).update(payload).digest('base64url'))) throw new Error();
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (data.show !== room.id || data.role !== 'control' || data.expires <= now) throw new Error();
      return 'control';
    } catch { throw httpError(401, 'Sign in to this show again.'); }
  }
  snapshot(room) { return { id: room.id, name: room.name, revision: room.revision, updatedAt: room.updatedAt, serverTime: Date.now(), state: room.state, portraits: room.portraits }; }
  async savePortrait(id, key, bytes) { await writeFile(path.join(this.directory, `portrait-${id}-${key}`), bytes, { mode: 0o600 }); }
  async readPortrait(id, key) { return readFile(path.join(this.directory, `portrait-${id}-${key}`)); }
  async mutate(id, update) {
    const prior = this.locks.get(id) || Promise.resolve();
    const operation = prior.catch(() => {}).then(async () => {
      const room = JSON.parse(JSON.stringify(this.get(id)));
      await update(room); room.revision++; room.updatedAt = Date.now(); await this.save(room); return room;
    });
    this.locks.set(id, operation);
    try { return await operation; } finally { if (this.locks.get(id) === operation) this.locks.delete(id); }
  }
  async patch(id, patch) {
    const clean = validateShowPatch(patch);
    return this.mutate(id, room => { room.state = applyShowPatch(room.state, clean, Date.now()); });
  }
}

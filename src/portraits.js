import { sanitizeMouth, mouthDefaults, gautamMouth } from './portrait-settings.js';

export function loadPortraitImage(src) {
  const image = new Image(); image.src = src;
  return image.decode().then(() => image);
}

// Image loading is injectable so selection/cycling/calibration can be tested without a camera/browser.
export class PortraitRoster {
  constructor(settings, loadImage = loadPortraitImage) {
    this.settings = settings; this.loadImage = loadImage; this.entries = [];
    this.currentId = ''; this.lastChange = 0; this.pendingIds = new Set();
  }
  get current() { return this.entries.find(entry => entry.id === this.currentId) || null; }
  saveMouth() {
    if (this.currentId) this.settings.portraitMouths[this.currentId] = sanitizeMouth(this.settings);
  }
  select(id, now = 0) {
    const next = this.entries.find(entry => entry.id === id);
    if (!next) return false;
    this.saveMouth(); this.currentId = id; this.settings.portraitId = id;
    const saved = Object.hasOwn(this.settings.portraitMouths, id) ? this.settings.portraitMouths[id] : next.mouth;
    Object.assign(this.settings, sanitizeMouth(saved, mouthDefaults));
    this.lastChange = now; return true;
  }
  next(direction = 1, now = 0) {
    if (!this.entries.length) return false;
    const index = this.entries.findIndex(entry => entry.id === this.currentId);
    return this.select(this.entries[(index + direction + this.entries.length) % this.entries.length].id, now);
  }
  tick(now, active) {
    if (!active) { this.lastChange = now; return false; }
    if (!this.settings.portraitCycle || this.entries.length < 2) return false;
    if (now - this.lastChange < this.settings.portraitCycleSeconds * 1000) return false;
    return this.next(1, now);
  }
  async add(entries, now = 0) {
    const known = new Set([...this.entries.map(entry => entry.id), ...this.pendingIds]);
    const unique = entries.filter(entry => {
      if (known.size >= 100 || !entry.id || entry.id.length > 300 || ['__proto__', 'constructor', 'prototype'].includes(entry.id) || known.has(entry.id)) return false;
      known.add(entry.id); this.pendingIds.add(entry.id); return true;
    });
    const results = await Promise.allSettled(unique.map(async entry => ({ ...entry, image: await this.loadImage(entry.src), mouth: sanitizeMouth(entry.mouth, /^gautam\.(jpe?g|png|webp)$/i.test(entry.id) ? gautamMouth : mouthDefaults) })));
    const added = [];
    for (const entry of unique) this.pendingIds.delete(entry.id);
    for (const result of results) if (result.status === 'fulfilled') { this.entries.push(result.value); added.push(result.value); }
    if (!this.current && this.entries.length) {
      const requested = this.entries.some(entry => entry.id === this.settings.portraitId) ? this.settings.portraitId : this.entries[0].id;
      this.select(requested, now);
    }
    return { added, failed: results.filter(result => result.status === 'rejected').length };
  }
  restoreSelection(now = 0) {
    // Used after importing settings; do not overwrite the imported mouth map with the previous person.
    const target = this.entries.find(entry => entry.id === this.settings.portraitId) || this.current || this.entries[0];
    this.currentId = '';
    if (target) this.select(target.id, now);
  }
}

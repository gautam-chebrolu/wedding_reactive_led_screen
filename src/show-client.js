import { applyShowPatch, sceneAt, portraitAt } from './show-state.js';

const clone = value => JSON.parse(JSON.stringify(value));
export function mergePatches(first, second) {
  const result = { ...first, ...second };
  if (first.settings || second.settings) {
    result.settings = { ...first.settings, ...second.settings };
    if (first.settings?.portraitMouths || second.settings?.portraitMouths) result.settings.portraitMouths = { ...first.settings?.portraitMouths, ...second.settings?.portraitMouths };
  }
  return result;
}
export class SharedShow {
  constructor({ onState = () => {}, onStatus = () => {}, onTelemetry = () => {} } = {}) {
    this.onState = onState; this.onStatus = onStatus; this.onTelemetry = onTelemetry;
    this.pending = {}; this.inFlight = {}; this.offset = 0; this.generation = 0;
    this.mediaURLs = new Map(); this.mediaPending = new Map(); this.telemetry = null;
  }
  get connected() { return Boolean(this.session); }
  get isWall() { return this.session?.role === 'wall'; }
  get isController() { return this.session?.role === 'control'; }
  get now() { return Date.now() + this.offset; }
  get state() {
    if (!this.snapshot) return null;
    if (!this.cachedState) this.cachedState = applyShowPatch(applyShowPatch(this.snapshot.state, this.inFlight, this.now), this.pending, this.now);
    return this.cachedState;
  }
  scene(cameraReady) { return sceneAt(this.state, this.now, cameraReady); }
  portrait(ids) { return portraitAt(this.state, ids, this.now); }
  async request(pathname, { method = 'GET', body, headers = {}, signal } = {}) {
    const response = await fetch(pathname, { method, signal, cache: 'no-store', headers: { ...(this.session ? { Authorization: `Bearer ${this.session.token}` } : {}), ...(body && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: body instanceof Blob ? body : JSON.stringify(body) } : {}) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})); const error = new Error(data.error || `Show connection failed (${response.status}).`); error.status = response.status; throw error;
    }
    return response;
  }
  async create(name, password, setupKey, settings) {
    const response = await this.request('/api/shows', { method: 'POST', body: { name, password, setupKey, settings } });
    const data = await response.json(); this.attach({ id: data.id, role: 'control', token: data.token, wallKey: data.wallKey }, data); return data;
  }
  async login(id, password) {
    if (!/^[A-Za-z0-9_-]{32}$/.test(id)) throw new Error('Use a valid controller link or show ID.');
    const response = await this.request(`/api/shows/${id}/login`, { method: 'POST', body: { password } });
    const data = await response.json(); this.attach({ id, role: 'control', token: data.token, wallKey: data.wallKey }, data);
  }
  async joinWall(id, token) {
    if (!/^[A-Za-z0-9_-]{32}$/.test(id) || !/^[A-Za-z0-9_-]{32}$/.test(token)) throw new Error('This wall link is invalid. Ask the operator to copy a new wall link.');
    this.session = { id, token, role: 'wall' };
    try { const response = await this.request(`/api/shows/${id}`); this.attach(this.session, await response.json()); }
    catch (error) { this.session = null; throw error; }
  }
  attach(session, snapshot) {
    this.disconnect(); this.session = session;
    try { sessionStorage.setItem(`afterglow.show.${session.id}.${session.role}`, JSON.stringify(session)); } catch {}
    this.receive(snapshot); this.startStream(this.generation); this.onStatus('Connected');
  }
  async restore(id, role = 'control') {
    let saved; try { saved = JSON.parse(sessionStorage.getItem(`afterglow.show.${id}.${role}`)); } catch {}
    if (!saved?.token || saved.id !== id || saved.role !== role) return false;
    this.session = saved;
    try { const response = await this.request(`/api/shows/${id}`); this.attach(saved, await response.json()); return true; }
    catch { this.session = null; return false; }
  }
  receive(snapshot) {
    if (this.snapshot && snapshot.revision < this.snapshot.revision) return;
    const unchanged = this.snapshot?.revision === snapshot.revision;
    this.offset = snapshot.serverTime - Date.now(); this.snapshot = snapshot; this.cachedState = null;
    if (snapshot.telemetry && snapshot.telemetry.at !== this.telemetry?.at) { this.telemetry = snapshot.telemetry; this.onTelemetry(this.telemetry); }
    if (unchanged) return;
    this.onState({ ...snapshot, state: this.state });
  }
  async startStream(generation) {
    if (!this.session || generation !== this.generation) return;
    this.streamAbort = new AbortController();
    try {
      const response = await this.request(`/api/shows/${this.session.id}/events`, { signal: this.streamAbort.signal });
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        const snapshot = await response.json(); if (generation !== this.generation) return;
        this.receive(snapshot); this.poll(generation); return;
      }
      this.onStatus('Connected'); const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
      while (generation === this.generation) {
        const { value, done } = await reader.read(); if (done || generation !== this.generation) break;
        buffer += decoder.decode(value, { stream: true }); let end;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          const type = event.match(/^event: (.+)$/m)?.[1], data = event.match(/^data: (.+)$/m)?.[1]; if (!data) continue;
          const parsed = JSON.parse(data);
          if (type === 'state') this.receive(parsed);
          if (type === 'telemetry') { this.telemetry = parsed; this.onTelemetry(parsed); }
          if (type === 'heartbeat') this.offset = parsed.serverTime - Date.now();
        }
      }
      if (generation === this.generation) throw new Error('Show stream closed.');
    } catch (error) {
      if (generation !== this.generation || error.name === 'AbortError') return;
      if (error.status === 401 || error.status === 403) { this.onStatus(error.message); return; }
      this.onStatus('Reconnecting · visuals continue');
      this.retryTimer = setTimeout(() => this.startStream(generation), 2000);
    }
  }
  async poll(generation) {
    if (generation !== this.generation || !this.session) return;
    try {
      const response = await this.request(`/api/shows/${this.session.id}`); const snapshot = await response.json();
      if (generation !== this.generation) return;
      this.receive(snapshot); this.onStatus('Connected');
      this.retryTimer = setTimeout(() => this.poll(generation), 750);
    } catch (error) {
      if (generation !== this.generation) return;
      this.onStatus(`Reconnecting · ${error.message}`);
      if (![401, 403].includes(error.status)) this.retryTimer = setTimeout(() => this.poll(generation), 2000);
    }
  }
  publish(patch, immediate = false) {
    if (!this.isController) return;
    this.pending = mergePatches(this.pending, clone(patch)); this.cachedState = null; clearTimeout(this.flushTimer); this.flushTimer = null;
    if (immediate) this.flush(); else this.flushTimer = setTimeout(() => this.flush(), 120);
  }
  async flush() {
    this.flushTimer = null;
    if (!this.isController || this.flushing || !Object.keys(this.pending).length) return;
    this.flushing = true; this.inFlight = this.pending; this.pending = {}; const generation = this.generation;
    let retry = null;
    try {
      const response = await this.request(`/api/shows/${this.session.id}`, { method: 'PATCH', body: this.inFlight });
      const snapshot = await response.json();
      if (generation !== this.generation) return;
      this.inFlight = {}; this.cachedState = null; this.receive(snapshot);
    } catch (error) {
      if (generation !== this.generation) return;
      this.pending = mergePatches(this.inFlight, this.pending); this.inFlight = {}; this.cachedState = null;
      this.onStatus(`Changes not delivered · ${error.message}`);
      retry = ![400, 401, 403].includes(error.status);
    } finally {
      if (generation === this.generation) {
        this.flushing = false;
        if (retry !== false && Object.keys(this.pending).length && !this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), retry ? 2000 : 120);
      }
    }
  }
  async uploadPortrait(file) {
    if (!this.isController) throw new Error('Join as a controller to upload a shared portrait.');
    const response = await this.request(`/api/shows/${this.session.id}/portraits`, { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream', 'X-Portrait-Name': encodeURIComponent(file.name) } });
    const data = await response.json(); this.receive(data); return data.portrait;
  }
  async portraitEntries() {
    return Promise.all((this.snapshot?.portraits || []).map(async entry => {
      if (!this.mediaURLs.has(entry.id)) {
        if (!this.mediaPending.has(entry.id)) this.mediaPending.set(entry.id, (async () => {
          const response = await this.request(entry.src), blob = await response.blob(), url = URL.createObjectURL(blob);
          this.mediaURLs.set(entry.id, url); return url;
        })().finally(() => this.mediaPending.delete(entry.id)));
        await this.mediaPending.get(entry.id);
      }
      return { ...entry, src: this.mediaURLs.get(entry.id) };
    }));
  }
  async reportTelemetry(data) {
    if (!this.isWall || this.reporting) return; this.reporting = true;
    try { await this.request(`/api/shows/${this.session.id}/telemetry`, { method: 'POST', body: data }); } catch {} finally { this.reporting = false; }
  }
  links() {
    const controller = new URL(location.pathname, location.origin); controller.searchParams.set('show', this.session.id);
    const wall = new URL(location.pathname, location.origin); wall.searchParams.set('wall', this.session.id); wall.hash = `key=${this.session.wallKey}`;
    return { controller: controller.href, wall: wall.href };
  }
  disconnect(forget = false) {
    if (forget && this.session) { try { sessionStorage.removeItem(`afterglow.show.${this.session.id}.${this.session.role}`); } catch {} }
    this.generation++; this.streamAbort?.abort(); clearTimeout(this.retryTimer); clearTimeout(this.flushTimer);
    this.flushTimer = null; this.session = null; this.snapshot = null; this.pending = {}; this.inFlight = {}; this.flushing = false; this.cachedState = null; this.telemetry = null;
  }
}

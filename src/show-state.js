import { defaults, sanitizeSettings } from './settings.js';
import { sceneIds, cameraSceneIds } from './scene-ids.js';

const copy = value => JSON.parse(JSON.stringify(value));
export function initialShowState(settings, now) {
  return { settings: sanitizeSettings(settings), blackout: false, tempo: null, cue: null, sceneAnchor: now, portraitAnchor: now };
}
export function applyShowPatch(state, patch, now) {
  const next = copy(state);
  if (patch.settings) {
    const incoming = { ...patch.settings };
    if (incoming.portraitMouths) incoming.portraitMouths = { ...next.settings.portraitMouths, ...incoming.portraitMouths };
    next.settings = sanitizeSettings({ ...next.settings, ...incoming });
    if (['scene', 'autoCycle', 'cycleSeconds'].some(key => Object.hasOwn(incoming, key))) next.sceneAnchor = now;
    if (['portraitId', 'portraitCycle', 'portraitCycleSeconds', 'scene'].some(key => Object.hasOwn(incoming, key))) next.portraitAnchor = now;
  }
  if (typeof patch.blackout === 'boolean') next.blackout = patch.blackout;
  if (Object.hasOwn(patch, 'tempo')) next.tempo = patch.tempo;
  if (patch.cue) next.cue = patch.cue;
  return next;
}
export function validateShowPatch(patch) {
  const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !['settings', 'blackout', 'tempo', 'cue'].includes(key))) invalid('Invalid show update.');
  if (Object.hasOwn(patch, 'settings')) {
    if (!patch.settings || typeof patch.settings !== 'object' || Array.isArray(patch.settings) || Object.keys(patch.settings).some(key => !Object.hasOwn(defaults, key))) invalid('Invalid show settings.');
    const clean = sanitizeSettings(patch.settings);
    for (const key of Object.keys(patch.settings)) {
      if (JSON.stringify(patch.settings[key]) !== JSON.stringify(clean[key])) invalid(`Invalid value for ${key}.`);
    }
  }
  if (Object.hasOwn(patch, 'blackout') && typeof patch.blackout !== 'boolean') invalid('Invalid blackout value.');
  if (Object.hasOwn(patch, 'tempo') && patch.tempo !== null) {
    const tempo = patch.tempo;
    if (!tempo || !Number.isFinite(tempo.bpm) || tempo.bpm < 40 || tempo.bpm > 240 || !Number.isFinite(tempo.anchorAt) || Math.abs(tempo.anchorAt - Date.now()) > 86400000) invalid('Invalid tempo clock.');
    if (Object.keys(tempo).some(key => !['bpm', 'anchorAt'].includes(key))) invalid('Invalid tempo fields.');
  }
  if (Object.hasOwn(patch, 'cue')) {
    if (!patch.cue || !/^[a-zA-Z0-9_-]{10,80}$/.test(patch.cue.id) || !['reset-ball', 'reset-dvd'].includes(patch.cue.type) || Object.keys(patch.cue).some(key => !['id', 'type'].includes(key))) invalid('Invalid show cue.');
  }
  return copy(patch);
}
export function sceneAt(state, now, cameraReady) {
  const { settings } = state;
  if (!settings.autoCycle) return settings.scene;
  const eligible = sceneIds.filter(id => cameraReady || !cameraSceneIds.includes(id));
  const start = Math.max(0, eligible.indexOf(settings.scene));
  const steps = Math.max(0, Math.floor((now - state.sceneAnchor) / (settings.cycleSeconds * 1000)));
  return eligible[(start + steps) % eligible.length];
}
export function portraitAt(state, ids, now) {
  if (!ids.length) return '';
  const start = Math.max(0, ids.indexOf(state.settings.portraitId));
  if (!state.settings.portraitCycle) return ids[start];
  const steps = Math.max(0, Math.floor((now - state.portraitAnchor) / (state.settings.portraitCycleSeconds * 1000)));
  return ids[(start + steps) % ids.length];
}

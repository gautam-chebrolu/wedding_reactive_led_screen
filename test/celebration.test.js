import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneRegistry } from '../src/scenes/index.js';
import { sceneIds, sceneShortcuts, cameraSceneIds } from '../src/scene-ids.js';
import { sanitizeSettings } from '../src/settings.js';
import { initialShowState, sceneAt, validateShowPatch, applyShowPatch } from '../src/show-state.js';
import { musicStrength } from '../src/scenes/celebration-shared.js';
import { tunakPose } from '../src/scenes/tunak.js';
import { hubWindowLight } from '../src/scenes/kellogg.js';
import { hubGlass, globalHubIllustration } from '../src/scenes/kellogg-art.js';
import { thumbnail } from '../src/thumbnails.js';

const additions = ['rangoli', 'mehndi', 'baraat', 'kellogg', 'hyperspace', 'liquid', 'tunak'];
test('all seven additions are selectable, have unique shortcuts and join camera-free shared cycling', () => {
  assert.deepEqual(sceneRegistry.map(scene => scene.id), sceneIds);
  assert.deepEqual(sceneIds.slice(-7), additions); assert.equal(new Set(sceneShortcuts).size, sceneIds.length);
  assert.deepEqual(sceneShortcuts.slice(0, 10), ['1','2','3','4','5','6','7','8','9','0']);
  const reserved = new Set(['f','h','b','t','r']); assert.ok(sceneShortcuts.every(key => !reserved.has(key)));
  const state = initialShowState({ scene: 'memories', autoCycle: true, cycleSeconds: 15 }, 0);
  additions.forEach((id, index) => {
    assert.equal(sanitizeSettings({ scene: id }).scene, id);
    assert.equal(sceneRegistry.find(scene => scene.id === id).needsCamera, false);
    assert.ok(!cameraSceneIds.includes(id)); assert.equal(sceneAt(state, (index + 1) * 15000, false), id);
    assert.doesNotThrow(() => validateShowPatch({ settings: { scene: id } }));
    assert.ok(thumbnail(id).includes('<svg'));
  });
});

test('scene controls validate imports and merge into existing shared-show settings', () => {
  const settings = { rangoliPetals: '24', hyperspaceSpeed: 1.5, tunnelShape: 'rings', liquidMaterial: 'silk', tunakMode: 'solo', tunakRate: '2' };
  assert.doesNotThrow(() => validateShowPatch({ settings }));
  const state = applyShowPatch(initialShowState({}, 0), { settings }, 10);
  for (const [key, value] of Object.entries(settings)) assert.equal(state.settings[key], value);
  const malformed = sanitizeSettings({ hyperspaceSpeed: 1e9, rangoliPetals: '999', liquidMaterial: '<script>', tunakMode: '99', tunakRate: 0 });
  assert.equal(malformed.hyperspaceSpeed, 2); assert.equal(malformed.rangoliPetals, '16'); assert.equal(malformed.liquidMaterial, 'chrome'); assert.equal(malformed.tunakMode, 'takeover'); assert.equal(malformed.tunakRate, '1');
  assert.throws(() => validateShowPatch({ settings: { hyperspaceSpeed: -2 } }));
});

test('audio strength is bounded, zero reactivity is still, and gentle motion reduces beat energy', () => {
  const settings = sanitizeSettings({ intensity: 1 }), hit = { bass: 2, mid: 1, treble: 1, pulse: 1 };
  assert.equal(musicStrength(hit, settings).bass, 1);
  assert.deepEqual(musicStrength(hit, { ...settings, intensity: 0 }), { amount: 0, bass: 0, mid: 0, treble: 0, pulse: 0 });
  assert.ok(musicStrength(hit, { ...settings, reducedMotion: true }).pulse < 0.2);
});

test('Tunak has a neck nod, downward head bob and shoulder bounce that settle after each hit', () => {
  const settings = sanitizeSettings({ intensity: 1 }), hit = { pulse: 1 };
  const attack = tunakPose(0.06, hit, settings), rest = tunakPose(2, hit, settings);
  assert.ok(attack.nod > 0.1); assert.ok(attack.headY > 10); assert.ok(attack.shoulderY < -8);
  assert.ok(Math.abs(rest.nod) < 0.001); assert.ok(rest.headY < 0.001);
  assert.deepEqual(tunakPose(0.06, hit, { ...settings, intensity: 0 }), { nod: 0, headY: 0, shoulderY: -0 });
  assert.ok(tunakPose(0.06, hit, { ...settings, reducedMotion: true }).headY < attack.headY * 0.2);
});

test('Global Hub windows pass the beat between glass wings and preserve a low-motion setting', () => {
  const settings = sanitizeSettings(null), hit = { beatCount: 2, pulse: 1, bass: 0.5 };
  assert.ok(hubWindowLight(hit, settings, 2) > hubWindowLight(hit, settings, 0));
  assert.ok(hubWindowLight(hit, { ...settings, reducedMotion: true }, 2) < hubWindowLight(hit, settings, 2));
  assert.equal(hubWindowLight(hit, { ...settings, intensity: 0 }, 2), 0.12);
  assert.equal(hubGlass.length, 4); assert.match(globalHubIllustration, /GLOBAL HUB/);
});

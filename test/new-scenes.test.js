import test from 'node:test';
import assert from 'node:assert/strict';
import { DVDBounce } from '../src/dvd-physics.js';
import { pulseScale } from '../src/scenes/logo-art.js';
import { sceneRegistry } from '../src/scenes/index.js';
import { sceneIds } from '../src/scene-ids.js';
import { sanitizeSettings } from '../src/settings.js';
import { monochromeMask } from '../src/logo-mask.js';

test('DVD masking removes black padding, preserves anti-aliasing and crops to the original artwork', () => {
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
    0, 0, 0, 255, 255, 255, 255, 255, 128, 128, 128, 255,
    0, 0, 0, 255, 255, 255, 255, 128, 255, 255, 255, 0
  ]);
  assert.deepEqual(monochromeMask(pixels, 3, 3), [1, 1, 2, 2]);
  assert.equal(pixels[3], 0, 'Black background becomes transparent');
  assert.equal(pixels[(1 * 3 + 1) * 4 + 3], 255, 'White artwork stays opaque');
  assert.equal(pixels[(1 * 3 + 2) * 4 + 3], 128, 'Gray edge coverage is preserved');
  assert.equal(pixels[(2 * 3 + 1) * 4 + 3], 128, 'Existing transparency is preserved');
  assert.equal(pixels[(2 * 3 + 2) * 4 + 3], 0);
  assert.throws(() => monochromeMask(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1), /no visible/);
});

test('a wall reflects the DVD and changes color once, including corner hits', () => {
  const dvd = new DVDBounce(), originalHue = dvd.hue;
  dvd.x = 0.9; dvd.y = 0.3; dvd.dx = 1;
  assert.equal(dvd.step(0.016, 16 / 9, 0.2, 0.1, 0.18), true);
  assert.equal(dvd.dx, -1); assert.notEqual(dvd.hue, originalHue); assert.equal(dvd.hits, 1);
  assert.equal(dvd.step(0.016, 16 / 9, 0.2, 0.1, 0.18), false); assert.equal(dvd.hits, 1);
  dvd.x = 0.9; dvd.y = 0.95; dvd.dx = 1; dvd.dy = 1;
  dvd.step(0.016, 16 / 9, 0.2, 0.1, 0.18);
  assert.equal(dvd.dx, -1); assert.equal(dvd.dy, -1); assert.equal(dvd.hits, 2);
});

test('pulse enlargement cannot leave the DVD outside a wall or retrigger an inward bounce', () => {
  const dvd = new DVDBounce(); dvd.x = 0.88; dvd.dx = -1;
  const hue = dvd.hue;
  assert.equal(dvd.step(0.016, 32 / 9, 0.3, 0.15, 0.18), false);
  assert.ok(dvd.x <= 0.85); assert.equal(dvd.hue, hue);
  for (const aspect of [0.75, 16 / 9, 32 / 9]) {
    for (let i = 0; i < 10000; i++) {
      dvd.step(1 / 60, aspect, 0.24, 0.2, 0.6);
      assert.ok(dvd.x >= 0.12 && dvd.x <= 0.88); assert.ok(dvd.y >= 0.1 && dvd.y <= 0.9);
    }
  }
});

test('gold/DVD scale follows beat pulses and respects gentle motion and reactivity', () => {
  const settings = sanitizeSettings(null);
  assert.equal(pulseScale({ pulse: 0 }, settings), 1);
  const full = pulseScale({ pulse: 1 }, settings); assert.ok(full > 1);
  assert.ok(pulseScale({ pulse: 1 }, { ...settings, reducedMotion: true }) < full);
  assert.equal(pulseScale({ pulse: 1 }, { ...settings, intensity: 0 }), 1);
});

test('all seven scenes persist and the three new scenes require no camera', () => {
  assert.deepEqual(sceneRegistry.map(scene => scene.id), sceneIds);
  for (const id of ['kaleidoscope', 'monogram', 'dvd']) {
    assert.equal(sanitizeSettings({ scene: id }).scene, id);
    assert.equal(sceneRegistry.find(scene => scene.id === id).needsCamera, false);
  }
});

test('portrait calibrations and new controls are validated when importing settings', () => {
  const settings = sanitizeSettings({ portraitCycleSeconds: 0, dvdSpeed: 900, kaleidoSegments: '100000', portraitMouths: JSON.parse('{"__proto__":{"mouthY":1},"gautam.jpg":{"mouthY":20,"mouthWidth":-2}}') });
  assert.equal(settings.portraitCycleSeconds, 3); assert.equal(settings.dvdSpeed, 0.6); assert.equal(settings.kaleidoSegments, '12');
  assert.equal(settings.portraitMouths['gautam.jpg'].mouthY, 1); assert.equal(settings.portraitMouths['gautam.jpg'].mouthWidth, 0.02);
  assert.equal(Object.hasOwn(settings.portraitMouths, '__proto__'), false);
  const a = sanitizeSettings(null), b = sanitizeSettings(null); a.portraitMouths.test = {};
  assert.deepEqual(b.portraitMouths, {}, 'Fresh sessions must not share a mutable calibration map');
});

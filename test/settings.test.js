import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSettings, defaults } from '../src/settings.js';

test('malformed preferences cannot select invalid scenes or allocate arbitrary resolutions', () => {
  assert.deepEqual(sanitizeSettings(null), defaults);
  assert.deepEqual(sanitizeSettings([]), defaults);
  const result = sanitizeSettings({ scene: '<script>', resolution: '9999999', brightness: 80, intensity: -4, sensitivity: NaN, mirror: 'false', mouthX: Infinity, unexpected: true });
  assert.equal(result.scene, 'moon'); assert.equal(result.resolution, 'auto'); assert.equal(result.brightness, 1); assert.equal(result.intensity, 0);
  assert.equal(result.sensitivity, defaults.sensitivity); assert.equal(result.mirror, true); assert.equal(result.mouthX, defaults.mouthX); assert.equal(result.unexpected, undefined);
});

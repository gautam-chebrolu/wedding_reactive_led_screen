import test from 'node:test';
import assert from 'node:assert/strict';
import { CoupleBounce } from '../src/scenes/couple.js';
import { sanitizeSettings } from '../src/settings.js';
import { sceneIds, sceneShortcuts } from '../src/scene-ids.js';
import { initialShowState, sceneAt, validateShowPatch } from '../src/show-state.js';

test('the couple is selectable on X, persists and joins camera-free shared cycling', () => {
  const index = sceneIds.indexOf('couple');
  assert.equal(sceneShortcuts[index], 'x');
  assert.equal(sanitizeSettings({ scene: 'couple' }).scene, 'couple');
  assert.equal(sanitizeSettings({ coupleSpeed: 900 }).coupleSpeed, 0.6);
  assert.equal(sanitizeSettings({ coupleSpeed: -3 }).coupleSpeed, 0.05);
  assert.doesNotThrow(() => validateShowPatch({ settings: { scene: 'couple', coupleSpeed: 0.27 }, cue: { type: 'reset-couple', id: 'couple-reset-123' } }));
  const state = initialShowState({ scene: 'tunak', autoCycle: true, cycleSeconds: 30 }, 0);
  assert.equal(sceneAt(state, 30000, false), 'couple');
});

test('each person moves independently, and restart restores distinct starting positions', () => {
  const bounce = new CoupleBounce(), settings = sanitizeSettings(null);
  const initial = bounce.people.map(person => [person.x, person.y, person.dx, person.dy]);
  bounce.step(0.05, 1920, 1080, [0.87, 0.82], { pulse: 0 }, settings);
  assert.ok(bounce.people[0].x > initial[0][0]);
  assert.ok(bounce.people[1].x < initial[1][0]);
  assert.notEqual(Math.abs(bounce.people[0].x - initial[0][0]), Math.abs(bounce.people[1].x - initial[1][0]));
  bounce.people[0].x = 1; bounce.people[0].dx = 1;
  bounce.step(0.05, 1920, 1080, [0.87, 0.82], { pulse: 0 }, settings);
  assert.equal(bounce.people[0].dx, -1);
  assert.equal(bounce.people[1].hits, 0, 'One person hitting a wall does not bounce the other');
  bounce.reset();
  assert.deepEqual(bounce.people.map(person => [person.x, person.y, person.dx, person.dy]), initial);
});

test('both pulsing cutouts stay on screen across wall ratios and live resizes', () => {
  const bounce = new CoupleBounce(), settings = sanitizeSettings({ coupleSpeed: 0.6, intensity: 1 });
  for (const [w, h] of [[1920, 1080], [2560, 720], [720, 1280], [1080, 1080]]) {
    for (let i = 0; i < 3600; i++) {
      const boxes = bounce.step(1 / 60, w, h, [0.87, 0.82], { pulse: i % 30 < 8 ? 1 : 0 }, settings);
      for (const box of boxes) {
        assert.ok(box.x >= -1e-8 && box.y >= -1e-8);
        assert.ok(box.x + box.width <= w + 1e-8 && box.y + box.height <= h + 1e-8);
      }
    }
  }
});

test('the beat bumps size and speed; zero reactivity and gentle motion soften it', () => {
  const settings = sanitizeSettings({ intensity: 1 });
  const step = (pulse, override = settings) => new CoupleBounce().step(0.05, 1920, 1080, [0.87, 0.82], { pulse }, override);
  const rest = step(0), hit = step(1), gentle = step(1, { ...settings, reducedMotion: true });
  assert.ok(hit[0].height > rest[0].height * 1.1);
  assert.ok(gentle[0].height < hit[0].height);
  assert.deepEqual(step(0, { ...settings, intensity: 0 }), step(1, { ...settings, intensity: 0 }));
  const plain = new CoupleBounce(), kicked = new CoupleBounce();
  plain.step(0.05, 1920, 1080, [0.87, 0.82], { pulse: 0 }, settings);
  kicked.step(0.05, 1920, 1080, [0.87, 0.82], { pulse: 1 }, settings);
  assert.ok(kicked.people[0].x > plain.people[0].x);
});

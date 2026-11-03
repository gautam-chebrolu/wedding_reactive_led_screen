import test from 'node:test';
import assert from 'node:assert/strict';
import { BeatDetector, TapClock } from '../src/beat.js';

test('steady silence and sustained tones do not become beats', () => {
  for (const energy of [0, 0.3, 0.8]) {
    const detector = new BeatDetector();
    let hits = 0;
    for (let t = 0; t < 5000; t += 16) hits += Number(detector.update(energy, energy / 3, t).beat);
    assert.equal(hits, 0);
  }
});

test('a regular kick train converges on tempo and expires after silence', () => {
  const detector = new BeatDetector(); let hits = 0, result;
  for (let t = 0; t <= 8000; t += 10) {
    const hit = t > 500 && t % 500 < 50;
    result = detector.update(hit ? 0.85 : 0.07, hit ? 0.3 : 0.02, t);
    hits += Number(result.beat);
  }
  assert.ok(hits >= 12 && hits <= 16, `Expected one detection per kick; got ${hits}`);
  assert.equal(result.bpm, 120);
  assert.ok(result.confidence > 0.8);
  for (let t = 8010; t < 12000; t += 10) result = detector.update(0, 0, t);
  assert.equal(result.bpm, 0); assert.equal(result.confidence, 0);
});

test('refractory interval prevents rapid double triggers', () => {
  const detector = new BeatDetector(); let last = -Infinity;
  for (let t = 0; t < 4000; t += 10) {
    const pulse = t % 100 === 0;
    if (detector.update(pulse ? 0.9 : 0.01, pulse ? 0.3 : 0.02, t).beat) {
      assert.ok(t - last >= 260); last = t;
    }
  }
});

test('tap clock follows taps, ignores bounce, and counts four beats', () => {
  const clock = new TapClock();
  [0, 500, 1000, 1500].forEach(time => clock.tap(time));
  assert.equal(clock.bpm, 120);
  clock.tap(1550); assert.equal(clock.bpm, 120);
  assert.equal(clock.update(1500).beatInBar, 1);
  assert.equal(clock.update(1510).beat, false);
  assert.equal(clock.update(2000).beatInBar, 2);
  assert.equal(clock.update(3000).beatInBar, 4);
  assert.equal(clock.update(3500).beatInBar, 1);
  clock.firstBeat(3600); assert.equal(clock.update(3600).beatInBar, 1);
  clock.tap(7000); assert.equal(clock.bpm, 0);
});

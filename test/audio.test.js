import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio.js';
import { defaults } from '../src/settings.js';

test('switching audio releases all stream tracks and disconnects source nodes', () => {
  const engine = new AudioEngine(); let stopped = 0, disconnected = 0;
  engine.stream = { getTracks: () => [{ onended: () => {}, stop: () => stopped++ }, { stop: () => stopped++ }] };
  engine.source = { disconnect: () => disconnected++ };
  engine.tapClock.tap(0); engine.tapClock.tap(500); engine.spectrum.fill(255);
  engine.demo();
  assert.equal(stopped, 2); assert.equal(disconnected, 1); assert.equal(engine.tapClock.bpm, 0);
  assert.equal(engine.mode, 'demo'); assert.equal(engine.stream, null); assert.ok(engine.spectrum.every(value => value === 0));
});

test('late microphone permission after cancellation releases the new stream', async () => {
  let resolveCapture, stopped = 0;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise(resolve => { resolveCapture = resolve; }) } } });
  try {
    const engine = new AudioEngine(); engine.contextReady = async () => {};
    const pending = engine.microphone(); await Promise.resolve();
    engine.demo();
    resolveCapture({ getTracks: () => [{ stop: () => stopped++ }] });
    assert.equal(await pending, false); assert.equal(stopped, 1); assert.equal(engine.mode, 'demo');
  } finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});

test('microphone analysis never connects to the speaker destination', () => {
  const engine = new AudioEngine(); const connections = [], analyser = {};
  engine.analyser = analyser;
  engine.context = { createMediaStreamSource: () => ({ connect: node => connections.push(node) }) };
  const track = {}; engine.attachStream({ getTracks: () => [track] }, 'microphone', 'Mixer');
  assert.deepEqual(connections, [analyser]); assert.equal(engine.mode, 'microphone');
});

test('demo works without AudioContext and idle mode settles to silence', () => {
  const engine = new AudioEngine(); let frame;
  for (let now = 0; now < 1000; now += 16) frame = engine.update(now, 0.016, defaults);
  assert.ok(frame.level > 0); assert.equal(frame.bpm, 112);
  engine.stop();
  for (let now = 1000; now < 4000; now += 16) frame = engine.update(now, 0.016, defaults);
  assert.ok(frame.level < 0.001); assert.equal(frame.bpm, 0); assert.equal(frame.beat, false);
});

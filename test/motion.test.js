import test from 'node:test';
import assert from 'node:assert/strict';
import { motionDifference, motionAt, BallPhysics } from '../src/motion.js';
import { coverRect } from '../src/math.js';

test('no prior frame and uniform lighting changes produce no motion', () => {
  assert.deepEqual([...motionDifference(new Float32Array([100, 100]), null)], [0, 0]);
  assert.deepEqual([...motionDifference(new Float32Array([130, 150, 170]), new Float32Array([100, 120, 140]))], [0, 0, 0]);
});
test('localized movement affects only the nearby ball region', () => {
  const before = new Float32Array(96 * 54).fill(80), after = before.slice();
  for (let y = 22; y <= 30; y++) for (let x = 43; x <= 53; x++) after[y * 96 + x] = 220;
  const field = motionDifference(after, before);
  assert.ok(motionAt(field, 96, 54, 0.5, 0.5).strength > 0.5);
  assert.equal(motionAt(field, 96, 54, 0.1, 0.1).strength, 0);
});
test('ball falls out, can be saved, and does not bounce on an invisible floor', () => {
  const falling = new BallPhysics();
  for (let i = 0; i < 240; i++) falling.step(1 / 60);
  assert.equal(falling.lost, true);
  const ball = new BallPhysics(); ball.y = 0.8; ball.vy = 0.6;
  assert.equal(ball.push(0.4, 0.85), true);
  assert.ok(ball.vy < 0);
  assert.equal(ball.push(0.4, 0.85), false, 'A single motion event should not rack up saves every frame');
  for (let i = 0; i < 20; i++) ball.step(1 / 60);
  assert.ok(ball.y < 0.8); assert.equal(ball.lost, false);
  ball.reset(); assert.equal(ball.hits, 0); assert.equal(ball.lost, false);
});
test('ball respects the side and ceiling boundaries at wide LED ratios', () => {
  const ball = new BallPhysics(); ball.x = 0.001; ball.vx = -0.5; ball.y = 0.001; ball.vy = -0.7;
  ball.step(0.016, 0.65, 32 / 9);
  assert.ok(ball.x > 0); assert.ok(ball.vx > 0); assert.ok(ball.y >= 0.035); assert.ok(ball.vy > 0);
});
test('cover crop matches the motion grid to the stage without stretching', () => {
  const rect = coverRect(640, 480, 1920, 1080);
  assert.deepEqual(rect, { x: 0, y: -180, w: 1920, h: 1440 });
});

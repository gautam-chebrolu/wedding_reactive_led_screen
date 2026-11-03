import { clamp } from './math.js';

// Subtract the average luminance shift so a global exposure change is less disruptive.
export function motionDifference(current, previous, threshold = 28) {
  const result = new Float32Array(current.length);
  if (!previous || previous.length !== current.length) return result;
  let drift = 0;
  for (let i = 0; i < current.length; i++) drift += current[i] - previous[i];
  drift /= current.length;
  for (let i = 0; i < current.length; i++) result[i] = clamp((Math.abs(current[i] - previous[i] - drift) - threshold) / 65);
  return result;
}

export function motionAt(field, cols, rows, x, y, radiusX = 0.09, radiusY = 0.12) {
  if (!field?.length) return { strength: 0, x, y };
  let weight = 0, sx = 0, sy = 0, samples = 0;
  for (let row = Math.max(0, Math.floor((y - radiusY) * rows)); row <= Math.min(rows - 1, Math.ceil((y + radiusY) * rows)); row++) {
    for (let col = Math.max(0, Math.floor((x - radiusX) * cols)); col <= Math.min(cols - 1, Math.ceil((x + radiusX) * cols)); col++) {
      const px = (col + 0.5) / cols, py = (row + 0.5) / rows;
      if (((px - x) / radiusX) ** 2 + ((py - y) / radiusY) ** 2 > 1) continue;
      const value = field[row * cols + col];
      weight += value; sx += px * value; sy += py * value; samples++;
    }
  }
  return { strength: samples ? weight / samples : 0, x: weight ? sx / weight : x, y: weight ? sy / weight : y };
}

export class BallPhysics {
  constructor() { this.reset(); }
  reset() { this.x = 0.5; this.y = 0.2; this.vx = 0.12; this.vy = 0; this.lost = false; this.cooldown = 0; this.hits = 0; this.age = 0; }
  push(x, y, strength = 1) {
    if (this.lost || this.cooldown > 0) return false;
    this.vx = clamp(this.vx + (this.x - x) * 4 * strength, -0.65, 0.65);
    this.vy = -0.45 - clamp(strength) * 0.38;
    this.cooldown = 0.14; this.hits++;
    return true;
  }
  step(dt, gravity = 0.65, aspect = 16 / 9) {
    if (this.lost) return;
    dt = Math.min(dt, 0.05);
    this.age += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    this.vy += gravity * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const rx = 0.035 / aspect;
    if (this.x < rx) { this.x = rx; this.vx = Math.abs(this.vx) * 0.9; }
    if (this.x > 1 - rx) { this.x = 1 - rx; this.vx = -Math.abs(this.vx) * 0.9; }
    if (this.y < 0.035) { this.y = 0.035; this.vy = Math.abs(this.vy) * 0.65; }
    if (this.y > 1.08) this.lost = true;
  }
}

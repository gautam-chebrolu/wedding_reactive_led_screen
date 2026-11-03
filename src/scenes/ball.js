import { BallPhysics, motionAt } from '../motion.js';
import { backdrop, circle, caption } from './shared.js';

export const ballMetadata = { id: 'ball', name: 'Keep it in the air', type: 'INTERACTIVE', description: 'Move beneath the glowing ball to keep it flying. Miss it and the round starts again. A mouse or finger works too.', focal: 'Motion-powered ball', needsCamera: true };
export class BallScene {
  constructor() { this.physics = new BallPhysics(); this.trail = []; this.restartAt = 0; this.pointerPosition = null; this.round = 1; }
  reset() { this.physics.reset(); this.trail = []; this.restartAt = 0; this.round = 1; this.pointerPosition = null; }
  pointer(x, y, settings, width, height, now) { this.pointerPosition = { x: x / width, y: y / height, at: now }; }
  render({ ctx, width: w, height: h, time, dt, audio, settings, palette, camera }) {
    const ball = this.physics;
    backdrop(ctx, w, h, palette.hue);
    if (camera.ready) {
      camera.draw(ctx, w, h, { mirror: settings.mirror, alpha: 0.42 });
      ctx.fillStyle = '#07101b66'; ctx.fillRect(0, 0, w, h);
      const hit = motionAt(camera.field, camera.cols, camera.rows, ball.x, ball.y, 0.09 / (w / h), 0.09);
      if (hit.strength > 0.06) ball.push(hit.x, hit.y, Math.min(1, hit.strength * 3));
      // Sparse particles show which camera movement is being detected.
      for (let row = 0; row < camera.rows; row += 2) {
        for (let col = 0; col < camera.cols; col += 2) {
          const value = camera.field[row * camera.cols + col];
          if (value > 0.2) circle(ctx, (col + 0.5) / camera.cols * w, (row + 0.5) / camera.rows * h, 1 + value * 2, `${palette.accent}75`);
        }
      }
    } else {
      ctx.strokeStyle = `${palette.accent}0b`; ctx.lineWidth = 1;
      const grid = h / 9;
      for (let x = w / 2 % grid; x < w; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }
    const pointer = this.pointerPosition;
    if (pointer && time - pointer.at < 0.18) {
      const distance = Math.hypot((pointer.x - ball.x) * w / h, pointer.y - ball.y);
      if (distance < 0.15) ball.push(pointer.x, pointer.y, 0.8);
      circle(ctx, pointer.x * w, pointer.y * h, h * 0.03, `${palette.accent}44`);
    }
    ball.step(dt, settings.ballGravity, w / h);
    if (ball.lost) {
      if (!this.restartAt) this.restartAt = time + 3;
      caption(ctx, w, h, 'One more dance?', `New ball in ${Math.max(1, Math.ceil(this.restartAt - time))} · ${ball.hits} ${ball.hits === 1 ? 'save' : 'saves'}`, palette.accent);
      if (time >= this.restartAt) { ball.reset(); this.trail = []; this.restartAt = 0; this.round++; }
    } else {
      this.trail.unshift({ x: ball.x, y: ball.y }); if (this.trail.length > 18) this.trail.pop();
      if (!settings.reducedMotion) this.trail.forEach((point, i) => circle(ctx, point.x * w, point.y * h, h * 0.027 * (1 - i / 18), `${palette.accent}${Math.floor((1 - i / 18) * 35).toString(16).padStart(2, '0')}`));
      const x = ball.x * w, y = ball.y * h, r = h * 0.035 * (1 + audio.level * settings.intensity * 0.12);
      const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * (3 + audio.bass * settings.intensity));
      glow.addColorStop(0, `${palette.accent}77`); glow.addColorStop(1, `${palette.accent}00`); circle(ctx, x, y, r * 4, glow);
      const orb = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r);
      orb.addColorStop(0, '#ffffff'); orb.addColorStop(0.35, palette.accent); orb.addColorStop(1, palette.second); circle(ctx, x, y, r, orb);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = '#d0dce2'; ctx.font = `${Math.max(11, h * 0.022)}px system-ui`;
    ctx.fillText(`ROUND ${String(this.round).padStart(2, '0')}    /    ${ball.hits} SAVES`, w * 0.04, h * 0.07);
    ctx.textAlign = 'center'; ctx.fillStyle = '#b6c7d5';
    ctx.fillText(camera.ready ? 'MOVE BENEATH THE BALL TO KEEP IT UP' : 'MOVE YOUR CURSOR UNDER THE BALL · OR ENABLE THE CAMERA', w / 2, h * 0.94);
  }
}

import { seededRandom } from '../math.js';
import { TAU, disc, musicStrength, vignette } from './celebration-shared.js';

export const hyperspaceMetadata = { id: 'hyperspace', name: 'Hyperspace', type: 'NEON FLIGHT',
  description: 'Fly through luminous portals and star trails. Bass drives the flight; beats send a bright ring through the tunnel.', needsCamera: false };
export class HyperspaceScene {
  constructor() {
    this.travel = 0; this.rotation = 0; const random = seededRandom(6682);
    this.stars = Array.from({ length: 200 }, () => ({ angle: random() * TAU, radius: 0.7 + random() * 2.8, z: random(), color: random() }));
  }
  render({ ctx, width: w, height: h, dt, audio, settings, palette }) {
    const sound = musicStrength(audio, settings), gentle = settings.reducedMotion;
    const speed = (Number(settings.hyperspaceSpeed) || 0.8) * (gentle ? 0.08 : 1);
    this.travel += dt * (0.13 + sound.bass * 0.52 + sound.pulse * 0.12) * speed;
    this.rotation += dt * (gentle ? 0 : 0.035 + sound.mid * 0.04);
    ctx.fillStyle = '#02040e'; ctx.fillRect(0, 0, w, h);
    const cx = w / 2 + Math.sin(this.rotation * 0.7) * w * 0.035, cy = h / 2 + Math.cos(this.rotation * 0.65) * h * 0.035;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.65);
    glow.addColorStop(0, '#283174'); glow.addColorStop(0.12, '#161435'); glow.addColorStop(0.5, '#071022'); glow.addColorStop(1, '#02040e'); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sides = settings.tunnelShape === 'rings' ? 64 : 6;
    for (let i = 39; i >= 0; i--) {
      const depth = ((i / 40 - this.travel) % 1 + 1) % 1 + 0.018;
      const radius = h * 0.13 / depth;
      if (radius > Math.hypot(w, h) * 1.5) continue;
      const angle = this.rotation + Math.sin(depth * 2.5 + this.rotation) * 0.17;
      const hue = palette.hue + depth * 95;
      const alpha = Math.min(0.78, (1 - depth) * 0.65 + 0.03 + sound.pulse * 0.1);
      ctx.beginPath();
      for (let j = 0; j <= sides; j++) {
        const a = j * TAU / sides + angle;
        const x = cx + Math.cos(a) * radius * 1.4, y = cy + Math.sin(a) * radius;
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${hue},95%,65%,${alpha * 0.13})`; ctx.lineWidth = 5 + (1 - depth) * 7; ctx.stroke();
      ctx.strokeStyle = `hsla(${hue},95%,74%,${alpha})`; ctx.lineWidth = 0.6 + (1 - depth) * 1.6; ctx.stroke();
    }
    for (const star of this.stars) {
      const z = ((star.z - this.travel * 0.6) % 1 + 1) % 1 + 0.03;
      const r = h * star.radius * 0.12 / z, a = star.angle + this.rotation * 0.18;
      const x = cx + Math.cos(a) * r * 1.5, y = cy + Math.sin(a) * r;
      const tail = 1 + (0.025 + sound.bass * 0.07) * speed / z;
      ctx.strokeStyle = `hsla(${palette.hue + star.color * 90},80%,85%,${(1 - z) * 0.65})`; ctx.lineWidth = Math.max(0.5, (1 - z) * 1.5);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx + (x - cx) * tail, cy + (y - cy) * tail); ctx.stroke();
    }
    disc(ctx, cx, cy, h * 0.009 * (1 + sound.pulse * 0.5), '#edf2ff'); ctx.restore(); vignette(ctx, w, h, 0.32);
  }
}

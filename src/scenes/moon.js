import { seededRandom } from '../math.js';
import { backdrop, circle, stars, drawStars } from './shared.js';

function moonTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 640;
  const ctx = canvas.getContext('2d'), rand = seededRandom(312);
  ctx.beginPath(); ctx.arc(320, 320, 310, 0, Math.PI * 2); ctx.clip();
  const base = ctx.createRadialGradient(210, 180, 15, 355, 345, 405);
  base.addColorStop(0, '#fff9db'); base.addColorStop(0.5, '#e0dfc9'); base.addColorStop(0.8, '#a4b4b8'); base.addColorStop(1, '#627f92');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 640, 640);
  for (let i = 0; i < 170; i++) {
    const x = rand() * 640, y = rand() * 640, r = rand() * 35 + 2;
    const crater = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r);
    crater.addColorStop(0, `rgba(57,78,93,${rand() * 0.14 + 0.03})`); crater.addColorStop(0.7, 'rgba(85,101,111,0.07)'); crater.addColorStop(0.9, 'rgba(254,248,225,0.12)'); crater.addColorStop(1, 'rgba(0,0,0,0)');
    circle(ctx, x, y, r, crater);
  }
  const shade = ctx.createLinearGradient(0, 0, 640, 500);
  shade.addColorStop(0, 'rgba(4,21,41,0)'); shade.addColorStop(0.65, 'rgba(4,21,41,0.05)'); shade.addColorStop(1, 'rgba(4,21,41,0.55)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, 640, 640); return canvas;
}
function cloudTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 360;
  const ctx = canvas.getContext('2d'), rand = seededRandom(173);
  for (let i = 0; i < 85; i++) {
    const x = rand() * 1400, y = 150 + rand() * 90, r = 50 + rand() * 140;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(53,78,97,0.28)'); gradient.addColorStop(0.5, 'rgba(32,55,76,0.2)'); gradient.addColorStop(1, 'rgba(14,31,51,0)');
    ctx.save(); ctx.translate(x, y); ctx.scale(1.7, 0.55); ctx.translate(-x, -y); circle(ctx, x, y, r, gradient); ctx.restore();
  }
  return canvas;
}
export const moonMetadata = { id: 'moon', name: 'Moonlit reverie', type: 'ATMOSPHERIC', description: 'A moon that breathes with the music. Bass blooms into a halo; clouds drift across the stars.', focal: 'Moon glow + scale', needsCamera: false };
export class MoonScene {
  constructor() { this.points = stars(430); this.moon = moonTexture(); this.clouds = cloudTexture(); this.color = 174; }
  render({ ctx, width: w, height: h, time, audio, settings, palette }) {
    const motion = settings.reducedMotion ? 0.1 : 1, intensity = settings.intensity;
    const t = time * motion;
    this.color += ((palette.hue + Math.sin(audio.beatCount * 0.28) * 13) - this.color) * 0.015;
    backdrop(ctx, w, h, this.color);
    drawStars(ctx, this.points, w, h, t, audio.treble * intensity);
    // Broad, translucent ribbons create an aurora without per-pixel shaders.
    for (let layer = 0; layer < 5; layer++) {
      const y = h * (0.24 + layer * 0.025);
      const wash = ctx.createLinearGradient(0, y - h * 0.1, 0, y + h * 0.42);
      wash.addColorStop(0, `hsla(${this.color + layer * 5},50%,65%,0)`);
      wash.addColorStop(0.5, `hsla(${this.color + layer * 5},50%,65%,${0.016 + audio.mid * intensity * 0.008})`);
      wash.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = wash; ctx.beginPath(); ctx.moveTo(-w * 0.1, y + h * 0.22);
      ctx.bezierCurveTo(w * 0.22, y - h * 0.28 + Math.sin(t * 0.1 + layer) * h * 0.05, w * 0.5, y + h * 0.15, w * 1.1, y - h * 0.12);
      ctx.lineTo(w * 1.1, y + h * 0.38); ctx.bezierCurveTo(w * 0.5, y + h * 0.5, w * 0.2, y - h * 0.1, -w * 0.1, y + h * 0.4); ctx.fill();
    }
    const x = w * 0.56, y = h * 0.36;
    const r = Math.min(h * 0.156, w * 0.2) * (1 + audio.level * intensity * 0.16 * motion);
    const glowRadius = r * (3.4 + audio.bass * intensity * 0.8);
    const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, glowRadius);
    halo.addColorStop(0, `hsla(${this.color},45%,78%,${0.17 + audio.level * intensity * 0.15})`); halo.addColorStop(0.2, `hsla(${this.color},45%,65%,0.08)`); halo.addColorStop(1, 'rgba(80,150,170,0)');
    circle(ctx, x, y, glowRadius, halo);
    ctx.drawImage(this.moon, x - r, y - r, r * 2, r * 2);
    // Cloud layers pass at different speeds, including in front of the moon.
    for (let i = 0; i < 3; i++) {
      const cw = w * 1.5, ch = h * (0.44 + i * 0.08), shift = (t * (3 + i * 2) + i * w * 0.37) % cw;
      ctx.globalAlpha = 0.65 + i * 0.12;
      ctx.drawImage(this.clouds, shift - cw, h * (0.23 + i * 0.14), cw, ch);
      ctx.drawImage(this.clouds, shift, h * (0.23 + i * 0.14), cw, ch);
    }
    ctx.globalAlpha = 1;
    const horizon = h * 0.79;
    const water = ctx.createLinearGradient(0, horizon, 0, h); water.addColorStop(0, '#0a1827'); water.addColorStop(1, '#040b14');
    ctx.fillStyle = water; ctx.fillRect(0, horizon, w, h - horizon);
    const rand = seededRandom(16);
    for (let i = 0; i < 64; i++) {
      const depth = i / 64, yy = horizon + depth ** 1.6 * (h - horizon);
      const lineWidth = (0.02 + depth * 0.18) * w * (0.4 + rand() * 0.6);
      const offset = Math.sin(t * (0.3 + depth) + i * 1.7) * lineWidth * 0.3;
      ctx.strokeStyle = `hsla(${this.color},30%,80%,${(1 - depth) * 0.14 + audio.level * intensity * 0.025})`;
      ctx.lineWidth = 0.5 + depth * 1.5; ctx.beginPath(); ctx.moveTo(x + offset - lineWidth / 2, yy); ctx.lineTo(x + offset + lineWidth / 2, yy); ctx.stroke();
    }
    ctx.fillStyle = '#050d18'; ctx.beginPath(); ctx.moveTo(0, h * 0.73);
    ctx.bezierCurveTo(w * 0.1, h * 0.7, w * 0.15, h * 0.8, w * 0.35, horizon); ctx.lineTo(0, h * 0.9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w, h * 0.68); ctx.bezierCurveTo(w * 0.9, h * 0.69, w * 0.85, h * 0.79, w * 0.73, horizon); ctx.lineTo(w, h * 0.9); ctx.fill();
  }
}

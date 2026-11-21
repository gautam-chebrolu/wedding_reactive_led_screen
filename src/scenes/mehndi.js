import { seededRandom } from '../math.js';
import { TAU, disc, ring, musicStrength, vignette } from './celebration-shared.js';

export const mehndiMetadata = { id: 'mehndi', name: 'Mehndi After Dark', type: 'LIVING FILIGREE',
  description: 'Luminous paisleys and henna vines unfurl across deep emerald. Musical accents send warm light through the ink.', needsCamera: false };

function vine(index, random) {
  const path = new Path2D(), leaves = new Path2D();
  const startX = (index % 8) * 225 - 35, startY = index < 8 ? 1000 : -100;
  const direction = index < 8 ? -1 : 1;
  const amplitude = 45 + random() * 80, phase = random() * TAU;
  const points = [];
  for (let j = 0; j <= 60; j++) {
    const t = j / 60, x = startX + Math.sin(t * 5 + phase) * amplitude + t * (random() - 0.5) * 5;
    const y = startY + direction * t * 1020;
    points.push([x, y]); if (!j) path.moveTo(x, y); else path.lineTo(x, y);
    if (j % 4 === 0 && j > 0) {
      const side = j % 8 ? 1 : -1, size = 20 + random() * 28;
      leaves.moveTo(x, y); leaves.bezierCurveTo(x + side * size * 1.5, y - size * 0.4, x + side * size, y + size * 1.1, x, y + size * 0.6);
      leaves.bezierCurveTo(x + side * size * 0.4, y + size * 0.25, x + side * size * 0.25, y, x, y);
      leaves.moveTo(x + side * 6, y + 4); leaves.quadraticCurveTo(x + side * size * 0.9, y + size * 0.1, x + side * size * 0.4, y + size * 0.5);
    }
  }
  return { path, leaves, points, offset: random() };
}
function paisley() {
  const path = new Path2D();
  path.moveTo(0, -190); path.bezierCurveTo(115, -110, 170, 65, 55, 145);
  path.bezierCurveTo(-65, 225, -170, 70, -72, 7); path.bezierCurveTo(-10, -38, 58, 10, 17, 58);
  path.bezierCurveTo(-35, 110, -67, 28, -18, 0); path.bezierCurveTo(38, -36, 20, -125, 0, -190); return path;
}

export class MehndiScene {
  constructor() { const random = seededRandom(886); this.vines = Array.from({ length: 16 }, (_, i) => vine(i, random)); this.paisley = paisley(); this.phase = 0; }
  render({ ctx, width: w, height: h, dt, audio, settings }) {
    const sound = musicStrength(audio, settings);
    this.phase += dt * (settings.reducedMotion ? 0 : 0.028 + sound.mid * 0.015);
    const bg = ctx.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#052b22'); bg.addColorStop(0.5, '#061c19'); bg.addColorStop(1, '#123b2c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h / 2); const scale = Math.max(w / 1600, h / 900); ctx.scale(scale, scale); ctx.translate(-800, -450);
    this.vines.forEach((vine, i) => {
      const active = i % 4 === (audio.beatCount || 0) % 4;
      ctx.strokeStyle = '#92bea53d'; ctx.lineWidth = 1.2; ctx.stroke(vine.path); ctx.stroke(vine.leaves);
      ctx.save(); ctx.strokeStyle = `rgba(240,205,135,${0.62 + sound.pulse * (active ? 0.3 : 0.08)})`;
      ctx.lineWidth = 2.1; ctx.setLineDash([1150]);
      const growth = settings.reducedMotion ? 1 : 0.35 + (Math.sin(this.phase + vine.offset * TAU) + 1) * 0.325;
      ctx.lineDashOffset = 1150 * (1 - growth); ctx.stroke(vine.path);
      ctx.setLineDash([]); ctx.globalAlpha = 0.45 + growth * 0.55; ctx.stroke(vine.leaves);
      for (let j = 5; j < vine.points.length; j += 8) {
        const [x, y] = vine.points[j];
        for (let dot = 0; dot < 4; dot++) disc(ctx, x + 8 + dot * 5, y + dot * 3, 1.6, '#d4bc7caa');
      }
      ctx.restore();
    });
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.translate(800 + Math.cos(i * TAU / 8) * 235, 450 + Math.sin(i * TAU / 8) * 225);
      ctx.rotate(i * TAU / 8 + this.phase * 0.08); const s = 0.7 + sound.bass * 0.025; ctx.scale(s, s);
      ctx.strokeStyle = i % 2 ? '#ebca8ed9' : '#a3d4b6a8'; ctx.lineWidth = 2.3; ctx.stroke(this.paisley);
      ctx.scale(0.8, 0.8); ctx.strokeStyle = '#cfb77899'; ctx.stroke(this.paisley); ctx.restore();
    }
    ctx.save(); ctx.translate(800, 450); ctx.rotate(this.phase * 0.05);
    ring(ctx, 90, '#e2c98dbb', 2); ring(ctx, 99, '#d0b67899', 1.5);
    for (let i = 0; i < 16; i++) {
      ctx.save(); ctx.rotate(i * TAU / 16); ctx.strokeStyle = '#edcf91bb'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, 20); ctx.quadraticCurveTo(-23, 53, 0, 82); ctx.quadraticCurveTo(23, 53, 0, 20); ctx.stroke();
      disc(ctx, 0, 109, 2, '#d8c087'); ctx.restore();
    }
    ring(ctx, 15, '#f0dcaa', 2); ctx.restore();
    ctx.restore(); vignette(ctx, w, h, 0.4);
  }
}

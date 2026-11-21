import { loadLogo, tintLogo } from './logo-art.js';
import { TAU, disc, ring, musicStrength, vignette } from './celebration-shared.js';

export const rangoliMetadata = { id: 'rangoli', name: 'PG Rangoli', type: 'GOLD & EMERALD',
  description: 'Your PG monogram at the heart of a golden rangoli. Petals breathe with the bass; tiny lights follow the percussion.', needsCamera: false };

function makeLayer(petals, layer) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1200;
  const ctx = canvas.getContext('2d'); ctx.translate(600, 600);
  const gold = ctx.createLinearGradient(-500, -500, 450, 550);
  gold.addColorStop(0, '#fff1bd'); gold.addColorStop(0.45, '#c79f52'); gold.addColorStop(0.7, '#f7dc91'); gold.addColorStop(1, '#9e752e');
  ctx.strokeStyle = gold; ctx.fillStyle = gold; ctx.lineWidth = 2.8;
  const radius = [245, 385, 520][layer];
  ring(ctx, radius, gold, 2.8); ring(ctx, radius - 9, '#d9b86dbb', 1.6);
  for (let i = 0; i < petals; i++) {
    ctx.save(); ctx.rotate(i * TAU / petals);
    const start = radius - (layer === 0 ? 75 : 105), end = radius - 17;
    ctx.beginPath(); ctx.moveTo(0, start);
    ctx.bezierCurveTo(-56, start + 20, -45, end - 40, 0, end);
    ctx.bezierCurveTo(45, end - 40, 56, start + 20, 0, start); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, start + 15); ctx.quadraticCurveTo(-15, end - 55, 0, end - 13); ctx.quadraticCurveTo(15, end - 55, 0, start + 15); ctx.stroke();
    for (let dot = 0; dot < 6; dot++) disc(ctx, Math.sin(dot * 0.3) * 8, radius - 4 + dot * 5, 1.4, '#f2d28d');
    ctx.rotate(TAU / petals / 2);
    ctx.beginPath(); ctx.moveTo(0, radius - 100); ctx.quadraticCurveTo(-35, radius - 40, 0, radius - 6); ctx.quadraticCurveTo(35, radius - 40, 0, radius - 100); ctx.stroke();
    disc(ctx, 0, radius + 10, 3, gold); ctx.restore();
  }
  for (let i = 0; i < petals * 8; i++) {
    const a = i * TAU / (petals * 8); disc(ctx, Math.cos(a) * (radius + 21), Math.sin(a) * (radius + 21), i % 4 ? 1 : 2, '#d8bb75');
  }
  return canvas;
}

export class RangoliScene {
  constructor() {
    this.phase = 0; this.layers = []; this.petals = 0;
    this.logo = loadLogo('./assets/pg-monogram.svg'); this.stamp = document.createElement('canvas');
    this.stamp.width = 912; this.stamp.height = 684; this.prepared = false;
  }
  render({ ctx, width: w, height: h, dt, audio, settings }) {
    const sound = musicStrength(audio, settings), petals = Number(settings.rangoliPetals || 16);
    this.phase += dt * (settings.reducedMotion ? 0 : 0.018 + sound.mid * 0.025);
    if (petals !== this.petals) { this.petals = petals; this.layers = [0, 1, 2].map(layer => makeLayer(petals, layer)); }
    const background = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.65);
    background.addColorStop(0, '#153b29'); background.addColorStop(0.5, '#082217'); background.addColorStop(1, '#020c08');
    ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
    const size = Math.min(w * 0.94, h * 1.04);
    ctx.save(); ctx.translate(w / 2, h / 2);
    for (let i = 2; i >= 0; i--) {
      ctx.save(); ctx.rotate(this.phase * (i % 2 ? -1 : 1) + i * 0.05);
      const scale = 1 + sound.bass * (0.018 + i * 0.01) + sound.pulse * 0.012;
      ctx.scale(scale, scale); ctx.globalAlpha = 0.9 + sound.pulse * 0.1;
      ctx.drawImage(this.layers[i], -size / 2, -size / 2, size, size); ctx.restore();
    }
    const glow = ctx.createRadialGradient(0, 0, size * 0.06, 0, 0, size * 0.23);
    glow.addColorStop(0, '#e6bf6920'); glow.addColorStop(1, '#d7b45d00'); disc(ctx, 0, 0, size * 0.23, glow);
    ring(ctx, size * 0.148, '#e0c27c', 1.3); ring(ctx, size * 0.157, '#b3934f66');
    for (let i = 0; i < petals; i++) {
      const a = i * TAU / petals + this.phase;
      const active = i % 4 === (audio.beatCount || 0) % 4;
      disc(ctx, Math.cos(a) * size * 0.463, Math.sin(a) * size * 0.463, size * (0.0018 + (active ? sound.pulse : 0) * 0.0025), '#ffe6a4');
    }
    if (this.logo.ready) {
      if (!this.prepared) { tintLogo(this.logo, this.stamp, '#f2d58c', [54, 33, 304, 228]); this.prepared = true; }
      const sw = size * 0.23 * (1 + sound.pulse * 0.025);
      ctx.drawImage(this.stamp, -sw / 2, -sw * 0.375, sw, sw * 0.75);
    }
    ctx.restore(); vignette(ctx, w, h, 0.38);
  }
}

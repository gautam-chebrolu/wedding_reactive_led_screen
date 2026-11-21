import { globalHubIllustration, hubGlass } from './kellogg-art.js';
import { stars, drawStars, caption } from './shared.js';
import { musicStrength, vignette } from './celebration-shared.js';

export const kelloggMetadata = { id: 'kellogg', name: 'Kellogg After Hours', type: 'GLOBAL HUB · LAKE MICHIGAN',
  description: 'The Global Hub glows purple beside Lake Michigan. Light travels through its curved glass wings and shimmers across the lake.', needsCamera: false };
export function hubWindowLight(audio, settings, group) {
  const sound = musicStrength(audio, settings);
  return 0.12 + sound.bass * 0.13 + sound.pulse * ((audio.beatCount || 0) % 4 === group ? 0.55 : 0.16);
}
export class KelloggScene {
  constructor() {
    this.phase = 0; this.points = stars(120); this.glass = new Path2D(hubGlass.join(' '));
    this.art = new Image(); this.ready = false; this.failed = false;
    this.art.onload = () => { this.ready = true; }; this.art.onerror = () => { this.failed = true; };
    this.art.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(globalHubIllustration)}`;
  }
  render({ ctx, width: w, height: h, dt, audio, settings }) {
    const sound = musicStrength(audio, settings); this.phase += dt * (settings.reducedMotion ? 0 : 0.4 + sound.mid * 0.35);
    const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#10142b'); bg.addColorStop(0.5, '#3a2e4b'); bg.addColorStop(0.75, '#19283e'); bg.addColorStop(1, '#060f20');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); drawStars(ctx, this.points, w, h * 0.7, this.phase * 0.15, sound.treble * 0.3);
    const scale = Math.min(w / 1600, h / 900), left = (w - 1600 * scale) / 2, top = (h - 900 * scale) / 2, horizon = top + 624 * scale;
    if (!this.ready) { caption(ctx, w, h, this.failed ? 'The Global Hub artwork is unavailable.' : 'Lighting the lakefront…', '', '#d1bddf'); return; }
    const water = ctx.createLinearGradient(0, horizon, 0, h); water.addColorStop(0, '#182238'); water.addColorStop(1, '#050d1c'); ctx.fillStyle = water; ctx.fillRect(0, horizon, w, h - horizon);
    ctx.save(); ctx.beginPath(); ctx.rect(0, horizon, w, h - horizon); ctx.clip(); ctx.translate(left, horizon * 2 - top); ctx.scale(scale, -scale); ctx.globalAlpha = 0.22 + sound.bass * 0.05; ctx.drawImage(this.art, 0, 0, 1600, 900); ctx.restore();
    ctx.save(); ctx.translate(left, top); ctx.scale(scale, scale); ctx.drawImage(this.art, 0, 0, 1600, 900);
    ctx.save(); ctx.clip(this.glass);
    for (let row = 0; row < 5; row++) for (let col = 0; col < 58; col++) {
      const glow = hubWindowLight(audio, settings, (Math.floor(col / 5) + row) % 4);
      ctx.fillStyle = `rgba(${row % 2 ? '211,177,238' : '177,140,233'},${glow})`; ctx.fillRect(150 + col * 23, 246 + row * 64, 19, 51);
    }
    ctx.restore(); ctx.restore();
    for (let i = 0; i < 70; i++) {
      const depth = i / 70, y = horizon + depth ** 1.5 * (h - horizon), span = w * (0.06 + depth * 0.5);
      const offset = Math.sin(i * 1.9 + this.phase * (0.5 + depth)) * w * 0.12;
      ctx.strokeStyle = `rgba(197,163,229,${(1 - depth) * (0.11 + sound.bass * 0.06)})`; ctx.lineWidth = 0.6 + depth * 1.5;
      ctx.beginPath(); ctx.moveTo(w / 2 + offset - span / 2, y); ctx.lineTo(w / 2 + offset + span / 2, y); ctx.stroke();
    }
    vignette(ctx, w, h, 0.38);
  }
}

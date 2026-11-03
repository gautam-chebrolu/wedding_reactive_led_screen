import { circle } from './shared.js';

export const kaleidoscopeMetadata = { id: 'kaleidoscope', name: 'Infinite bloom', type: 'GENERATIVE KALEIDOSCOPE', description: 'A living kaleidoscope of mirrored petals, ribbons, and gems. Bass opens the pattern; the beat turns its colors.', focal: 'Music-shaped geometry', needsCamera: false };
export class KaleidoscopeScene {
  constructor() {
    this.source = document.createElement('canvas'); this.source.width = this.source.height = 640;
    this.rotation = 0; this.phase = 0; this.hue = 174; this.hueOffset = 0; this.targetOffset = 0;
  }
  render({ ctx, width: w, height: h, dt, audio, settings, palette }) {
    const motion = settings.reducedMotion ? 0.12 : 1, intensity = settings.intensity;
    this.phase += dt * motion * (0.22 + audio.level * intensity * 0.7);
    this.rotation += dt * motion * (0.025 + audio.mid * intensity * 0.045);
    if (audio.beat) this.targetOffset += 21 * intensity;
    this.hueOffset += (this.targetOffset - this.hueOffset) * (1 - Math.exp(-dt * 2));
    this.hue = palette.hue + this.hueOffset;
    const c = this.source.getContext('2d'), s = 640, t = this.phase;
    const bg = c.createRadialGradient(s * 0.4, s * 0.4, 0, s / 2, s / 2, s * 0.8);
    bg.addColorStop(0, `hsl(${this.hue + 38},35%,12%)`); bg.addColorStop(1, '#03050e');
    c.fillStyle = bg; c.fillRect(0, 0, s, s);
    // A changing source field, then true alternating mirrored wedges below.
    for (let i = 0; i < 12; i++) {
      const a = i * 2.39996 + t * (i % 2 ? 1 : -0.65);
      const orbit = 100 + i * 11 + audio.bass * intensity * 55;
      const x = s / 2 + Math.cos(a) * orbit, y = s / 2 + Math.sin(a * 0.8) * orbit;
      const size = 30 + i * 3 + audio.level * intensity * 38;
      const color = this.hue + i * 17;
      const glow = c.createRadialGradient(x, y, 0, x, y, size * 2.4);
      glow.addColorStop(0, `hsla(${color},80%,65%,0.24)`); glow.addColorStop(1, `hsla(${color},70%,40%,0)`);
      circle(c, x, y, size * 2.4, glow);
      c.save(); c.translate(x, y); c.rotate(a + t);
      c.strokeStyle = `hsla(${color},75%,72%,0.8)`; c.fillStyle = `hsla(${color},70%,50%,0.18)`; c.lineWidth = 1.6 + audio.treble * intensity * 2;
      c.beginPath(); c.moveTo(0, -size);
      c.bezierCurveTo(size * 1.25, -size * 0.1, size * 0.7, size * 1.3, 0, size * (0.8 + audio.bass * intensity));
      c.bezierCurveTo(-size * 0.7, size, -size * 1.25, -size * 0.1, 0, -size); c.fill(); c.stroke();
      c.restore();
    }
    const sides = Number(settings.kaleidoSegments), angle = Math.PI * 2 / sides, radius = Math.hypot(w, h) / 2 + 3;
    ctx.fillStyle = '#03050e'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(this.rotation);
    for (let i = 0; i < sides; i++) {
      ctx.save(); ctx.rotate(i * angle); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius, -0.002, angle + 0.002); ctx.closePath(); ctx.clip();
      if (i % 2) { ctx.rotate(angle); ctx.scale(1, -1); }
      const scale = radius / 300 * (1 + audio.bass * intensity * 0.06 * motion);
      ctx.scale(scale, scale); ctx.drawImage(this.source, -180 + Math.sin(t * 0.5) * 24, -320); ctx.restore();
    }
    ctx.restore();
    const vignette = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(0.5, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  }
}

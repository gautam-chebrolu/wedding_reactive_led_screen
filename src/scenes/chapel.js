import { chapelIllustration, chapelWindows, pointedArch } from './chapel-art.js';
import { backdrop, caption, stars, drawStars } from './shared.js';
import { clamp } from '../math.js';

export const chapelMetadata = { id: 'chapel', name: 'Duke Chapel, after dark', type: 'CHAPEL LIGHT SHOW', description: 'A front-row view of Duke Chapel. Stained-glass windows glow, trade colors and flash with the music.', focal: 'Duke Chapel + beat-lit windows', needsCamera: false };

export function chapelWindowLight(audio, settings, group) {
  const active = (audio.beatCount || 0) % 4;
  const strength = clamp(settings.intensity) * (settings.reducedMotion ? 0.16 : 1);
  const pulse = clamp(audio.pulse || 0);
  return 0.12 + strength * (pulse * (active === group ? 0.85 : 0.46) + clamp(audio.bass || 0) * 0.03);
}

export class ChapelScene {
  constructor() {
    this.stars = stars(110);
    this.windows = chapelWindows.map(window => ({ ...window, path: new Path2D(pointedArch(window)) }));
    this.art = new Image(); this.ready = false; this.failed = false;
    this.art.onload = () => { this.ready = true; };
    this.art.onerror = () => { this.failed = true; };
    this.art.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(chapelIllustration)}`;
  }
  render({ ctx, width: w, height: h, time, audio, settings, palette }) {
    backdrop(ctx, w, h, 222);
    drawStars(ctx, this.stars, w, h, settings.reducedMotion ? 0 : time * 0.15);
    if (!this.ready) { caption(ctx, w, h, this.failed ? 'Chapel illustration unavailable' : 'Lighting the chapel…', '', '#d5c4a2'); return; }
    const scale = Math.min(w / 1240, h / 1030);
    const left = (w - 1200 * scale) / 2, top = (h - 1000 * scale) / 2;
    ctx.save(); ctx.translate(left, top); ctx.scale(scale, scale);
    // Ground and facade stay still; only the glass responds to music.
    const ground = ctx.createRadialGradient(600, 935, 10, 600, 935, 580);
    ground.addColorStop(0, '#293950'); ground.addColorStop(1, '#080f1a');
    ctx.fillStyle = ground; ctx.fillRect(-w / scale, 900, w / scale * 3, h / scale);
    ctx.drawImage(this.art, 0, 0, 1200, 1000);
    for (const window of this.windows) {
      const light = chapelWindowLight(audio, settings, window.group);
      const hue = settings.reducedMotion || settings.intensity === 0 ? 39 : palette.hue + window.group * 42;
      const color = `hsl(${hue},80%,${25 + light * 60}%)`;
      ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = light * 30;
      ctx.fillStyle = color; ctx.fill(window.path); ctx.restore();
      ctx.save(); ctx.clip(window.path);
      const glass = ctx.createLinearGradient(window.x, window.y, window.x + window.w, window.y + window.h);
      glass.addColorStop(0, `rgba(255,239,182,${light * 0.6})`); glass.addColorStop(0.5, 'rgba(255,255,255,0)'); glass.addColorStop(1, 'rgba(0,7,25,.45)');
      ctx.fillStyle = glass; ctx.fillRect(window.x, window.y, window.w, window.h);
      ctx.strokeStyle = '#273445'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 1; i < 4; i++) {
        const x = window.x + window.w * i / 4;
        ctx.moveTo(x, window.y); ctx.lineTo(x, window.y + window.h);
      }
      for (let y = window.y + window.w * 0.9; y < window.y + window.h; y += window.w * 0.7) {
        ctx.moveTo(window.x, y); ctx.lineTo(window.x + window.w, y);
      }
      ctx.stroke(); ctx.restore();
      ctx.strokeStyle = '#8993a1'; ctx.lineWidth = 2; ctx.stroke(window.path);
    }
    ctx.restore();
  }
}

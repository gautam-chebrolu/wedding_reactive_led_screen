import { backdrop, circle, drawStars, stars } from './shared.js';
import { clamp } from '../math.js';

export const portraitMetadata = { id: 'portrait', name: 'The headliner', type: 'PERSONAL', description: 'A whole cast of headliners. Cycle through your people, each with their own sound-driven mouth.', focal: 'Portrait roster + sound-driven mouth', needsCamera: false };
export class PortraitScene {
  constructor() { this.points = stars(100); this.rect = null; }
  pointer(x, y, settings) {
    if (!this.rect) return;
    settings.mouthX = clamp((x - this.rect.x) / this.rect.w);
    settings.mouthY = clamp((y - this.rect.y) / this.rect.h);
  }
  render({ ctx, width: w, height: h, time, audio, settings, palette, portrait }) {
    backdrop(ctx, w, h, palette.hue); drawStars(ctx, this.points, w, h, settings.reducedMotion ? 0 : time);
    const motion = settings.reducedMotion ? 0.15 : 1;
    ctx.strokeStyle = palette.accent;
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.09 - i * 0.012;
      ctx.lineWidth = h * 0.002; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, h * (0.3 + i * 0.09 + audio.level * settings.intensity * 0.05 * motion), h * (0.38 + i * 0.09), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    let rect;
    if (portrait) {
      const scale = Math.min(w * 0.86 / portrait.naturalWidth, h * 0.9 / portrait.naturalHeight);
      rect = { w: portrait.naturalWidth * scale, h: portrait.naturalHeight * scale };
      rect.x = (w - rect.w) / 2; rect.y = (h - rect.h) / 2;
      ctx.drawImage(portrait, rect.x, rect.y, rect.w, rect.h);
    } else {
      const size = Math.min(h * 0.8, w * 0.7);
      rect = { x: w / 2 - size * 0.38, y: h / 2 - size / 2, w: size * 0.76, h: size };
      ctx.save(); ctx.translate(rect.x, rect.y); ctx.scale(rect.w, rect.h);
      ctx.fillStyle = '#203a43'; ctx.beginPath(); ctx.ellipse(0.5, 1.02, 0.48, 0.25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ac7d62'; ctx.fillRect(0.39, 0.67, 0.22, 0.24);
      const skin = ctx.createLinearGradient(0.2, 0.3, 0.8, 0.65); skin.addColorStop(0, '#e2bb98'); skin.addColorStop(1, '#b38166');
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0.5, 0.42, 0.33, 0.36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a2229'; ctx.beginPath(); ctx.ellipse(0.49, 0.16, 0.34, 0.16, -0.12, Math.PI, Math.PI * 2); ctx.bezierCurveTo(0.85, 0.33, 0.7, 0.17, 0.57, 0.23); ctx.bezierCurveTo(0.35, 0.3, 0.21, 0.2, 0.16, 0.36); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#273138'; ctx.beginPath(); ctx.ellipse(0.36, 0.41, 0.035, 0.025, 0, 0, Math.PI * 2); ctx.ellipse(0.65, 0.41, 0.035, 0.025, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#96694e'; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(0.51, 0.44); ctx.lineTo(0.47, 0.55); ctx.lineTo(0.55, 0.55); ctx.stroke();
      ctx.restore();
    }
    this.rect = rect;
    const mouthW = rect.w * settings.mouthWidth;
    const mouthH = rect.h * settings.mouthHeight * (0.12 + audio.level * settings.intensity * 2.4);
    ctx.save(); ctx.translate(rect.x + rect.w * settings.mouthX, rect.y + rect.h * settings.mouthY); ctx.rotate(settings.mouthAngle * Math.PI / 180);
    ctx.fillStyle = '#030306'; ctx.beginPath(); ctx.ellipse(0, 0, mouthW / 2, Math.max(2, mouthH / 2), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (!portrait) {
      ctx.textAlign = 'center'; ctx.fillStyle = '#bac5ce'; ctx.font = `${Math.max(12, h * 0.02)}px system-ui`;
      ctx.fillText('YOUR PORTRAIT GOES HERE', w / 2, h * 0.96);
    }
  }
}

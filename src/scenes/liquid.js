import { LiquidShader } from './liquid-shader.js';
import { musicStrength, vignette } from './celebration-shared.js';

export const liquidMetadata = { id: 'liquid', name: 'Liquid Chrome / Silk', type: 'SCULPTED LIGHT',
  description: 'Flowing folds of liquid metal or luminous silk. Bass reshapes the surface; fine details shimmer with the music.', needsCamera: false };
export class LiquidScene {
  constructor() { this.shader = new LiquidShader(); this.phase = 0; }
  render({ ctx, width: w, height: h, dt, audio, settings, palette }) {
    const sound = musicStrength(audio, settings);
    this.phase += dt * (settings.reducedMotion ? 0.025 : 0.45 + sound.mid * 0.2);
    if (this.shader.render(w, h, this.phase, sound, settings.liquidMaterial || 'chrome', palette.accent)) {
      ctx.drawImage(this.shader.canvas, 0, 0, w, h); return;
    }
    // Graceful Canvas fallback for devices without an available GPU context.
    ctx.fillStyle = '#080c15'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const y = h * (i - 1) / 9, wave = Math.sin(this.phase * 0.4 + i * 0.8) * h * 0.2;
      const light = ctx.createLinearGradient(0, y, w, y + h * 0.2);
      light.addColorStop(0, '#080c15'); light.addColorStop(0.38, settings.liquidMaterial === 'silk' ? palette.second : '#7c91aa'); light.addColorStop(0.49, '#f2e2be'); light.addColorStop(0.55, '#27354a'); light.addColorStop(1, '#070d18');
      ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(-w * 0.1, y);
      ctx.bezierCurveTo(w * 0.25, y - h * 0.3 + wave, w * 0.6, y + h * 0.32 - wave, w * 1.1, y - h * 0.05);
      ctx.lineTo(w * 1.1, y + h * 0.16);
      ctx.bezierCurveTo(w * 0.55, y + h * 0.45 - wave, w * 0.3, y - h * 0.17 + wave, -w * 0.1, y + h * 0.14); ctx.closePath(); ctx.fill();
    }
    vignette(ctx, w, h, 0.3);
  }
}

import { backdrop, caption, circle } from './shared.js';

export const cameraMetadata = { id: 'camera', name: 'Dance floor prism', type: 'LIVE CAMERA', description: 'Turn the room into the visual. Beat-led color, soft echoes, or a kaleidoscope of the dance floor.', focal: 'Live camera + beat effects', needsCamera: true };
export class CameraScene {
  constructor() { this.echo = document.createElement('canvas'); this.lastEcho = -Infinity; this.hue = 0; }
  render({ ctx, width: w, height: h, time, audio, settings, palette, camera }) {
    backdrop(ctx, w, h, palette.hue);
    if (!camera.ready) {
      const r = h * 0.25;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + time * (settings.reducedMotion ? 0 : 0.03);
        circle(ctx, w / 2 + Math.cos(a) * r, h * 0.48 + Math.sin(a) * r, h * 0.12, `${palette.accent}0b`);
      }
      caption(ctx, w, h, 'Your dance floor, remixed.', 'Enable the camera in Scene setup to bring the room in.', palette.accent); return;
    }
    const motion = settings.reducedMotion ? 0 : settings.intensity;
    const zoom = 1 + audio.pulse * motion * 0.045;
    if (settings.cameraEffect === 'kaleidoscope') {
      const radius = Math.hypot(w, h);
      for (let i = 0; i < 6; i++) {
        ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(i * Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius, -0.006, Math.PI / 3 + 0.006); ctx.closePath(); ctx.clip();
        if (i % 2) { ctx.rotate(Math.PI / 3); ctx.scale(1, -1); }
        ctx.rotate(Math.sin(time * 0.1) * motion * 0.08); ctx.translate(-w / 2, -h / 2);
        camera.draw(ctx, w, h, { mirror: settings.mirror, zoom }); ctx.restore();
      }
    } else {
      camera.draw(ctx, w, h, { mirror: settings.mirror, zoom });
      if (settings.cameraEffect === 'echo') {
        if (this.echo.width !== w || this.echo.height !== h) { this.echo.width = w; this.echo.height = h; this.lastEcho = -Infinity; }
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.15 + audio.level * motion * 0.22;
        ctx.drawImage(this.echo, -w * 0.02, -h * 0.02, w * 1.04, h * 1.04); ctx.restore();
        if (time - this.lastEcho > 0.16) { camera.draw(this.echo.getContext('2d'), w, h, { mirror: settings.mirror }); this.lastEcho = time; }
      }
    }
    const target = palette.hue + (audio.beatCount % 4) * 12;
    this.hue += (target - this.hue) * 0.025;
    ctx.save(); ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = `hsla(${this.hue},65%,55%,${0.3 + settings.intensity * 0.32})`; ctx.fillRect(0, 0, w, h); ctx.restore();
    const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, Math.max(w, h) * 0.66);
    vignette.addColorStop(0, 'rgba(0,0,0,0.03)'); vignette.addColorStop(1, 'rgba(2,7,18,0.85)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  }
}

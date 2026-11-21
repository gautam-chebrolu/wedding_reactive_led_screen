import { DVDBounce } from '../dvd-physics.js';
import { loadLogo, tintLogo, pulseScale } from './logo-art.js';
import { caption } from './shared.js';

export const dvdMetadata = { id: 'dvd', name: 'One perfect corner', type: 'PG VIDEO', description: 'PG Video takes the classic screensaver bounce. A new color at every wall, a pulse on every beat. Wait for the corner.', focal: 'Bouncing PG Video + beat pulse', needsCamera: false };
export class DVDScene {
  constructor() {
    this.physics = new DVDBounce(); this.art = loadLogo('./assets/dvd.svg'); this.tint = null;
    this.texture = document.createElement('canvas'); this.texture.width = 920; this.texture.height = 420;
  }
  reset() { this.physics.reset(); this.tint = null; }
  render({ ctx, width: w, height: h, dt, audio, settings }) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    if (!this.art.ready) { caption(ctx, w, h, this.art.failed ? 'PG Video artwork unavailable' : 'Getting nostalgic…', '', '#bed5c5'); return; }
    const width = Math.min(w * 0.24, h * 0.42) * pulseScale(audio, settings, 0.16), height = width / this.art.aspect;
    const hit = this.physics.step(dt, w / h, width / w, height / h, settings.dvdSpeed * (settings.reducedMotion ? 0.35 : 1));
    if (hit || this.tint !== this.physics.hue) {
      const textureHeight = Math.round(this.texture.width / this.art.aspect);
      if (this.texture.height !== textureHeight) this.texture.height = textureHeight;
      tintLogo(this.art, this.texture, `hsl(${this.physics.hue},82%,68%)`); this.tint = this.physics.hue;
    }
    ctx.drawImage(this.texture, this.physics.x * w - width / 2, this.physics.y * h - height / 2, width, height);
  }
}

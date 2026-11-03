import { loadLogo, tintLogo, pulseScale } from './logo-art.js';
import { caption } from './shared.js';

export const monogramMetadata = { id: 'monogram', name: 'PG, in gold', type: 'YOUR MONOGRAM', description: 'Your original PG monogram, in warm gold on black. Each beat gives it a soft pulse.', focal: 'Gold monogram + beat pulse', needsCamera: false };
export class MonogramScene {
  constructor() {
    this.art = loadLogo('./assets/pg-monogram.svg'); this.texture = document.createElement('canvas');
    this.texture.width = 912; this.texture.height = 684; this.prepared = false;
  }
  render({ ctx, width: w, height: h, audio, settings }) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    if (!this.art.ready) {
      caption(ctx, w, h, this.art.failed ? 'Monogram unavailable' : 'A little gold is on its way.', this.art.failed ? 'Check assets/pg-monogram.svg.' : '', '#d4af5a'); return;
    }
    if (!this.prepared) {
      const gold = this.texture.getContext('2d').createLinearGradient(0, 0, this.texture.width * 0.3, this.texture.height);
      gold.addColorStop(0, '#f5dfa1'); gold.addColorStop(0.4, '#d5b46c'); gold.addColorStop(0.7, '#b98b39'); gold.addColorStop(1, '#ecd08a');
      // Crop only the empty invitation-frame margins; the original SVG paths/masks stay intact.
      tintLogo(this.art, this.texture, gold, [54, 33, 304, 228]); this.prepared = true;
    }
    const width = Math.min(w * 0.58, h * 0.76) * pulseScale(audio, settings, 0.13), height = width * 0.75;
    ctx.drawImage(this.texture, (w - width) / 2, (h - height) / 2, width, height);
  }
}

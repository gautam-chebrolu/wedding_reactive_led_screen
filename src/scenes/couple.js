import { DVDBounce } from '../dvd-physics.js';
import { loadLogo, pulseScale } from './logo-art.js';
import { caption } from './shared.js';
import { clamp } from '../math.js';

export const coupleMetadata = { id: 'couple', name: 'PG, on the bounce', type: 'TWO OF A KIND',
  description: 'Priya and Gautam, cut out and set loose. Two independent screensaver bounces, with a little bump on every beat.', needsCamera: false };

export class CoupleBounce {
  constructor() { this.people = [new DVDBounce(), new DVDBounce()]; this.reset(); }
  reset() {
    this.people.forEach(person => person.reset());
    Object.assign(this.people[0], { x: 0.25, y: 0.32, dx: 1, dy: 1 });
    Object.assign(this.people[1], { x: 0.75, y: 0.65, dx: -1, dy: -1 });
  }
  step(dt, w, h, aspects, audio, settings) {
    const pulse = clamp(audio.pulse || 0);
    const scale = pulseScale({ pulse }, settings, 0.18);
    const motion = settings.reducedMotion ? 0.22 : 1;
    const kick = 1 + pulse * settings.intensity * 0.4 * (settings.reducedMotion ? 0.18 : 1);
    return this.people.map((person, i) => {
      const height = Math.min(h * 0.42, w * 0.29 / aspects[i]) * scale;
      const width = height * aspects[i];
      person.step(dt, w / h, width / w, height / h, settings.coupleSpeed * (i ? 0.87 : 1.08) * motion * kick);
      return { x: person.x * w - width / 2, y: person.y * h - height / 2, width, height };
    });
  }
}

export class CoupleScene {
  constructor() {
    this.art = [loadLogo('./assets/couple/gautam.png'), loadLogo('./assets/couple/priya.png')];
    this.physics = new CoupleBounce();
  }
  reset() { this.physics.reset(); }
  render({ ctx, width: w, height: h, dt, audio, settings }) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    if (!this.art.every(art => art.ready)) {
      const failed = this.art.some(art => art.failed);
      caption(ctx, w, h, failed ? 'The couple’s photos could not load.' : 'Making an entrance…', failed ? 'Check the bundled couple images.' : '', '#e8d7ad');
      return;
    }
    const boxes = this.physics.step(dt, w, h, this.art.map(art => art.aspect), audio, settings);
    this.art.forEach((art, i) => {
      const box = boxes[i];
      ctx.drawImage(art.image, box.x, box.y, box.width, box.height);
    });
  }
}

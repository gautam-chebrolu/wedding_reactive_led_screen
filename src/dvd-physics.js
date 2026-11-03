import { clamp } from './math.js';

export class DVDBounce {
  constructor() { this.reset(); }
  reset() { this.x = 0.28; this.y = 0.3; this.dx = 1; this.dy = 1; this.hue = 45; this.hits = 0; }
  step(dt, aspect, widthFraction, heightFraction, speed) {
    const minX = widthFraction / 2, maxX = 1 - minX, minY = heightFraction / 2, maxY = 1 - minY;
    this.x += this.dx * speed / aspect * Math.min(dt, 0.05);
    this.y += this.dy * speed * 0.74 * Math.min(dt, 0.05);
    const hitX = (this.x <= minX && this.dx < 0) || (this.x >= maxX && this.dx > 0);
    const hitY = (this.y <= minY && this.dy < 0) || (this.y >= maxY && this.dy > 0);
    if (hitX) this.dx *= -1; if (hitY) this.dy *= -1;
    this.x = clamp(this.x, minX, maxX); this.y = clamp(this.y, minY, maxY);
    if (hitX || hitY) { this.hue = (this.hue + 137.508) % 360; this.hits++; }
    return hitX || hitY;
  }
}

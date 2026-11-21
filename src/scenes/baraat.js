import { seededRandom } from '../math.js';
import { TAU, disc, musicStrength, vignette } from './celebration-shared.js';

export const baraatMetadata = { id: 'baraat', name: 'Neon Baraat', type: 'DHOL & DANCE',
  description: 'A neon procession of dancing silhouettes, festival tassels and oversized dhols. The drums kick with the bass.', needsCamera: false };

function dancer(ctx, x, y, size, color, pose, flip) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size * flip, size);
  ctx.strokeStyle = color; ctx.lineWidth = 3.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Turban, flowing kurta, raised arms and bent knees form a full silhouette.
  disc(ctx, 0, -109, 12, '#b78d6f'); ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, -120, 17, 10, -0.15, Math.PI, TAU); ctx.lineTo(16, -112); ctx.lineTo(-15, -112); ctx.closePath(); ctx.fill(); ctx.stroke();
  const robe = ctx.createLinearGradient(-30, -95, 30, 10); robe.addColorStop(0, color + 'a0'); robe.addColorStop(1, color + '30'); ctx.fillStyle = robe;
  ctx.beginPath(); ctx.moveTo(-12, -95); ctx.quadraticCurveTo(-32, -83, -33, -51); ctx.lineTo(-21, -24); ctx.lineTo(-35, 3); ctx.lineTo(-17, 7); ctx.lineTo(0, -17); ctx.lineTo(18, 9); ctx.lineTo(34, 2); ctx.lineTo(22, -25); ctx.lineTo(31, -52); ctx.quadraticCurveTo(31, -87, 13, -95); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-22, -86); ctx.lineTo(-51, -111 + pose * 12); ctx.lineTo(-64, -145 + pose * 12);
  ctx.moveTo(22, -87); ctx.lineTo(52, -104 - pose * 8); ctx.lineTo(68, -141 - pose * 10);
  ctx.moveTo(-20, 2); ctx.lineTo(-26, 35 + pose * 4); ctx.lineTo(-49, 44 + pose * 4);
  ctx.moveTo(20, 3); ctx.lineTo(37, 25 - pose * 10); ctx.lineTo(62, 23 - pose * 10); ctx.stroke();
  disc(ctx, -64, -145 + pose * 12, 4, color); disc(ctx, 68, -141 - pose * 10, 4, color);
  ctx.restore();
}
function dhol(ctx, x, y, size, rotation, sound, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(size, size);
  const wood = ctx.createLinearGradient(0, -75, 0, 75);
  wood.addColorStop(0, '#e79d42'); wood.addColorStop(0.25, '#a43c62'); wood.addColorStop(0.5, '#512462'); wood.addColorStop(0.8, '#a34f5e'); wood.addColorStop(1, '#e6a948');
  ctx.fillStyle = wood; ctx.beginPath(); ctx.moveTo(-115, -62); ctx.bezierCurveTo(-55, -82, 55, -82, 115, -62); ctx.lineTo(115, 62); ctx.bezierCurveTo(55, 82, -55, 82, -115, 62); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffcf7d'; ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) { const xx = -110 + i * 24; ctx.beginPath(); ctx.moveTo(xx, -62); ctx.lineTo(xx + 23, 65); ctx.lineTo(xx + 45, -62); ctx.stroke(); }
  for (const side of [-1, 1]) {
    const cx = side * 115, expand = 1 + sound.bass * 0.12 + sound.pulse * 0.055;
    ctx.save(); ctx.translate(cx, 0); ctx.scale(expand, 1);
    ctx.fillStyle = '#eadbb5'; ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, 0, 26, 66, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#614d68'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, 18, 53, 0, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(cx * 1.15, -86); ctx.rotate(side * (0.5 - sound.pulse * 0.6)); ctx.strokeStyle = '#f9d7a5'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, 17); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

export class BaraatScene {
  constructor() { this.phase = 0; const random = seededRandom(562); this.sparks = Array.from({ length: 75 }, () => ({ x: random(), y: random(), angle: random() * TAU, speed: random() + 0.3 })); }
  render({ ctx, width: w, height: h, dt, audio, settings }) {
    const sound = musicStrength(audio, settings), motion = settings.reducedMotion ? 0 : 1;
    this.phase += dt * (0.5 + sound.mid) * motion;
    const bg = ctx.createRadialGradient(w / 2, h * 0.7, 0, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    bg.addColorStop(0, '#371c55'); bg.addColorStop(0.4, '#141033'); bg.addColorStop(1, '#040712'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const colors = ['#ff9d47', '#f269b3', '#74e6e0', '#bea4ff'];
    // Decorative strings and pendants fill the upper edge without flashing.
    for (let row = 0; row < 2; row++) {
      ctx.strokeStyle = '#b2926155'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, h * (0.02 + row * 0.03)); ctx.quadraticCurveTo(w / 2, h * (0.22 + row * 0.04), w, h * (0.02 + row * 0.03)); ctx.stroke();
      for (let i = 0; i < 22; i++) {
        const u = (i + 0.5) / 22, x = u * w, y = h * (0.02 + row * 0.03 + 0.4 * u * (1 - u));
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(this.phase + i) * 0.09 * motion);
        ctx.strokeStyle = colors[(i + row) % 4]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, h * 0.045); ctx.stroke();
        ctx.fillStyle = colors[(i + row) % 4]; ctx.beginPath(); ctx.moveTo(0, h * 0.04); ctx.lineTo(h * 0.009, h * 0.065); ctx.lineTo(-h * 0.009, h * 0.065); ctx.fill(); ctx.restore();
      }
    }
    const count = Math.min(18, Math.max(5, Math.round(w / h * 4)));
    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length], x = (i + 0.5) / count * w;
      const pose = Math.sin(this.phase * 1.5 + i * 1.6) * (0.3 + sound.pulse * 0.7);
      dancer(ctx, x, h * 0.64 - sound.pulse * h * 0.012, h / 570, color, settings.reducedMotion ? 0 : pose, i % 2 ? 1 : -1);
    }
    ctx.strokeStyle = '#b482d333'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const y = h * (0.74 + i * 0.025); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const ds = Math.min(w / 900, h / 520);
    dhol(ctx, w * 0.34, h * 0.78, ds, -0.16 - sound.pulse * 0.018, sound, colors[0]);
    dhol(ctx, w * 0.67, h * 0.79, ds * 0.91, 0.17 + sound.pulse * 0.018, sound, colors[2]);
    for (let i = 0; i < this.sparks.length; i++) {
      const spark = this.sparks[i], y = ((spark.y - this.phase * 0.035 * spark.speed) % 1 + 1) % 1;
      ctx.save(); ctx.translate(spark.x * w, y * h); ctx.rotate(spark.angle + this.phase * 0.3); ctx.globalAlpha = 0.22 + sound.treble * 0.6;
      ctx.fillStyle = colors[i % 4]; ctx.fillRect(-1.5, -3, 3, 6); ctx.restore();
    }
    vignette(ctx, w, h, 0.45);
  }
}

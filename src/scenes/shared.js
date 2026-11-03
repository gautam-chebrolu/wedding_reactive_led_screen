import { seededRandom } from '../math.js';

export function circle(ctx, x, y, radius, fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, radius), 0, Math.PI * 2); ctx.fill();
}
export function backdrop(ctx, width, height, hue = 175) {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.36, 0, width * 0.5, height * 0.5, width * 0.8);
  gradient.addColorStop(0, `hsl(${hue}, 33%, 12%)`); gradient.addColorStop(0.55, '#0b1421'); gradient.addColorStop(1, '#03060e');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
}
export function stars(count = 350) {
  const rand = seededRandom(814);
  return Array.from({ length: count }, () => ({ x: rand(), y: rand(), radius: rand() * 1.25 + 0.3, phase: rand() * 6.28 }));
}
export function drawStars(ctx, points, width, height, time, energy = 0) {
  for (const star of points) {
    const opacity = 0.25 + (Math.sin(time * 0.5 + star.phase) + 1) * 0.22 + energy * 0.15;
    circle(ctx, star.x * width, star.y * height * 0.85, star.radius * Math.max(0.6, height / 800), `rgba(220,235,247,${opacity})`);
  }
}
export function caption(ctx, width, height, title, subline, accent) {
  ctx.textAlign = 'center'; ctx.fillStyle = accent;
  ctx.font = `${Math.max(20, height * 0.052)}px Georgia, serif`;
  ctx.fillText(title, width / 2, height * 0.49);
  ctx.fillStyle = '#bdc6d1'; ctx.font = `${Math.max(12, height * 0.023)}px system-ui, sans-serif`;
  ctx.fillText(subline, width / 2, height * 0.56);
}

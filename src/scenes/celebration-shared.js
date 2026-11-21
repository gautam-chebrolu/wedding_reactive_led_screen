import { clamp } from '../math.js';

export const TAU = Math.PI * 2;
export function musicStrength(audio, settings) {
  const amount = clamp(settings.intensity) * (settings.reducedMotion ? 0.12 : 1);
  return { amount, bass: clamp(audio.bass || 0) * amount, mid: clamp(audio.mid || 0) * amount,
    treble: clamp(audio.treble || 0) * amount, pulse: clamp(audio.pulse || 0) * amount };
}
export function disc(ctx, x, y, r, fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, TAU); ctx.fill();
}
export function ring(ctx, radius, color, line = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = line; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke();
}
export function vignette(ctx, w, h, strength = 0.65) {
  const shade = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.hypot(w, h) * 0.56);
  shade.addColorStop(0, '#0000'); shade.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
}
export function ornamentLeaf(ctx, x, y, size, angle, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.strokeStyle = color;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(size * 0.9, -size * 0.65, size * 1.2, size * 0.1, size * 0.2, size * 0.7);
  ctx.bezierCurveTo(size * 0.35, size * 0.25, size * 0.25, size * 0.1, 0, 0); ctx.stroke(); ctx.restore();
}

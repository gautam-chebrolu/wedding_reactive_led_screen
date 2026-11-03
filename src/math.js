export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const median = values => {
  const a = [...values].sort((x, y) => x - y);
  return a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2 : 0;
};
export function seededRandom(seed = 1234) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
export function coverRect(sw, sh, dw, dh) {
  const scale = Math.max(dw / sw, dh / sh);
  return { x: (dw - sw * scale) / 2, y: (dh - sh * scale) / 2, w: sw * scale, h: sh * scale };
}

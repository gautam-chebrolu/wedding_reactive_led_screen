export const mouthRanges = {
  mouthX: [0, 1], mouthY: [0, 1], mouthWidth: [0.02, 0.6],
  mouthHeight: [0.01, 0.4], mouthAngle: [-60, 60]
};
export const mouthDefaults = { mouthX: 0.5, mouthY: 0.65, mouthWidth: 0.18, mouthHeight: 0.12, mouthAngle: 0 };
export const gautamMouth = { mouthX: 0.46, mouthY: 0.475, mouthWidth: 0.11, mouthHeight: 0.05, mouthAngle: 0 };
export function sanitizeMouth(input, fallback = mouthDefaults) {
  return Object.fromEntries(Object.entries(mouthRanges).map(([key, [min, max]]) => {
    const value = input?.[key];
    return [key, typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback[key]];
  }));
}
export function sanitizePortraitMouths(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).slice(0, 100).filter(([id]) => id.length > 0 && id.length <= 300 && !['__proto__', 'constructor', 'prototype'].includes(id)).map(([id, mouth]) => [id, sanitizeMouth(mouth)]));
}

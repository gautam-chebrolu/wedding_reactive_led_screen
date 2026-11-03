import { sceneIds } from './scene-ids.js';
import { sanitizePortraitMouths } from './portrait-settings.js';

export const palettes = {
  moonstone: { name: 'Moonstone', hue: 174, accent: '#a2ead5', second: '#c3b7ed', warm: '#e8d7ad' },
  rose: { name: 'Rose quartz', hue: 335, accent: '#f2b6c9', second: '#d4b6ec', warm: '#eed2a4' },
  amber: { name: 'Golden hour', hue: 37, accent: '#f0d49b', second: '#e6a69b', warm: '#fff0ce' },
  violet: { name: 'Ultraviolet', hue: 265, accent: '#cbb7ff', second: '#8fd6ec', warm: '#efc0e5' }
};
export const defaults = {
  scene: 'moon', palette: 'moonstone', sensitivity: 1.4, intensity: 0.65,
  brightness: 0.8, reducedMotion: false, resolution: '1920',
  autoCycle: false, cycleSeconds: 60, mouthX: 0.5, mouthY: 0.65,
  mouthWidth: 0.18, mouthHeight: 0.12, mouthAngle: 0,
  cameraEffect: 'prism', mirror: true, motionThreshold: 28, ballGravity: 0.65,
  portraitCycle: false, portraitCycleSeconds: 12, portraitId: '', portraitMouths: {},
  dvdSpeed: 0.18, kaleidoSegments: '12'
};
const ranges = {
  sensitivity: [0.3, 4], intensity: [0, 1], brightness: [0, 1], cycleSeconds: [15, 300],
  mouthX: [0, 1], mouthY: [0, 1], mouthWidth: [0.02, 0.6], mouthHeight: [0.01, 0.4],
  mouthAngle: [-60, 60], motionThreshold: [8, 80], ballGravity: [0.2, 1.5],
  portraitCycleSeconds: [3, 120], dvdSpeed: [0.05, 0.6]
};
export function sanitizeSettings(input) {
  const result = { ...defaults, portraitMouths: {} };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  for (const [key, original] of Object.entries(defaults)) {
    const value = input[key];
    if (ranges[key] && typeof value === 'number' && Number.isFinite(value)) result[key] = Math.max(ranges[key][0], Math.min(ranges[key][1], value));
    else if (typeof original === 'boolean' && typeof value === 'boolean') result[key] = value;
  }
  for (const [key, choices] of Object.entries({ scene: sceneIds, palette: Object.keys(palettes), resolution: ['1280', '1920', '2560'], cameraEffect: ['prism', 'echo', 'kaleidoscope'], kaleidoSegments: ['8', '12', '16'] })) {
    if (choices.includes(input[key])) result[key] = input[key];
  }
  if (typeof input.portraitId === 'string' && input.portraitId.length <= 300) result.portraitId = input.portraitId;
  result.portraitMouths = sanitizePortraitMouths(input.portraitMouths);
  return result;
}
export function loadSettings() {
  try { return sanitizeSettings(JSON.parse(localStorage.getItem('afterglow.settings'))); }
  catch { return sanitizeSettings(null); }
}
export function saveSettings(settings) {
  try { localStorage.setItem('afterglow.settings', JSON.stringify(settings)); } catch { /* The show still runs if storage is unavailable. */ }
}

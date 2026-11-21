import { caption } from './shared.js';
import { TAU, disc, musicStrength, vignette } from './celebration-shared.js';

export const tunakMetadata = { id: 'tunak', name: 'Tunak Takeover', type: 'DALER ON THE BEAT',
  description: 'One giant bobbing Daler, or an entire colourful takeover. His head nods and shoulders bounce to your DJ’s actual beat.', needsCamera: false };
export function tunakPose(age, audio, settings) {
  const strength = musicStrength(audio, settings).amount;
  const envelope = Math.exp(-Math.max(0, age) * 7);
  return { nod: Math.sin(Math.max(0, age) * 20) * envelope * strength * 0.22,
    headY: envelope * strength * 19, shoulderY: -envelope * strength * 17 };
}
export class TunakScene {
  constructor() {
    this.art = new Image(); this.ready = false; this.failed = false; this.phase = 0; this.age = 10; this.lastBeat = -1; this.beats = 0;
    this.art.onload = () => { this.ready = true; }; this.art.onerror = () => { this.failed = true; };
    this.art.src = './assets/tunak/daler-atlas.png';
  }
  person(ctx, x, floor, height, pose, hue = 0, mirror = false, alpha = 1) {
    ctx.save(); ctx.translate(x, floor + pose.shoulderY * height / 1150); ctx.scale((mirror ? -1 : 1) * height / 1150, height / 1150);
    ctx.globalAlpha = alpha; ctx.filter = hue ? `hue-rotate(${hue}deg)` : 'none';
    ctx.drawImage(this.art, 0, 0, 820, 1024, -410, -1024, 820, 1024);
    ctx.translate(-26, -909 + pose.headY); ctx.rotate(pose.nod);
    ctx.drawImage(this.art, 815, 90, 670, 850, -129, -289, 258, 327);
    ctx.restore();
  }
  render({ ctx, width: w, height: h, dt, audio, settings, palette }) {
    const sound = musicStrength(audio, settings); this.phase += dt * (settings.reducedMotion ? 0 : 0.22 + sound.mid * 0.3); this.age += dt;
    if (audio.beat && audio.beatCount !== this.lastBeat) {
      this.lastBeat = audio.beatCount;
      if (this.beats++ % Number(settings.tunakRate || '1') === 0) this.age = 0;
    }
    const bg = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.5, Math.hypot(w, h) * 0.6);
    bg.addColorStop(0, '#322866'); bg.addColorStop(0.4, '#111634'); bg.addColorStop(1, '#040712'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 20; i++) {
      const a = i * TAU / 20 + this.phase * 0.15, radius = Math.hypot(w, h);
      ctx.fillStyle = `hsla(${palette.hue + i * 12},65%,60%,${0.015 + sound.pulse * 0.009})`;
      ctx.beginPath(); ctx.moveTo(w / 2, h * 0.65); ctx.lineTo(w / 2 + Math.cos(a) * radius, h * 0.65 + Math.sin(a) * radius); ctx.lineTo(w / 2 + Math.cos(a + 0.065) * radius, h * 0.65 + Math.sin(a + 0.065) * radius); ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.translate(w / 2, h * 0.87); ctx.strokeStyle = `${palette.accent}22`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, h * (0.2 + i * 0.12), h * (0.04 + i * 0.02), 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (!this.ready) { caption(ctx, w, h, this.failed ? 'Tunak artwork unavailable.' : 'Daler is getting ready…', '', palette.accent); return; }
    const pose = tunakPose(this.age, audio, settings);
    if (settings.tunakMode !== 'solo') {
      for (let i = 0; i < 4; i++) {
        const x = [0.12, 0.31, 0.69, 0.88][i] * w;
        const height = Math.min(h * (i % 2 ? 0.58 : 0.46), w * 0.36);
        this.person(ctx, x, h * 0.94, height, { ...pose, nod: pose.nod * (i % 2 ? -1 : 1) }, (i - 1) * 50, i % 2 === 0, 0.82);
      }
    }
    const centerHeight = Math.min(h * 0.88, w * (settings.tunakMode === 'solo' || w / h < 1.25 ? 1.08 : 0.66));
    disc(ctx, w / 2, h * 0.47, h * 0.21, '#e3c88706');
    this.person(ctx, w / 2, h * 0.97, centerHeight, pose);
    vignette(ctx, w, h, 0.28);
  }
}

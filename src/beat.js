import { clamp, median } from './math.js';

// Adaptive onset detector. These are detected accents, not inferred musical downbeats.
export class BeatDetector {
  constructor() { this.reset(); }
  reset() {
    this.history = [];
    this.intervals = [];
    this.lastBeat = -Infinity;
    this.previousEnergy = 0;
    this.bpm = 0;
    this.confidence = 0;
    this.count = 0;
  }
  update(energy, level, now, sensitivity = 1) {
    this.history = this.history.filter(point => now - point.time < 1600);
    const mean = this.history.length ? this.history.reduce((sum, p) => sum + p.energy, 0) / this.history.length : energy;
    const variance = this.history.length ? this.history.reduce((sum, p) => sum + (p.energy - mean) ** 2, 0) / this.history.length : 0;
    const threshold = mean + Math.max(0.035, Math.sqrt(variance) * 1.15) / sensitivity;
    const beat = this.history.length >= 8 && level > 0.012 && energy > threshold && energy > this.previousEnergy + 0.012 && now - this.lastBeat >= 260;
    this.history.push({ energy, time: now });
    this.previousEnergy = energy;
    if (beat) {
      const interval = now - this.lastBeat;
      if (interval >= 300 && interval <= 1500) {
        this.intervals.push(interval);
        if (this.intervals.length > 12) this.intervals.shift();
        const center = median(this.intervals);
        const consistent = this.intervals.filter(value => Math.abs(value - center) < center * 0.18);
        if (consistent.length >= 3) this.bpm = Math.round(60000 / median(consistent));
        this.confidence = clamp(consistent.length / 8) * (consistent.length / this.intervals.length);
      } else if (interval > 2000) {
        this.intervals = []; this.bpm = 0; this.confidence = 0;
      }
      this.lastBeat = now;
      this.count++;
    }
    if (now - this.lastBeat > 2500) { this.bpm = 0; this.confidence = 0; }
    return { beat, bpm: this.bpm, confidence: this.confidence, beatCount: this.count };
  }
}

export class TapClock {
  constructor() { this.clear(); }
  clear() { this.taps = []; this.bpm = 0; this.anchor = 0; this.lastIndex = -1; }
  tap(now) {
    if (this.taps.length && now - this.taps.at(-1) > 2000) this.clear();
    if (this.taps.length && now - this.taps.at(-1) < 200) return this.bpm;
    this.taps.push(now);
    if (this.taps.length > 8) this.taps.shift();
    if (this.taps.length > 1) {
      const gaps = this.taps.slice(1).map((time, i) => time - this.taps[i]);
      this.bpm = clamp(60000 / median(gaps), 40, 240);
    }
    this.anchor = now;
    this.lastIndex = -1;
    return this.bpm;
  }
  firstBeat(now) { this.anchor = now; this.lastIndex = -1; }
  setTempo(bpm, anchor) {
    this.clear(); this.bpm = clamp(bpm, 40, 240); this.anchor = anchor;
  }
  update(now) {
    if (!this.bpm) return null;
    const elapsed = Math.max(0, (now - this.anchor) / (60000 / this.bpm));
    const index = Math.floor(elapsed);
    const beat = index !== this.lastIndex;
    this.lastIndex = index;
    return { beat, bpm: Math.round(this.bpm), confidence: 1, beatCount: index + 1, beatInBar: index % 4 + 1, phase: elapsed % 1 };
  }
}

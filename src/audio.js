import { BeatDetector, TapClock } from './beat.js';
import { clamp, lerp } from './math.js';

export class AudioEngine {
  constructor(onStatus = () => {}) {
    this.onStatus = onStatus;
    this.mode = 'demo';
    this.label = 'Demo signal';
    this.generation = 0;
    this.detector = new BeatDetector();
    this.tapClock = new TapClock();
    this.level = 0; this.bass = 0; this.mid = 0; this.treble = 0; this.pulse = 0;
    this.lastDemoBeat = -1; this.beatCount = 0; this.muted = false;
    this.spectrum = new Uint8Array(64);
  }
  async contextReady() {
    if (!this.context) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error('This browser does not support Web Audio. Demo mode is available.');
      this.context = new Context();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.65;
      this.frequency = new Uint8Array(this.analyser.frequencyBinCount);
      this.previousFrequency = new Uint8Array(this.analyser.frequencyBinCount);
      this.wave = new Float32Array(this.analyser.fftSize);
      this.gain = this.context.createGain();
      this.gain.gain.value = this.muted ? 0 : 1;
      this.gain.connect(this.context.destination);
    }
    await this.context.resume();
  }
  stop(mode = 'idle') {
    this.generation++;
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    this.stream = null;
    if (this.element) { this.element.pause(); this.element.removeAttribute('src'); this.element.load(); this.element = null; }
    if (this.objectURL) URL.revokeObjectURL(this.objectURL);
    this.objectURL = null;
    this.source?.disconnect(); this.source = null;
    this.analyser?.disconnect();
    this.mode = mode; this.label = mode === 'demo' ? 'Demo signal' : 'No audio input';
    this.detector.reset(); this.tapClock.clear(); this.lastDemoBeat = -1; this.beatCount = 0; this.pulse = 0;
    this.previousFrequency?.fill(0);
    this.spectrum.fill(0);
    this.onStatus();
    return this.generation;
  }
  demo() { this.stop('demo'); }
  async microphone(deviceId = '') {
    const token = this.stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone input needs localhost or HTTPS and a supported browser.');
    await this.contextReady();
    if (token !== this.generation) return false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    if (token !== this.generation) { stream.getTracks().forEach(track => track.stop()); return false; }
    this.attachStream(stream, 'microphone', stream.getAudioTracks()[0]?.label || 'Microphone');
    return true;
  }
  async sharedAudio() {
    const token = this.stop();
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Tab audio capture is unavailable here. Try microphone or a local track.');
    // Call capture before awaiting resume to preserve the click's user activation.
    const contextPromise = this.contextReady();
    const capturePromise = navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: 'include' });
    const [contextResult, captureResult] = await Promise.allSettled([contextPromise, capturePromise]);
    if (captureResult.status === 'rejected') throw captureResult.reason;
    const stream = captureResult.value;
    if (contextResult.status === 'rejected' || token !== this.generation || !stream.getAudioTracks().length) {
      stream.getTracks().forEach(track => track.stop());
      if (contextResult.status === 'rejected') throw contextResult.reason;
      if (token !== this.generation) return false;
      throw new Error('No audio was shared. Select a browser tab and enable “Share tab audio”, or use an audio interface.');
    }
    this.attachStream(stream, 'shared', 'Shared tab / system audio');
    return true;
  }
  attachStream(stream, mode, label) {
    this.stream = stream;
    this.source = this.context.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    // Microphone and shared audio are analysed only, never sent to the speakers.
    this.mode = mode; this.label = label;
    const token = this.generation;
    stream.getTracks().forEach(track => { track.onended = () => { if (token === this.generation) this.stop(); }; });
    this.onStatus();
  }
  async localFile(file) {
    const token = this.stop();
    await this.contextReady();
    if (token !== this.generation) return false;
    this.objectURL = URL.createObjectURL(file);
    const element = new Audio(this.objectURL);
    element.loop = true;
    this.element = element;
    this.source = this.context.createMediaElementSource(element);
    this.source.connect(this.analyser);
    this.analyser.connect(this.gain);
    try { await element.play(); }
    catch (error) { if (token === this.generation) this.stop(); throw error; }
    if (token !== this.generation) return false;
    this.mode = 'file'; this.label = file.name; this.onStatus(); return true;
  }
  setMuted(muted) { this.muted = muted; if (this.gain) this.gain.gain.value = muted ? 0 : 1; }
  async togglePlayback() {
    if (!this.element) return;
    if (this.element.paused) { await this.contextReady(); await this.element.play(); }
    else this.element.pause();
    this.onStatus();
  }
  band(low, high) {
    const bin = this.context.sampleRate / this.analyser.fftSize;
    const start = Math.max(1, Math.floor(low / bin));
    const end = Math.min(this.frequency.length, Math.ceil(high / bin));
    let total = 0;
    for (let i = start; i < end; i++) total += this.frequency[i] / 255;
    return total / Math.max(1, end - start);
  }
  update(now, dt, settings) {
    let level = 0, bass = 0, mid = 0, treble = 0, rhythm = { beat: false, bpm: 0, confidence: 0, beatCount: this.beatCount };
    if (this.mode === 'demo') {
      const seconds = now / 1000, phase = seconds * 112 / 60;
      const hit = Math.exp(-(phase % 1) * 12);
      level = (0.1 + hit * 0.28 + Math.sin(seconds * 1.7) * 0.04) * settings.sensitivity;
      bass = hit * 0.85; mid = 0.25 + Math.sin(seconds * 3) * 0.15; treble = Math.exp(-((phase * 2) % 1) * 9) * 0.5;
      const index = Math.floor(phase);
      rhythm = { beat: index !== this.lastDemoBeat, bpm: 112, confidence: 1, beatCount: this.beatCount };
      if (rhythm.beat) this.beatCount++;
      rhythm.beatCount = this.beatCount; this.lastDemoBeat = index;
      for (let i = 0; i < this.spectrum.length; i++) this.spectrum[i] = clamp((Math.sin(i * 0.6 + seconds) * 0.2 + 0.5) * (1 - i / 80) + hit * 0.3) * 255;
    } else if (this.source && this.context.state === 'running') {
      this.analyser.getFloatTimeDomainData(this.wave);
      this.analyser.getByteFrequencyData(this.frequency);
      let sum = 0;
      for (const value of this.wave) sum += value * value;
      const rms = Math.sqrt(sum / this.wave.length);
      level = clamp(rms * settings.sensitivity * 3);
      bass = this.band(35, 180); mid = this.band(180, 2500); treble = this.band(2500, 10000);
      let flux = 0;
      for (let i = 1; i < 128; i++) flux += Math.max(0, this.frequency[i] - this.previousFrequency[i]) / 255;
      this.previousFrequency.set(this.frequency);
      rhythm = this.detector.update(bass * 0.8 + flux / 127 * 0.8, rms, now, Math.sqrt(settings.sensitivity));
      for (let i = 0; i < 64; i++) this.spectrum[i] = this.frequency[Math.min(this.frequency.length - 1, Math.floor(2 ** (i / 7)))];
    }
    const manual = this.tapClock.update(now);
    if (manual) rhythm = manual;
    if (rhythm.beat) this.pulse = 1;
    else this.pulse *= Math.exp(-dt * 5);
    const follow = 1 - Math.exp(-dt * 14);
    this.level = lerp(this.level, clamp(level), follow);
    this.bass = lerp(this.bass, bass, follow); this.mid = lerp(this.mid, mid, follow); this.treble = lerp(this.treble, treble, follow);
    return { level: this.level, bass: this.bass, mid: this.mid, treble: this.treble, pulse: this.pulse, ...rhythm, manual: Boolean(manual), spectrum: this.spectrum, beatInBar: manual?.beatInBar || 0 };
  }
}

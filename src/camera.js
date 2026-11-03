import { coverRect } from './math.js';
import { motionDifference } from './motion.js';

export class CameraInput {
  constructor(onStatus = () => {}) {
    this.onStatus = onStatus; this.generation = 0; this.cols = 96; this.rows = 54;
    this.video = document.createElement('video');
    this.video.muted = true; this.video.playsInline = true;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.cols; this.canvas.height = this.rows;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.field = new Float32Array(this.cols * this.rows); this.lastUpdate = 0; this.ready = false;
    this.aspect = 16 / 9;
  }
  async start(deviceId = '') {
    this.stop(); const token = this.generation;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera input needs localhost or HTTPS and a supported browser.');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) }, audio: false });
    if (token !== this.generation) { stream.getTracks().forEach(track => track.stop()); return false; }
    this.stream = stream; this.video.srcObject = stream;
    try { await this.video.play(); }
    catch (error) { if (token === this.generation) this.stop(); throw error; }
    if (token !== this.generation) return false;
    this.ready = true;
    stream.getTracks().forEach(track => { track.onended = () => { if (token === this.generation) this.stop(); }; });
    this.onStatus(); return true;
  }
  stop() {
    this.generation++; this.ready = false;
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); }); this.stream = null;
    this.video.pause(); this.video.srcObject = null;
    this.previous = null; this.field.fill(0); this.onStatus();
  }
  update(now, settings, aspect = 16 / 9) {
    if (!this.ready || this.video.readyState < 2 || now - this.lastUpdate < 1000 / 24) return;
    this.lastUpdate = now;
    const rows = Math.max(24, Math.round(this.cols / aspect));
    if (rows !== this.rows || this.lastMirror !== settings.mirror) {
      this.rows = rows; this.canvas.height = rows; this.previous = null;
      this.field = new Float32Array(this.cols * rows); this.lastMirror = settings.mirror;
    }
    this.aspect = aspect;
    this.ctx.save();
    if (settings.mirror) { this.ctx.translate(this.cols, 0); this.ctx.scale(-1, 1); }
    const rect = coverRect(this.video.videoWidth, this.video.videoHeight, this.cols, this.rows);
    this.ctx.drawImage(this.video, rect.x, rect.y, rect.w, rect.h); this.ctx.restore();
    const pixels = this.ctx.getImageData(0, 0, this.cols, this.rows).data;
    const luma = new Float32Array(this.cols * this.rows);
    for (let i = 0; i < luma.length; i++) luma[i] = pixels[i * 4] * 0.299 + pixels[i * 4 + 1] * 0.587 + pixels[i * 4 + 2] * 0.114;
    this.field = motionDifference(luma, this.previous, settings.motionThreshold); this.previous = luma;
  }
  draw(ctx, width, height, { mirror = true, zoom = 1, alpha = 1 } = {}) {
    if (!this.ready || this.video.readyState < 2) return false;
    const rect = coverRect(this.video.videoWidth, this.video.videoHeight, width, height);
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.translate(width / 2, height / 2); ctx.scale((mirror ? -1 : 1) * zoom, zoom);
    ctx.drawImage(this.video, rect.x - width / 2, rect.y - height / 2, rect.w, rect.h); ctx.restore(); return true;
  }
}

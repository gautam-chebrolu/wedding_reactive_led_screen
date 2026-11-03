import { clamp } from './math.js';
import { palettes } from './settings.js';
import { sceneRegistry } from './scenes/index.js';

export class Renderer {
  constructor(canvas, stage, settings) {
    this.canvas = canvas; this.stage = stage; this.settings = settings;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.instances = new Map(); this.transition = document.createElement('canvas');
    this.transitionStart = -Infinity; this.blackout = false; this.outputAspect = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(stage);
    this.resize();
  }
  resize() {
    const rect = this.stage.getBoundingClientRect();
    const aspect = this.outputAspect || rect.width / Math.max(1, rect.height);
    let width = Number(this.settings.resolution), height = Math.round(width / aspect);
    const scale = Math.min(1, 2560 / Math.max(width, height), Math.sqrt(4400000 / (width * height)));
    width = Math.max(2, Math.round(width * scale)); height = Math.max(2, Math.round(height * scale));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
  }
  instance(id = this.settings.scene) {
    if (!this.instances.has(id)) this.instances.set(id, (sceneRegistry.find(scene => scene.id === id) || sceneRegistry[0]).create());
    return this.instances.get(id);
  }
  beginTransition(now) {
    this.transition.width = this.canvas.width; this.transition.height = this.canvas.height;
    this.transition.getContext('2d').drawImage(this.canvas, 0, 0);
    this.transitionStart = now;
  }
  switchScene(id, now) {
    if (id === this.settings.scene) return;
    this.beginTransition(now); this.settings.scene = id;
  }
  render(frame) {
    const { ctx, canvas, settings } = this;
    const width = canvas.width, height = canvas.height;
    ctx.save();
    try { this.instance().render({ ...frame, ctx, width, height, settings, palette: palettes[settings.palette] }); }
    finally { ctx.restore(); }
    if (settings.brightness < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - settings.brightness})`; ctx.fillRect(0, 0, width, height); }
    const fade = clamp(1 - (frame.time - this.transitionStart) / (settings.reducedMotion ? 0.25 : 1.2));
    if (fade > 0) { ctx.globalAlpha = fade; ctx.drawImage(this.transition, 0, 0, width, height); ctx.globalAlpha = 1; }
    if (this.blackout) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height); }
  }
  pointer(event, now) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * this.canvas.width;
    const y = (event.clientY - rect.top) / rect.height * this.canvas.height;
    this.instance().pointer?.(x, y, this.settings, this.canvas.width, this.canvas.height, now);
  }
}

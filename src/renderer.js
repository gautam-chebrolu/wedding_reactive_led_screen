import { clamp } from './math.js';
import { palettes } from './settings.js';
import { sceneRegistry } from './scenes/index.js';
import { renderDimensions, containRect, observeDisplay, normalizePlacement, placementTransform } from './display.js';

export class Renderer {
  constructor(canvas, stage, settings) {
    this.canvas = canvas; this.stage = stage; this.settings = settings;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.instances = new Map(); this.transition = document.createElement('canvas');
    this.transitionStart = -Infinity; this.blackout = false; this.outputSize = null;
    this.placement = normalizePlacement();
    this.stopObserving = observeDisplay(stage, () => this.resize());
  }
  setOutputSize(size) { this.outputSize = size; this.resize(); }
  setPlacement(value) {
    const next = normalizePlacement(value);
    if (next.x !== this.placement.x || next.y !== this.placement.y || next.scale !== this.placement.scale) this.transitionStart = -Infinity;
    this.placement = next;
  }
  resize() {
    const rect = this.stage.getBoundingClientRect();
    const size = renderDimensions(this.outputSize || { width: rect.width, height: rect.height, pixelRatio: this.stage.ownerDocument.defaultView.devicePixelRatio }, this.settings.resolution);
    if (!size) return; // Keep the last frame while the browser settles a hidden/transitioning viewport.
    const { width, height } = size;
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
    const transform = placementTransform(width, height, this.placement);
    const adjusted = transform.x !== 0 || transform.y !== 0 || transform.scale !== 1;
    if (adjusted) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height); }
    ctx.save();
    if (adjusted) {
      ctx.translate(transform.x, transform.y); ctx.scale(transform.scale, transform.scale);
      ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
    }
    try { this.instance().render({ ...frame, ctx, width, height, settings, palette: palettes[settings.palette] }); }
    finally { ctx.restore(); }
    if (settings.brightness < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - settings.brightness})`; ctx.fillRect(0, 0, width, height); }
    const fade = clamp(1 - (frame.time - this.transitionStart) / (settings.reducedMotion ? 0.25 : 1.2));
    if (fade > 0) { ctx.globalAlpha = fade; ctx.drawImage(this.transition, 0, 0, width, height); ctx.globalAlpha = 1; }
    if (this.blackout) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height); }
  }
  pointer(event, now) {
    const rect = containRect(this.canvas.width, this.canvas.height, this.canvas.getBoundingClientRect());
    const transform = placementTransform(this.canvas.width, this.canvas.height, this.placement);
    const x = ((event.clientX - rect.x) / rect.width * this.canvas.width - transform.x) / transform.scale;
    const y = ((event.clientY - rect.y) / rect.height * this.canvas.height - transform.y) / transform.scale;
    if (x < 0 || y < 0 || x > this.canvas.width || y > this.canvas.height) return;
    this.instance().pointer?.(x, y, this.settings, this.canvas.width, this.canvas.height, now);
  }
  destroy() { this.stopObserving(); }
}

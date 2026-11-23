import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDimensions, containRect, observeDisplay, normalizePlacement, placementTransform } from '../src/display.js';
import { Renderer } from '../src/renderer.js';

test('automatic render sizing follows the actual surface and device density', () => {
  assert.deepEqual(renderDimensions({ width: 960, height: 540 }), { width: 960, height: 540 });
  assert.deepEqual(renderDimensions({ width: 960, height: 540, pixelRatio: 2 }), { width: 1920, height: 1080 });
  assert.deepEqual(renderDimensions({ width: 720, height: 1280, pixelRatio: 2 }), { width: 1440, height: 2560 });
  assert.deepEqual(renderDimensions({ width: 1280, height: 360, pixelRatio: 2 }), { width: 2560, height: 720 });
});

test('fixed quality only sets buffer detail, and all qualities preserve the surface aspect', () => {
  for (const resolution of ['auto', '1280', '1920', '2560']) {
    for (const [width, height] of [[1280, 360], [720, 1280], [1600, 1000], [7680, 4320], [8000, 360]]) {
      const size = renderDimensions({ width, height, pixelRatio: 2 }, resolution);
      assert.ok(Math.max(size.width, size.height) <= 2560);
      assert.ok(size.width * size.height <= 4400000 + 2560, 'Pixel budget allows at most one rounded edge');
      assert.ok(Math.abs(size.height - size.width * height / width) <= 1, 'Aspect differs by at most one buffer pixel');
    }
  }
  assert.deepEqual(renderDimensions({ width: 800, height: 600 }, '1920'), { width: 1920, height: 1440 });
  assert.equal(renderDimensions({ width: 0, height: 1080 }), null);
  assert.equal(renderDimensions({ width: Infinity, height: 1080 }), null);
});

test('contained artwork stays centered and supplies accurate pointer coordinates', () => {
  const wide = containRect(1920, 1080, { x: 30, y: 20, width: 1000, height: 1000 });
  for (const [key, expected] of Object.entries({ x: 30, y: 238.75, width: 1000, height: 562.5 })) assert.ok(Math.abs(wide[key] - expected) < 1e-8);
  const tall = containRect(720, 1280, { x: 0, y: 0, width: 1920, height: 1080 });
  assert.deepEqual(tall, { x: 656.25, y: 0, width: 607.5, height: 1080 });
});

test('manual placement is bounded and uses the same proportions at every display size', () => {
  assert.deepEqual(normalizePlacement(null), { x: 0, y: 0, scale: 1 });
  assert.deepEqual(normalizePlacement({ x: Infinity, y: -5, scale: 900 }), { x: 0, y: -1, scale: 2 });
  for (const [w, h] of [[1920, 1080], [720, 1280], [2560, 720]]) {
    const transform = placementTransform(w, h, { x: 0.1, y: -0.05, scale: 0.8 });
    assert.ok(Math.abs((transform.x + w / 2 * transform.scale) / w - 0.6) < 1e-9);
    assert.ok(Math.abs((transform.y + h / 2 * transform.scale) / h - 0.45) < 1e-9);
  }
});

test('pointer interaction follows shifted/scaled artwork and ignores the empty margins', () => {
  const calls = [], renderer = {
    canvas: { width: 1000, height: 500, getBoundingClientRect: () => ({ x: 20, y: 30, width: 1000, height: 500 }) },
    placement: { x: 0.1, y: -0.1, scale: 0.5 }, settings: {},
    instance: () => ({ pointer: (x, y) => calls.push([x, y]) })
  };
  Renderer.prototype.pointer.call(renderer, { clientX: 620, clientY: 230 }, 0);
  Renderer.prototype.pointer.call(renderer, { clientX: 30, clientY: 40 }, 0);
  assert.deepEqual(calls, [[500, 250]]);
});

test('display observation follows density-only changes, fullscreen, and resize, then detaches', () => {
  const win = new EventTarget(), doc = new EventTarget(), viewport = new EventTarget();
  win.devicePixelRatio = 1; win.visualViewport = viewport; doc.defaultView = win;
  let observer, bounds = { width: 960, height: 540 };
  const queries = [], sizes = [];
  win.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observer = this; }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  win.matchMedia = query => { const result = new EventTarget(); result.media = query; queries.push(result); return result; };
  const element = { ownerDocument: doc, getBoundingClientRect: () => bounds };
  const stop = observeDisplay(element, size => sizes.push(size));
  assert.deepEqual(sizes.at(-1), { ...bounds, pixelRatio: 1 });
  win.devicePixelRatio = 2; queries[0].dispatchEvent(new Event('change'));
  assert.deepEqual(sizes.at(-1), { ...bounds, pixelRatio: 2 });
  assert.ok(queries.at(-1).media.includes('2dppx'));
  bounds = { width: 1280, height: 360 }; doc.dispatchEvent(new Event('fullscreenchange'));
  assert.deepEqual(sizes.at(-1), { ...bounds, pixelRatio: 2 });
  bounds = { width: 720, height: 1280 }; viewport.dispatchEvent(new Event('resize'));
  assert.equal(sizes.at(-1).height, 1280);
  bounds = { width: 0, height: 0 }; observer.callback();
  assert.equal(sizes.length, 4, 'Transient empty surfaces preserve the last valid dimensions');
  stop(); bounds = { width: 800, height: 600 }; win.dispatchEvent(new Event('resize'));
  assert.equal(sizes.length, 4); assert.equal(observer.disconnected, true);
});

// Real-browser regression checks for adaptive canvas/fullscreen sizing.
// Uses the same PLAYWRIGHT_MODULE/BROWSER_EXECUTABLE overrides as browser-check.mjs.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const directory = await mkdtemp(path.join(tmpdir(), 'afterglow-display-'));
const app = await createAppServer({ directory });
let browser;
try {
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
  await page.goto(`http://127.0.0.1:${app.server.address().port}`);
  await page.waitForFunction(() => document.querySelectorAll('.scene-card').length > 0);
  assert.equal(await page.locator('#resolution').inputValue(), 'auto');
  await page.locator('[data-scene="monogram"]').click();
  for (const [id, value] of [['brightness', '1'], ['intensity', '0']]) {
    await page.locator('#' + id).fill(value); await page.locator('#' + id).dispatchEvent('input');
  }
  await page.waitForTimeout(1500);
  await mkdir('test-results/display', { recursive: true });

  async function verifyMain(fullscreen = false, auto = true) {
    await page.waitForFunction(({ fullscreen, auto }) => {
      const c = document.getElementById('visual-canvas'), stage = document.getElementById('stage');
      const box = stage.getBoundingClientRect(), canvas = c.getBoundingClientRect();
      if (fullscreen && (Math.abs(box.x) > 1 || Math.abs(box.y) > 1 || Math.abs(box.width - innerWidth) > 1 || Math.abs(box.height - innerHeight) > 1)) return false;
      if (Math.abs(box.width - canvas.width) > 1 || Math.abs(box.height - canvas.height) > 1) return false;
      if (!auto) return true;
      const w = box.width * devicePixelRatio, h = box.height * devicePixelRatio;
      const scale = Math.min(1, 2560 / Math.max(w, h), Math.sqrt(4400000 / (w * h)));
      return Math.abs(c.width - Math.round(w * scale)) <= 1 && Math.abs(c.height - Math.round(h * scale)) <= 1;
    }, { fullscreen, auto });
    await page.waitForTimeout(100);
    const stats = await page.evaluate(async () => {
      const { containRect } = await import('/src/display.js');
      const c = document.getElementById('visual-canvas'), box = c.getBoundingClientRect();
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4;
        if (data[i] + data[i + 1] + data[i + 2] > 150) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
      const fit = containRect(c.width, c.height, box);
      const artX = fit.x + (minX + maxX) / 2 / c.width * fit.width;
      const artY = fit.y + (minY + maxY) / 2 / c.height * fit.height;
      return { width: box.width, height: box.height, buffer: [c.width, c.height], density: devicePixelRatio,
        offsetX: Math.abs(artX - (box.x + box.width / 2)), offsetY: Math.abs(artY - (box.y + box.height / 2)), visible: minX < maxX && minY < maxY,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(stats.visible, 'Actual monogram pixels are visible');
    assert.ok(stats.offsetX < stats.width * 0.01 && stats.offsetY < stats.height * 0.01, `Monogram stays centered: ${JSON.stringify(stats)}`);
    assert.equal(stats.overflow, false);
    return stats;
  }

  const preview = await verifyMain();
  assert.ok(Math.abs(preview.width / preview.height - 16 / 9) < 0.001);
  assert.ok(await page.evaluate(() => {
    const bottom = document.getElementById('visual-canvas').getBoundingClientRect().bottom;
    return ['preview-resize-handle', 'stage-source', 'stage-name', 'fullscreen-button', 'preview-scale'].every(id => document.getElementById(id).getBoundingClientRect().top >= bottom);
  }), 'Resize controls and preview information stay outside the visual image');
  await page.locator('#preview-scale').fill('65'); await page.locator('#preview-scale').dispatchEvent('input');
  const smaller = await verifyMain();
  assert.ok(Math.abs((smaller.width + 2) / (preview.width + 2) - 0.65) < 0.002);
  assert.ok(Math.abs(smaller.width / smaller.height - 16 / 9) < 0.001);
  const handle = page.locator('#preview-resize-handle');
  async function dragGrip(dx, dy) {
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 5 }); await page.mouse.up();
  }
  await dragGrip(-60, 0);
  const dragged = await verifyMain();
  assert.ok(dragged.width < smaller.width - 100);
  await handle.focus(); await page.keyboard.press('ArrowRight');
  const keyboard = await verifyMain();
  assert.ok(Math.abs(keyboard.width - dragged.width - 16) < 1);
  assert.equal(await page.locator('#stage-name').textContent(), 'PG, in gold', 'Resize arrows do not switch scenes');
  await page.locator('#preview-lock').uncheck();
  await dragGrip(0, 90);
  const free = await verifyMain();
  assert.ok(Math.abs(free.width - keyboard.width) < 1 && free.height > keyboard.height + 80);
  await page.locator('#fullscreen-button').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'stage');
  await verifyMain(true);
  await page.evaluate(() => document.exitFullscreen());
  const restored = await verifyMain();
  assert.ok(Math.abs(restored.width - free.width) < 1 && Math.abs(restored.height - free.height) < 1);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('stage-name').textContent === 'PG, in gold');
  const saved = await verifyMain();
  assert.ok(Math.abs(saved.width - free.width) < 1 && Math.abs(saved.height - free.height) < 1);
  assert.equal(await page.locator('#preview-lock').isChecked(), false);
  await page.setViewportSize({ width: 390, height: 844 }); await verifyMain();
  await page.setViewportSize({ width: 1440, height: 900 });
  const expanded = await verifyMain();
  assert.ok(Math.abs(expanded.width - saved.width) < 1, 'A smaller window does not overwrite the preferred width');
  await page.locator('#reset-preview-size').click();
  const reset = await verifyMain();
  assert.ok(Math.abs(reset.width - preview.width) < 1);
  assert.equal(await page.locator('#preview-scale').inputValue(), '100');
  assert.ok(await page.locator('#preview-lock').isChecked());
  console.log('PASS: preview size slider, drag, keyboard, unlocked dimensions, fullscreen restoration, persistence, mobile bounds and reset');
  await page.locator('.output-settings summary').click();
  await page.locator('#resolution').selectOption('1280');
  const fixed = await verifyMain(false, false);
  assert.equal(fixed.buffer[0], 1280); assert.equal(fixed.width, preview.width);
  await page.locator('#resolution').selectOption('auto');
  await page.locator('#fullscreen-button').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'stage');
  for (const [width, height] of [[1920, 1080], [2560, 720], [900, 1200], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    console.log('PASS: fullscreen viewport and centered monogram', await verifyMain(true));
  }
  await page.locator('#visual-canvas').screenshot({ path: 'test-results/display/main-fullscreen.png' });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
  const dense = await verifyMain(true);
  assert.equal(dense.density, 2); assert.deepEqual(dense.buffer, [2560, 1600]);
  console.log('PASS: density-only monitor change without a CSS viewport-size change');
  await page.evaluate(() => document.exitFullscreen());
  await verifyMain();
  await page.locator('h1').click(); await page.keyboard.press('h'); await verifyMain(true);
  await page.keyboard.press('Escape'); await verifyMain();
  console.log('PASS: clean presentation and return to the 16:9 controller preview');

  const opened = page.waitForEvent('popup'); await page.locator('#output-button').click();
  const popup = await opened; popup.on('pageerror', error => errors.push(error.message));
  async function verifyOutput(width, height) {
    await popup.setViewportSize({ width, height });
    await popup.waitForFunction(() => {
      const video = document.querySelector('video'), box = video.getBoundingClientRect();
      return video.readyState >= 2 && Math.abs(box.x) < 1 && Math.abs(box.y) < 1 && Math.abs(box.width - innerWidth) < 1 && Math.abs(box.height - innerHeight) < 1 && Math.abs(video.videoWidth / video.videoHeight / (innerWidth / innerHeight) - 1) < 0.003;
    });
    await page.waitForFunction(({ width, height }) => {
      const c = document.getElementById('visual-canvas');
      return Math.abs(c.width / c.height / (width / height) - 1) < 0.003;
    }, { width, height });
    await verifyMain(false, false);
  }
  for (const [width, height] of [[1280, 360], [720, 1280], [1600, 1000]]) await verifyOutput(width, height);
  const outputBuffer = await page.locator('#visual-canvas').evaluate(c => [c.width, c.height]);
  await page.locator('#preview-scale').fill('55'); await page.locator('#preview-scale').dispatchEvent('input');
  await verifyMain(false, false);
  assert.deepEqual(await page.locator('#visual-canvas').evaluate(c => [c.width, c.height]), outputBuffer, 'Preview size does not change the independent output resolution');
  await page.locator('#reset-preview-size').click();
  await popup.keyboard.press('f'); await popup.waitForFunction(() => Boolean(document.fullscreenElement));
  await verifyOutput(1920, 1080);
  await popup.screenshot({ path: 'test-results/display/popup-fullscreen.png' });
  // The output's shape remains authoritative when the controller itself also
  // goes fullscreen. Its contained preview and pointer mapping stay centered.
  await verifyOutput(1280, 360);
  await page.locator('#fullscreen-button').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'stage');
  await verifyMain(true, false);
  await page.evaluate(() => document.exitFullscreen());
  await popup.close();
  const reopened = page.waitForEvent('popup'); await page.locator('#output-button').click();
  const secondOutput = await reopened;
  await secondOutput.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  await secondOutput.close(); await page.waitForTimeout(800); await verifyMain();
  console.log('PASS: independent output resizing/fullscreen, concurrent fullscreen centering and output-close recovery');

  // Pointer mapping must use the centered artwork, not its letterbox margins.
  const point = await page.evaluate(async () => {
    const { Renderer } = await import('/src/renderer.js');
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 1280;
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, width: 1920, height: 1080 });
    const calls = [];
    const renderer = { canvas, settings: {}, instance: () => ({ pointer: (x, y) => calls.push([x, y]) }) };
    Renderer.prototype.pointer.call(renderer, { clientX: 960, clientY: 540 }, 0);
    Renderer.prototype.pointer.call(renderer, { clientX: 10, clientY: 540 }, 0);
    return calls;
  });
  assert.deepEqual(point, [[360, 640]]);
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  console.log('PASS: centered pointer coordinates, ignored letterbox clicks, no page errors or failed assets');
} finally {
  await browser?.close(); app.close(); await rm(directory, { recursive: true, force: true });
}

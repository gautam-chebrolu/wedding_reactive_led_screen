// Manual placement regression checks. Uses an isolated local show server and
// the same browser overrides as display-browser.mjs.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createAppServer } from '../server.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const directory = await mkdtemp(path.join(tmpdir(), 'afterglow-placement-'));
const app = await createAppServer({ directory });
let browser;
try {
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${app.server.address().port}`);
  await page.waitForFunction(() => document.querySelectorAll('.scene-card').length > 0);
  await page.locator('[data-scene="monogram"]').click();
  for (const [id, value] of [['brightness', '1'], ['intensity', '0']]) {
    await page.locator('#' + id).fill(value); await page.locator('#' + id).dispatchEvent('input');
  }
  await page.waitForTimeout(1400);
  async function pixels(target = page, selector = '#visual-canvas') {
    await target.waitForTimeout(140);
    return target.evaluate(selector => {
      const element = document.querySelector(selector);
      let canvas = element;
      if (element.tagName === 'VIDEO') {
        canvas = document.createElement('canvas'); canvas.width = element.videoWidth; canvas.height = element.videoHeight;
        canvas.getContext('2d').drawImage(element, 0, 0);
      }
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width, right = 0, top = canvas.height, bottom = 0;
      for (let y = 0; y < canvas.height; y += 2) for (let x = 0; x < canvas.width; x += 2) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] + data[i + 1] + data[i + 2] > 150) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
      }
      return { x: (left + right) / 2 / canvas.width, y: (top + bottom) / 2 / canvas.height, width: (right - left) / canvas.width, height: (bottom - top) / canvas.height };
    }, selector);
  }
  async function drag(target, selector, dx, dy) {
    const element = target.locator(selector); await element.scrollIntoViewIfNeeded();
    const box = await element.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    await target.mouse.move(x, y); await target.mouse.down();
    await target.mouse.move(x + dx, y + dy, { steps: 6 }); await target.mouse.up();
    return box;
  }
  const near = (actual, expected, message, tolerance = 0.005) => assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} vs ${expected}`);
  const centered = await pixels(); near(centered.x, 0.5, 'Initially centered');
  await page.locator('#move-visuals').click();
  const box = await drag(page, '#visual-canvas', 80, -45), moved = await pixels();
  near(moved.x - centered.x, 80 / box.width, 'Page drag moves the actual rendered pixels horizontally');
  near(moved.y - centered.y, -45 / box.height, 'Page drag moves the actual rendered pixels vertically');
  await page.locator('#visual-zoom').fill('75'); await page.locator('#visual-zoom').dispatchEvent('input');
  const zoomed = await pixels(); near(zoomed.width / moved.width, 0.75, 'Visual zoom scales the artwork', 0.015);
  await page.locator('#center-visuals').click();
  const recentered = await pixels(); near(recentered.x, 0.5, 'Center button restores horizontal center'); near(recentered.y, 0.5, 'Center button restores vertical center');
  assert.equal(await page.locator('#visual-zoom').inputValue(), '75');
  await page.locator('#reset-visual-placement').click();
  assert.equal(await page.locator('#visual-zoom').inputValue(), '100');
  console.log('PASS: page drag changes real canvas pixels, visual zoom, center and reset');

  await page.locator('[data-scene="portrait"]').click(); await page.waitForTimeout(1400);
  const mouth = await page.locator('#mouthY').inputValue();
  await drag(page, '#visual-canvas', 35, 20);
  assert.equal(await page.locator('#mouthY').inputValue(), mouth, 'Placement dragging does not recalibrate the mouth');
  await page.locator('#reset-visual-placement').click(); await page.locator('#move-visuals').click();
  await page.locator('#visual-canvas').click({ position: { x: 680, y: 290 } });
  assert.notEqual(await page.locator('#mouthY').inputValue(), mouth, 'Portrait calibration still works with placement locked');
  await page.locator('[data-scene="monogram"]').click(); await page.waitForTimeout(1400);
  await page.locator('h1').click(); await page.keyboard.press('m');
  assert.equal(await page.locator('#move-visuals').getAttribute('aria-pressed'), 'true');
  await page.locator('#fullscreen-button').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'stage');
  await page.locator('.visual-placement-tools').waitFor({ state: 'visible' });
  const beforeFullscreen = await pixels(), fullBox = await drag(page, '#visual-canvas', -70, 55), fullscreen = await pixels();
  near(fullscreen.x - beforeFullscreen.x, -70 / fullBox.width, 'Fullscreen horizontal drag');
  near(fullscreen.y - beforeFullscreen.y, 55 / fullBox.height, 'Fullscreen vertical drag');
  await page.locator('.visual-placement-tools input').fill('65'); await page.locator('.visual-placement-tools input').dispatchEvent('input');
  assert.equal(await page.locator('#visual-zoom').inputValue(), '65');
  await page.locator('#visual-canvas').focus(); await page.keyboard.press('Home');
  const home = await pixels(); near(home.x, 0.5, 'Home recenters'); near(home.y, 0.5, 'Home recenters');
  await page.keyboard.press('Shift+ArrowRight');
  assert.ok((await pixels()).x > home.x, 'Keyboard nudges the image instead of changing scenes');
  assert.equal(await page.locator('#stage-name').textContent(), 'PG, in gold');
  await page.setViewportSize({ width: 720, height: 1280 });
  const portrait = await pixels();
  const savedView = await page.evaluate(() => JSON.parse(localStorage.getItem('afterglow.visual-placement.v1')));
  near(portrait.x, 0.5 + savedView.x, 'Placement scales with portrait viewport');
  await page.evaluate(() => document.exitFullscreen());
  await page.reload(); await page.waitForFunction(() => document.getElementById('stage-name').textContent === 'PG, in gold');
  assert.equal(await page.locator('#move-visuals').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#visual-zoom').inputValue(), '65');
  near((await pixels()).x, 0.5 + savedView.x, 'Placement survives reload');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#reset-visual-placement').click();
  await page.locator('h1').click(); await page.keyboard.press('h');
  await drag(page, '#visual-canvas', 25, -20);
  assert.ok(await page.locator('.visual-placement-tools').isVisible());
  await page.keyboard.press('Escape');
  console.log('PASS: portrait interaction isolation, fullscreen drag/zoom, keyboard adjustment, portrait display, persistence and clean presentation');

  await page.locator('#reset-visual-placement').click();
  const opened = page.waitForEvent('popup'); await page.locator('#output-button').click();
  const popup = await opened; popup.on('pageerror', error => errors.push(error.message));
  await popup.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  const beforeVideo = await pixels(popup, 'video');
  const videoBox = await drag(popup, 'video', 65, 35), shiftedVideo = await pixels(popup, 'video');
  near(shiftedVideo.x - beforeVideo.x, 65 / videoBox.width, 'Dragging output moves the captured stream pixels');
  near(shiftedVideo.y - beforeVideo.y, 35 / videoBox.height, 'Output vertical adjustment');
  await popup.keyboard.press('f'); await popup.waitForFunction(() => Boolean(document.fullscreenElement));
  await drag(popup, 'video', -25, 15);
  await popup.locator('.visual-placement-tools input').fill('80'); await popup.locator('.visual-placement-tools input').dispatchEvent('input');
  assert.equal(await page.locator('#visual-zoom').inputValue(), '80');
  await popup.locator('[data-center]').click();
  const videoCenter = await pixels(popup, 'video'); near(videoCenter.x, 0.5, 'Output toolbar centers actual video');
  await mkdir('test-results/placement', { recursive: true });
  await popup.screenshot({ path: 'test-results/placement/fullscreen-adjustment.png' });
  await popup.locator('[data-done]').click();
  assert.equal(await page.locator('#move-visuals').getAttribute('aria-pressed'), 'false');
  await popup.close(); await page.waitForTimeout(800);
  assert.deepEqual(errors, []);
  console.log('PASS: output and fullscreen output dragging, actual captured pixels, synchronized zoom/toolbar, locking placement and cleanup');
} finally {
  await browser?.close(); app.close(); await rm(directory, { recursive: true, force: true });
}

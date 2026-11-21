// Optional browser checks. Uses the same PLAYWRIGHT_MODULE/BROWSER_EXECUTABLE
// overrides as browser-check.mjs, with an isolated temporary show server.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createAppServer } from '../server.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const directory = await mkdtemp(path.join(tmpdir(), 'afterglow-couple-'));
const app = await createAppServer({ directory, setupKey: 'couple-browser-key' });
let browser;
try {
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await context.newPage(), errors = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
  await page.goto(`http://127.0.0.1:${app.server.address().port}`);
  await page.waitForFunction(() => document.querySelectorAll('.scene-card').length === 18);
  await page.locator('h1').click(); await page.keyboard.press('x');
  await page.waitForFunction(() => document.querySelector('[data-scene="couple"]').getAttribute('aria-pressed') === 'true');
  assert.ok(await page.locator('#couple-controls').isVisible());
  await page.waitForTimeout(1500);
  await mkdir('test-results/couple', { recursive: true });
  await page.locator('#visual-canvas').screenshot({ path: 'test-results/couple/live.png' });

  const stats = await page.evaluate(async () => {
    const { CoupleScene } = await import('/src/scenes/couple.js');
    const { sanitizeSettings } = await import('/src/settings.js');
    const scene = new CoupleScene();
    await Promise.all(scene.art.map(art => new Promise((resolve, reject) => {
      if (art.ready) resolve();
      else { art.image.addEventListener('load', resolve, { once: true }); art.image.addEventListener('error', reject, { once: true }); }
    })));
    const alpha = scene.art.map(art => {
      const c = document.createElement('canvas'); c.width = art.image.naturalWidth; c.height = art.image.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(art.image, 0, 0);
      const data = x.getImageData(0, 0, c.width, c.height).data;
      let transparent = 0, opaque = 0;
      for (let i = 3; i < data.length; i += 4) { if (data[i] === 0) transparent++; if (data[i] > 240) opaque++; }
      return { transparent, opaque, total: c.width * c.height };
    });
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    const results = [];
    for (const [width, height] of [[1920, 1080], [2560, 720], [720, 1280]]) {
      canvas.width = width; canvas.height = height; scene.reset();
      const settings = sanitizeSettings({ scene: 'couple', brightness: 1 });
      scene.render({ ctx, width, height, dt: 0, audio: { pulse: 0 }, settings });
      const sample = x => {
        const data = ctx.getImageData(Math.round(x * width), 0, Math.round(width * 0.45), height).data;
        let lit = 0;
        for (let i = 0; i < data.length; i += 16) if (data[i] + data[i + 1] + data[i + 2] > 120) lit++;
        return lit;
      };
      results.push({ width, height, leftLit: sample(0), rightLit: sample(0.55), corner: [...ctx.getImageData(0, 0, 1, 1).data] });
    }
    return { alpha, results };
  });
  for (const asset of stats.alpha) {
    assert.ok(asset.transparent > asset.total * 0.1, 'Cutout has real transparency');
    assert.ok(asset.opaque > asset.total * 0.2, 'Cutout contains visible photo detail');
  }
  for (const frame of stats.results) {
    assert.ok(frame.leftLit > 100 && frame.rightLit > 100, `${frame.width}×${frame.height}: two separate visible people`);
    assert.deepEqual(frame.corner, [0, 0, 0, 255], 'Background stays black');
  }
  console.log('PASS: X shortcut, setup panel, transparent photo assets and both people at normal, wide and portrait ratios');

  await page.locator('#coupleSpeed').fill('0.27'); await page.locator('#coupleSpeed').dispatchEvent('input');
  await page.locator('#reset-couple').click();
  await page.reload(); await page.waitForFunction(() => document.querySelector('[data-scene="couple"]')?.getAttribute('aria-pressed') === 'true');
  assert.equal(await page.locator('#coupleSpeed').inputValue(), '0.27');
  await page.locator('h1').click(); await page.keyboard.press('r');
  await page.locator('#fullscreen-button').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'stage');
  const bounds = await page.locator('#visual-canvas').boundingBox();
  assert.equal(bounds.x, 0); assert.equal(bounds.y, 0);
  await page.evaluate(() => document.exitFullscreen());
  console.log('PASS: speed persistence, restart button, R shortcut and fullscreen layout');

  await page.locator('#shared-show-button').click();
  await page.locator('#show-name').fill('Couple browser check');
  await page.locator('#show-password').fill('couple-test-password');
  await page.locator('#show-setup-key').fill('couple-browser-key');
  await page.locator('#shared-create-form button[type="submit"]').click();
  await page.waitForFunction(() => Boolean(document.getElementById('wall-link').value));
  const wallContext = await browser.newContext({ viewport: { width: 1280, height: 360 } });
  const wall = await wallContext.newPage(); wall.on('pageerror', error => errors.push(error.message));
  await wall.goto(await page.locator('#wall-link').inputValue());
  await wall.waitForFunction(() => !document.getElementById('wall-start-input').disabled);
  await wall.locator('#wall-source').selectOption('demo'); await wall.locator('#wall-start-input').click();
  await wall.locator('#close-wall-setup').click(); await page.locator('#close-shared').click();
  await wall.waitForFunction(() => document.querySelector('[data-scene="couple"]').getAttribute('aria-pressed') === 'true');
  await page.locator('#coupleSpeed').fill('0.34'); await page.locator('#coupleSpeed').dispatchEvent('input');
  await wall.waitForFunction(() => document.getElementById('coupleSpeed').value === '0.34');
  const resetSent = page.waitForResponse(response => response.request().method() === 'PATCH' && /\/api\/shows\//.test(response.url()));
  await page.locator('#reset-couple').click(); assert.ok((await resetSent).ok());
  await wall.waitForTimeout(400);
  await wall.locator('#visual-canvas').screenshot({ path: 'test-results/couple/shared-wide.png' });
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  await wallContext.close();
  console.log('PASS: shared wall selection, speed and restart cue; no page errors or failed assets');
} finally {
  await browser?.close(); app.close(); await rm(directory, { recursive: true, force: true });
}

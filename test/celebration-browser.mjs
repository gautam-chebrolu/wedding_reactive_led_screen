// Optional real-browser checks: PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE work
// like test/browser-check.mjs. Uses an isolated localhost show server.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const parent = path.resolve('test-results/new-scenes'); await mkdir(parent, { recursive: true });
const directory = await mkdtemp(path.join(parent, 'show-'));
const app = await createAppServer({ directory, setupKey: 'celebration-browser-test-key' });
let browser;
const ids = ['rangoli', 'mehndi', 'baraat', 'kellogg', 'hyperspace', 'liquid', 'tunak'];
try {
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], failed = []; page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
  await page.goto(`http://127.0.0.1:${app.server.address().port}`);
  await page.waitForFunction(() => document.querySelectorAll('.scene-card').length === 17);
  for (const [index, id] of ids.entries()) {
    await page.locator('h1').click(); await page.keyboard.press(['q','w','e','a','s','d','z'][index]);
    await page.waitForFunction(id => document.querySelector(`[data-scene="${id}"]`).getAttribute('aria-pressed') === 'true', id);
    assert.ok(await page.locator(`#${id}-controls`).isVisible());
    await page.waitForTimeout(1450);
    await page.locator('#visual-canvas').screenshot({ path: path.join(parent, `${id}-live.png`) });
    console.log(`PASS: ${id} shortcut, setup panel and live render`);
  }
  for (const [key, value] of [['tunakMode','solo'], ['tunakRate','2']]) await page.locator('#' + key).selectOption(value);
  await page.locator('[data-scene="liquid"]').click(); await page.locator('#liquidMaterial').selectOption('silk'); await page.waitForTimeout(1400);
  await page.locator('#visual-canvas').screenshot({ path: path.join(parent, 'liquid-silk-live.png') });
  await page.reload(); await page.waitForFunction(() => document.querySelectorAll('.scene-card').length === 17);
  assert.equal(await page.locator('#liquidMaterial').inputValue(), 'silk');
  await page.locator('[data-scene="tunak"]').click(); assert.equal(await page.locator('#tunakMode').inputValue(), 'solo'); assert.equal(await page.locator('#tunakRate').inputValue(), '2');
  console.log('PASS: material and Tunak controls persist through reload');

  const results = await page.evaluate(async ids => {
    const { sceneRegistry } = await import('/src/scenes/index.js');
    const { sanitizeSettings, palettes } = await import('/src/settings.js');
    const results = [];
    for (const id of ids) {
      const scene = sceneRegistry.find(entry => entry.id === id).create();
      if (scene.art?.decode) await scene.art.decode();
      if (scene.logo?.image?.decode) await scene.logo.image.decode();
      // decode() can resolve before the Image load event updates scene.ready.
      for (let i = 0; i < 100 && ((scene.art && !scene.ready) || (scene.logo && !scene.logo.ready)); i++) await new Promise(resolve => setTimeout(resolve, 10));
      if (scene.art && !scene.ready) throw new Error(`${id}: image load event did not complete`);
      if (scene.logo && !scene.logo.ready) throw new Error(`${id}: monogram load event did not complete`);
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
      const ctx = canvas.getContext('2d');
      const settings = sanitizeSettings({ scene: id, intensity: 0.85 });
      const idle = { level: 0, bass: 0, mid: 0, treble: 0, pulse: 0, beat: false, beatCount: 0 };
      const hit = { level: 0.8, bass: 1, mid: 0.6, treble: 1, pulse: 1, beat: true, beatCount: 1 };
      function draw(audio, override = settings, dt = 0) {
        ctx.save(); scene.render({ ctx, width: canvas.width, height: canvas.height, time: 1, dt, audio, settings: override, palette: palettes.violet }); ctx.restore();
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      }
      const zero = { ...settings, intensity: 0 };
      const a = draw(idle, zero), b = draw(hit, zero); let zeroChanges = 0;
      // Canvas edge rasterization can differ by a level between identical
      // draws; count visible changes rather than single-channel roundoff.
      for (let i = 0; i < a.length; i += 16) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) zeroChanges++;
      if (id === 'tunak') scene.age = 5;
      const c = draw(idle), d = draw({ ...hit, beatCount: 2 }, settings, 0.05); let changes = 0, lit = 0;
      for (let i = 0; i < c.length; i += 16) { if (c[i] !== d[i] || c[i + 1] !== d[i + 1] || c[i + 2] !== d[i + 2]) changes++; if (d[i] + d[i + 1] + d[i + 2] > 90) lit++; }
      const samples = [];
      for (const [width, height] of [[1280, 360], [540, 960]]) {
        canvas.width = width; canvas.height = height; draw(hit, { ...settings, reducedMotion: true });
        samples.push({ width, height, png: canvas.toDataURL().split(',')[1] });
      }
      let shader = null, fallbackLit = null;
      if (scene.shader) {
        shader = scene.shader.ready; scene.shader.ready = false;
        const fallback = draw(hit); fallbackLit = fallback.some((value, i) => i % 4 !== 3 && value > 40);
      }
      results.push({ id, zeroChanges, changes, lit, shader, fallbackLit, samples });
    }
    return results;
  }, ids);
  for (const row of results) {
    for (const sample of row.samples) await writeFile(path.join(parent, `${row.id}-${sample.width}x${sample.height}.png`), Buffer.from(sample.png, 'base64'));
    const { samples, ...stats } = row; console.log(JSON.stringify(stats));
    assert.equal(row.zeroChanges, 0, `${row.id}: zero reactivity holds the visual steady`);
    assert.ok(row.changes > 5, `${row.id}: music changes the canvas`); assert.ok(row.lit > 100, `${row.id}: visible detail`);
    if (row.id === 'liquid') assert.equal(row.fallbackLit, true);
  }
  await page.locator('#shared-show-button').click();
  await page.locator('#show-name').fill('Celebration browser check');
  await page.locator('#show-password').fill('celebration-test-password');
  await page.locator('#show-setup-key').fill('celebration-browser-test-key');
  await page.locator('#shared-create-form button[type="submit"]').click();
  await page.waitForFunction(() => Boolean(document.getElementById('wall-link').value));
  const wallContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const wall = await wallContext.newPage(); wall.on('pageerror', error => errors.push(error.message));
  await wall.goto(await page.locator('#wall-link').inputValue());
  await wall.waitForFunction(() => !document.getElementById('wall-start-input').disabled);
  await wall.locator('#wall-source').selectOption('demo'); await wall.locator('#wall-start-input').click();
  await wall.locator('#close-wall-setup').click(); await page.locator('#close-shared').click();
  for (const id of ids) {
    await page.locator(`[data-scene="${id}"]`).click();
    await wall.waitForFunction(id => document.querySelector(`[data-scene="${id}"]`).getAttribute('aria-pressed') === 'true', id);
  }
  await page.locator('#tunakMode').selectOption('takeover'); await page.locator('#tunakRate').selectOption('1');
  await wall.waitForFunction(() => document.getElementById('tunakMode').value === 'takeover' && document.getElementById('tunakRate').value === '1');
  await page.locator('[data-scene="liquid"]').click(); await page.locator('#liquidMaterial').selectOption('chrome');
  await wall.waitForFunction(() => document.getElementById('liquidMaterial').value === 'chrome');
  await wallContext.close();
  console.log('PASS: all seven scene selections and new controls synchronize to an independent shared wall');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile has no horizontal overflow');
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  console.log('PASS: reactive pixels, gentle motion, wide/portrait canvases, fallback rendering, mobile layout and clean asset loading');
} finally {
  await browser?.close(); app.close(); app.server.closeAllConnections?.();
  if (path.dirname(directory) === parent) await rm(directory, { recursive: true, force: true });
}

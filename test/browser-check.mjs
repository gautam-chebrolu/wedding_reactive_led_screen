// Optional integration checks. Playwright is a QA tool, not a runtime dependency.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_URL || 'http://localhost:4173';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, permissions: ['camera', 'microphone'] });
const errors = [], failedResponses = [];
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
await mkdir('test-results', { recursive: true });
const waitForScene = async () => page.waitForTimeout(1400);
const canvasPixel = () => page.evaluate(() => {
  const c = document.getElementById('visual-canvas');
  const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let sum = 0, bright = 0;
  for (let i = 0; i < pixels.length; i += 400) { const light = pixels[i] + pixels[i + 1] + pixels[i + 2]; sum += light; if (light > 200) bright++; }
  return { sum, bright };
});
function wavBuffer() {
  const rate = 22050, seconds = 3, count = rate * seconds;
  const data = Buffer.alloc(44 + count * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + count * 2, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) data.writeInt16LE(Math.round(Math.sin(i / rate * Math.PI * 2 * 80) * 24000 * Math.exp(-((i / rate) % 0.5) * 18)), 44 + i * 2);
  return data;
}
try {
  await page.goto(base); await page.waitForFunction(() => document.querySelectorAll('.scene-card').length === 9); await waitForScene();
  assert.equal(await page.title(), 'Afterglow · A visual soundtrack');
  assert.ok((await canvasPixel()).bright > 50, 'Moon scene has visible rendered detail');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  console.log('PASS: initial render and loaded assets');

  await page.locator('[data-scene="portrait"]').click(); await waitForScene();
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#e7ac87'; x.fillRect(0, 0, 300, 400); return c.toDataURL().split(',')[1]; });
  await page.locator('#portrait-file').setInputFiles({ name: 'test-portrait.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForFunction(() => document.getElementById('portrait-name').textContent.startsWith('test-portrait'));
  await page.locator('#visual-canvas').click({ position: { x: 480, y: 290 } });
  assert.ok(Number(await page.locator('#mouthY').inputValue()) > 0.3);
  await page.screenshot({ path: 'test-results/portrait.png', fullPage: true });
  const firstId = await page.locator('#portrait-person').inputValue();
  const firstY = await page.locator('#mouthY').inputValue();
  await page.locator('#portrait-file').setInputFiles({ name: 'second-person.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForFunction(() => document.getElementById('portrait-name').textContent.startsWith('second-person'));
  const secondId = await page.locator('#portrait-person').inputValue();
  await page.locator('#mouthY').fill('0.4'); await page.locator('#mouthY').dispatchEvent('input');
  await page.locator('#portrait-person').selectOption(firstId); assert.equal(await page.locator('#mouthY').inputValue(), firstY);
  await page.locator('#portrait-person').selectOption(secondId); assert.equal(await page.locator('#mouthY').inputValue(), '0.4');
  await page.locator('h1').click(); await page.keyboard.press('['); assert.notEqual(await page.locator('#portrait-person').inputValue(), secondId);
  await page.keyboard.press(']'); assert.equal(await page.locator('#portrait-person').inputValue(), secondId);
  await page.locator('#portraitCycle').check();
  await page.locator('#portraitCycleSeconds').evaluate(el => { el.add(new Option('3 sec', '3')); });
  await page.locator('#portraitCycleSeconds').selectOption('3');
  await page.waitForTimeout(3150); assert.notEqual(await page.locator('#portrait-person').inputValue(), secondId);
  await page.locator('#portraitCycle').uncheck();
  console.log('PASS: portrait roster, per-person mouth placement, shortcuts and timed cycling');

  await page.locator('[data-scene="camera"]').click(); await page.locator('#connect-camera').click();
  await page.waitForFunction(() => document.getElementById('camera-status').textContent.startsWith('Camera live'));
  await waitForScene();
  for (const effect of ['prism', 'echo', 'kaleidoscope']) {
    await page.locator('#cameraEffect').selectOption(effect); await page.waitForTimeout(350);
    assert.ok((await canvasPixel()).sum > 0, `${effect} camera output is nonempty`);
  }
  await page.screenshot({ path: 'test-results/camera.png', fullPage: true });
  await page.locator('[data-scene="pg-camera"]').click(); await waitForScene();
  assert.equal(await page.locator('#remix-controls').isVisible(), false);
  assert.equal(await page.locator('#camera-controls').isVisible(), true);
  assert.ok((await canvasPixel()).bright > 50, 'PG Camera renders a live feed');
  const borderPixel = await page.locator('#visual-canvas').evaluate(canvas => [...canvas.getContext('2d').getImageData(canvas.width * 0.25, canvas.height * 0.12, 1, 1).data].slice(0, 3));
  assert.ok(Math.max(...borderPixel) < 20, 'Video crop stays inside the dark message border');
  await page.screenshot({ path: 'test-results/pg-camera-live.png', fullPage: true });
  await page.locator('[data-scene="ball"]').click(); await waitForScene();
  const bounds = await page.locator('#visual-canvas').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.5); await page.locator('#reset-ball').click();
  await page.screenshot({ path: 'test-results/ball.png', fullPage: true });
  await page.locator('#stop-camera').click(); assert.ok((await page.locator('#camera-status').textContent()).startsWith('Camera is off'));
  console.log('PASS: fake camera, all treatments, ball scene and camera release');

  await page.locator('#audio-source').selectOption('microphone'); await page.locator('#connect-audio').click();
  await page.waitForFunction(() => document.getElementById('audio-state').textContent === 'LIVE');
  await page.locator('#audio-source').selectOption('file');
  await page.locator('#music-file').setInputFiles({ name: 'test-kicks.wav', mimeType: 'audio/wav', buffer: wavBuffer() });
  await page.waitForFunction(() => document.getElementById('audio-state').textContent === 'LIVE');
  await page.locator('#play-pause').click(); await page.waitForFunction(() => document.getElementById('play-pause').textContent === 'Play');
  await page.locator('#play-pause').click(); await page.waitForFunction(() => document.getElementById('play-pause').textContent === 'Pause');
  await page.locator('#mute-playback').check();
  await page.waitForTimeout(400);
  assert.notEqual(await page.locator('#level-value').textContent(), '0%', 'Muted playback still drives analysis');
  await page.locator('#audio-source').selectOption('demo');
  console.log('PASS: fake microphone, local music playback and mute analysis');

  await page.locator('h1').click();
  for (let i = 0; i < 4; i++) { await page.keyboard.press('t'); await page.waitForTimeout(500); }
  assert.equal(await page.locator('#tempo-label').textContent(), 'TAPPED TEMPO');
  await page.locator('#first-beat').click(); await page.locator('#auto-tempo').click();
  await page.locator('h1').click(); await page.keyboard.press('1'); await waitForScene();
  await page.keyboard.press('b'); assert.equal((await canvasPixel()).sum, 0, 'Blackout affects the actual output canvas');
  await page.keyboard.press('b'); assert.ok((await canvasPixel()).sum > 0);
  await page.keyboard.press('Space'); assert.equal(await page.locator('#stage-name').textContent(), 'The headliner');
  await page.keyboard.press('h'); assert.ok(await page.locator('body').evaluate(el => el.classList.contains('presentation')));
  await page.keyboard.press('Escape');
  console.log('PASS: tap clock, keyboard navigation, clean presentation and blackout');
  for (const [key, id] of [['5', 'kaleidoscope'], ['6', 'monogram'], ['7', 'dvd'], ['8', 'pg-camera'], ['9', 'chapel']]) {
    await page.locator('h1').click(); await page.keyboard.press(key); await waitForScene();
    assert.ok(await page.locator(`[data-scene="${id}"]`).evaluate(el => el.getAttribute('aria-pressed') === 'true'));
    assert.ok((await canvasPixel()).bright > 5, `${id} has rendered detail`);
    await page.screenshot({ path: `test-results/${id}.png`, fullPage: true });
  }
  await page.locator('[data-scene="kaleidoscope"]').click();
  for (const count of ['8', '12', '16']) { await page.locator('#kaleidoSegments').selectOption(count); await page.waitForTimeout(200); }
  await page.locator('[data-scene="dvd"]').click(); await page.locator('#reset-dvd').click();
  console.log('PASS: all scenes, keyboard shortcuts, geometry controls and bounce reset');

  const chapelPixels = await page.evaluate(async () => {
    const { ChapelScene } = await import('/src/scenes/chapel.js');
    const { defaults, palettes } = await import('/src/settings.js');
    const scene = new ChapelScene();
    await new Promise((resolve, reject) => {
      scene.art.addEventListener('load', resolve, { once: true });
      scene.art.addEventListener('error', reject, { once: true });
    });
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    const frame = { ctx, width: 1200, height: 1000, time: 0, settings: defaults, palette: palettes.moonstone };
    const sample = pulse => {
      scene.render({ ...frame, audio: { pulse, bass: 0, beatCount: 4 } });
      return [...ctx.getImageData(535, 310, 1, 1).data].slice(0, 3).reduce((a, b) => a + b, 0);
    };
    return { idle: sample(0), peak: sample(1) };
  });
  assert.ok(chapelPixels.peak > chapelPixels.idle + 100, 'Chapel window pixels visibly brighten with the beat');
  console.log('PASS: chapel window rendering reacts to music pulses');


  const popupEvent = page.waitForEvent('popup'); await page.locator('#output-button').click();
  const popup = await popupEvent;
  await popup.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  assert.equal(await popup.locator('canvas').count(), 0); assert.equal(await popup.locator('video').count(), 1);
  await popup.setViewportSize({ width: 1280, height: 360 }); await page.waitForTimeout(400);
  const aspect = await page.locator('#visual-canvas').evaluate(el => el.width / el.height);
  assert.ok(Math.abs(aspect - 32 / 9) < 0.02, 'Output adapts to a wide LED wall');
  await popup.close();
  console.log('PASS: separate live output and wide wall ratio');

  await page.locator('[data-palette="rose"]').click();
  await page.reload(); await page.waitForFunction(() => document.querySelectorAll('.scene-card').length === 9);
  assert.equal(await page.locator('#palette-name').textContent(), 'Rose quartz');
  await page.locator('#help-button').click(); assert.ok(await page.locator('#help-dialog').evaluate(el => el.open)); await page.locator('#help-done').click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout has no horizontal overflow');
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(failedResponses, []);
  console.log('PASS: persistence, help, mobile layout, no page errors or failed assets');

  await page.locator('#shared-show-button').click();
  await page.locator('#show-name').fill('Browser QA show');
  await page.locator('#show-password').fill('browser-qa-password');
  await page.locator('#show-setup-key').fill(process.env.AFTERGLOW_SETUP_KEY || '');
  await page.locator('#shared-create-form button[type="submit"]').click();
  await page.waitForFunction(() => Boolean(document.getElementById('wall-link').value));
  const wallLink = await page.locator('#wall-link').inputValue();
  const controllerLink = await page.locator('#controller-link').inputValue();
  const wallContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const wall = await wallContext.newPage(); wall.on('pageerror', error => errors.push(error.message));
  await wall.goto(wallLink);
  await wall.waitForFunction(() => !document.getElementById('wall-start-input').disabled);
  await wall.locator('#wall-source').selectOption('demo'); await wall.locator('#wall-start-input').click();
  await wall.locator('#close-wall-setup').click();
  await page.locator('#close-shared').click(); await page.locator('[data-scene="monogram"]').click();
  await wall.waitForFunction(() => document.querySelector('[data-scene="monogram"]').getAttribute('aria-pressed') === 'true');
  await page.locator('#brightness').fill('0.35'); await page.locator('#brightness').dispatchEvent('input');
  await wall.waitForFunction(() => document.getElementById('brightness').value === '0.35');
  await page.locator('#blackout-button').click();
  await wall.waitForFunction(() => document.getElementById('blackout-button').getAttribute('aria-pressed') === 'true');
  await wall.waitForFunction(() => {
    const c = document.getElementById('visual-canvas');
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < data.length; i += 4) if (data[i] || data[i + 1] || data[i + 2]) return false;
    return true;
  });
  const total = await wall.locator('#visual-canvas').evaluate(c => {
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let sum = 0; for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2]; return sum;
  }); assert.equal(total, 0);
  await page.locator('#blackout-button').click();
  await page.locator('[data-scene="portrait"]').click();
  await page.locator('#portrait-file').setInputFiles({ name: 'Shared QA person.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await wall.waitForFunction(() => [...document.getElementById('portrait-person').options].some(option => option.text === 'Shared QA person'));
  const operatorContext = await browser.newContext(); const operator = await operatorContext.newPage();
  operator.on('pageerror', error => errors.push(error.message)); await operator.goto(controllerLink);
  await operator.locator('#join-password').fill('browser-qa-password');
  await operator.locator('#shared-join-form button[type="submit"]').click();
  await operator.waitForFunction(() => document.body.classList.contains('remote-controller'));
  await operator.locator('#close-shared').click(); await operator.locator('[data-scene="dvd"]').click();
  await wall.waitForFunction(() => document.querySelector('[data-scene="dvd"]').getAttribute('aria-pressed') === 'true');
  await wall.reload(); await wall.waitForFunction(() => !document.getElementById('wall-start-input').disabled);
  await wall.waitForFunction(() => document.querySelector('[data-scene="dvd"]').getAttribute('aria-pressed') === 'true');
  await operatorContext.close(); await wallContext.close(); assert.deepEqual(errors, []);
  console.log('PASS: independent wall/controller browsers, live scene/brightness/blackout, shared portraits, second operator and wall reload');

} finally { await browser.close(); }

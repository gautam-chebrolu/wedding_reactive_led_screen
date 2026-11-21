import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PortraitRoster } from '../src/portraits.js';
import { listPortraitFiles } from '../src/portrait-files.js';
import { sanitizeSettings } from '../src/settings.js';
import { gautamMouth, headlinerMouth } from '../src/portrait-settings.js';

const entries = [
  { id: 'gautam.jpg', name: 'Gautam', src: '/assets/portraits/gautam.jpg', bundled: true },
  { id: 'priya.png', name: 'Priya', src: '/assets/portraits/priya.png', bundled: true }
];
const makeRoster = input => new PortraitRoster(sanitizeSettings(input), async src => ({ src, naturalWidth: 1230, naturalHeight: 1640 }));

test('portraits save separate mouth placements and restore them when cycling', async () => {
  const roster = makeRoster(); await roster.add(entries);
  assert.equal(roster.current.id, 'gautam.jpg'); assert.equal(roster.settings.mouthY, gautamMouth.mouthY);
  roster.settings.mouthX = 0.45; roster.settings.mouthY = 0.47;
  roster.next(1, 1000); assert.equal(roster.current.id, 'priya.png'); assert.equal(roster.settings.mouthY, 0.65);
  roster.settings.mouthX = 0.51; roster.settings.mouthY = 0.58; roster.settings.mouthAngle = 12;
  roster.next(-1, 2000); assert.equal(roster.current.id, 'gautam.jpg'); assert.equal(roster.settings.mouthX, 0.45); assert.equal(roster.settings.mouthY, 0.47);
  roster.next(1, 3000); assert.equal(roster.settings.mouthY, 0.58); assert.equal(roster.settings.mouthAngle, 12);
});

test('manual selection, elapsed-time cycling and pauses use a fresh interval', async () => {
  const roster = makeRoster({ portraitCycle: true, portraitCycleSeconds: 6 }); await roster.add(entries, 1000);
  assert.equal(roster.tick(6999, true), false); assert.equal(roster.tick(7000, true), true);
  assert.equal(roster.current.id, 'priya.png');
  roster.tick(50000, false); assert.equal(roster.tick(50001, true), false);
  assert.equal(roster.tick(56000, true), true); assert.equal(roster.current.id, 'gautam.jpg');
  roster.select('priya.png', 60000); assert.equal(roster.tick(65000, true), false);
});

test('reload and settings import retain the selected person and calibrated mouth', async () => {
  const settings = sanitizeSettings({ portraitId: 'priya.png', portraitMouths: { 'priya.png': { mouthX: 0.44, mouthY: 0.55, mouthWidth: 0.14, mouthHeight: 0.05, mouthAngle: -3 } } });
  const roster = makeRoster(settings); await roster.add(entries);
  assert.equal(roster.current.id, 'priya.png'); assert.equal(roster.settings.mouthY, 0.55);
  Object.assign(roster.settings, sanitizeSettings({ portraitId: 'gautam.jpg', portraitMouths: { 'gautam.jpg': { mouthY: 0.42 } } }));
  roster.restoreSelection(); assert.equal(roster.current.id, 'gautam.jpg'); assert.equal(roster.settings.mouthY, 0.42);
});

test('broken images and repeated folder reloads do not corrupt the roster', async () => {
  const roster = new PortraitRoster(sanitizeSettings(null), async src => { if (src === '/broken') throw new Error('Bad image'); return { src }; });
  const result = await roster.add([...entries, { id: 'bad.png', name: 'Bad', src: '/broken' }]);
  assert.equal(result.added.length, 2); assert.equal(result.failed, 1);
  const repeated = await roster.add(entries); assert.equal(repeated.added.length, 0); assert.equal(roster.entries.length, 2);
  assert.equal(roster.select('missing.jpg'), false); assert.equal(roster.current.id, 'gautam.jpg');
});

test('concurrent loads cannot add duplicate people', async () => {
  let resolve;
  const roster = new PortraitRoster(sanitizeSettings(null), () => new Promise(done => { resolve = done; }));
  const pending = roster.add([entries[0]]);
  const duplicate = await roster.add([entries[0]]); assert.equal(duplicate.added.length, 0);
  resolve({ naturalWidth: 100 }); await pending; assert.equal(roster.entries.length, 1);
});

test('folder discovery only includes supported images, orders the default first and encodes paths', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'afterglow-portraits-'));
  try {
    await Promise.all(['z-person.JPG', 'gautam.jpg', 'priya #1.png', '.hidden.png', 'notes.txt', 'unsupported.svg'].map(file => writeFile(path.join(dir, file), 'fixture')));
    await mkdir(path.join(dir, 'folder.jpg')); await symlink(path.join(dir, 'gautam.jpg'), path.join(dir, 'linked.jpg'));
    const found = await listPortraitFiles(dir);
    assert.equal(found.length, 3); assert.equal(found[0].id, 'gautam.jpg');
    assert.equal(found[1].src, '/assets/portraits/priya%20%231.png'); assert.equal(found[2].name, 'Z Person');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the new headliner replaces the legacy photo without reusing its mouth calibration', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'afterglow-headliner-'));
  try {
    await Promise.all(['gautam.jpg', 'priya_gautam_headliner_image.jpeg', 'another-person.png'].map(file => writeFile(path.join(dir, file), 'fixture')));
    const found = await listPortraitFiles(dir);
    assert.deepEqual(found.map(entry => entry.id), ['priya_gautam_headliner_image.jpeg', 'another-person.png']);
    assert.equal(found[0].name, 'Priya & Gautam');
    const roster = makeRoster({ portraitId: 'gautam.jpg', portraitMouths: { 'gautam.jpg': gautamMouth } });
    await roster.add(found);
    assert.equal(roster.current.id, found[0].id);
    for (const [key, value] of Object.entries(headlinerMouth)) assert.equal(roster.settings[key], value);
    roster.settings.mouthX = 0.61;
    roster.next(); roster.next();
    assert.equal(roster.settings.mouthX, 0.61);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

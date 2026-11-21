import { AudioEngine } from './audio.js';
import { CameraInput } from './camera.js';
import { loadSettings, saveSettings, sanitizeSettings, palettes } from './settings.js';
import { sceneRegistry } from './scenes/index.js';
import { Renderer } from './renderer.js';
import { WallOutput } from './output.js';
import { thumbnail } from './thumbnails.js';
import { PortraitRoster } from './portraits.js';
import { SharedShow } from './show-client.js';
import { mountSharedShowUI } from './show-ui.js';
import { MemoryAlbum } from './memories.js';
import { sceneShortcuts } from './scene-ids.js';

const $ = id => document.getElementById(id);
const settings = loadSettings();
const audio = new AudioEngine(syncSourceStatus);
const camera = new CameraInput(syncCameraStatus);
const renderer = new Renderer($('visual-canvas'), $('stage'), settings);
const portraits = new PortraitRoster(settings);
const memories = new MemoryAlbum({ onChange: album => {
  $('memory-status').textContent = album.status;
  $('refresh-memories').disabled = album.loading;
} });
const portraitURLs = new Set();
const shared = new SharedShow({ onState: applyRemoteSnapshot, onStatus: syncRemoteStatus, onTelemetry: syncRemoteTelemetry });
let remoteRoom = '', remoteCue = null, remoteClock = '', mediaLoading = false, mediaDirty = false, lastTelemetry = 0, lastRemoteBeat = -1;
let lastSwitch = performance.now(), toastTimer, pendingAudio = false, pendingCamera = false;
let errorReported = false, loadingPortraits = false;
const output = new WallOutput(renderer.canvas, aspect => {
  renderer.outputAspect = aspect; $('stage').style.aspectRatio = String(aspect); renderer.resize();
}, () => {
  renderer.outputAspect = 0; $('stage').style.aspectRatio = ''; renderer.resize(); $('output-button').innerHTML = 'Open wall output <span aria-hidden="true">↗</span>';
});

function toast(message, error = false) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 12000 : 5000);
}
function persistSettings(keys = []) {
  saveSettings(settings);
  if (shared.isController && keys.length) shared.publish({ settings: Object.fromEntries(keys.map(key => [key, settings[key]])) });
}
function describeError(error) {
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return 'Access was not granted. Allow microphone/camera access in your browser’s site settings, then try again.';
  if (error.name === 'NotFoundError') return 'No matching input device was found. Connect your equipment and refresh the device list.';
  if (error.name === 'NotReadableError') return 'The device could not be opened. Close other apps using it, then try again.';
  if (error.name === 'OverconstrainedError') return 'That device is no longer available. Refresh the list and choose another input.';
  return error.message || 'The input could not be started. Try again or use demo mode.';
}
function syncSourceStatus() {
  const live = ['microphone', 'shared', 'file'].includes(audio.mode);
  $('source-badge').textContent = shared.isController ? 'Remote control' : live ? 'Audio connected' : audio.mode === 'demo' ? 'Demo signal' : 'Audio off';
  $('audio-state').textContent = shared.isController ? 'WALL' : audio.mode === 'demo' ? 'DEMO' : live ? 'LIVE' : 'OFF';
  $('stage-source').textContent = shared.isController ? 'REMOTE PREVIEW' : audio.mode === 'demo' ? 'SIMULATED AUDIO' : live ? 'REACTING TO MUSIC' : 'AMBIENT MODE';
  $('play-pause').disabled = !audio.element; $('play-pause').textContent = audio.element?.paused ? 'Play' : 'Pause';
  $('track-position').disabled = !audio.element;
  $('signal-label').title = audio.label;
}
function syncCameraStatus() {
  $('camera-status').textContent = camera.ready ? 'Camera live · processed on this device.' : 'Camera is off. Video is processed on this device.';
  $('connect-camera').textContent = camera.ready ? 'Reconnect camera' : 'Enable camera';
  $('stop-camera').hidden = !camera.ready && !pendingCamera;
}
async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    for (const [id, kind] of [['audio-device', 'audioinput'], ['camera-device', 'videoinput']]) {
      const select = $(id), current = select.value;
      select.replaceChildren(new Option('System default', ''));
      devices.filter(device => device.kind === kind && device.deviceId && device.deviceId !== 'default').forEach((device, i) => select.add(new Option(device.label || `${kind === 'audioinput' ? 'Audio input' : 'Camera'} ${i + 1}`, device.deviceId)));
      if ([...select.options].some(option => option.value === current)) select.value = current;
    }
  } catch (error) { toast(describeError(error), true); }
}
function updateInputPanels() {
  const source = $('audio-source').value;
  $('microphone-controls').hidden = source !== 'microphone'; $('shared-controls').hidden = source !== 'shared';
  $('file-controls').hidden = source !== 'file'; $('demo-hint').hidden = source !== 'demo';
}
async function startAudio(action) {
  if (pendingAudio) return;
  pendingAudio = true; $('connect-audio').disabled = true; $('connect-shared').disabled = true; $('music-file').disabled = true;
  try {
    const started = await action();
    if (started) { toast(`Listening to ${audio.label}.`); refreshDevices(); }
  } catch (error) { toast(describeError(error), true); }
  finally { pendingAudio = false; $('connect-audio').disabled = false; $('connect-shared').disabled = false; $('music-file').disabled = false; syncSourceStatus(); }
}

$('audio-source').addEventListener('change', () => {
  if ($('audio-source').value === 'demo') audio.demo(); else audio.stop();
  updateInputPanels();
});
$('connect-audio').addEventListener('click', () => startAudio(() => audio.microphone($('audio-device').value)));
$('connect-shared').addEventListener('click', () => startAudio(() => audio.sharedAudio()));
$('refresh-audio').addEventListener('click', refreshDevices); $('refresh-camera').addEventListener('click', refreshDevices);
navigator.mediaDevices?.addEventListener('devicechange', refreshDevices);
$('music-file').addEventListener('change', event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  $('music-name').textContent = file.name; startAudio(() => audio.localFile(file));
});
$('play-pause').addEventListener('click', async () => { try { await audio.togglePlayback(); } catch (error) { toast(describeError(error), true); } });
$('mute-playback').addEventListener('change', event => audio.setMuted(event.target.checked));
$('track-position').addEventListener('input', event => { if (Number.isFinite(audio.element?.duration)) audio.element.currentTime = audio.element.duration * Number(event.target.value) / 100; });
$('connect-camera').addEventListener('click', async () => {
  if (pendingCamera) return;
  pendingCamera = true; $('connect-camera').disabled = true; $('stop-camera').hidden = false; $('camera-status').textContent = 'Waiting for camera permission…';
  try { if (await camera.start($('camera-device').value)) { toast('Camera connected. Make a little movement.'); refreshDevices(); } }
  catch (error) { toast(describeError(error), true); }
  finally { pendingCamera = false; $('connect-camera').disabled = false; syncCameraStatus(); }
});
$('stop-camera').addEventListener('click', () => camera.stop());

const rangeKeys = ['sensitivity', 'intensity', 'brightness', 'mouthX', 'mouthY', 'mouthWidth', 'mouthHeight', 'mouthAngle', 'motionThreshold', 'ballGravity', 'dvdSpeed', 'hyperspaceSpeed'];
function formatSetting(key) {
  if (['sensitivity', 'ballGravity', 'hyperspaceSpeed'].includes(key)) return `${settings[key].toFixed(2).replace(/0$/, '')}×`;
  if (key === 'mouthAngle') return `${settings[key]}°`;
  if (key === 'motionThreshold') return Math.round(settings[key]);
  if (key === 'dvdSpeed') return `${Math.round(settings[key] * 100)}%`;
  return `${Math.round(settings[key] * 100)}%`;
}
function syncSettings() {
  for (const key of rangeKeys) { $(key).value = settings[key]; $(`${key}-value`).textContent = formatSetting(key); }
  for (const key of ['autoCycle', 'reducedMotion', 'mirror', 'portraitCycle']) $(key).checked = settings[key];
  for (const key of ['cycleSeconds', 'resolution', 'cameraEffect', 'portraitCycleSeconds', 'kaleidoSegments', 'memoryBeats', 'memoryCount', 'rangoliPetals', 'tunnelShape', 'liquidMaterial', 'tunakMode', 'tunakRate']) {
    const select = $(key);
    if (![...select.options].some(option => option.value === String(settings[key]))) select.add(new Option(`${settings[key]} sec`, settings[key]));
    select.value = settings[key];
  }
  $('palette-name').textContent = palettes[settings.palette].name;
  document.querySelectorAll('.palette-swatch').forEach(button => { const active = button.dataset.palette === settings.palette; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  syncScene();
}
for (const key of rangeKeys) $(key).addEventListener('input', event => {
  settings[key] = Number(event.target.value); $(`${key}-value`).textContent = formatSetting(key);
  if (key.startsWith('mouth')) portraits.saveMouth();
  persistSettings(key.startsWith('mouth') ? [key, 'portraitMouths'] : [key]);
});
for (const key of ['autoCycle', 'reducedMotion', 'mirror', 'portraitCycle']) $(key).addEventListener('change', event => {
  settings[key] = event.target.checked; lastSwitch = performance.now();
  if (key === 'portraitCycle') portraits.lastChange = performance.now();
  persistSettings([key]);
});
for (const key of ['cycleSeconds', 'resolution', 'cameraEffect', 'portraitCycleSeconds', 'kaleidoSegments', 'memoryBeats', 'memoryCount', 'rangoliPetals', 'tunnelShape', 'liquidMaterial', 'tunakMode', 'tunakRate']) $(key).addEventListener('change', event => {
  settings[key] = ['cycleSeconds', 'portraitCycleSeconds'].includes(key) ? Number(event.target.value) : event.target.value;
  if (key === 'portraitCycleSeconds') portraits.lastChange = performance.now();
  persistSettings([key]); if (key === 'resolution') renderer.resize();
});
for (const [id, palette] of Object.entries(palettes)) {
  const button = document.createElement('button'); button.className = 'palette-swatch'; button.dataset.palette = id; button.title = palette.name;
  button.setAttribute('aria-label', palette.name); button.style.backgroundImage = `linear-gradient(120deg, ${palette.accent}, ${palette.second})`;
  button.addEventListener('click', () => { settings.palette = id; persistSettings(['palette']); syncSettings(); }); $('palette-picker').append(button);
}
sceneRegistry.forEach((scene, i) => {
  const button = document.createElement('button'); button.className = 'scene-card'; button.dataset.scene = scene.id;
  button.innerHTML = `<span class="scene-thumbnail">${thumbnail(scene.id)}</span><kbd class="scene-shortcut">${sceneShortcuts[i].toUpperCase()}</kbd><span class="scene-info"><strong>${scene.name}</strong><small>${scene.type}</small></span>`;
  button.addEventListener('click', () => chooseScene(scene.id)); $('scene-grid').append(button);
});
$('scene-count').textContent = `${sceneRegistry.length} SCENES`;
function chooseScene(id) {
  renderer.switchScene(id, performance.now() / 1000); lastSwitch = performance.now();
  if (id === 'portrait') portraits.lastChange = performance.now();
  persistSettings(['scene']); syncScene();
}
function nextScene(direction = 1) {
  const index = sceneRegistry.findIndex(scene => scene.id === settings.scene);
  chooseScene(sceneRegistry[(index + direction + sceneRegistry.length) % sceneRegistry.length].id);
}
function syncScene() {
  const scene = sceneRegistry.find(scene => scene.id === settings.scene);
  document.querySelectorAll('.scene-card').forEach(button => { const active = button.dataset.scene === settings.scene; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  $('stage-name').textContent = scene.name; $('stage-number').textContent = `${String(sceneRegistry.indexOf(scene) + 1).padStart(2, '0')} / ${String(sceneRegistry.length).padStart(2, '0')}`;
  $('scene-description').textContent = scene.description; $('scene-setup-tag').textContent = scene.id.toUpperCase();
  $('moon-controls').hidden = scene.id !== 'moon'; $('portrait-controls').hidden = scene.id !== 'portrait';
  $('camera-controls').hidden = !scene.needsCamera; $('remix-controls').hidden = scene.id !== 'camera'; $('ball-controls').hidden = scene.id !== 'ball';
  for (const id of ['kaleidoscope', 'monogram', 'dvd', 'chapel', 'pg-camera', 'memories', 'rangoli', 'mehndi', 'baraat', 'kellogg', 'hyperspace', 'liquid', 'tunak']) $(`${id}-controls`).hidden = scene.id !== id;
  renderer.canvas.style.cursor = scene.id === 'portrait' ? 'crosshair' : scene.id === 'ball' ? 'none' : 'default';
}

$('refresh-memories').addEventListener('click', () => memories.refresh());

function syncPortraitRoster() {
  const select = $('portrait-person'); select.replaceChildren();
  for (const entry of portraits.entries) select.add(new Option(entry.name, entry.id));
  if (!portraits.current) select.add(new Option('Illustrated stand-in', ''));
  select.value = portraits.currentId; select.disabled = portraits.entries.length === 0;
  $('portrait-name').textContent = portraits.current ? `${portraits.current.name} · ${portraits.current.bundled ? 'from portraits folder' : 'session upload'}` : 'No portraits loaded · add images or use the portraits folder';
  $('portrait-count').textContent = `${portraits.entries.length} ${portraits.entries.length === 1 ? 'PERSON' : 'PEOPLE'}`;
  $('portrait-prev').disabled = portraits.entries.length < 2; $('portrait-next').disabled = portraits.entries.length < 2;
}
function selectPortrait(id) {
  if (id === portraits.currentId) return;
  if (settings.scene === 'portrait') renderer.beginTransition(performance.now() / 1000);
  portraits.select(id, performance.now()); syncSettings(); syncPortraitRoster(); persistSettings(['portraitId', 'portraitMouths', 'mouthX', 'mouthY', 'mouthWidth', 'mouthHeight', 'mouthAngle']);
}
function nextPortrait(direction = 1) {
  if (portraits.entries.length < 2) return;
  if (settings.scene === 'portrait') renderer.beginTransition(performance.now() / 1000);
  portraits.next(direction, performance.now()); syncSettings(); syncPortraitRoster(); persistSettings(['portraitId', 'portraitMouths', 'mouthX', 'mouthY', 'mouthWidth', 'mouthHeight', 'mouthAngle']);
}
$('portrait-person').addEventListener('change', event => selectPortrait(event.target.value));
$('portrait-prev').addEventListener('click', () => nextPortrait(-1));
$('portrait-next').addEventListener('click', () => nextPortrait());
async function refreshPortraitFolder(announce = false) {
  if (loadingPortraits) return;
  loadingPortraits = true; $('refresh-portraits').disabled = true;
  try {
    const response = await fetch('./api/portraits');
    if (!response.ok) throw new Error('The portraits folder needs the project’s npm start server. You can also add photos with the upload button.');
    const entries = await response.json();
    if (!Array.isArray(entries)) throw new Error('The portrait folder response was invalid. Restart the project’s npm start server.');
    const result = await portraits.add(entries, performance.now());
    syncSettings(); syncPortraitRoster(); persistSettings();
    if (result.failed) toast(`${result.failed} portrait image(s) could not be opened. Use JPG, PNG or WebP.`, true);
    else if (announce) toast(result.added.length ? `Loaded ${result.added.length} new portrait(s).` : 'Portrait folder checked. No new images found.');
  } catch (error) { toast(describeError(error), true); }
  finally { loadingPortraits = false; $('refresh-portraits').disabled = false; }
}
$('refresh-portraits').addEventListener('click', () => refreshPortraitFolder(true));
$('portrait-file').addEventListener('change', async event => {
  const files = [...event.target.files]; event.target.value = ''; if (!files.length) return;
  if (shared.isController) {
    for (const file of files.slice(0, 50)) {
      if (file.size > 3 * 1024 * 1024) { toast(`${file.name} is larger than the shared portrait limit of 3 MB.`, true); continue; }
      try { await shared.uploadPortrait(file); } catch (error) { toast(error.message, true); }
    }
    toast('Shared portraits updated. Each device downloads them from this show.'); return;
  }
  const entries = [];
  for (const file of files.slice(0, 100)) {
    if (file.size > 30 * 1024 * 1024) { toast(`${file.name} is larger than 30 MB and was skipped.`, true); continue; }
    const id = `upload:${file.name}:${file.size}:${file.lastModified}`.slice(0, 300);
    if (portraits.entries.some(entry => entry.id === id)) continue;
    const src = URL.createObjectURL(file); portraitURLs.add(src);
    entries.push({ id, src, name: file.name.replace(/\.[^.]+$/, ''), bundled: false });
  }
  const result = await portraits.add(entries, performance.now());
  const accepted = new Set(result.added.map(entry => entry.src));
  for (const entry of entries) if (!accepted.has(entry.src)) { URL.revokeObjectURL(entry.src); portraitURLs.delete(entry.src); }
  if (result.added.length) selectPortrait(result.added[0].id);
  syncSettings(); syncPortraitRoster(); persistSettings();
  toast(result.failed ? `${result.added.length} portrait(s) added; ${result.failed} could not be opened.` : `${result.added.length} portrait(s) added. Click the preview to place each person’s mouth.`, Boolean(result.failed));
});
renderer.canvas.addEventListener('pointerdown', event => {
  renderer.pointer(event, performance.now() / 1000);
  if (settings.scene === 'portrait') { portraits.saveMouth(); syncSettings(); persistSettings(['mouthX', 'mouthY', 'mouthWidth', 'mouthHeight', 'mouthAngle', 'portraitMouths']); renderer.canvas.setPointerCapture(event.pointerId); }
});
renderer.canvas.addEventListener('pointermove', event => {
  if (settings.scene === 'ball' || (settings.scene === 'portrait' && event.buttons)) {
    renderer.pointer(event, performance.now() / 1000);
    if (settings.scene === 'portrait') { portraits.saveMouth(); syncSettings(); persistSettings(['mouthX', 'mouthY', 'mouthWidth', 'mouthHeight', 'mouthAngle', 'portraitMouths']); }
  }
});
$('reset-ball').addEventListener('click', () => sendCue('reset-ball')); 
$('reset-dvd').addEventListener('click', () => sendCue('reset-dvd')); 

function tapTempo() { audio.tapClock.tap(performance.now()); publishTempo(); }
function publishTempo() {
  if (shared.isController) shared.publish({ tempo: audio.tapClock.bpm ? { bpm: audio.tapClock.bpm, anchorAt: shared.now } : null }, true);
}
function sendCue(type) {
  renderer.instance(type === 'reset-dvd' ? 'dvd' : 'ball').reset();
  if (shared.isController) shared.publish({ cue: { type, id: crypto.randomUUID().replaceAll('-', '') } }, true);
}
$('tap-tempo').addEventListener('click', tapTempo);
$('auto-tempo').addEventListener('click', () => { audio.tapClock.clear(); publishTempo(); });
$('first-beat').addEventListener('click', () => { audio.tapClock.firstBeat(performance.now()); publishTempo(); toast('Four-beat cycle starts here.'); });
function toggleBlackout() {
  renderer.blackout = !renderer.blackout;
  if (shared.isController) shared.publish({ blackout: renderer.blackout }, true);
  syncBlackoutDisplay();
}
function syncBlackoutDisplay() {
  $('blackout-label').hidden = !renderer.blackout; $('blackout-button').classList.toggle('active', renderer.blackout);
  $('blackout-button').setAttribute('aria-pressed', String(renderer.blackout));
  $('blackout-button').innerHTML = `<span aria-hidden="true">◼</span> ${renderer.blackout ? 'Restore visuals' : 'Blackout'} <kbd>B</kbd>`;
}
$('blackout-button').addEventListener('click', toggleBlackout);
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('stage').requestFullscreen) await $('stage').requestFullscreen();
    else document.body.classList.toggle('presentation');
  } catch { document.body.classList.toggle('presentation'); }
}
$('fullscreen-button').addEventListener('click', fullscreen);
$('restore-button').addEventListener('click', () => { document.body.classList.remove('presentation'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); });
$('output-button').addEventListener('click', () => {
  try { output.open(); $('output-button').textContent = 'Focus wall output ↗'; toast('Move the output window to the LED display and double-click to fill it.'); }
  catch (error) { toast(describeError(error), true); }
});
const dialog = $('help-dialog');
$('help-button').addEventListener('click', () => dialog.showModal());
for (const id of ['close-help', 'help-done']) $(id).addEventListener('click', () => dialog.close());
function handleKey(event, fromOutput = false) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || document.querySelector('dialog[open]')) return;
  const tag = document.activeElement?.tagName;
  if (!fromOutput && (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || document.activeElement?.isContentEditable)) return;
  if (!fromOutput && (event.key === ' ' || event.key === 'Enter') && ['BUTTON', 'SUMMARY', 'A'].includes(tag)) return;
  const key = event.key.toLowerCase();
  if (shared.isWall && !['f', 'h', 'escape'].includes(key)) return;
  if (sceneShortcuts.includes(key)) chooseScene(sceneRegistry[sceneShortcuts.indexOf(key)].id);
  else if (key === ' ' || key === 'arrowright') { event.preventDefault(); nextScene(); }
  else if (key === 'arrowleft') { event.preventDefault(); nextScene(-1); }
  else if (key === 'b') toggleBlackout();
  else if (key === 't') tapTempo();
  else if (key === 'f') fullscreen();
  else if (key === 'h') { if (shared.isWall) showUI.wallSetup(); else document.body.classList.toggle('presentation'); }
  else if (key === 'r') sendCue(settings.scene === 'dvd' ? 'reset-dvd' : 'reset-ball');
  else if (key === ']') nextPortrait();
  else if (key === '[') nextPortrait(-1);
  else if (key === 'escape' && !shared.isWall) document.body.classList.remove('presentation');
}
window.addEventListener('keydown', event => handleKey(event));
window.addEventListener('afterglow-output-key', event => handleKey({ key: event.detail.key, preventDefault() {} }, true));

$('export-settings').addEventListener('click', () => {
  portraits.saveMouth();
  const blob = new Blob([JSON.stringify({ app: 'Afterglow', version: 1, settings }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'afterglow-settings.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import-settings').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > 100000) throw new Error('Use an Afterglow settings JSON file smaller than 100 KB.');
    const data = JSON.parse(await file.text());
    if (data.app !== 'Afterglow' || data.version !== 1 || !data.settings || typeof data.settings !== 'object') throw new Error('This is not an Afterglow version 1 settings file.');
    const clean = sanitizeSettings(data.settings); renderer.switchScene(clean.scene, performance.now() / 1000);
    Object.assign(settings, clean); portraits.restoreSelection(performance.now()); syncSettings(); syncPortraitRoster(); renderer.resize(); persistSettings(Object.keys(settings)); lastSwitch = performance.now(); toast('Settings restored.');
  } catch (error) { toast(describeError(error), true); }
});

function syncRemoteStatus(message) {
  $('shared-status').textContent = message;
  if (shared.isWall) $('wall-show-status').textContent = `${shared.snapshot?.name || 'Show'} · ${message}`;
  if (message === 'Connected' && shared.snapshot?.portraits.some(entry => !portraits.entries.some(person => person.id === entry.id))) syncSharedPortraits();
}
function syncRemoteTelemetry(meter) {
  $('shared-wall-status').textContent = `Wall audio: ${meter.audioMode === 'demo' ? 'silent demo' : meter.audioMode} · camera ${meter.cameraReady ? 'on' : 'off'}`;
}
function applyRemoteSnapshot(snapshot) {
  if (remoteRoom !== snapshot.id) { remoteRoom = snapshot.id; remoteCue = null; remoteClock = ''; }
  const previousScene = settings.scene;
  Object.assign(settings, JSON.parse(JSON.stringify(snapshot.state.settings)));
  settings.scene = shared.scene(shared.isWall ? camera.ready : Boolean(shared.telemetry?.cameraReady));
  if (previousScene !== settings.scene) renderer.beginTransition(performance.now() / 1000);
  const person = shared.portrait(portraits.entries.filter(entry => entry.bundled || entry.shared).map(entry => entry.id));
  if (person) settings.portraitId = person;
  portraits.restoreSelection(performance.now());
  renderer.blackout = snapshot.state.blackout; syncBlackoutDisplay();
  const clock = JSON.stringify(snapshot.state.tempo);
  if (clock !== remoteClock) {
    remoteClock = clock;
    if (snapshot.state.tempo) {
      const taps = audio.tapClock.taps;
      audio.tapClock.setTempo(snapshot.state.tempo.bpm, performance.now() + snapshot.state.tempo.anchorAt - shared.now);
      if (shared.isController) audio.tapClock.taps = taps;
    } else audio.tapClock.clear();
  }
  if (snapshot.state.cue?.id !== remoteCue) {
    if (remoteCue !== null && snapshot.state.cue) renderer.instance(snapshot.state.cue.type === 'reset-dvd' ? 'dvd' : 'ball').reset();
    remoteCue = snapshot.state.cue?.id || '';
  }
  syncSettings(); syncPortraitRoster(); syncSourceStatus(); renderer.resize(); syncSharedPortraits();
}
async function syncSharedPortraits() {
  if (mediaLoading) { mediaDirty = true; return; }
  if (!shared.connected) return;
  mediaLoading = true; const generation = shared.generation;
  try {
    const entries = await shared.portraitEntries();
    if (generation !== shared.generation) return;
    await portraits.add(entries, performance.now());
    if (generation === shared.generation) { syncSettings(); syncPortraitRoster(); }
  } catch (error) { toast(`Shared portraits: ${error.message}`, true); }
  finally { mediaLoading = false; if (mediaDirty) { mediaDirty = false; syncSharedPortraits(); } }
}

function formatTime(seconds) { if (!Number.isFinite(seconds)) return '0:00'; return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
const spectrumCtx = $('spectrum').getContext('2d');
function updateMeters(features, fps) {
  $('level-meter').style.transform = `scaleX(${features.level})`; $('level-value').textContent = `${Math.round(features.level * 100)}%`;
  for (const band of ['bass', 'mid', 'treble']) $(`${band}-meter`).style.transform = `scaleX(${features[band]})`;
  $('beat-light').style.opacity = String(0.15 + features.pulse * 0.85); $('tempo').textContent = features.bpm || '—';
  $('tempo-label').textContent = features.manual ? 'TAPPED TEMPO' : audio.mode === 'demo' ? 'DEMO TEMPO' : 'ESTIMATED TEMPO';
  $('tempo-confidence').textContent = features.manual ? 'Manual four-beat clock' : audio.mode === 'demo' ? 'Demo clock · silent' : features.bpm ? `${Math.round(features.confidence * 100)}% rhythmic consistency` : 'Waiting for a steady beat';
  $('auto-tempo').hidden = !audio.tapClock.taps.length && !features.manual; $('first-beat').hidden = !features.manual; $('bar-dots').hidden = !features.manual;
  [...$('bar-dots').children].forEach((dot, i) => dot.classList.toggle('active', i + 1 === features.beatInBar));
  const wallFresh = shared.telemetry && shared.now - shared.telemetry.at < 4000;
  $('signal-label').textContent = shared.isController ? (wallFresh ? `Wall · ${shared.telemetry.audioLabel}` : 'Preview demo · waiting for wall') : audio.mode === 'demo' ? 'Demo · 112 BPM' : audio.mode === 'idle' ? 'Ambient · audio off' : audio.label;
  if (shared.isController && !wallFresh) $('shared-wall-status').textContent = 'Wall not reporting · preview uses demo';
  if (shared.isController && wallFresh) $('tempo-label').textContent = features.manual ? 'TAPPED TEMPO' : 'WALL TEMPO';
  $('fps').textContent = String(Math.round(fps));
  spectrumCtx.clearRect(0, 0, 210, 40); spectrumCtx.fillStyle = palettes[settings.palette].accent;
  for (let i = 0; i < 42; i++) { const height = features.spectrum[Math.floor(i * 64 / 42)] / 255 * 32; spectrumCtx.globalAlpha = 0.25 + i / 70; spectrumCtx.fillRect(i * 5, 38 - height, 2, Math.max(1, height)); }
  if (audio.element) {
    const duration = audio.element.duration; if (Number.isFinite(duration) && duration > 0 && document.activeElement !== $('track-position')) $('track-position').value = audio.element.currentTime / duration * 100;
    $('track-time').textContent = `${formatTime(audio.element.currentTime)} / ${formatTime(duration)} · loops automatically`;
  }
}
let previous = performance.now(), lastMeters = 0, fps = 60;
function frame(now) {
  const elapsed = (now - previous) / 1000, dt = Math.min(0.05, Math.max(0.001, elapsed)); previous = now;
  fps += (1 / Math.max(0.001, elapsed) - fps) * 0.04;
  if (!shared.connected && settings.autoCycle && now - lastSwitch >= settings.cycleSeconds * 1000) {
    // Camera scenes join the rotation once a camera is enabled.
    const eligible = sceneRegistry.filter(scene => !scene.needsCamera || camera.ready);
    const index = eligible.findIndex(scene => scene.id === settings.scene);
    chooseScene(eligible[(index + 1) % eligible.length].id);
  }
  const features = audio.update(now, dt, settings);
  if (shared.connected && shared.state) {
    const cameraReady = shared.isWall ? camera.ready : Boolean(shared.telemetry?.cameraReady);
    const scene = shared.scene(cameraReady);
    if (scene !== settings.scene) { renderer.switchScene(scene, now / 1000); syncScene(); }
    const person = shared.portrait(portraits.entries.filter(entry => entry.bundled || entry.shared).map(entry => entry.id));
    if (person && person !== portraits.currentId) {
      if (scene === 'portrait') renderer.beginTransition(now / 1000);
      portraits.select(person, now); syncSettings(); syncPortraitRoster();
    }
    if (shared.isController && shared.telemetry && shared.now - shared.telemetry.at < 4000) {
      const meter = shared.telemetry;
      const age = Math.max(0, shared.now - meter.at) / 1000;
      Object.assign(features, meter, { spectrum: features.spectrum, pulse: meter.pulse * Math.exp(-age * 5), beat: meter.beatCount !== lastRemoteBeat, manual: Boolean(shared.state.tempo) });
      lastRemoteBeat = meter.beatCount;
    }
    if (shared.isWall && now - lastTelemetry > 1000) {
      lastTelemetry = now;
      shared.reportTelemetry({ ...features, spectrum: undefined, cameraReady: camera.ready, audioMode: audio.mode, audioLabel: audio.label, fps });
    }
  }
  if (!shared.connected && settings.scene === 'portrait' && settings.portraitCycle && portraits.entries.length > 1 && now - portraits.lastChange >= settings.portraitCycleSeconds * 1000) {
    renderer.beginTransition(now / 1000);
  }
  if (!shared.connected && portraits.tick(now, settings.scene === 'portrait')) { syncSettings(); syncPortraitRoster(); persistSettings(); }
  if (camera.ready && ['camera', 'ball'].includes(settings.scene)) camera.update(now, settings, renderer.canvas.width / renderer.canvas.height);
  memories.tick(now, settings.scene === 'memories');
  try { renderer.render({ time: now / 1000, dt, audio: features, camera, portrait: portraits.current?.image || null, memories }); }
  catch (error) { if (!errorReported) { errorReported = true; toast(`A scene could not be rendered: ${error.message}. Try another scene or reload.`, true); console.error(error); } }
  if (now - lastMeters > 90) { updateMeters(features, fps); lastMeters = now; }
  requestAnimationFrame(frame);
}
window.addEventListener('pagehide', () => { shared.disconnect(); memories.stop(); audio.stop(); camera.stop(); output.close(); for (const url of portraitURLs) URL.revokeObjectURL(url); });
const showUI = mountSharedShowUI({
  shared, settings, toast, fullscreen,
  onConnect: () => {
    portraits.entries = portraits.entries.filter(entry => entry.bundled || entry.shared);
    if (!portraits.entries.some(entry => entry.id === portraits.currentId)) portraits.currentId = '';
    if (shared.isController) { audio.demo(); camera.stop(); remoteClock = ''; }
    $('privacy-label').textContent = 'Audio/video stay local · shared portraits are stored with this show';
    applyRemoteSnapshot({ ...shared.snapshot, state: shared.state }); syncSourceStatus();
  },
  onLeave: () => { audio.demo(); syncSourceStatus(); persistSettings(); $('privacy-label').textContent = 'Audio/video stay local. Guest photos stream from the album.'; },
  startInput: async (mode, device, file) => {
    if (mode === 'microphone') await audio.microphone(device);
    else if (mode === 'shared') await audio.sharedAudio();
    else if (mode === 'file') await audio.localFile(file);
    else if (mode === 'demo') audio.demo(); else audio.stop();
    remoteClock = ''; applyRemoteSnapshot({ ...shared.snapshot, state: shared.state });
    $('audio-source').value = mode; updateInputPanels(); await refreshDevices(); showUI.wallSetup(); return `Listening: ${audio.label}`;
  },
  enableCamera: () => camera.start($('wall-camera-device').value), stopCamera: () => camera.stop()
});
syncSettings(); syncPortraitRoster(); syncSourceStatus(); syncCameraStatus(); updateInputPanels(); refreshDevices(); refreshPortraitFolder(); showUI.boot(); requestAnimationFrame(frame);

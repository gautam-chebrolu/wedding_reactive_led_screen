import { containRect, normalizePlacement } from './display.js';

const storageKey = 'afterglow.visual-placement.v1';
const toolbarCSS = `
  .visual-placement-tools { position:absolute; z-index:130; bottom:18px; left:50%; transform:translateX(-50%); display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:10px; width:max-content; max-width:calc(100% - 32px); padding:10px 14px; border:1px solid #8ead9660; border-radius:7px; background:#101b17ed; color:#d6e5db; font:12px system-ui,sans-serif; transition:opacity .2s; }
  .visual-placement-tools[hidden] { display:none !important; }
  .visual-placement-tools.idle:not(:focus-within):not(:hover) { opacity:0; pointer-events:none; }
  .visual-placement-tools button { background:#294035; color:#e3ece5; border:1px solid #6c8c78; border-radius:4px; padding:7px 10px; cursor:pointer; font:inherit; }
  .visual-placement-tools label { display:flex; align-items:center; gap:8px; white-space:nowrap; }
  .visual-placement-tools input[type=range] { width:110px; accent-color:#bdd7c5; margin:0; }
  .visual-placement-tools output { min-width:4ch; font-variant-numeric:tabular-nums; }
  body.moving-visuals [data-placement-surface] { cursor:grab !important; }
  body.dragging-visuals [data-placement-surface] { cursor:grabbing !important; }
  body.moving-visuals { cursor:grab !important; }
  body.dragging-visuals { cursor:grabbing !important; }
  body.dragging-visuals { user-select:none; overflow-anchor:none; }
`;

// Placement is applied by the renderer, so canvas capture and every local
// output show the actual adjustment. It is saved per device, not shared as a
// scene setting. Move mode explicitly takes over portrait/ball gestures.
export function mountVisualPlacement({ canvas, toggle, center, reset, scale, scaleValue, onChange }) {
  const win = canvas.ownerDocument.defaultView;
  let view = normalizePlacement(), enabled = false;
  const surfaces = new Set();
  try {
    const saved = JSON.parse(win.localStorage.getItem(storageKey));
    view = normalizePlacement(saved);
    enabled = saved?.enabled === true;
  } catch {}
  const save = () => { try { win.localStorage.setItem(storageKey, JSON.stringify({ ...view, enabled })); } catch {} };
  const change = (next, persist = false) => {
    view = normalizePlacement(next); onChange(view); sync();
    if (persist) save();
  };
  const centerView = () => change({ ...view, x: 0, y: 0 }, true);
  const resetView = () => change({}, true);
  const setEnabled = value => { enabled = value; sync(); save(); };
  function sync() {
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = enabled ? 'Moving visuals · M to lock' : 'Move visuals · M';
    scale.value = String(Math.round(view.scale * 100)); scaleValue.textContent = `${Math.round(view.scale * 100)}%`;
    for (const surface of surfaces) surface.sync();
  }
  toggle.addEventListener('click', () => setEnabled(!enabled));
  center.addEventListener('click', centerView); reset.addEventListener('click', resetView);
  scale.addEventListener('input', () => change({ ...view, scale: Number(scale.value) / 100 }, true));

  function attachSurface(element, { alwaysToolbar = false } = {}) {
    const doc = element.ownerDocument, surfaceWin = doc.defaultView;
    const host = element.tagName === 'VIDEO' ? doc.body : element.parentElement;
    if (!doc.getElementById('visual-placement-style')) {
      const style = doc.createElement('style'); style.id = 'visual-placement-style'; style.textContent = toolbarCSS; doc.head.append(style);
    }
    const oldTabIndex = element.getAttribute('tabindex');
    element.dataset.placementSurface = ''; element.draggable = false; element.tabIndex = 0;
    const toolbar = doc.createElement('div'); toolbar.className = 'visual-placement-tools'; toolbar.setAttribute('aria-label', 'Visual placement');
    toolbar.innerHTML = '<span>Drag to move</span><label>Zoom <input type="range" min="25" max="200" step="1" value="100" aria-label="Visual zoom"></label><output>100%</output><button type="button" data-center>Center</button><button type="button" data-reset>Reset</button><button type="button" data-done>Done · M</button>';
    host.append(toolbar);
    const zoom = toolbar.querySelector('input'), zoomValue = toolbar.querySelector('output');
    zoom.addEventListener('input', () => change({ ...view, scale: Number(zoom.value) / 100 }, true));
    toolbar.querySelector('[data-center]').addEventListener('click', centerView);
    toolbar.querySelector('[data-reset]').addEventListener('click', resetView);
    toolbar.querySelector('[data-done]').addEventListener('click', () => setEnabled(false));
    let drag = null, timer, presentation = doc.body.classList.contains('presentation');
    const fittedBounds = () => {
      const bounds = element.getBoundingClientRect();
      return containRect(element.videoWidth || element.width || bounds.width, element.videoHeight || element.height || bounds.height, bounds);
    };
    const showTools = () => {
      surfaceWin.clearTimeout(timer);
      if (!enabled) return;
      toolbar.classList.remove('idle');
      timer = surfaceWin.setTimeout(() => { if (!drag) toolbar.classList.add('idle'); }, 2400);
    };
    const surface = { sync() {
      doc.body.classList.toggle('moving-visuals', enabled);
      toolbar.hidden = !enabled || !(alwaysToolbar || doc.fullscreenElement || doc.body.classList.contains('presentation'));
      zoom.value = String(Math.round(view.scale * 100)); zoomValue.textContent = `${Math.round(view.scale * 100)}%`;
      if (!enabled && drag) finish();
    } };
    surfaces.add(surface);
    const down = event => {
      if (!enabled || event.button !== 0) return;
      event.preventDefault(); event.stopImmediatePropagation();
      element.focus({ preventScroll: true });
      const fit = fittedBounds();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, view: { ...view }, width: fit.width, height: fit.height };
      element.setPointerCapture(event.pointerId); doc.body.classList.add('dragging-visuals'); showTools();
    };
    const move = event => {
      if (!enabled) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!drag || event.pointerId !== drag.id) return;
      change({ ...view, x: drag.view.x + (event.clientX - drag.x) / drag.width, y: drag.view.y + (event.clientY - drag.y) / drag.height });
      showTools();
    };
    function finish(event) {
      if (!drag || (event && event.pointerId !== drag.id)) return;
      const id = drag.id; drag = null; doc.body.classList.remove('dragging-visuals'); save();
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
      showTools();
    }
    const keydown = event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || doc.querySelector('dialog[open]')) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(doc.activeElement?.tagName) || doc.activeElement?.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (key === 'm') { event.preventDefault(); event.stopImmediatePropagation(); setEnabled(!enabled); showTools(); return; }
      if (doc.activeElement?.id === 'preview-resize-handle') return;
      if (!enabled || !['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'home', '+', '-', '='].includes(key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (key === 'home') centerView();
      else if (['+', '-', '='].includes(key)) change({ ...view, scale: view.scale + (key === '-' ? -0.02 : 0.02) }, true);
      else {
        const bounds = fittedBounds();
        const step = event.shiftKey ? 20 : 2;
        change({ ...view, x: view.x + (key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0) / bounds.width,
          y: view.y + (key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0) / bounds.height }, true);
      }
      showTools();
    };
    const fullscreen = () => { surface.sync(); showTools(); };
    const observer = new surfaceWin.MutationObserver(() => {
      const next = doc.body.classList.contains('presentation');
      if (next !== presentation) { presentation = next; surface.sync(); showTools(); }
    });
    observer.observe(doc.body, { attributes: true, attributeFilter: ['class'] });
    element.addEventListener('pointerdown', down, true); element.addEventListener('pointermove', move, true);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(name, finish, true);
    doc.addEventListener('keydown', keydown, true); doc.addEventListener('pointermove', showTools);
    doc.addEventListener('fullscreenchange', fullscreen);
    surface.sync(); showTools();
    return () => {
      finish(); surfaces.delete(surface); observer.disconnect(); surfaceWin.clearTimeout(timer); toolbar.remove();
      element.removeAttribute('data-placement-surface');
      if (oldTabIndex === null) element.removeAttribute('tabindex'); else element.setAttribute('tabindex', oldTabIndex);
      element.removeEventListener('pointerdown', down, true); element.removeEventListener('pointermove', move, true);
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) element.removeEventListener(name, finish, true);
      doc.removeEventListener('keydown', keydown, true); doc.removeEventListener('pointermove', showTools); doc.removeEventListener('fullscreenchange', fullscreen);
    };
  }
  attachSurface(canvas); onChange(view); sync();
  return { attachSurface, get enabled() { return enabled; } };
}

import { clamp } from './math.js';

const storageKey = 'afterglow.preview-layout.v1';
const defaults = () => ({ fraction: 1, locked: true, height: 540 });

// Preview layout belongs to this browser, independently of show settings and
// the DJ's output viewport. Store a width fraction so it also fits after a move
// to a smaller monitor or a change in browser zoom.
export function mountPreviewSizing({ shell, stage, scale, scaleValue, dimensions, lock, reset, handle }) {
  const doc = shell.ownerDocument, win = doc.defaultView;
  let state = defaults(), aspect = 16 / 9, drag = null, lastAvailable = 0;
  try {
    const saved = JSON.parse(win.localStorage.getItem(storageKey));
    if (saved && typeof saved === 'object') {
      if (Number.isFinite(saved.fraction)) state.fraction = clamp(saved.fraction, 0.01, 1);
      if (typeof saved.locked === 'boolean') state.locked = saved.locked;
      if (Number.isFinite(saved.height)) state.height = clamp(saved.height, 180, 2400);
    }
  } catch { /* A fresh preview also works without browser storage. */ }
  const availableWidth = () => shell.parentElement.clientWidth;
  const minimumWidth = () => Math.min(320, availableWidth());
  const isFullscreen = () => doc.fullscreenElement === stage || doc.body.classList.contains('presentation');
  const save = () => { try { win.localStorage.setItem(storageKey, JSON.stringify(state)); } catch {} };
  const updateDimensions = () => {
    const box = stage.getBoundingClientRect();
    dimensions.textContent = `${Math.round(box.width)} × ${Math.round(box.height)}`;
  };
  function apply() {
    const available = availableWidth();
    if (available <= 0) return;
    const minimumPercent = Math.ceil(minimumWidth() / available * 100);
    const fraction = clamp(state.fraction, minimumPercent / 100, 1);
    shell.style.width = `${fraction * 100}%`;
    stage.style.aspectRatio = state.locked ? String(aspect) : 'auto';
    stage.style.height = state.locked ? '' : `${state.height}px`;
    scale.min = String(minimumPercent);
    scale.value = String(Math.round(fraction * 100));
    scaleValue.textContent = `${Math.round(fraction * 100)}%`;
    lock.checked = state.locked;
    updateDimensions();
  }
  scale.addEventListener('input', () => {
    state.fraction = clamp(Number(scale.value) / 100, minimumWidth() / availableWidth(), 1);
    apply(); save();
  });
  lock.addEventListener('change', () => {
    if (!lock.checked) state.height = clamp(stage.getBoundingClientRect().height, 180, 2400);
    state.locked = lock.checked; apply(); save();
  });
  reset.addEventListener('click', () => { state = defaults(); apply(); save(); });

  function setSize(width, height) {
    state.fraction = clamp(width, minimumWidth(), availableWidth()) / availableWidth();
    if (!state.locked) state.height = clamp(height, 180, 2400);
    apply();
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || isFullscreen()) return;
    event.preventDefault();
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      width: shell.getBoundingClientRect().width, height: stage.getBoundingClientRect().height };
    handle.setPointerCapture(event.pointerId); doc.body.classList.add('resizing-preview');
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    // The shell is centered: each horizontal pixel at its right edge changes
    // its total width by two. Locked vertical drags follow the same ratio.
    const dx = (event.clientX - drag.x) * 2, dy = event.clientY - drag.y;
    const delta = state.locked && Math.abs(dy * aspect) > Math.abs(dx) ? dy * aspect : dx;
    setSize(drag.width + delta, drag.height + dy);
  });
  const finishDrag = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null; doc.body.classList.remove('resizing-preview'); save();
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(name, finishDrag);
  handle.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || isFullscreen()) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 64 : 16, direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
    const width = shell.getBoundingClientRect().width, height = stage.getBoundingClientRect().height;
    if (state.locked || ['ArrowLeft', 'ArrowRight'].includes(event.key)) setSize(width + step * direction, height);
    else setSize(width, height + step * direction);
    save();
  });

  const parentObserver = new win.ResizeObserver(() => {
    const available = availableWidth();
    if (available !== lastAvailable) { lastAvailable = available; apply(); }
  });
  parentObserver.observe(shell.parentElement);
  const stageObserver = new win.ResizeObserver(updateDimensions); stageObserver.observe(stage);
  apply();
  return {
    setAspect(value = 16 / 9) { aspect = Number.isFinite(value) && value > 0 ? value : 16 / 9; apply(); },
    destroy() { parentObserver.disconnect(); stageObserver.disconnect(); }
  };
}

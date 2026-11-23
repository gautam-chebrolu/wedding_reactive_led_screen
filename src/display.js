// Layout uses CSS pixels. Only the backing buffer uses device pixels, and its
// quality limits never determine the element's size or position on the screen.
export function renderDimensions({ width, height, pixelRatio = 1 }, resolution = 'auto') {
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return null;
  const density = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const requestedWidth = ['1280', '1920', '2560'].includes(resolution) ? Number(resolution) : width * density;
  const requestedHeight = requestedWidth * height / width;
  const scale = Math.min(1, 2560 / Math.max(requestedWidth, requestedHeight), Math.sqrt(4400000 / (requestedWidth * requestedHeight)));
  return { width: Math.max(2, Math.round(requestedWidth * scale)), height: Math.max(2, Math.round(requestedHeight * scale)) };
}

export function containRect(contentWidth, contentHeight, bounds) {
  const scale = Math.min(bounds.width / contentWidth, bounds.height / contentHeight);
  const width = contentWidth * scale, height = contentHeight * scale;
  return { x: bounds.x + (bounds.width - width) / 2, y: bounds.y + (bounds.height - height) / 2, width, height };
}

export function normalizePlacement(value = {}) {
  const bounded = (key, fallback, min, max) => Number.isFinite(value?.[key]) ? Math.max(min, Math.min(max, value[key])) : fallback;
  return { x: bounded('x', 0, -1, 1), y: bounded('y', 0, -1, 1), scale: bounded('scale', 1, 0.25, 2) };
}

export function placementTransform(width, height, placement) {
  const { x, y, scale } = normalizePlacement(placement);
  return { x: width * ((1 - scale) / 2 + x), y: height * ((1 - scale) / 2 + y), scale };
}

// A move between monitors can change density without changing CSS dimensions.
// Re-arm the media query whenever that happens, and measure after fullscreen
// and visual-viewport events as well as normal element/window resizes.
export function observeDisplay(element, onChange) {
  const win = element.ownerDocument.defaultView, doc = element.ownerDocument;
  let previous = '', densityQuery;
  const measure = () => {
    const { width, height } = element.getBoundingClientRect();
    if (!(width > 0 && height > 0)) return;
    const size = { width, height, pixelRatio: win.devicePixelRatio || 1 };
    const key = `${width}:${height}:${size.pixelRatio}`;
    if (key !== previous) { previous = key; onChange(size); }
  };
  const densityChanged = () => { watchDensity(); measure(); };
  const unwatchDensity = () => densityQuery?.removeEventListener('change', densityChanged);
  const watchDensity = () => {
    unwatchDensity();
    densityQuery = win.matchMedia(`(resolution: ${win.devicePixelRatio || 1}dppx)`);
    densityQuery.addEventListener('change', densityChanged);
  };
  const observer = new win.ResizeObserver(measure); observer.observe(element);
  win.addEventListener('resize', measure);
  doc.addEventListener('fullscreenchange', measure);
  win.visualViewport?.addEventListener('resize', measure);
  watchDensity(); measure();
  return () => {
    observer.disconnect(); unwatchDensity();
    win.removeEventListener('resize', measure);
    doc.removeEventListener('fullscreenchange', measure);
    win.visualViewport?.removeEventListener('resize', measure);
  };
}

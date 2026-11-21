import { monochromeMask } from '../logo-mask.js';

export function loadLogo(src, { monochrome = false } = {}) {
  const image = new Image();
  const art = { image, ready: false, failed: false };
  image.onload = () => {
    try {
      art.aspect = image.naturalWidth / image.naturalHeight;
      if (monochrome) {
        const mask = document.createElement('canvas'); mask.width = image.naturalWidth; mask.height = image.naturalHeight;
        const ctx = mask.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, mask.width, mask.height);
        art.crop = monochromeMask(pixels.data, mask.width, mask.height);
        ctx.putImageData(pixels, 0, 0); art.image = mask; art.aspect = art.crop[2] / art.crop[3];
      }
      art.ready = true;
    } catch { art.failed = true; }
  }; image.onerror = () => { art.failed = true; }; image.src = src;
  return art;
}
export function tintLogo(art, canvas, color, crop = art.crop) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  if (crop) ctx.drawImage(art.image, ...crop, 0, 0, canvas.width, canvas.height);
  else ctx.drawImage(art.image, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
}
export function pulseScale(audio, settings, amount = 0.12) {
  return 1 + audio.pulse * settings.intensity * amount * (settings.reducedMotion ? 0.18 : 1);
}

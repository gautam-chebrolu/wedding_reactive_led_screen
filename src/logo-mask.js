// Runtime rendering mask for white-on-black artwork. The downloaded source stays unchanged.
export function monochromeMask(data, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      const alpha = Math.round(data[i + 3] * luminance / 255);
      data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = alpha;
      if (alpha > 0) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
  }
  if (right < left) throw new Error('The logo image contains no visible light-colored artwork.');
  return [left, top, right - left + 1, bottom - top + 1];
}

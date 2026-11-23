import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { headlinerMouth } from './portrait-settings.js';

const headlinerFile = 'priya_gautam_headliner_image.jpeg';
const headlinerPreview = 'priya_gautam_headliner_preview.jpg';
const isLegacyHeadliner = name => /^gautam\.(jpe?g|png|webp)$/i.test(name);

export async function listPortraitFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const images = entries.filter(entry => entry.isFile() && !entry.name.startsWith('.') && /\.(jpe?g|png|webp)$/i.test(entry.name));
  const hasHeadliner = images.some(entry => entry.name === headlinerFile);
  const hasPreview = images.some(entry => entry.name === headlinerPreview);
  const priority = name => name === headlinerFile ? 0 : isLegacyHeadliner(name) ? 1 : 2;
  return images.filter(entry => entry.name !== headlinerPreview && (!hasHeadliner || !isLegacyHeadliner(entry.name)))
    .sort((a, b) => priority(a.name) - priority(b.name) || a.name.localeCompare(b.name))
    .slice(0, 100).map(entry => ({
      id: entry.name,
      name: path.parse(entry.name).name.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
      src: `/assets/portraits/${encodeURIComponent(entry.name === headlinerFile && hasPreview ? headlinerPreview : entry.name)}`,
      bundled: true,
      ...(entry.name === headlinerFile ? { name: 'Priya & Gautam', mouth: headlinerMouth } : {})
    }));
}

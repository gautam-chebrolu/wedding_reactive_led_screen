import { readdir } from 'node:fs/promises';
import path from 'node:path';

export async function listPortraitFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.filter(entry => entry.isFile() && !entry.name.startsWith('.') && /\.(jpe?g|png|webp)$/i.test(entry.name))
    .sort((a, b) => Number(!/^gautam\./i.test(a.name)) - Number(!/^gautam\./i.test(b.name)) || a.name.localeCompare(b.name))
    .slice(0, 100).map(entry => ({
      id: entry.name,
      name: path.parse(entry.name).name.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
      src: `/assets/portraits/${encodeURIComponent(entry.name)}`,
      bundled: true
    }));
}

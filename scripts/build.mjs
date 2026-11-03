import { mkdir, cp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)), output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true }); await mkdir(path.join(output, 'src'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'assets']) await cp(path.join(root, file), path.join(output, file), { recursive: true });
for (const entry of await readdir(path.join(root, 'src'), { withFileTypes: true })) {
  if (entry.name === 'portrait-files.js') continue; // Node-only folder discovery stays in the Function.
  await cp(path.join(root, 'src', entry.name), path.join(output, 'src', entry.name), { recursive: true });
}
console.log('Vercel static assets built in dist/. API functions remain server-only.');

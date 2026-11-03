import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listPortraitFiles } from './src/portrait-files.js';
import { ShowAPI } from './server/show-api.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
export async function createAppServer(options = {}) {
  const setupKey = options.setupKey ?? process.env.AFTERGLOW_SETUP_KEY ?? '';
  if (process.env.NODE_ENV === 'production' && !setupKey) throw new Error('Set AFTERGLOW_SETUP_KEY before starting a public production server.');
  const api = new ShowAPI({ directory: options.directory || process.env.AFTERGLOW_DATA_DIR || path.join(root, '.afterglow-data'), setupKey, publicOrigin: process.env.PUBLIC_ORIGIN || '' });
  await api.init();
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok'); return; }
      if (await api.handle(req, res, url)) return;
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end('Method not allowed'); return; }
      const pathname = decodeURIComponent(url.pathname);
      if (pathname === '/api/portraits') {
        const portraits = await listPortraitFiles(path.join(root, 'assets/portraits'));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(portraits)); return;
      }
      if (!(pathname === '/' || pathname === '/index.html' || pathname === '/styles.css' || pathname.startsWith('/src/') || pathname.startsWith('/assets/'))) { res.writeHead(404).end('Not found'); return; }
      const target = await realpath(path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)));
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) { res.writeHead(403).end('Forbidden'); return; }
      if (!(await stat(target)).isFile()) throw new Error('Not a file');
      const type = types[path.extname(target).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type + (/^(text\/|application\/json)/.test(type) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(target));
    } catch { if (!res.headersSent) res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
  });
  server.headersTimeout = 30000; server.requestTimeout = 60000;
  return { server, api, close: () => { api.close(); server.close(); server.closeIdleConnections?.(); } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, close } = await createAppServer();
  const port = Number(process.env.PORT || 4173), host = process.env.HOST || '127.0.0.1';
  server.listen(port, host, () => console.log(`Afterglow is ready at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  process.on('SIGTERM', close); process.on('SIGINT', close);
}

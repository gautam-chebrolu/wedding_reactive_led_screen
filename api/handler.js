import path from 'node:path';
import { ShowAPI } from '../server/show-api.js';
import { RedisShowStore } from '../server/redis-store.js';
import { listPortraitFiles } from '../src/portrait-files.js';
import { handlePhotoAPI } from '../server/photo-api.js';

let service;
async function getService() {
  if (!service) service = (async () => {
    if (!process.env.AFTERGLOW_SETUP_KEY) throw new Error('Set AFTERGLOW_SETUP_KEY in Vercel project settings.');
    const store = new RedisShowStore({ url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN });
    const api = new ShowAPI({ store, polling: true, setupKey: process.env.AFTERGLOW_SETUP_KEY, publicOrigin: process.env.PUBLIC_ORIGIN || '' });
    await api.init(); return api;
  })().catch(error => { service = null; throw error; });
  return service;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const url = new URL(req.url, 'https://afterglow.invalid');
    const route = req.query?.route || url.searchParams.get('route');
    if (typeof route === 'string') url.pathname = `/api/${route}`;
    if (await handlePhotoAPI(req, res, url)) return;
    if (url.pathname === '/api/portraits' && ['GET', 'HEAD'].includes(req.method)) {
      const portraits = await listPortraitFiles(path.join(process.cwd(), 'assets/portraits'));
      res.setHeader('Content-Type', 'application/json'); res.statusCode = 200; res.end(JSON.stringify(portraits)); return;
    }
    const api = await getService();
    if (!(await api.handle(req, res, url))) { res.statusCode = 404; res.end('Not found'); }
  } catch (error) {
    res.statusCode = 503; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error.message || 'Shared show setup is incomplete.' }));
  }
}

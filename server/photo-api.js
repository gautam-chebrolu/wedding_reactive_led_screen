// Read-only bridge to the same approved album used by wedding_photos/memories.
// Same-origin images keep canvas.captureStream() usable on the separate wall.
export const defaultPhotosOrigin = 'https://priya-gautam-photos.web.app';
export async function handlePhotoAPI(req, res, url, { origin = process.env.PHOTOS_ORIGIN || defaultPhotosOrigin, fetcher = fetch } = {}) {
  if (!url.pathname.startsWith('/api/memories/')) return false;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const fail = (status, error) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error })); };
  if (!['GET', 'HEAD'].includes(req.method)) { fail(405, 'The memory album is read-only.'); return true; }
  const file = url.pathname.match(/^\/api\/memories\/files\/([A-Za-z0-9_-]{1,160})$/);
  if (url.pathname !== '/api/memories/gallery' && !file) { fail(404, 'Memory route not found.'); return true; }
  try {
    const base = new URL(origin);
    if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw new Error('Invalid photo origin');
    const upstream = new URL(file ? `/api/photos/public/files/${file[1]}` : '/api/photos/public/gallery', base);
    if (file) upstream.searchParams.set('thumb', '1');
    else if (url.searchParams.has('cursor')) upstream.searchParams.set('cursor', url.searchParams.get('cursor').slice(0, 2000));
    // Never forward cookies, show credentials, or user-supplied destinations.
    const response = await fetcher(upstream, { signal: AbortSignal.timeout(10000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) { fail(response.status === 404 ? 404 : 503, 'The approved photo album is unavailable.'); return true; }
    const type = response.headers.get('content-type')?.split(';')[0];
    if (file ? !['image/jpeg', 'image/png', 'image/webp'].includes(type) : type !== 'application/json') throw new Error('Unexpected photo response');
    // Bound the response before buffering; stay below Vercel's function payload limit.
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length; if (size > 3 * 1024 * 1024) throw new Error('Photo response too large');
      chunks.push(chunk);
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(req.method === 'HEAD' ? undefined : Buffer.concat(chunks));
  } catch { fail(503, 'Could not reach the photo album. Check the connection and try Refresh photos.'); }
  return true;
}

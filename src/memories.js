export const MAX_MEMORIES = 90;

export function loadMemoryImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.decoding = 'async';
    const timer = setTimeout(() => { image.src = ''; reject(new Error('Photo timed out')); }, 10000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('Photo unavailable')); };
    image.src = src;
  });
}

export class MemoryAlbum {
  // Calling a native Window.fetch as this.fetcher() supplies the album as its
  // receiver and throws "Illegal invocation" in browsers. Keep the Window call.
  constructor({ fetcher = (...args) => globalThis.fetch(...args), loadImage = loadMemoryImage, onChange = () => {} } = {}) {
    this.fetcher = fetcher; this.loadImage = loadImage; this.onChange = onChange;
    this.items = []; this.status = 'Select this scene to open the approved album.'; this.state = 'idle';
    this.loading = false; this.nextRefresh = 0; this.generation = 0;
  }
  tick(now, active) {
    if (active && !this.loading && now >= this.nextRefresh) void this.refresh(now);
  }
  async refresh(now = performance.now()) {
    if (this.loading) return;
    this.loading = true; const generation = this.generation;
    this.state = 'loading'; this.status = 'Checking approved photos…'; this.onChange(this);
    try {
      const records = new Map(), visited = new Set(); let cursor = '', pages = 0;
      do {
        visited.add(cursor);
        const response = await this.fetcher('/api/memories/gallery' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), { cache: 'no-store', signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error('Could not reach the album. Check the connection and try Refresh photos.');
        const data = await response.json();
        if (generation !== this.generation) return;
        if (data.galleryEnabled === false) { this.items = []; this.state = 'closed'; this.status = 'The shared album is closed. Enable “Show approved photos” in the photo dashboard.'; return; }
        if (data.galleryEnabled !== true || !Array.isArray(data.items)) throw new Error('The photo service returned an invalid album.');
        for (const item of data.items) {
          if (typeof item.id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(item.id) && records.size < MAX_MEMORIES) records.set(item.id, { id: item.id });
        }
        cursor = typeof data.next === 'string' ? data.next : '';
      } while (cursor && !visited.has(cursor) && records.size < MAX_MEMORIES && ++pages < 20);
      // Remove revoked/deleted photos before loading any new ones. A failed poll
      // preserves the last successful album; a successful poll reconciles it.
      const cached = new Map(this.items.map(item => [item.id, item]));
      this.items = this.items.filter(item => records.has(item.id)); this.onChange(this);
      const pending = [...records.values()]; let index = 0, failed = 0;
      // Mix download order too: the first photos on screen should not always
      // come from the newest group while the rest of the album is decoding.
      for (let i = pending.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pending[i], pending[j]] = [pending[j], pending[i]];
      }
      await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
        while (index < pending.length && generation === this.generation) {
          const item = pending[index++]; if (cached.has(item.id)) continue;
          try {
            const image = await this.loadImage('/api/memories/files/' + encodeURIComponent(item.id));
            if (generation !== this.generation) return;
            if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) throw new Error('Empty image');
            this.items.push({ ...item, image }); this.onChange(this);
          } catch { failed++; }
        }
      }));
      const order = new Map([...records.keys()].map((id, index) => [id, index]));
      this.items.sort((a, b) => order.get(a.id) - order.get(b.id));
      this.state = this.items.length ? 'ready' : failed ? 'error' : 'empty';
      this.status = this.items.length ? `${this.items.length} approved ${this.items.length === 1 ? 'photo' : 'photos'}${cursor ? ' · latest 90' : ''}${failed ? ` · ${failed} unavailable; retrying next refresh` : ''} · refreshes every 30 sec` : failed ? 'Photos could not be opened. Try Refresh photos.' : 'Waiting for the first approved photos.';
    } catch (error) { if (generation === this.generation) { this.state = 'error'; this.status = error.message; } }
    finally {
      if (generation === this.generation) { this.loading = false; this.nextRefresh = now + 30000; this.onChange(this); }
    }
  }
  stop() { this.generation++; this.items = []; this.loading = false; }
}

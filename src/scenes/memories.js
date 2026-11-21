import { clamp, seededRandom } from '../math.js';

export const memoriesMetadata = { id: 'memories', name: 'Through your eyes', type: 'GUEST PHOTO WALL', description: 'Your wedding, through everyone’s eyes. Approved guest photos settle onto a sage tabletop to the beat of the music.', focal: 'Guest photos + beat-led arrivals', needsCamera: false };

export const MAX_MEMORY_LAYERS = 36;

// A new placement belongs to an arrival, never to a grid cell. The first few
// prints spread toward the edges; later prints keep covering the earlier pile.
export function memoryPlacement(width, height, arrival, size = '9', aspect = 0.8) {
  const random = seededRandom(724 + arrival * 7919);
  const factor = ({ '6': 1.15, '9': 1, '12': 0.85 })[size] || 1;
  const photoHeight = Math.min(height * 0.84 * factor, width * 0.76 * factor / aspect);
  const photoWidth = photoHeight * aspect;
  const anchors = [[0.5, 0.5], [0, 0], [1, 1], [1, 0], [0, 1], [0.5, 0], [0.5, 1]];
  const anchor = arrival < anchors.length ? anchors[arrival]
    : [(arrival * 0.61803398875 + 0.5) % 1, (arrival * 0.75487766625 + 0.5) % 1];
  const x = clamp(anchor[0] + (random() - 0.5) * 0.22);
  const y = clamp(anchor[1] + (random() - 0.5) * 0.22);
  return {
    x: photoWidth * 0.4 + (width - photoWidth * 0.8) * x,
    y: photoHeight * 0.4 + (height - photoHeight * 0.8) * y,
    width: photoWidth, height: photoHeight, angle: (random() - 0.5) * 0.42
  };
}

export class MemorySequence {
  constructor(random = Math.random) { this.random = random; this.played = new Set(); this.cards = []; this.beats = 0; this.lastBeat = null; this.lastBeatAt = -Infinity; this.lastPlacement = -Infinity; this.arrivals = 0; this.lastTime = -Infinity; }
  update(items, time, audio, settings) {
    const ids = new Set(items.map(item => item.id));
    this.cards = this.cards.filter(card => ids.has(card.id));
    for (const id of this.played) if (!ids.has(id)) this.played.delete(id);
    const resumed = time - this.lastTime > 1;
    this.lastTime = time;
    if (resumed) { this.beats = 0; this.lastBeat = audio.beatCount; this.lastPlacement = time; }
    if (audio.beat && audio.beatCount !== this.lastBeat) { this.beats++; this.lastBeat = audio.beatCount; this.lastBeatAt = time; }
    const interval = Number(settings.memoryBeats), silentDue = time - this.lastPlacement >= 6 && time - this.lastBeatAt >= 6;
    const beatDue = this.beats >= interval && time - this.lastPlacement >= (settings.reducedMotion ? 2 : 0.25);
    if (!items.length || (this.cards.length && !silentDue && !beatDue)) return false;
    // Draw without replacement so everyone gets a turn, then start a fresh
    // random pass. Album refreshes preserve the pass and new approvals join it.
    let choices = items.filter(item => !this.played.has(item.id));
    if (!choices.length) { this.played.clear(); choices = items; }
    const previous = this.cards.at(-1)?.id;
    if (choices.length > 1) choices = choices.filter(item => item.id !== previous);
    const next = choices[Math.floor(this.random() * choices.length)];
    this.played.add(next.id);
    this.beats = 0; this.lastPlacement = time;
    this.cards.push({ id: next.id, at: time, arrival: this.arrivals++ });
    // Retire only the deepest layers so a long show has bounded memory/render
    // work. No visible slot is replaced or cleared for a new arrival.
    if (this.cards.length > MAX_MEMORY_LAYERS) this.cards.shift();
    return true;
  }
}

export class MemoriesScene {
  constructor(createCanvas = () => document.createElement('canvas')) {
    this.sequence = new MemorySequence(); this.createCanvas = createCanvas; this.pile = null; this.pileKey = '';
  }
  drawPrint(ctx, image, card, w, h, time, audio, settings, settled = false) {
    const slot = memoryPlacement(w, h, card.arrival, settings.memoryCount, image.naturalWidth / image.naturalHeight);
    const progress = settled ? 1 : clamp((time - card.at) / 0.65), ease = 1 - (1 - progress) ** 3;
    const movement = settings.reducedMotion ? 0 : settings.intensity;
    ctx.save(); ctx.globalAlpha = settled ? 1 : clamp(progress * 3);
    ctx.translate(slot.x, slot.y - (1 - ease) * h * 0.22 * movement);
    ctx.rotate(slot.angle + (1 - ease) * 0.22 * movement);
    const zoom = 1 + (1 - ease) * 0.18 * movement + (settled ? 0 : audio.pulse || 0) * 0.008 * movement;
    ctx.scale(zoom, zoom); ctx.shadowColor = '#0009';
    ctx.shadowBlur = h * (0.012 + (1 - ease) * 0.025); ctx.shadowOffsetY = h * 0.008;
    ctx.drawImage(image, -slot.width / 2, -slot.height / 2, slot.width, slot.height); ctx.restore();
  }
  render({ ctx, width: w, height: h, time, audio, settings, memories }) {
    const gradient = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    gradient.addColorStop(0, '#365149'); gradient.addColorStop(1, '#101f1b');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f0e5cf';
    ctx.font = `${Math.min(h * 0.045, w * 0.06)}px Georgia, serif`;
    ctx.fillText('Through your eyes', w / 2, h * 0.063);
    const items = memories?.items || [];
    this.sequence.update(items, time, audio, settings);
    if (!items.length) {
      const [title, note] = memories?.state === 'error'
        ? ['The photos couldn’t load.', 'Check the connection, then choose Refresh photos.']
        : memories?.state === 'closed'
          ? ['The shared album is resting.', 'The organizers can reopen the shared photo album.']
          : [memories?.loading ? 'Setting out the memories…' : 'The first memories are on their way.', 'Photos shared by our guests · Priya & Gautam'];
      ctx.font = `${Math.min(h * 0.028, w * 0.045)}px system-ui`; ctx.fillStyle = '#bfccbd';
      ctx.fillText(title, w / 2, h * 0.49, w * 0.88);
      ctx.font = `${Math.min(h * 0.018, w * 0.032)}px system-ui`;
      ctx.fillText(note, w / 2, h * 0.56, w * 0.88); return;
    }
    const photos = new Map(items.map(item => [item.id, item.image]));
    const cards = this.sequence.cards;
    const firstMoving = cards.findIndex(card => time - card.at < 0.65);
    const split = Math.min(firstMoving < 0 ? cards.length : firstMoving, Math.max(0, cards.length - 1));
    const settled = cards.slice(0, split);
    const key = `${w}:${h}:${settings.memoryCount}:${settled.map(card => card.arrival).join(',')}`;
    if (!this.pile) this.pile = this.createCanvas();
    // Cache the settled pile instead of redrawing dozens of large shadows each
    // frame. Only prints currently landing and the top print stay animated.
    if (key !== this.pileKey) {
      this.pile.width = w; this.pile.height = h;
      const pileCtx = this.pile.getContext('2d');
      for (const card of settled) this.drawPrint(pileCtx, photos.get(card.id), card, w, h, time, audio, settings, true);
      this.pileKey = key;
    }
    ctx.drawImage(this.pile, 0, 0);
    for (const card of cards.slice(split)) this.drawPrint(ctx, photos.get(card.id), card, w, h, time, audio, settings);
  }
}

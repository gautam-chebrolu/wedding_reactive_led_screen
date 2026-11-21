import { caption } from './shared.js';

export const pgCameraMetadata = { id: 'pg-camera', name: 'Smile, you’re on PG Camera', type: 'LIVE CAMERA', description: 'The dance floor, as it happens. A clean live feed framed by your very own PG Camera border.', focal: 'Live video + PG Camera frame', needsCamera: true };

export class PGCameraScene {
  render({ ctx, width: w, height: h, settings, camera }) {
    ctx.fillStyle = '#080b12'; ctx.fillRect(0, 0, w, h);
    const inset = Math.min(w, h) * 0.025;
    const header = Math.min(h * 0.14, w * 0.105);
    const footer = inset * 1.8;
    const videoWidth = w - inset * 2, videoHeight = h - header - footer;
    ctx.save(); ctx.translate(inset, header);
    ctx.beginPath(); ctx.rect(0, 0, videoWidth, videoHeight); ctx.clip();
    if (camera.ready) camera.draw(ctx, videoWidth, videoHeight, { mirror: settings.mirror });
    else caption(ctx, videoWidth, videoHeight, 'PG Camera is ready for you.', 'Enable the camera in Scene setup.', '#eed9a7');
    ctx.restore();
    ctx.strokeStyle = '#e6c888'; ctx.lineWidth = Math.max(1, h * 0.003);
    ctx.strokeRect(inset, header, videoWidth, videoHeight);
    ctx.fillStyle = '#f5e3b9'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.min(header * 0.44, w * 0.043)}px system-ui, sans-serif`;
    ctx.fillText("Smile, you're on PG Camera", w / 2, header * 0.5, w - inset * 4);
  }
}

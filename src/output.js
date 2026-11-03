// Capture only the visual canvas. No controls, browser mic monitoring, or camera feed is sent separately.
export class WallOutput {
  constructor(canvas, onAspect, onClose) { this.canvas = canvas; this.onAspect = onAspect; this.onClose = onClose; }
  open() {
    if (this.window && !this.window.closed) { this.window.focus(); return; }
    if (!this.canvas.captureStream) throw new Error('Separate output is unavailable in this browser. Use fullscreen preview instead.');
    const popup = window.open('', 'afterglow-wall', 'popup,width=1280,height=720');
    if (!popup) throw new Error('The output window was blocked. Allow pop-ups for localhost and try again.');
    this.window = popup;
    popup.document.title = 'Afterglow · Wall output';
    popup.document.body.innerHTML = '<style>*{box-sizing:border-box}html,body{margin:0;background:#000;width:100%;height:100%;overflow:hidden}video{width:100%;height:100%;object-fit:contain;display:block}button{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#17241dc9;border:1px solid #9fbaa0;color:#d7e3d5;padding:12px 18px;border-radius:6px;font:13px system-ui;cursor:pointer;transition:opacity .2s}body.clean{cursor:none}body.clean button{opacity:0;pointer-events:none}button:focus-visible{opacity:1;pointer-events:auto}</style><video autoplay muted playsinline aria-label="Afterglow live wall output"></video><button>Double-click or press F for fullscreen · Esc to exit</button>';
    const video = popup.document.querySelector('video');
    this.stream = this.canvas.captureStream(30); video.srcObject = this.stream;
    video.play().catch(() => {});
    const fullscreen = () => {
      if (!popup.document.documentElement.requestFullscreen) {
        popup.document.querySelector('button').textContent = 'Use the browser’s fullscreen menu to fill this display.';
        return;
      }
      const action = popup.document.fullscreenElement ? popup.document.exitFullscreen() : popup.document.documentElement.requestFullscreen();
      action.catch(() => { popup.document.querySelector('button').textContent = 'Use the browser’s fullscreen menu to fill this display.'; });
    };
    popup.document.querySelector('button').addEventListener('click', fullscreen);
    popup.document.addEventListener('dblclick', fullscreen);
    popup.document.addEventListener('keydown', event => {
      if (event.key.toLowerCase() === 'f') fullscreen();
      // Keep show shortcuts working when the wall window has focus.
      if (!['f', 'escape'].includes(event.key.toLowerCase())) {
        if ([' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
        window.dispatchEvent(new CustomEvent('afterglow-output-key', { detail: { key: event.key } }));
      }
    });
    let hideTimer;
    popup.document.addEventListener('pointermove', () => { popup.document.body.classList.remove('clean'); clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (!popup.closed) popup.document.body.classList.add('clean'); }, 2200); });
    hideTimer = setTimeout(() => { if (!popup.closed) popup.document.body.classList.add('clean'); }, 3500);
    const update = () => { if (!popup.closed) this.onAspect(popup.innerWidth / Math.max(1, popup.innerHeight)); };
    popup.addEventListener('resize', update); popup.document.addEventListener('fullscreenchange', update); update();
    this.poll = setInterval(() => {
      if (popup.closed) { clearInterval(this.poll); clearTimeout(hideTimer); this.stream?.getTracks().forEach(track => track.stop()); this.window = null; this.onClose(); }
    }, 700);
  }
  close() { clearInterval(this.poll); this.stream?.getTracks().forEach(track => track.stop()); this.window?.close(); this.window = null; }
}

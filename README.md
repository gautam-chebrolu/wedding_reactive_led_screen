# Afterglow

A music-reactive visual stage for a wedding LED wall. Seven scenes, one shared audio engine, and a separate clean output window. Runs locally with no runtime dependencies, accounts, API keys, build step, or internet connection.

## Run it

Requires Node.js 18 or newer.

```sh
cd /Users/gautam/Documents/repos/wedding_ledscreen_background
npm start
```

Open **http://localhost:4173**. No `npm install` is needed. Start with the silent demo signal, which simulates music at 112 BPM. Stop the server with Ctrl+C. To change the port, use `PORT=4174 npm start`.

Use a Chromium browser for the first hardware rehearsal. The code uses standard Canvas, Web Audio and media-capture APIs; individual capture/fullscreen capabilities vary by browser. Use localhost rather than opening `index.html` directly. Camera and microphone access require a secure context; localhost qualifies. The local server listens only on this computer unless you explicitly set `HOST`.

## Shared wall and remote control

**Shared show** creates separate links: a read-only wall for the DJ and a password-protected controller for your phone or another operator. Visual settings, blackout, tap tempo, resets and portraits sync between devices. The DJ enables audio/camera on his device; those media streams stay there. Several controllers can share the show password.

For your **Vercel** deployment, see [DEPLOYMENT.md](DEPLOYMENT.md). The included build/API configuration uses an **Upstash Redis** store connected through Vercel Storage and a private `AFTERGLOW_SETUP_KEY` environment variable. Firebase is not used. Vercel pages poll small show snapshots about every 750 ms; the wall renders continuously and keeps its last settings through network interruptions. Local development uses private files and live SSE without Redis. After deployment, use **Shared show → Create a show**, then copy its wall/controller links.

## What is implemented

| Scene | Atmosphere | Reactive focal point | Setup |
| --- | --- | --- | --- |
| Moonlit reverie | Stars, aurora, drifting clouds, cratered moon and water | Loudness changes the moon's size; bass expands its halo; detected beats influence the aurora color | Works immediately |
| The headliner | A roster of portraits surrounded by soft rings | Each person has a separate black mouth that opens with loudness | Add multiple photos or use the portraits folder; switch or cycle people |
| Dance floor prism | Mirrored webcam with prism, echo or kaleidoscope treatment | Beat-led color and small zoom pulses | Enable the camera |
| Keep it in the air | Webcam or a dark interactive grid | Motion near a glowing ball pushes it upward; gravity drops it out if missed | Enable camera, or use mouse/touch |
| Infinite bloom | A generated, mirrored kaleidoscope of petals, ribbons and gems | Bass opens the pattern; treble changes outlines; beats turn its colors | No camera; choose 8, 12 or 16 sections |
| PG, in gold | The supplied PG monogram centered in gold on black | Soft scale pulse on each detected or tapped beat | Loads the bundled SVG |
| One perfect corner | The classic bouncing DVD logo on black | Changes color at the walls and pulses on the beat | Set bounce speed; R restarts it |

There are four color palettes, reactivity and brightness controls, a gentle-motion option, scene transitions, timed cycling, tap tempo, a blackout switch, render resolution selection, and settings import/export. Camera scenes join auto-cycle only after a camera is enabled.

## Portrait roster and default photo

Use **Scene setup → Add portrait photos** to select several people at once. Choose a person from the dropdown, use Previous/Next, or press **[ / ]** outside a form field. Enable **Cycle people** to switch at the selected interval while the portrait scene is active. Cycling people is independent of cycling scenes, and pauses while another scene is selected.

For a permanent, automatically loaded roster, use this layout:

```text
assets/
  portraits/
    priya_gautam_headliner_image.jpeg
    priya.png
    friend-name.webp
```

No manifest or scene-code edit is required. Run the included `npm start` server: it discovers JPG/JPEG, PNG and WebP files in that folder, with the headliner photo first and the remaining filenames in alphabetical order. Filename stems become display names. Images can have different dimensions/aspect ratios; the scene fits the entire image without stretching it. Clear front-facing photos are easiest to calibrate. Aim for about 1000–2000 pixels tall, within 30 MB for session uploads. The roster supports up to 100 people. Avoid changing filenames after calibration because a filename identifies its saved mouth settings.

**The default headliner is `assets/portraits/priya_gautam_headliner_image.jpeg`**, shown as **Priya & Gautam**. Initial mouth placement is centered on Gautam's smile on the right at approximately 60% across and 44.3% down the image, angled −15°; click the mouth and fine-tune if needed. Your saved corrections override those defaults. The previous `gautam.jpg` remains on disk but is excluded from the roster while the replacement is present; if the replacement is removed, `gautam.*` loads first again. Reload the page after upgrading: a saved selection of the old portrait falls back to the new headliner with its own mouth calibration. To replace the default photo later, replace `priya_gautam_headliner_image.jpeg` and reload the page.

After placing new files there, click **Reload portraits folder** or reload the page. That button discovers additions; replace an existing image and reload the whole page to refresh its decoded pixels. Deleting a folder image takes effect on page reload. This folder discovery uses the bundled Node server, not a generic static-file host.

For **each person**, select them, click their mouth in the preview, and adjust horizontal/vertical position, width, opening and angle. Each person's calibration saves separately in local storage and in exported settings. People added with the upload button are session-only: reselect their files after a reload. Folder images reload automatically. Keep the same browser profile/origin or import the exported settings to recover calibration on another computer; copy the image files separately.

## Logo assets

`assets/pg-monogram.svg` is the supplied **Wedding Invites Frame 37.svg**, copied unchanged. The renderer crops empty frame margins and applies a gold gradient to its alpha mask, preserving the original artwork. Global palettes do not recolor the gold monogram. `assets/dvd-original.png` is the actual 512×512 DVD image downloaded from the link you supplied. At runtime, the renderer uses its luminance as transparency, preserves anti-aliased edges, crops the black padding, and tints only the logo. The source image is kept unchanged, and collision bounds follow the cropped artwork rather than the square image frame.

## Music inputs

**Microphone or mixer/audio interface.** Choose the source, select the device, then click Enable audio input and allow access. Start with sensitivity around 1.4× and adjust until the level meter moves with the music without sitting at 100%. A suitable audio interface connected to the DJ's mixer output provides a more isolated signal than a laptop mic in a crowded room. Select the interface as the input device. Input capture requests echo cancellation, noise suppression and automatic gain control off; the browser/device may not honor every constraint. Captured input is analysed without being routed to the speakers.

**Browser tab / system audio.** Click Choose a tab to listen to. Select the music tab and enable audio sharing. Capturing an entire computer's sound depends on browser and operating system; choosing screen sharing does not guarantee audio is included. The app reports when a shared stream has no audio. The captured stream is not replayed through the speakers.

**Local music file.** Choose an audio file supported by your browser. The track plays and loops from this app, with play/pause, seek and mute controls. Mute changes speaker playback while preserving analysis. Do not mute if this is the actual music feed for the event. The app does not control a separate DJ player's playback.

**Demo.** A silent simulated signal for rehearsing. It does not play a test tone or pretend to be a live microphone.

**Off.** Scenes continue with ambient animation while their audio response settles to zero.

Switching away from a capture input stops its tracks. If you change a selected device while it is live, click Enable/Reconnect to apply the change. Camera capture is independent of audio. Camera tracks stay active when switching scenes, so cycling back does not require another permission prompt; Stop camera explicitly releases them.

## Beats, tempo and colors

The engine computes RMS loudness, frequency bands, and positive spectral changes. An adaptive threshold finds strong onsets, with a short cooldown to suppress double triggers. Recent consistent onset intervals produce an estimated BPM. Dense music, syncopation, live-room noise and tempo changes can cause missed accents or half/double-tempo estimates.

This is **onset detection and tempo estimation**, not song recognition, time-signature analysis, or reliable downbeat detection. The automatic beat count is a count of detected hits. It does not indicate which beat of the musical bar is playing.

For stable timing, tap **T** at least four times on consecutive beats. The median interval drives a manual clock. **Set beat 1** marks the first beat of your own repeating four-beat cycle, shown by four indicators. The manual clock remains active until you choose **Use auto** or switch audio sources. It will drift if the song changes tempo; tap again. Starting a new tap sequence after a pause resets the old clock. The manual clock drives scene color accents even if the audio is quiet.

## LED wall setup

1. Connect the display/LED processor to the laptop and select **extended display** in the operating system.
2. Set the processor and operating system to the intended output resolution and mapping. The app renders visuals; it does not configure LED hardware.
3. Open the app on the laptop and click **Open wall output**. Allow the localhost pop-up if blocked.
4. Move the output window to the LED display. Double-click its video, press F there, or use the fullscreen button to fill the display. Its controls fade away. Esc exits fullscreen.
5. Keep the operator window visible on the laptop. The output streams only the visual canvas, at up to 30 FPS; controls are not included. The render shape adapts to the output window, including wide LED layouts. Preview fullscreen can be used instead when you only need one window.
6. Select music input, tune sensitivity/reactivity, and set brightness. Brightness here is a canvas dimmer; it does not replace the LED processor's physical brightness control.
7. Rehearse the actual DJ feed, full music volume, screen ratio, camera position and lighting. For the ball game, steady lighting and a camera facing guests work best. Keep the ball's area reachable in the image. More sensitive motion settings also react more to camera noise and background movement.
8. Keep the laptop powered, disable sleep for the show, and keep this app's controller window visible. Browsers can throttle hidden/minimized tabs, and a sleeping computer cannot render. Start at 1920 px; use 1280 if frame rate drops. Render size is capped to avoid excessive buffers on unusual display shapes.

The blackout switch makes the visual canvas black immediately while the music continues. It is also black in the separate output. Preview labels are hidden in fullscreen/output. No full-screen strobe effect is implemented; color changes are smoothed and gentle motion reduces decorative movement. The ball still follows gravity so its game remains playable.

## Keys

Shortcuts apply outside form fields. When a button has focus, Space keeps its normal button behavior; click the stage or another neutral area for Space to advance scenes.

| Key | Action |
| --- | --- |
| 1–7 | Choose a scene (5 kaleidoscope, 6 PG, 7 DVD) |
| [ / ] | Previous / next portrait person |
| Space / Right arrow | Next scene |
| Left arrow | Previous scene |
| F | Fullscreen preview; in the output window, fullscreen output |
| H | Hide/show the operator UI on the current page |
| B | Blackout / restore visuals |
| T | Tap tempo |
| R | Restart the DVD bounce when in that scene; otherwise restart the ball round |
| Esc | Exit fullscreen / restore hidden controls |

## Local data

In local mode, numeric/boolean choices and selected scene/palette are saved to browser local storage. Export settings to save a portable JSON preset. Import validates and bounds values. Microphone, camera and track data stay on their device. Folder portraits reload from disk on launch; local session uploads need to be selected again after a reload. Individual mouth calibrations are saved in settings. Browser permissions are managed by the browser. Closing/reloading a local controller stops its inputs and closes its output window.

In shared mode, settings and portrait uploads are stored privately by the show server and delivered to authorized show devices. Controller sessions use tab-scoped session storage; passwords are hashed server-side and are not placed in share URLs. The DJ's audio/camera stays local; only numerical meters and input status are reported. Disconnecting a remote controller leaves the separate wall running. See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting, access control, storage and timing behavior.

## Add a scene

See [PLAN.md](PLAN.md) for architecture decisions and follow-on ideas.

Create a file in `src/scenes/` and register it in `src/scenes/index.js`:

```js
export const exampleMetadata = {
  id: 'example',
  name: 'Example scene',
  type: 'ATMOSPHERIC',
  description: 'Describe what guests see.',
  focal: 'The reactive object',
  needsCamera: false
};

export class ExampleScene {
  render({ ctx, width, height, time, dt, audio, settings, palette, camera, portrait }) {
    ctx.fillStyle = '#06101b';
    ctx.fillRect(0, 0, width, height);
    const radius = height * (0.12 + audio.level * settings.intensity * 0.12);
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Optional: reset() and pointer(x, y, settings, width, height, time).
}
```

The shared `audio` frame contains:

| Field | Meaning |
| --- | --- |
| `level` | Smoothed, sensitivity-adjusted loudness, 0–1 |
| `bass`, `mid`, `treble` | Smoothed frequency-band energy, 0–1 |
| `beat` | True on the frame of an onset or clock tick |
| `pulse` | Fast-decaying visual envelope, 0–1 |
| `bpm`, `confidence` | Tempo estimate and rhythmic consistency, or manual clock values |
| `beatCount` | Count of detected hits/clock beats |
| `manual`, `beatInBar` | Manual clock active; beat 1–4 only in manual mode (otherwise 0) |
| `spectrum` | 64 frequency values, 0–255, for additional effects |

Render in the supplied dimensions rather than hardcoding a ratio. Paint the whole canvas each frame. Respect `settings.intensity` and `settings.reducedMotion`, and cache static textures in the constructor. The renderer handles transitions, brightness, blackout and output sizing. The current seven-scene UI includes scene-specific setup panels: extend `syncScene()`/`scene-setup` in `main.js` and `index.html`, add settings validation in `settings.js`, and add its ID to `scene-ids.js`. Scene counts and available numeric shortcuts are derived from the registry. A p5 instance or WebGL offscreen canvas could be adapted to this contract later.

## Validation

```sh
npm test
```

Uses Node's built-in runner to test silence/sustained tones, regular kick tempo, duplicate onset suppression, manual clock behavior, cancelled microphone requests, input track cleanup, no microphone speaker routing, motion sampling/exposure compensation, ball saves/loss/boundaries, crop mapping and imported settings validation. Additional tests cover per-person calibration, saved selection, timed portrait rotation, failed/duplicate image loads, safe portrait-folder discovery, DVD wall/corner reflections, pulse-aware bounds and the expanded scene registry. No dependencies are required for these tests.

An optional browser smoke script is at `test/browser-check.mjs`. With a separately installed Playwright module and Chromium, run it against the local server:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node test/browser-check.mjs
```

You can provide `BROWSER_EXECUTABLE` to use an existing compatible Chromium binary. It uses fake media devices, not your real camera/microphone. Browser automation does not validate an actual mixer feed, physical LED performance, or guest-camera motion in your venue.

## Browser API references

- [Web Audio specification](https://www.w3.org/TR/webaudio/)
- [Microphone/camera capture and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Screen capture and optional audio](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [Chrome screen-sharing audio controls](https://developer.chrome.com/docs/web-platform/screen-sharing-controls)

The first-release ball interaction detects changed pixels, not hands, faces or skeletons. Pose tracking, MIDI/OSC clocks and song cue lists are good future extensions after a venue rehearsal establishes what needs improvement.
# wedding_reactive_led_screen

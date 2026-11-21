# Shared shows on Vercel — no Firebase

The Vercel deployment serves the app and its authenticated API. A small **Upstash Redis** store connected through Vercel Storage keeps show settings, password hashes, sessions, and shared portrait files durable across Function invocations. Your existing Firestore project is not used or changed. No Firebase, Firebase Auth, SDK installation, or separate always-running server is required for this deployment.

## One-time Vercel setup

1. Import/deploy this folder as a Vercel project. If the Git repository contains other projects, set **Root Directory** to `wedding_reactive_led_screen`.
2. Select **Other** as the framework preset. The included `vercel.json` sets Build Command to `npm run build` and Output Directory to `dist`. Use a supported current Node.js runtime, such as Node 22. There are no npm runtime dependencies.
3. In the Vercel project's **Storage / Marketplace** area, connect an **Upstash Redis** database to this project. Enable its environment variables for Production (and Preview if you want preview URLs to support shared shows). The app accepts either pair:
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN`
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. Add a private environment variable named **`AFTERGLOW_SETUP_KEY`**, containing a long random secret that only you know. This key authorizes creating shows on your public site. It is separate from each show's controller password. Do not prefix any server secrets with `PUBLIC_` or `NEXT_PUBLIC_`.
5. Redeploy after connecting storage or changing environment variables.
6. Open the resulting HTTPS URL. Ordinary local/demo scenes work even before shared-show storage is configured; the **Shared show** dialog explains missing configuration when you try to create a show.

Use a dedicated Redis database for this app. It uses keys prefixed `afterglow:`. If the integration generates variable names with a custom prefix, map them to one of the pairs above. `.env.example` lists the accepted names. You do not need to give this app a Firebase service account.

Vercel deployment protection, if enabled for the URL you send, may require a Vercel login before the app can load. Use a production URL accessible to the DJ and operators; the app applies its own show authentication. Keep the deployment's HTTPS enabled for microphone and camera support.

## Create the show and hand off the links

1. Open **Shared show → Create a show**.
2. Enter a name, choose a **controller password of at least 10 characters**, and enter your server setup key. The setup key is cleared from the form after submission.
3. Copy the **Wall link** and send it to the DJ. It opens a clean visual wall and its local Device setup dialog. The view key lives in the URL fragment, is removed from the address bar after loading, and is remembered in that tab's session storage. Copy wall links from the controller dialog when sharing again.
4. The DJ chooses a microphone/audio-interface input, shared tab audio, local music file, or demo mode on his own computer. He can enable the webcam there and select its input. Click **Fullscreen wall**. Move the pointer or press H to reopen local setup.
5. Copy the **Controller link** to your phone or another operator. Give them the show's controller password separately. They choose **Join as controller**; the server setup key is not needed for joining.
6. Close the share dialog and use the normal show controls. Scene, palette, reactivity, sensitivity, brightness, blackout, camera treatment, motion settings, portrait placement/selection, cycling, tap tempo and reset cues apply to the shared show.

Several controllers can join using the same show password. Independent setting changes merge. If two people change the same setting, the later accepted change wins. Controller sessions expire after 12 hours; reconnect using the same controller link and password. The application has no plaintext password recovery. Choose a password you can retain, or create a new show if it is lost.

The wall link grants **read-only viewing** and the ability to report input status. It cannot change show settings or upload portraits. Keep it private because anyone who has that exact link can view that show. A controller link alone does not grant control; its password is checked by the server.

## What moves across the network

- **Guest memories:** the Through your eyes scene reads the existing approved photo album through `/api/memories/`. It defaults to `https://priya-gautam-photos.web.app` and needs no Firebase credentials or Redis configuration. Optional server-side `PHOTOS_ORIGIN` selects a different photo-app origin. The organizer's **Show approved photos** switch governs both listing and image access. The wall checks approvals every 30 seconds while the scene is active and keeps up to 90 thumbnails in memory. Scene density and beat spacing sync through show settings; the DJ's local audio determines arrivals. The controller preview does not reproduce the exact photo arrangement or every beat.
- **Settings and cues:** small authenticated requests and snapshots. On Vercel, each connected page polls about every 750 ms after the preceding request completes. Rendering remains local and continuous; this is settings synchronization rather than a video stream. Latency includes your network and database region.
- **Portraits:** bundled folder portraits, including Gautam's default, ship with the app. Images added after joining as a controller upload to the show's private storage and download to its wall and other controllers. Shared uploads support JPG, PNG and WebP, up to 3 MB each and 50 per show. Shared image routes require a valid show token. Local session uploads made before joining do not automatically become shared: add them again after connecting.
- **Audio/camera:** audio samples and camera frames stay on the DJ's device. It reports a small set of signal meters and input status once per second. The controller preview can use these delayed signal levels; it does not stream the DJ's camera or reproduce every animation frame. Audio devices, camera permission, local track selection/playback, and fullscreen must be operated on the DJ's computer.
- **Timing:** automatic scene/portrait cycling uses server-clock anchors so a late join resumes the current cycle. Manual tap tempo shares the BPM and phase anchor. Reconnecting pages take the latest settings. Reset cues are not replayed on a fresh join.

The on-screen wall status reflects its most recent report, not an independent hardware-health check. If you open several walls, the latest device report supplies the controller preview's meters. Each wall still uses its own audio and camera.

## Connection loss and rehearsal

An already-open wall keeps the last received settings, local audio analysis, camera input and automatic cycling when the network drops. It reconnects automatically and takes the newest snapshot. A reload/new tab still needs the server to load the app and its show. Undelivered controller changes are labeled and retried after network failures; do not assume a change reached the DJ while that message is shown.

Rehearse with the actual production URL, DJ equipment, and both devices on the venue network. Keep the DJ's wall tab visible and the laptop awake. Remote control needs internet access to Vercel/Redis; it does not replace an offline operator fallback. Vercel Functions and Redis requests use their normal platform quotas, so check usage before running long unattended sessions. Region proximity improves latency.

## Local development and an optional standalone server

`npm start` continues to work without Redis, a setup key, or internet access. Local shared shows use `.afterglow-data/` for persisted state and private photos, with live server-sent events. The folder is gitignored and is never served as a static directory.

To test two devices on your own network, bind explicitly with `HOST=0.0.0.0 npm start`, then use this computer's LAN address. Plain LAN HTTP does not generally provide the secure context needed for browser microphone/camera input; use the deployed HTTPS URL for hardware rehearsal. Use a supported Node service plus private persistent storage if you choose standalone hosting later. Do not run multiple standalone replicas against the same file directory; Vercel's Redis adapter handles concurrent Function instances instead.

`npm run build` creates only public browser assets in `dist/`; API/server files, environment variables and local show data are excluded. Vercel deploys `api/handler.js` separately. Uploading only `dist/` to a static host will not provide shared-show APIs.

## Verification

- `npm test` covers authentication, password hashing, cross-show isolation, read-only walls, concurrent settings, state persistence, portraits, timelines, cues, streaming/polling, Redis conflict retries, and existing audio/scene behavior.
- `node test/shared-http.mjs` exercises real localhost HTTP requests, live updates, password login, and static-route isolation.
- `npm run build` prepares the Vercel output.
- `test/browser-check.mjs` is optional browser QA. Production Vercel/Redis and actual DJ equipment must be tested after you connect your hosting account and storage; those services are not provisioned by these local checks.

References: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), [Vercel Functions limits](https://vercel.com/docs/functions/limitations), [Upstash for Redis in Vercel](https://vercel.com/marketplace/upstash/upstash-kv), [Redis REST API](https://upstash.com/docs/redis/features/restapi).

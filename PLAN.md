# Afterglow — wedding LED stage

## Experience

A local browser app, operated from a laptop with a clean visual output on an extended-display LED wall. Music supplies the movement; each scene has a distinct focal point. Rendering, analysis and camera processing stay on the device. Shared portraits use the show server; the guest photo wall reads the existing approved album. No account, API key, model download, CDN, or build step is required.

## Implementation plan

1. **Shared audio engine.** Web Audio analyser with RMS loudness, bass/mid/treble bands, adaptive onset detection and tempo estimation. Microphone/audio-interface input, browser tab audio when supported, local track playback, and silent simulated audio. Manual tap tempo provides a stable clock and a user-selected first beat in a four-beat cycle.
2. **Scene contract.** Each scene exports metadata and a class with `render(frame)`; optional `reset()` and `pointer()` handle scene-specific interaction. `frame` carries canvas context, dimensions, clock, shared audio features, settings, portrait, and camera. Registration happens in one file. Canvas 2D keeps the initial app dependency-free and familiar to p5.js users.
3. **Moonlit scene.** Procedural stars, aurora, layered cloud banks, cratered moon and water reflections. Loudness swells the moon, bass expands its halo, and beats shift the accent color.
4. **Talking portrait.** Local photo upload; a black mouth overlay reacts to volume. Position, size and angle can be adjusted, including clicking directly on the face to place the mouth. An illustrated placeholder makes rehearsal possible before adding a photo.
5. **Camera remix.** Mirrored webcam with beat-driven color treatment, zoom and kaleidoscope options. Input starts only after an explicit button press; stop releases camera tracks.
6. **Motion ball.** Small webcam frame-difference grid pushes a gravity-driven ball. Guests keep it aloft by moving; it is lost through the bottom, followed by a countdown and a new round. Mouse/touch interaction offers a camera-free fallback. This first version detects movement, not bodies or skeletal poses.
7. **Show controls.** Scene buttons/shortcuts, timed cycling, palette/intensity/brightness controls, render resolution, smoothing between scenes, clean fullscreen and separate output window, blackout, reduced motion, source/beat/FPS meters, saved preferences and import/export settings.
8. **Validation and handoff.** Automated tests for rhythm, motion collisions and resource lifecycle; static HTTP and browser checks where available. Document local launch, signal routing, scene development, hardware rehearsal, limitations and a practical next-phase roadmap.
9. **Expanded scene library.** Standalone procedural kaleidoscope (no camera), original PG SVG rendered in gold on black with beat pulses, and a DVD-logo bounce with collision-driven colors and beat-driven scale. Existing scene order stays stable; shortcuts 5–7 select additions.
10. **Portrait cast.** Discover permanent images in `assets/portraits/`, allow multiple session uploads, and add previous/next and timed cycling. Save each person's mouth calibration in exported/browser settings. Folder images reload automatically; session uploads remain memory-only. The default `gautam.*` image is first in discovery order.
11. **Shared shows without Firebase.** Server-authenticated controller passwords, a separate read-only wall key, live settings/cues, shared portrait storage, server-anchored cycling/tempo, reconnect handling and DJ-local audio/camera. Vercel Functions use a Redis REST storage adapter and short polling; the standalone server uses private files and SSE. Include Vercel build/routing configuration and deployment instructions. No changes to the existing wedding Firestore project.

12. **Guest memories on the beat.** Reuse the photo app's approved public feed and deterministic scatter concept in a fixed Canvas scene. Preserve full image proportions, place one photo every configurable beat interval, use a silence fallback, reconcile approvals on a 30-second poll, and bound thumbnail decoding/cache size. Share scene controls through existing settings; the DJ device drives actual beat timing.

## First-release boundaries

- Onsets and tempo are estimates; the app does not infer musical time signatures or reliably identify a song's first beat. Tap tempo establishes a manual four-beat clock.
- Motion tracking responds to changed pixels. Lighting shifts and moving backgrounds can trigger it. Pose/hand tracking is a later module rather than a hidden network/model dependency.
- Uploaded photos/tracks are held in memory and must be selected again after a reload. Folder portraits reload from disk. Numeric preferences and individual mouth calibrations persist locally and can be exported.
- Rendering fits the available screen, including nonstandard LED ratios. The LED processor and operating system control the actual display mapping.

## Later additions

Optional local pose tracking, MIDI/OSC/DJ clock bridge, configurable beat divisions and song cues, additional p5/WebGL scene adapters, video recording, and portrait mouth landmarks. Validate the initial experience with the actual DJ feed and webcam placement before investing in these additions.

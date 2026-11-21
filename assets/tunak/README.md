# Tunak sprite atlas

`daler-atlas.png` is custom AI-generated artwork of Daler Mehndi for this app,
created with the built-in **image_gen** tool. It is a 1536 × 1024 transparent PNG
with separate body and head regions. It is not downloaded music-video footage.
The scene animates the head around the neck independently of the shoulders.

The body crop is `[0, 0, 820, 1024]`; the head crop is `[815, 90, 670, 850]`.
The runtime keeps the atlas intact and draws those regions separately. The
artwork ships with the app and needs no external request or account.

## Generation prompt

Create a production-ready transparent PNG sprite atlas for a music-reactive wedding LED-wall scene titled Tunak Takeover. Subject: recognizable Daler Mehndi, the adult Indian singer from the Tunak Tunak Tun music video, joyful smiling face, full black beard, vivid golden yellow/orange turban and a royal blue long Punjabi stage coat with ornate gold embroidery, matching trousers and shoes. Photorealistic editorial cutout look with crisp edges, not a cartoon. Exactly TWO detached pieces on ONE transparent landscape 1536x1024 canvas: LEFT HALF x=0..768: his COMPLETE headless body from the base of the neck to the shoes, front-facing with both arms raised outwards in a celebratory bhangra pose, centered at x384; body entirely contained within x40..728 and y80..970. No head and no turban on this body, only a short neck. RIGHT HALF x=768..1536: a large separate front-facing head portrait INCLUDING the full turban, smiling face, ears and full black beard down to just below the chin, centered at x1152, entirely contained in x820..1480,y100..900. Make both pieces belong to the same person, consistent lighting and sharp detail. The separated head will be animated around the neck atop the body in code. Transparent background everywhere including the space between the pieces. No other people, no instruments, no text, no frame, no watermark, no ground shadow.

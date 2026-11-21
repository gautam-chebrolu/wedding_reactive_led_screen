# Portrait photos

Put JPG/JPEG, PNG or WebP files directly in this folder. The local `npm start` server discovers them automatically. Click **Reload portraits folder** in the portrait scene after adding files.

- `priya_gautam_headliner_image.jpeg` is the default headliner photo, shown as **Priya & Gautam**. Its mouth overlay starts over Gautam's smile on the right (60% across, 44.3% down, angled −15°).
- `gautam.jpg` is the previous portrait. It stays on disk for compatibility but is excluded from the roster while the new headliner photo is present. Reload the page after upgrading to switch from the old default and use the new mouth placement.
- `priya.png`, `friend-name.jpg`, etc. add people. Names come from filenames.
- Use front-facing photos, ideally about 1000–2000 pixels tall. Different sizes/ratios work.
- Select each person, click their mouth, and adjust the sliders. Placement saves individually in the browser and exported settings.
- Keep filenames stable after calibration. Copy this folder plus exported settings when moving to the show laptop.
- Folder photos persist across reloads. Photos added with the upload button last for that browser session.
- Up to 100 photos load; subfolders, hidden files and symlinks are ignored.

No photo is uploaded. These files are served only by this computer's localhost server.

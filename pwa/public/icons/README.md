# icons

Required for the manifest (Phase: Polish). Add three PNGs here before deploying:

- `icon-192.png` — 192×192, opaque, app icon
- `icon-512.png` — 512×512, opaque, app icon
- `icon-maskable-512.png` — 512×512, with content centered inside the safe area (logical center 80% of the canvas) so Android's circular/squircle mask doesn't clip it

Quick options:

- [maskable.app](https://maskable.app/editor) — drop any SVG/PNG, export both maskable and regular variants.
- ImageMagick: `magick convert source.svg -resize 192x192 icon-192.png`

These three PNGs are present: a refined teal (`#5ec5c0`) ECG-pulse mark on the
near-black (`#0a0a0b`) "editorial dark" ground, matching the app palette. They
were generated with a stdlib-only script (`zlib`+`struct`, no Pillow) — see
`scratchpad/gen_icons.py` from the design pass; tweak the palette/`ECG` polyline
there and re-run to regenerate. Replace them with your own artwork the same way
if you want a different icon — keep the maskable variant's content within the
central 80% safe area.

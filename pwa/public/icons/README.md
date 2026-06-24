# icons

Required for the manifest (Phase: Polish). Add three PNGs here before deploying:

- `icon-192.png` — 192×192, opaque, app icon
- `icon-512.png` — 512×512, opaque, app icon
- `icon-maskable-512.png` — 512×512, with content centered inside the safe area (logical center 80% of the canvas) so Android's circular/squircle mask doesn't clip it

Quick options:

- [maskable.app](https://maskable.app/editor) — drop any SVG/PNG, export both maskable and regular variants.
- ImageMagick: `magick convert source.svg -resize 192x192 icon-192.png`

These three PNGs are present (navy `#0b132b` ECG-pulse mark, generated with
Pillow). Replace them with your own artwork the same way if you want a different
icon — keep the maskable variant's content within the central 80% safe area.

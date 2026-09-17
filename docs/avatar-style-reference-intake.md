# Avatar style-reference intake

The Avatar Lab is ready to accept the reference images being gathered. These files guide silhouette, proportions, palette, material language, and tier progression; they are **not** production layers and are never loaded by `PlayerAvatarRenderer`.

## Lossless intake

1. Put each original PNG or JPEG in `public/assets/avatar/style-references/` without renaming or editing it.
2. Register it in that folder's `manifest.json`. Use a stable descriptive ID and record where it came from. The `role` is one of `npc`, `body`, `face`, `hair`, `armour`, or `weapon`.
3. Run `bun run avatar:style-audit`. The report records dimensions, PNG mode, transparency, visible-pixel bounds, coverage, and a SHA-256 checksum.
4. Commit the originals and manifest together. Later derived crops, palette swatches, or traced boundaries must live elsewhere and retain a link to the source ID.

Example entry:

```json
{
  "id": "npc-armourer-front",
  "filename": "armourer.png",
  "label": "Armourer front view",
  "role": "npc",
  "source": "Tomlandia game asset",
  "notes": "Primary outline and metal-shading reference"
}
```

## Review sequence

References are reviewed first at native pixels, then nearest-neighbour game scale. We record recurring outline thickness, head-to-body ratio, value steps, saturation limits, light direction, and readable equipment shapes. Only after those measurements are agreed do we draw the bald lightly dressed male/female masters, trace their registration masks, and approve generated armour or large-sword overlays.

Armour and swords must remain registered to the common 384×384 canvas. They may extend only into their named boundary masks; no per-item runtime offsets are permitted. This keeps large swords behind the body below the grip and in front above it, while hair remains above the bald head and armour stays below the protected face/neck window.

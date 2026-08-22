# Pixel-Art River Pass

## One correction up front

There is no `PixelRiverLayer` component and no river debug controls in this project. Rivers are drawn directly on the game canvas in `src/game/engine.ts`:

- `drawBarriers()` fills three smooth vector bands per river (dark teal bank, mid blue water, a cached across-stream gradient, plus a bright half-width "core"). This is baked into the terrain overlay.
- `drawRiverFlow()` + `drawMoatFlow()` draw the animated effect you want gone: three "lanes" of long meandering streaks that travel downstream (`f = (seed + t * speed) % 1`), each stroked in 4 wide low-opacity passes plus 2 lagged ghost trails, followed by a bank-foam pass of white segments that also scroll along the river.

So the traversing lines are these lane streaks + scrolling bank foam. Everything else in your brief maps cleanly onto the existing river code, and I'll treat "keep the architecture" as: keep the existing river geometry cache (`riverGeom`, centreline/normals/half-width) and the existing canvas draw order — no tilemap, no SVG, no shader, no external assets, no second river system.

## What changes

1. **Remove the legacy motion.** Delete the lane-streak wash, its ghost trails and the scrolling bank foam in both `drawRiverFlow()` and `drawMoatFlow()`. Verify the river reads correctly fully static before anything new is added.
2. **Quantise the river to a world-locked pixel grid.** Instead of smooth vector fills, the water/bank bands are rasterised into a cached offscreen canvas per river, at a chosen logical pixel size, snapped to world coordinates (grid origin at world 0,0) so camera movement, resize and rerenders never make it crawl. Drawn back with `imageSmoothingEnabled = false`.
3. **New six-colour palette** (`bankShadow`, `bankMid`, `waterDeep`, `waterBase`, `waterLight`, `foamHighlight`), all opaque, replacing the current gradient + translucent core. Bank treatment limited to 1–2 logical pixels: `bankMid` edge with `bankShadow` only on the shaded (lower-right) side, occasional `waterLight` upper-left accents. No concentric rings, no pure black, no pure white.
4. **Deterministic static highlight clusters.** Seeded hash per river + cluster index, so identical after every rerender/resize. Clusters are 3–8 logical pixels long, 1px thick (sometimes 2 at one end), aligned to the local centreline tangent, denser on the outside of tight bends, sparser inside the junction and near the moat gates. Target ~2–3% surface coverage.
5. **Discrete 4-frame cluster pulse** at 5 fps, staggered phase per cluster, pixel-shape changes only (no opacity easing, no translation beyond one logical pixel). Paused when the tab is hidden; static frame under `prefers-reduced-motion`.
6. **Junction/moat continuity.** The Great River, the moat channel and the city moat ring share the same palette and grid so the Y-junction and moat mouth read as one body of water with no internal seam or outline.
7. **A temporary river debug panel** (same pattern as `KnightDebug.tsx`, dev-only) exposing: preset selector, pixel scale, bank thickness, six palette swatches, highlight density, cluster length range, fps, animation on/off.

## Pixel-scale calibration

Measured references in the current renderer: the tree sprite draws at 6.6 world px per source art pixel, the knight strip draws 384 source px into ~145 world px (≈0.38 world px per source pixel — it is high-res art, so it is not the grid reference). I'll re-measure tree, ore rock and bush against a knight at normal zoom before locking numbers; provisional presets:

| Preset | Logical px (world) | Intended read |
| --- | --- | --- |
| Fine | ~3 | smoothest curves, still clearly pixel art |
| Sprite-matched | ~4 | integrates with rocks/trees/bushes |
| Coarse | ~5 | chunkier, capped below the tree sprite's 6.6 |

Each rounded so it lands on whole device pixels at the current dpr.

## Deliverable

I'll produce screenshots of all three presets — animation off and on, same camera position, viewport, dpr and river section (straight run, bend, Y-junction) — plus a table with pixel scale, device-pixel block size, bank thickness, all six palette hex values, density, cluster length range, fps, and the sprite-pixel reference used. **No production default is set until you pick one.**

## Not touched

River paths, widths, junction geometry, collision/`blockedAt`, bridges, camera, terrain, sprites, UI, map or save data.

## Known limitation to flag early

The current banks come from `bandPath()` quadratic-smoothed offset polygons. Rasterising those onto a coarse grid can produce isolated one-pixel spikes/holes on tight bends. The fix stays inside the raster step (a small majority/erosion cleanup pass on the mask before colouring) — no path or geometry changes. If cleanup can't remove jaggies at the Coarse scale, I'll report it rather than quietly reworking the geometry.

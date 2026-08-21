# Smooth out the biome borders

## Goal
Biome boundaries stop looking jagged and pixel-steppy. Instead of short zig-zag runs, each region reads as one long, gently sweeping shape — nearly straight curves with only a hint of natural drift.

## What changes
Three things currently create the jaggedness, and all three get toned down:

1. The world is divided into 100px cells and each cell is awarded to the nearest biome seed using a heavily randomised sample point. That randomness is what makes the seam zig-zag cell by cell. The random offset is cut right down, and a majority-vote smoothing pass runs over the cell grid so isolated teeth along a seam get absorbed into their neighbour.
2. Every traced corner point is nudged by up to +/-34px. That nudge is reduced to near zero.
3. The traced outline is still a staircase of 100px steps. A corner-cutting (Chaikin) smoothing pass runs over each region outline so the staircase becomes a flowing curve, with points sitting on the world edges pinned back to the exact border so the map still fills its rectangle.

Result: long sweeping boundaries, same five territories in the same places.

## Knock-on effects (intentional, small)
- The Great River is seeded from the fields/forest border chain, so its meander shifts slightly. It stays a single river with its bridges and the Grand Haven moat connection intact.
- Which biome a given point belongs to (for spawn colour/type lookups) is still resolved from the cell grid, so it stays consistent with the smoothed visuals to within a few pixels.
- Existing shared nodes and monsters in the backend are stored by position and are not touched; no migration.

## Technical detail
- `src/game/data.ts`
  - `CELL_OWNER`: drop the sample jitter from 150 to roughly 30, then run 2-3 passes of 8-neighbour majority smoothing before the existing orphan-island cleanup (cleanup must stay last so every region remains one solid blob).
  - `vertex()`: reduce `amp` from 34 to about 4, keeping the existing world-edge pinning.
  - `traceRegion()`: after the loop is walked, collapse collinear runs and apply 2-3 Chaikin iterations; re-snap any point within a pixel of x=0, x=WORLD_W, y=0, y=WORLD_H back onto that edge.
  - `buildBarriers()` and everything downstream keep working unchanged — they read the same cell grid.
- Rendering already fills each `poly` with a slight stroke of the same tone, which hides any hairline where two smoothed outlines part company by a pixel; if seams show, widen that stroke marginally in `src/game/engine.ts` and `src/components/game/WorldMap.tsx`.

## Verification
- Typecheck passes.
- In preview: biome seams read as long smooth curves, no staircase; the map still has no unpainted gaps between regions; river, bridges, moat and towns all still in place.

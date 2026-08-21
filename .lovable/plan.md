# Remove the boulder and treeline walls between biomes

## Goal
Biome borders stop being blocked by long lines of impassable rocks and trees. Players walk freely from one biome into the next; only rivers, lakes, city walls/moats and buildings still block movement.

## What changes
The generated border barriers come in three kinds: `river`, `rocks` and `woodland`. Only the river kind stays. The rock ridges and treelines are dropped from the world entirely, so they neither render nor collide.

Nothing else about the world changes: the Great River, its bridges, Grand Haven's moat channel, lakes, jetties, city walls, roads, nodes, monsters and spawns are untouched. No database migration and no shared-world resync are needed, since barriers are client-side generated geometry.

## Technical detail

1. `src/game/data.ts`
   - Keep `buildBarriers()` as-is (its river segments are still the seed for the Great River meander).
   - In the exported `BARRIERS` array, drop the non-river raw barriers: export only `GREAT_RIVER` and `MOAT_CHANNEL`. This removes them from `blockedAt()` collision and from all rendering in one place.
   - The `distToRiver` wash-out filter on raw barriers becomes unnecessary and is removed with them.
   - Leave `BarrierKind` including `"rocks" | "woodland"` only if still referenced; otherwise narrow it to `"river"`.

2. `src/game/engine.ts`
   - In `drawBarriers`, delete the `rocks` and `woodland` branches (boulder clusters / tree blobs) and keep the river path only.
   - Remove any now-unused helpers those branches called.

3. `src/components/game/WorldMap.tsx`
   - In the `BARRIERS.map(...)` block, keep the layered river rendering and delete the fallback stroke branch for rocks/woodland.

## Verification
- Typecheck passes with no dangling references.
- In preview: no rock or tree walls along biome borders; walking across a biome boundary is unobstructed; rivers, bridges, moat and lakes look and behave exactly as before.

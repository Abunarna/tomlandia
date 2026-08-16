# Remove the four decorative road waypoints

## Goal
Delete the four purely-decorative roadside landmarks (The Broken Watch, The Whispering Stones, Wayfarer's Oasis, The Crossroad Shrine) entirely. They have no collision, no mechanics, no interaction, and no database rows — they are client-side render-only flavour. Roads stay plain; the world map loses the four named midpoint markers.

## Why
They read as clutter blocking the main route on a narrow mobile screen. Removing them is a pure visual cleanup with zero gameplay or persistence impact.

## Changes (3 files, render-only)

### 1. `src/game/data.ts` — delete the waypoint section (~lines 2055–2127)
Remove in full:
- The section header comment `/* Road waypoints — pure flavour landmarks at the midpoint of each leg */`
- `export type WaypointKind`
- `export interface WaypointDef`
- `function midOfPath(...)` (used only here)
- the `WAYPOINTS` IIFE (which also defines the local `nearBridge` helper, used only here)

Leave the following `/* Spawn generation */` section untouched.

### 2. `src/game/engine.ts` — drop the waypoint rendering
- Remove `WAYPOINTS,` from the import block at the top (line ~8).
- Remove the call `this.drawWaypoints(ctx, view);` (line ~2892).
- Delete the entire `private drawWaypoints(ctx, view)` method (lines ~3221–3410, including its leading comment).

### 3. `src/components/game/WorldMap.tsx` — drop the map markers
- Remove `WAYPOINTS,` from the import block (line ~10).
- Delete the `{WAYPOINTS.map((wp) => (...))}` block (lines ~384–403).

## Not affected
- Roads, bridges, rivers, mountains, cities, spawns — unchanged.
- No database migration, no shared-world resync, no RPC changes.
- No new collisions or mechanics; waypoints had none to begin with.

## Verification
- `tsgo` typecheck passes (no dangling references to `WAYPOINTS` / `WaypointDef`).
- Preview: the four landmarks no longer render on the canvas or the world map; roads are uninterrupted.

# Blanket spawn clearance rule

Goal: nothing that lives in the world — resource nodes, monsters, NPCs, villagers — is ever placed inside or touching an impassable object, with at least 10px of free space around it.

## Current situation

- Node and monster placement already calls a `spawnable()` check that tests the exact centre point with a 34px collision pad. It only tests one point, so a spot can pass while the body of the object overlaps a wall, tower base, castle footprint or tree trunk just off-centre.
- NPC home positions are hand-authored coordinates. The custom buildings (castle, towers, houses, monastery) were added later at fixed coordinates, so an NPC or a wandering villager can now stand inside one of those footprints.
- Villager and NPC wander targets use small pads (10–12px) measured from a single point, so they can drift into a footprint corner.

## What will change

1. **One shared clearance helper** in the world data module: `hasClearance(x, y, margin)` — passes only if the centre point plus a ring of sample points around it (8 directions at the object's radius + margin) are all free of barriers, rivers, lakes, city walls/moat, buildings and landmark footprints. Default margin 10px.
2. **Nodes and monsters**: `spawnable()` uses the ring check instead of the single-point test, so both the main world pass and the southern-extension pass inherit it automatically. Candidates that fail are skipped, exactly as today — density stays roughly the same because the candidate grid is dense.
3. **NPCs and villagers**: at load, any NPC/villager home that fails the clearance test is nudged outward along a widening ring to the nearest clear spot (same approach as the existing player unstick). Wander target picking uses the same clearance helper so they can't walk a target into a wall.
4. **Existing landmark overlaps**: because the nudge runs on the authored coordinates at startup, any NPC currently sitting inside the castle/tower/house footprints moves out on the next load without hand-editing coordinates.

## Notes

- Deterministic: the node/monster generator stays seed-driven, so world layout stays stable apart from the small number of spawns that were previously overlapping.
- Purely client-side world generation; no database or migration work needed.
- After the change I'll spot-check Grand Haven and the southern extension in the preview for empty overlaps or noticeably thinned spawn density.

## Technical detail

- `hasClearance` lives next to `blockedAt` in `src/game/data.ts` and reuses it, so every barrier type (including future ones) is covered by one rule.
- Node bodies use their existing solid-disc radii (14 rock/tree, 11 bush) plus the 10px margin; monsters and NPCs use a ~12px body radius plus the margin.

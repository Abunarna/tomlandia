# Issue: optional `/knight/*` armour and weapon overlay 404s

- Status: open, non-blocking, cosmetic
- Severity: low (no gameplay, data, or release impact)
- Scope: explicitly OUT of the completed V3 content release

## Symptom

The browser console logs 404s for optional knight overlay strips, e.g.

```
GET /knight/idle_armor_strip.png   404
GET /knight/walk_armor_strip.png   404
GET /knight/mine_weapon_strip.png  404
```

## Cause

`src/game/knight.ts` declares `OVERLAY_PATHS` for an `armor` and a `weapon`
layer across all six animations (`idle`, `walk`, `attack`, `mine`, `chop`,
`loot`). Only three weapon strips ship as bundled assets
(`idle_weapon_strip`, `walk_weapon_strip`, `attack_weapon_strip`); the rest are
requested from `/knight/*` in `public/`, which does not contain them.

The rig is designed for this: `overlaysAvailable()` gates the layer, so a
missing strip degrades silently to the base sprite. The only defect is console
noise.

## Options (pick one when this is scheduled)

1. Ship the missing `*_armor_strip.png` / `*_weapon_strip.png` files under
   `public/knight/`.
2. Reduce `OVERLAY_PATHS` to the strips that actually exist and skip loading
   the rest.
3. Probe with a manifest of known-present overlays instead of speculative
   `Image` loads.

## Constraint

Do not fold this into the V3 release record. V3 is content/world scope; this is
a client asset cleanup and must land as its own change with its own verification.

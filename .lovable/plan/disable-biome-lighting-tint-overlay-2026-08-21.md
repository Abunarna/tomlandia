# Disable biome lighting/tint overlay

## Goal
Remove the distracting full-screen color wash that shifts as the player moves between biomes. Keep the day/night cycle and vignette intact.

## Current behavior
In `src/game/engine.ts` (lines 2935-2937), after the world is drawn, the engine applies a biome-specific tint as a translucent rectangle over the entire viewport:

```ts
// biome tint + day/night + soft vignette
ctx.fillStyle = this.biome.tint;
ctx.fillRect(0, 0, w, h);
```

Each biome in `src/game/data.ts` defines a `tint` (e.g. forest = green wash, desert = orange, evil = purple, winter = blue). Crossing a biome border therefore visibly shifts the whole screen's color, which the user finds distracting.

## Change
Remove the two lines that apply the biome tint fill, so only the day/night cycle and vignette remain:

```ts
// day/night + soft vignette
this.drawDayNight(ctx, w, h);
const v = ctx.createRadialGradient(...);
...
```

The `tint` property on `BiomeDef` and its values in `data.ts` are left in place (harmless, unused) to avoid touching the biome definitions.

## Verification
- Build passes (no type errors from removing the fill).
- In the preview, crossing between biomes no longer shifts the screen color; day/night and edge vignette still render.

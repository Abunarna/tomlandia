# Replace all water bridges with the pixel-art bridge sprite

Swap the hand-drawn plank bridges for the uploaded 52x90 pixel-art bridge image, drawn whole (never cropped or squashed) at every water crossing.

## What changes

- The six Great River crossings now render the sprite instead of the drawn deck + rails.
- Grand Haven's moat drawbridges at the gates use the same sprite.
- The sprite is drawn at its full structure: uniform scale, original 52:90 aspect, no clipping of the ends.
- Sizing: scale so the bridge's long axis comfortably overshoots the water (river band is 54px wide; the deck spans ~100px). At that length the deck is ~58px wide — plenty for the player to walk across, and wider than the current 62px deck's walkable feel.
- The bridge sprite is rotated to sit perpendicular to the river, exactly as the current decks are.
- Walkable area (`onBridge`) is widened slightly to match the sprite's actual deck so players never get blocked at the edges of a bridge they can clearly see.
- The world map's bridge markers keep the same proportions as the new decks so map and world agree.

## Technical notes

- Upload `bridge_PNG.png` to the CDN via `lovable-assets`, pointer at `src/assets/bridge.png.asset.json`.
- Load it once in `src/game/engine.ts` as an `Image`, drawn with `imageSmoothingEnabled = false` to keep pixels crisp.
- Rewrite `drawBridges()` in `src/game/engine.ts`: translate/rotate as today, then `drawImage` centred, sized `len x (len * 52/90)` where `len` derives from `BridgeDef.len`. Keep the existing water shadow. Fall back to the current drawn deck only while the image is still loading.
- Bump `BridgeDef.len`/`width` in `buildGreatRiver` (`src/game/data.ts`) so deck length and width follow the sprite's aspect ratio; `onBridge` reads those fields, so collision follows automatically.
- Moat drawbridge block in `engine.ts` (`CITY.gates` loop): draw the same sprite rotated along the gate bearing, scaled to span the moat gap plus the existing overhang.
- `WorldMap.tsx` bridge rects keep using `br.width`/`br.len`, so they update with the new numbers; no logic change there.
- No changes to river geometry, road splitting, pathing, or any gameplay values.

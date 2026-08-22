# Show all players as the knight sprite

Right now only your own character uses the knight sprite rig. Other players are still drawn with the old rounded-vector avatar, so everyone sees strangers as the legacy model.

## What changes

- Every remote player gets their own knight animation rig, so they animate independently of you.
- Remote knights pick their animation from the data already broadcast: idle when standing, walk when moving, and attack / mine / chop / loot when their activity says they're fighting or harvesting.
- Facing uses the broadcast facing value (art faces left, mirrored when facing right), same as your own knight.
- Nameplates and emote bubbles stay exactly where they are, positioned above the knight.
- The old vector avatar stays only as a fallback for the brief moment before sprite strips finish loading.

Nothing about presence networking, movement, combat, or balance changes — this is purely how other players are drawn.

## Technical notes

- `RemotePlayer` gains a lazily created `KnightRig` instance (`src/game/engine.ts`).
- In `tickRemotes`, compute per-remote movement (distance to target position) and call `rig.setLocomotion(moving)`; map `r.act` to an action animation with the same rules `syncRig()` uses for the local player (`Fighting` → attack, mining/woodcutting/gathering/fishing activity strings → mine/chop/loot), then `rig.update(dt)`.
- `drawRemote` replaces the roundRect body/head drawing with `rig.draw(ctx, r.x, r.y + 16, r.f as 1 | -1, 72)` (no armour/weapon tint colours, since equipment isn't broadcast). If `draw` returns false, fall back to the existing vector body.
- Nameplate/emote y-offsets keep their current values so layout is unchanged.

# Fix: attack animation restarting during combat

## What I found

Your suspicion is close, but the culprit is not the damage/hit events.

- **Combat hits do not touch the animation.** The swing timer (`combatCd`) and the server damage call never call into the sprite rig. `playPlayerAnim()` exists but nothing in combat calls it.
- **What starts/stops the attack loop:** every frame the renderer looks at the activity label. If it starts with `Fighting `, it asks the rig to play `attack` on repeat; when the target dies or is dropped the label reverts to `Wandering`/`Approaching`/`Walking` and the rig falls back to idle/walk. That part is correct, and the repeat guard already avoids a restart when `attack` is already playing.
- **The actual bug:** just before that, the rig is told each frame whether the player is moving. That movement call swaps the rig's animation to idle or walk **even while an action animation is playing**. During combat the knight keeps micro-nudging toward the monster, so the moving/stationary flag flickers on and off; each flicker yanks the rig to idle/walk, and the very next line re-plays `attack` — which resets it to frame 0. The result is an attack that visibly stutters and never completes its 0→5 cycle.

## The change

One targeted change in the knight rig: the locomotion call records the new base state (idle vs walk) but only changes the visible animation when the rig is currently showing a locomotion animation. If an action animation (attack, mine, chop, loot) is active, the base is remembered silently and applied when the action ends.

Result: attack starts once when combat begins, cycles 0→1→2→3→4→5→0 on its own timer for the whole fight, and returns to idle/walk when combat ends. Mining, chopping, gathering and fishing get the same stability as a side effect of the same guard.

## Untouched

Attack PNG asset, animation speeds, frame size, render scale, anchors, facing logic, movement, damage timing and combat balance all stay exactly as approved.

## Technical detail

`src/game/knight.ts` → `KnightRig.setLocomotion()`: keep updating `this.base`, but gate the `setAnim(next)` call on the rig currently being in a locomotion state rather than only on `!oneShot`. No other file changes.

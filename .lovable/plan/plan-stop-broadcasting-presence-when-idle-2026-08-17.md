# Plan — Stop Broadcasting Presence When Idle

## Goal
Cost-reduction fix to `src/game/presence.ts`. Today `PresenceNet.tick()` sends a `pos` broadcast every tick (~4×/sec) even when the player has not moved, changed facing, changed activity, or changed emote. Standing still (crafting, in a menu, AFK) still emits a steady stream of redundant realtime messages. Under Lovable's unified credit model this directly costs build credits. Trim it with no gameplay change.

## Change (single file: `src/game/presence.ts`)
Add idle-suppression + heartbeat to `PresenceNet`:

1. Add module constants near the other timing constants:
   - `HEARTBEAT_MS = 2000` — minimum send interval while idle (well under `STALE_MS = 6000`).
   - `POS_EPSILON = 2` — world-unit movement threshold below which we treat position as unchanged.

2. Add instance fields on `PresenceNet`:
   - `private lastSent: Omit<PresencePacket, "id"> | null = null;`
   - `private lastSentAt = 0;`

3. Rewrite `tick()` so that after the existing `resubscribe` call and the `home`/`joined` guard, it computes:
   - `moved` = `!this.lastSent` OR `hypot(dx, dy) > POS_EPSILON` OR `f` changed OR `act` changed OR `emo` changed.
   - `heartbeatDue` = `now - lastSentAt >= HEARTBEAT_MS`.
   - If neither, `return` (skip the send).
   - Otherwise send the `pos` broadcast exactly as today, then update `lastSent = me` and `lastSentAt = now`.

4. Keep everything else identical: `SEND_HZ`, `STALE_MS`, `cellOf`, `cellKey`, `neighbours`, `resubscribe`, channel subscribe/`bye` handling, `farewell`, `start`/`stop`. Only *when* a send happens changes — not the mechanism.

## Why it's safe
- Moving players still send every tick they actually move (tick loop still runs at `SEND_HZ`), so remote interpolation is unaffected while walking.
- 2s heartbeat keeps idle players visible; `STALE_MS` (6s) drops only true leavers.
- No change to combat, movement, interaction, or channel topology.

## Verification
- Typecheck (`tsgo`) passes.
- Report: a stationary player now sends ~1 message / 2s instead of 4/s (~87% idle reduction), and movement still looks smooth to nearby players.

# Plan: Increase gatherable tree node size ~50%

## Change
In `src/game/engine.ts` (line 4898), the tree node pixel scale is:

```ts
const px = 4.4; // world px per art pixel
```

Change it to `6.6` (4.4 × 1.5):

```ts
const px = 6.6; // world px per art pixel
```

`w` and `h` are derived from `px` (`16 * px`, `20 * px`), so the whole tree — including its base sitting on the ground baseline at `n.y + 22` — scales up proportionally. No other constants, shadows, sway math, or assets change.

## Scope
- One line changed.
- No asset replacement, no re-centering, no gameplay logic change.
- Bushes and ore rocks are untouched (separate `px` constants).

# V7 healing foods — canonical audit and plan

Status: **Implemented, awaiting activation approval.** The canonical V6 audit
passes field for field, all owner decisions of 2026-09-07 are applied, and the
complete V7 release is generated and committed. Nothing has been staged,
activated, deployed or published.

Owner decisions applied:

1. The stale V6 client world stamp was regenerated, verified by
   `bun run v6:client:check`, and republished. `V7-GATE0-001` is closed.
2. Food values are unchanged in V7. The 1.25x ingredient revaluation below stays
   as unapproved future research only.
3. Manual eating is repaired generically for every active dish, with no
   allowlist, covered per food id by `supabase/tests/v7_manual_eating.sql`.
4. The healing curve is frozen at
   `15, 45, 120, 135, 155, 180, 210, 245, 300, 340, 375, 445, 485, 525, 605, 645`.

Generated V7 identity: content hash
`89789521c5b84948af1b954e86fdd9d6bea127d8315d3bb5b4f553d340a46935`, spawn hash
`3c3602f8247d58655d4a004f4af1cf330f606a84d0f22509e8a5ab5cdc47577c`, 173 items,
108 recipes, 730 spawns (369 nodes / 361 monsters), 0 deletions.

Everything below is derived from canonical V6
(`content/v6/manifest.authoring.json`) and live production reads. No release
data is copied from V5 generated output.


## 1. Gate 0 — production baseline

`docs/overhaul/v7/production-v6-baseline.json` holds the machine-readable
record. Summary:

| Check | Expected | Observed | Result |
| --- | --- | --- | --- |
| Active content | v6 | v6 | pass |
| Active spawn set | v6 | v6 | pass |
| Minimum client | v6 | v6 | pass |
| Maintenance mode | false | false | pass |
| V5 | retired, retained | retired, retained | pass |
| Content hash | `d8726719…673d9e` | identical | pass |
| Spawn hash | `69a4276f…9aba0c163` | identical | pass |
| Items / foods / potions | 173 / 16 / 16 | 173 / 16 / 16 | pass |
| Cooking / Alchemy recipes | 16 / 16 | 16 / 16 | pass |
| Spawns / nodes / monsters | 730 / 369 / 361 | 730 / 369 / 361 | pass |
| Migration ledger | steps 1–3 once each | `20260905064323`, `20260905065614`, `20260905073552` | pass |
| Working tree | clean | clean | pass |

### Blocking drift V7-GATE0-001 — client world manifest still pinned to V5

`src/generated/world-manifest.ts` still declares spawn set `v5` and spawn hash
`48680a9d…d2743`, while production reports the V6 spawn hash
`69a4276f…0c163`. `resolveWorldRuntime()` in `src/game/world-runtime.ts`
compares that constant against the server value and falls back to maintenance
mode when they differ, so the published V6 client cannot enter the live world
path. The content manifest and release catalogue were promoted correctly; only
the world manifest was missed, because `scripts/v6/build.mjs` writes it only
under `--promote`.

This is the exact failure class the handoff asks V7 to prevent, and it means V6
publication is incomplete. Per Gate 0, work stops here rather than building V7
on an incompletely published release. The remedy needs no database change:
regenerate the V6 world manifest with `--promote`, verify all pins agree, and
republish.

### Remaining scan groups

* **RLS Enabled No Policy** (INFO, 6) — deny-all internal tables. Does not
  intersect V7.
* **Signed-In Users Can Execute SECURITY DEFINER Function** (WARN, 31) — this is
  the intended public RPC surface and includes `consume_food` and the combat
  entry points V7 touches. It intersects V7 by design, so Gate 0 requires an
  owner decision before continuing.

The post-V6 security fix is recorded in the baseline artifact. Its four
properties (caller-permission runtime items, restricted helpers, signed-out
rejection of release status, retained signed-in play access) are **not yet
proven by automated tests**; those tests are scheduled in the V7 security-delta
suite and have not been written.

## 2. Canonical food and recipe audit

All 16 foods and all 16 Cooking recipes in canonical V6 match the owner-supplied
contract **exactly** — IDs, names, recipe IDs, output IDs, inputs, quantities,
Cooking requirements, XP, times, output quantities (all 1), stackability,
tradability, icons, colours, rarity, tier assignments, current heals and current
values. No drift. The frozen contract is
`docs/overhaul/v7/healing-foods-current-and-proposed.json`.

Every ingredient is defined, active, obtainable, non-circular and reachable at
or below the Cooking gate that consumes it. Earliest canonical routes:

| Ingredient | Earliest route |
| --- | --- |
| River Minnow / Silver Trout / Golden Koi / Deepwater Eel / Starlight Salmon | Fishing 1 / 10 / 20 / 40 / 70 |
| Forest Herbs / Desert Bloom / Gloomcap / Frost Lichen | Gathering 18 / 42 / 68 / 98 |
| Feather / Goblin Charm | Chicken drop 0.70 / Goblin drop 0.35, both level 1 |
| Frost Pelt | Frost Wolf level 55, guaranteed |
| Thick Leather | Skinning recipe level 20 from Thick Hide |

Desert Bloom and Gloomcap also drop earlier (Bandit 17, Wraith 32). Frost Lichen
gates at 98, below its earliest use at Cooking 110. Ascendant Feast depends only
on Starlight Salmon and Frost Lichen — no Ascendant drop.

## 3. Authoritative behaviour (verified against live functions)

* `max_hp = 30 + (combat_level - 1) * 6` — confirmed in `player_max_hp`.
* `incoming = max(0, floor(monster_attack * U[0.5,1.2) - defense * 0.5))` — confirmed.
* `effective_heal = min(food.heal, max_hp - current_hp)` — confirmed.
* Food action gate: shared 2-second `action:food` gate for manual and auto-eat.
* Auto-eat resolves heal from the versioned `game_runtime_items` view, never
  from the client.

Two behavioural findings correct assumptions in the handoff:

1. **Auto-eat runs before death is resolved.** `settle_incoming_damage` applies
   damage, then calls `try_auto_eat`, then checks `hp <= 0`. Auto-eat *can*
   therefore save a player from the triggering hit. UI wording must state this
   accurately rather than the opposite.
2. **Defect: manual eating is broken for 11 of 16 foods.** `consume_food_v1`
   resolves heal from the legacy `game_items` table, not from authoritative
   versioned content. That table holds only 5 of the 16 foods, and gives Honey
   Bun 14 heal instead of the canonical 15. Manual consumption of Fisherman's
   Stew, Golden Koi Feast, Sunspiced Eel, Runic Fish Stew, Shadow Stew, Wyrm
   Feast, Starsteel Feast, Void Feast, Wyrmforged Feast, Ancient Feast and
   Ascendant Feast returns `not_food`. V7 must repoint manual consumption at
   `game_runtime_items` with focused SQL tests.

## 4. Deterministic balance model

`scripts/v7/model-healing-foods.mjs` (commands `v7:plan`, `v7:plan:canonical`,
`v7:plan:check`) rebuilds both planning artifacts byte-deterministically from
canonical V6 using a seeded PRNG and the authoritative formulas. It runs 2,496
paired encounter cases — 16 tiers x Heavy/Light x +0/+20/+50/+100 x 25/50/75%
auto-eat x same-tier, adjacent-tier and worst-in-band targets, plus Ascendant
Wyrm and DESOLATUS at the endgame bands — evaluating current and candidate
healing on identical seeds, plus 144 sensitivity runs at ±5% max HP and 1.5 /
2.0 / 2.5-second cooldowns.

Results with the candidate curve:

* **Safety: pass.** Zero death-probability regressions in all 2,496 paired
  cases, including both bosses. The only non-zero death rate is a pre-existing
  level-1 worst-in-band case (Goblin), identical before and after.
* **Overheal: improved.** Tiers 11–16 fall from ~44–47% wasted healing to
  ~22–27%. Tiers 1–10 are unchanged.
* **Sustain: pass.** Peak consumption stays under 18 foods per minute against
  the 30-per-minute ceiling implied by the 2-second gate; a 28-slot stack lasts
  through the sensitivity range.
* **Intent confirmed.** Tiers 1–10 keep their healing; tiers 11–16 drop from
  101–104% of same-level max HP to 60–70%. The tier-3 Hearty Stew outlier
  (83.3%) is preserved.

### Telemetry

Production has **no** food-consumption, death or crafting telemetry tables:
recorded unavailable, not estimated. Market history is present but unusable for
food pricing — 15 trades total, none of them food, and a single Honey Bun
listing. The value question therefore cannot be settled empirically.

### Economy and the value decision

The deterministic value rule
`round_up_to_5(max(current_value, ingredient_intrinsic_value * 1.25))`
reproduces the owner's candidate column exactly for all 16 foods. It is a large
move for several tiers, driven purely by ingredient intrinsic value:

| Food | Current | Candidate | Intrinsic |
| --- | --- | --- | --- |
| Sunspiced Eel | 105 | 415 | 330 |
| Shadow Stew | 140 | 450 | 358 |
| Wyrm Feast | 210 | 875 | 698 |
| Phoenix Fillet | 700 | 1,375 | 1,100 |
| Ascendant Feast | 790 | 1,960 | 1,565 |

Per the handoff, this rule is not frozen and is **not implemented**. Owner
decision required before any runtime artifact is generated.

## 5. What V7 ships

| Deliverable | Path |
| --- | --- |
| Frozen model | `scripts/v7/model.mjs` |
| Content and world generator | `scripts/v7/build.mjs` |
| Client catalogue generator (unpromoted) | `scripts/v7/build-client-catalog.mjs` |
| Migration generator | `scripts/v7/build-migrations.mjs` |
| Deterministic verification | `scripts/v7/check.mjs` (`bun run v7:check`) |
| Manual-eating runtime | `supabase/v7/food-runtime.sql` |
| Database regression suite | `supabase/tests/v7_manual_eating.sql` (45 assertions) |
| Migration regressions | `tests/content/v7-stage-content-migration.test.mjs` |
| Cook interface and food ladder | `src/game/release-content.ts`, `src/components/game/NpcDialog.tsx` |

The three generated migrations are written but **not applied**:

* `supabase/migrations/20260908120000_v7_stage_content.sql`
* `supabase/migrations/20260908120100_v7_stage_world.sql`
* `supabase/migrations/20260908120200_v7_activate.sql`

Verification run: `v7:check` (all four generators in check mode plus release
invariants), 17 static/unit tests, 7 V7 migration regressions, typecheck,
scoped lint and a production build — all green. No smoke tests were run.

## 6. Remaining owner decision

Only one item is still open: confirm the SECURITY DEFINER scan group is
accepted as by-design. It does not block V7 implementation.

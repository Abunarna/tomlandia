# TOMLANDIA v2 — Gate 0 decision register

Approval basis: the project owner instructed Codex on `2026-08-23` to begin Gate 0 using recommended defaults. These decisions are locked for implementation planning. A change requires a new revision in source control and explicit owner approval; it must never be made silently inside code, SQL or a prompt.

`LOCKED` means the product/scope decision is final for the current overhaul. `LOCKED-GATE-N` means ownership and constraints are final, but the numeric output must be generated and approved in that future gate before dependent implementation can start.

| ID | Status | Locked decision |
|---|---|---|
| D-01 | LOCKED | Use `tier_index` only for ordinal 1–16 and `level_requirement` only for gameplay level. Bare phrases such as “tier 10” are forbidden. Exact pairs are in `id-registry.json`. |
| D-02 | LOCKED-GATE-3 | Preserve the current XP curve exactly through level 50. Gate 3 must derive levels 51–150 and per-skill rewards from approved active-play time targets. No exponential continuation and no implementation agent may invent target hours. |
| D-03 | LOCKED | Enforce equipment requirements server-side on every new equip after v2 activation. Currently equipped under-level gear is grandfathered only while it remains equipped; after removal it cannot be re-equipped until the requirement is met. |
| D-04 | LOCKED | Equipped `wooden_club` becomes `copper_sword` with the same `plus`. Unequipped clubs become `captured_unit_value × quantity` gold once; observed value 15g is evidence, not a hard-coded cutover value. |
| D-05 | LOCKED | One server/client/market hard maximum of `plus = 100`. Never clamp an unexpected value; stop and investigate. Gate 3 owns the cost curve and realistic reachable range. |
| D-06 | LOCKED | All gear is non-stackable in every source, inventory, bank and market path. Any legacy gear slot with `qty > 1` is a migration stop condition unless a separately approved lossless split rule exists. |
| D-07 | LOCKED | Existing potions map to levels 1/20/40/70/100. New potion IDs fill 10/30/50/60/80/90/110/120/130/140/150. |
| D-08 | LOCKED | Level 100 remains `phoenix_fillet`; levels 110–150 are Starsteel, Void, Wyrmforged, Ancient and Ascendant Feasts. No extra Glacial Feast. |
| D-09 | LOCKED | Use `Voidsteel` for the ore, bar, weapon and armour material family and IDs. `Void Feast` is the explicit culinary-name exception. `void_bar` and `void_ore` are forbidden aliases. |
| D-10 | LOCKED | `wyrm_hide` comes from the level-120 Wyrm Knight hide/skinning channel and refines into `wyrm_leather` at level 130. It is not sourced from the level-146 Ancient Frost Wyrm. |
| D-11 | LOCKED | Light-armour speed fraction is `min(0.25, round2(0.04 + 0.03 × (tier_index - 1)))`. This preserves or improves every migrated Light item. Gate 3 must sensitivity-test it; changing it requires a decision revision. |
| D-12 | LOCKED | Build a versioned v2 Winter spawn relocation so elevation bands are real. Existing monster definitions/stats remain unchanged and v1 rows remain available for rollback. |
| D-13 | LOCKED | Weapon and armour silhouettes remain the current colour-overlay system for this release. Per-archetype gear art is a separate later asset project. |
| D-14 | LOCKED-GATE-3 | Keep DESOLATUS, remove all Tungsten reward coupling, and rebalance stats/rewards against approved v2 endgame/group targets in Gate 3. |
| D-15 | LOCKED | Existing quests become server-authoritative and have retired/over-tier rewards corrected. No new high-level quest chain ships in this overhaul. Default reward replacements: `goblin_trouble` → one `copper_bar`; `wolf_watch` → one `bronze_sword`. |
| D-16 | LOCKED | One schema-validated manifest owns content. Client data/types, SQL upserts/constraints, world spawn manifest, dependency graph and content hash are generated outputs. |
| D-17 | LOCKED | Use the validated 32-file canonical-kind sprite set, 4px-padded assets, sprite-aware pivots/click bounds and procedural fallback. Archive ordinals never become database IDs. |
| D-18 | LOCKED | Regular-creature assets ship as single-frame front-facing sprites with lightweight canvas transforms. Frame animation is outside this overhaul. |
| D-19 | LOCKED | Keep the current procedural DESOLATUS visual unless a separately approved boss asset is supplied. |
| D-20 | LOCKED | Start regular creatures at natural 1.0 pixel scale. Store reviewed per-kind adjustments in the manifest only after isolated staging preview. |

## Additional migration and market locks

- Starter loadout after v2 activation: `copper_sword` + `cloth_tunic` at `plus = 0`.
- Cancel and return every active listing for a retired ID or a materially changed in-place definition before activation. Do not grandfather those listings.
- Version market prices and trade history by content version; v1 history cannot seed v2 recommendations as if item semantics were unchanged.
- `bronze_dagger`, `sunspire_wand`, `tungsten_maul`, `tungsten_ore` and `tungsten_bar` use captured cutover unit value × current owned quantity exactly once unless an explicit mapping is later approved.
- Any unexpectedly equipped retired item without a locked mapping is a stop condition.
- Existing in-place IDs retain ID, quantity, `plus` and location. Instance JSON is not rewritten merely because a central definition changes.
- Preserve valid short bank arrays, null slots and slot order. No silent normalization.
- Current-value snapshots and live ownership/listing aggregates are re-read after maintenance begins; the audit snapshot is evidence, never a migration constant.

## Values deliberately owned by later gates

The following are not permission to guess. They are blocked from content implementation until the named gate produces signed evidence:

| Future owner | Required outputs |
|---|---|
| Gate 3 | Time-to-level targets; XP/reward curves; combat TTK/TTD; all item/monster/node stats; heal and potion effects; XP/hour; gold/source/sink bands; upgrade costs; boss targets. |
| Gate 4 | Final manifest schema, generated-output contracts, database constraints, spawn-ID representation and content hashing. |
| Gate 5 | Display names, complete recipes, exact values/rarities/tradability, loot chances, node timings, spawn rows and every remaining entity field. |
| Gate 7 | Exact sub-zone geometry, stable spawn rows and measured reachability exceptions. |
| Gate 9 | Production-shaped isolated dataset, migration timing and idempotency evidence. |

No `TBD`, null required field or deferred value may enter a runnable manifest, generated output, migration or active database row.


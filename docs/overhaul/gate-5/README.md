# Gate 5 — complete canonical content

Gate 5 converts the Gate 4 inventory-only draft into the complete, schema-validated `v2` runtime manifest. The owner-approved Gate 3 model hash is `e1fbe19aac61014b38885ce38cd16d9a12e3852f24858301a2588c65fba4a640`; every balance-dependent value in this gate is bound to that hash.

`runtime` means the manifest is complete enough to generate artifacts. It does **not** mean active or published. Generated SQL creates or refreshes a `staged` version, refuses to replace an active version, and never writes `game_content_control`. No production database was contacted by this gate.

Gate 5 extends the pushed Gate 4 schema through the new additive migration `20260824080000_gate5_complete_content_contract.sql`; it does not rewrite Gate 4 migration history. A database that has already applied Gate 4 therefore receives the same complete contract as a zero-to-head rebuild.

## Complete inventory

| Entity | Count |
|---|---:|
| Locked tiers | 16 |
| Items | 174 total / 168 active / 6 inactive |
| Recipes | 108 |
| Resource-node definitions | 27 |
| Regular-monster definitions | 32 |
| Fish rules | 5 |
| Fishing spots | 6 |
| Existing quests | 8 |
| Bosses | 1 |
| Versioned node spawns | 369 |
| Versioned monster spawns | 361 |
| Retirement rules | 6 |
| Canonical padded creature sprites | 32 |

The checked-in count and manifest hash are regenerated in `content-summary.json`; tests reject drift.

## Non-regression boundaries

- All 289 existing regular-monster spawn coordinates are copied exactly from the live source snapshot.
- All 20 existing regular monsters retain name, HP, attack, defence, XP, gold, drop chance, hide and skinning XP. The only drop-ID change is the locked Frost Giant rename from `tungsten_ore` to `frost_giant_heart`.
- Existing resource-node coordinates remain exact except Tungsten nodes, which are absent from active v2 content because Tungsten is retired.
- All locked in-place items retain their immutable IDs and meet or exceed every live stat.
- The six retired items remain as inactive definitions. Nothing is hard-deleted and no active dependency points to them.
- New spawn candidates are generated deterministically and checked against the real `biomeAt()` and `blockedAt()` world functions. Gate 7 still owns final sub-zone geometry, versioned Winter relocation and measured reachability.

## Two audit resolutions recorded explicitly

### In-place item arithmetic

The master document says “18 migrate in place,” but its own phase requirements and the locked Gate 0 registry contain 23:

- 4 weapons;
- 9 armour pieces;
- 5 foods;
- 5 potions.

The missing five in the stated total are the existing potions that Phase 8 explicitly says retain their IDs. Gate 5 follows the locked registry and protects all 23. No IDs were invented.

### Level-1 Linen Cloth reachability

The unchanged Linen Cloth recipe consumes Meadow Berries at level 1, while the live Berry Bush required level 3. That was the sole remaining ingredient-above-consumer failure in the complete 108-recipe graph. Gate 5 lowers only the Berry Bush and Meadow Berries requirement to level 1. This is player-favourable, preserves the recipe exactly and makes the tier-1 progression invariant true. The resolution is encoded in tests and in `content-summary.json`; it is not a silent normalization.

### Armourer skill split

The live game uses the same Armourer station for two skills: Heavy armour recipes award Smithing, while Light armour recipes award Tailoring. Gate 4's first contract draft accidentally reduced that to Armourer=Smithing only. Gate 5 restores the live two-skill rule in JavaScript validation and the database constraint, and all 16 Light recipes now use the approved Gate 3 Tailoring XP/timing values.

## Reproducible sources and checks

- `live-v1-snapshot.json` captures 79 items, 19 node definitions, 20 monster definitions, 36 recipes, 5 fish and 8 quests directly from `src/game/data.ts`.
- `live-v1-spawns.json` captures 311 live resource positions and 289 live monster positions, including their computed biome.
- `sprite-metadata.json` normalizes the prepared 32-creature package and deliberately strips archive ordinals.
- `new-spawn-placements.json` records deterministic, unblocked candidates in their declared live biome.
- `content/v2/manifest.authoring.json` is the sole canonical content manifest.
- `node scripts/gate5/check.mjs` runs snapshots, generation drift checks, contract tests, complete-content tests, asset hashes and real-world spawn geometry.

Gate 5 CI also rebuilds an isolated local database from migration zero, applies the generated v2 SQL, validates the complete graph and proves that `v2` is still staged with zero active control rows.

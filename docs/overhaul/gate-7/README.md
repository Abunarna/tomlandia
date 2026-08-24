# Gate 7 — deterministic, versioned world

Status: implemented on a feature branch; staged only. This gate does not activate v2, write to a production database, merge to `main`, publish the game, or invoke the Lovable agent.

## Result

Gate 7 replaces the v2 startup-array concept with a deterministic, reviewable world artifact and additive UUID server state. The generated payload contains 730 stable spawns (369 nodes and 361 monsters) in 152 clusters.

- Spawn payload SHA-256: `24130e8725da5f6e339d5037a40e81f5bcc1052a47fc29b056b36b8d8b2d31fa`
- Source content manifest SHA-256: `8b2b3877e7ae3e7f5202ddfbf703c9f29ccd663d36baf38e5ed4c56352f76ee9`
- Generator model: `tomlandia-gate7-world-model/v1`
- Generator split: 436 exact coordinate carry-forwards; 294 regenerated rows
- Deterministic selection: 262 `cluster_90` rows and 32 `fallback_10` rows, each decided by `stable_sha256_roll < 0.9`
- Tungsten: 0 v2 nodes; all 20 v1 nodes retained for rollback
- Reachability: 730/730 spawns checked, 152/152 clusters reachable, 16/16 tier loops passing
- Movement model: 130 world units/second on a 40-unit collision-aware A* grid, with diagonal corner-cut prevention

The source artifact is [`content/v2/world-spawn-manifest.json`](../../../content/v2/world-spawn-manifest.json). It owns exact UUID, entity type, kind, ordinal, state, coordinates, 700×500 subscription cell, biome, subzone, cluster, collision/interaction geometry, charges or HP, respawn time, and canonical monster loot for every spawn.

## Winter Mountain geometry

Subzones are real 100-unit biome-owned polygons clipped from the game's actual `biomeAt` geometry. Depth increases southward. The southern extension begins at world `y = 3000` and contributes 2,195,000 units², or 42.0096% of Winter's 5,225,000 units².

| Subzone | Levels | World-y band | Area | Southern area |
|---|---:|---:|---:|---:|
| Lower Slopes | 55–79 | `[0, 2000)` | 620,000 | 0 |
| Mid Mountain | 80–99 | `[2000, 2400)` | 780,000 | 0 |
| Upper Peaks | 100–119 | `[2400, 2800)` | 1,060,000 | 0 |
| High Peaks | 120–139 | `[2800, 3300)` | 1,460,000 | 890,000 |
| Deepest Frontier | 140–150 | `[3300, 3750)` | 1,305,000 | 1,305,000 |

Every Winter node and monster is constrained to the band matching its canonical level. Every level-140–150 Winter spawn is in the southern Deepest Frontier. All 23 Runite nodes use the approved Desert side of the Desert/Evil boundary; the source v1 coordinates and tables remain unchanged.

## Reachability and resource loops

[`reachability-report.json`](./reachability-report.json) evaluates the actual collision geometry plus every v2 resource-node collision disc. Each of the 152 clusters must reach an eligible counterpart cluster and a smelt → forge → bank service chain. The overall cluster counterpart median/p90 is 5.80/18.89 seconds; the station-and-bank median/p90 is 18.12/26.01 seconds.

The 15–30 second node/monster target is treated as a design target, not an excuse to spread nearby resources artificially. A tier is `pass_compact` when all routes are reachable and its p90 is at most 30 seconds, but some routes are naturally under 15 seconds.

| Tier | Level | Primary node | Primary monster | Pair median | Pair p90 | Result |
|---:|---:|---|---|---:|---:|---|
| 1 | 1 | Copper | Chicken | 4.02s | 4.89s | Pass (compact) |
| 2 | 10 | Copper | Goblin Brute | 13.33s | 23.10s | Pass (compact) |
| 3 | 20 | Iron | Ironback Boar | 2.10s | 3.20s | Pass (compact) |
| 4 | 30 | Coal Seam | Forest Boar | 7.57s | 9.41s | Pass (compact) |
| 5 | 40 | Mithril | Dust Jackal | 1.97s | 8.19s | Pass (compact) |
| 6 | 50 | Sunstone Vein | Desert Raider | 2.90s | 4.39s | Pass (compact) |
| 7 | 60 | Runite | Withered Ghoul | 10.20s | 14.99s | Pass (compact) |
| 8 | 70 | Cursed Rock | Cursed Knight | 2.10s | 7.20s | Pass (compact) |
| 9 | 80 | Frost Crystal Vein | Frost Troll | 3.02s | 3.02s | Pass (compact) |
| 10 | 90 | Frost Crystal Vein | Ice Wraith | 4.33s | 8.59s | Pass (compact) |
| 11 | 100 | Glacial Vein | Frost Revenant | 2.72s | 7.06s | Pass (compact) |
| 12 | 110 | Starsteel Vein | Frost Giant | 4.38s | 4.38s | Pass (compact) |
| 13 | 120 | Voidsteel Vein | Wyrm Knight | 1.92s | 5.06s | Pass (compact) |
| 14 | 130 | Wyrmforged Vein | Void Wraith | 1.67s | 13.45s | Pass (compact) |
| 15 | 140 | Ancient Vein | Void Wraith | 2.28s | 12.86s | Pass (compact) |
| 16 | 150 | Ascendant Vein | Ascendant Wyrm | 0.92s | 7.38s | Pass (compact) |

The model expands the real weapon recipes, resolves node and monster producers, accounts for shared node charges, node and monster respawn cycles, trophy probabilities, incidental loot, and the 20-slot bag. All evaluated samples pass bag capacity. The report preserves five intentional cross-biome exceptions: Bronze Fields/Forest, Runite's inherited Ghoul trophy, Shadowsteel's Desert/Evil boundary, and the inherited Froststeel and Wyrmsteel chains.

## Server contract

The generated migration [`20260824100000_gate7_versioned_world.sql`](../../../supabase/migrations/20260824100000_gate7_versioned_world.sql) is additive and refuses to run unless v2 is still staged and no activation-control row exists.

- `game_world_spawn_sets` stores the reviewed model, geometry, hashes, and reachability summary.
- `game_world_nodes` and `game_world_monsters` use UUID primary keys and composite foreign keys to the canonical versioned spawn definitions.
- Database checks bind each 700×500 subscription cell to its coordinate.
- RLS exposes only the active content/spawn versions. Staged v2 rows are invisible to authenticated clients while v1 is active.
- `harvest_node_v2(uuid, x, y)` and `attack_monster_v2(uuid, x, y)` are row-locked, server-authoritative, release-guarded, and scoped to both active versions.
- The monster RPC evaluates every canonical loot rule rather than assuming one drop.
- Anonymous execution and direct player writes to world state are denied.
- Legacy integer tables and RPC dispatchers remain untouched and fail closed if v2 is transactionally selected.

The database test simulates activation inside a transaction to prove that all 730 rows become visible under v2, then rolls the entire test back. It performs no production write.

## Deterministic commands

```sh
bun run gate7:build
bun run gate7:check
bun run test:gate7
supabase test db supabase/tests/gate7_versioned_world.sql
```

`gate7:check` also locks the SHA-256 of the Gate 4, Gate 5, and Gate 6 migrations, regenerates all Gate 7 artifacts in check mode, re-derives stable UUIDs and the 90/10 result, verifies exact state/geometry/cells/rollback evidence, and rejects activation statements or external database targets.

## Rollback boundary

Gate 7 adds staged v2 rows only. Rolling back before any later approved cutover means continuing to select v1; the legacy 311 nodes, 289 monsters, integer RPCs, and all 20 Tungsten nodes are still present. Player saves are not migrated or mutated by this gate.

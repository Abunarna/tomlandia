# Repository ↔ Live V2 Reconciliation Report

Canonical identity (verified by `scripts/identity/check.mjs`):

- Lovable project ID: `10d00f6b-da27-43c4-a205-c0b7841a64fc`
- Supabase project ref: `fhelsfnbvrmnxuynyoqu`
- Production URL: `https://tomlandia.lovable.app`

Production was **not** activated, published, reset, or written to at any point.
All reads were `SELECT`-only. Control plane stayed `v2` / `v2`, maintenance off.

## Root cause

The live V2 release was generated at commit `4ce6890` ("Lock separate v1 world
authorities", built on `7d916e8` "Implement deterministic Gate 7 world").

At a later commit (`e4bc5ad`, "Complete UUID V2 runtime cutover") the content
generators were re-run **after** `src/game/data.ts` and `src/game/city.ts` had
been changed by gameplay work (southern world extension, lake/river geometry,
landmark collision, spawn clearance). Because the Gate 5/7 generators read the
mutable runtime world source, re-running them re-rolled every rejection-sampled
placement. The regenerated artifacts — and, critically, the **already-applied**
Gate 6 and Gate 7 migration files — were overwritten in place with the new
`a0d654a9` / `9d1bc1c2` release. Production still held the original
`8b2b3877` / `24130e87` release, so the repository no longer described production.

## Recovered / changed files

Restored byte-for-byte from commit `4ce6890` (the build that produced live):

| file | restored sha256 (first 8) |
| --- | --- |
| `supabase/migrations/20260824090000_gate6_inactive_server_content.sql` | `14182078` |
| `supabase/migrations/20260824100000_gate7_versioned_world.sql` | `190d39ea` |
| `supabase/generated/content-manifest.sql` | `0b5f6764` |
| `content/v2/manifest.authoring.json` | `c227c24e` |
| `content/v2/new-spawn-placements.json` | `a09d2246` |
| `content/v2/world-spawn-manifest.json` | `bdacb822` |
| `content/generated/spawn-manifest.json` | `e781f483` |
| `content/generated/dependency-graph.json` | `8affce26` |
| `docs/overhaul/gate-5/live-v1-snapshot.json` | `053650b3`* |
| `docs/overhaul/gate-5/live-v1-spawns.json` | `9e1c409a`* |
| `docs/overhaul/gate-5/content-summary.json` | `5c94ec13` |
| `docs/overhaul/gate-7/reachability-report.json` | `e23d5794` |
| `docs/overhaul/gate-7/README.md` | — |
| `src/generated/content-manifest.ts` | `e52a77db` |
| `scripts/gate7/check.mjs` | restored counts 730 / 369 / 152 / 436 |
| `scripts/gate6/check.mjs` | expected manifest hash restored to `8b2b3877…` |
| `tests/content/gate5-complete-content.test.mjs` | `node_spawns: 369` |

`*` the two snapshot files now differ from `4ce6890` in exactly one provenance
field (`source_file`), which points at the frozen source below. All payload
content is identical.

New files:

- `content/v2/frozen/data.ts` — byte-identical copy of `src/game/data.ts` at the
  V2 cut, sha256 `0babb7e09063dbe1d7973c8ec6e584df38f1fa362312df72baf12f8f8c16cf8f`
- `content/v2/frozen/city.ts` — byte-identical copy of `src/game/city.ts` at the
  V2 cut, sha256 `49e00aeef143d77c05448c48b4dda066c8440ddb724eb2a053c3270bfde1f4e5`
- `content/v2/frozen/types.ts` — type-only re-export so `data.ts` stays byte-identical
- `content/v2/frozen/README.md` — freeze policy
- `scripts/identity/check.mjs` — canonical identity guard
- `docs/overhaul/reconciliation/v2-live-reconciliation.md` — this report

Generators repointed from mutable `src/game/data.ts` to the frozen V2-cut source:
`scripts/gate5/snapshot-live.mjs`, `scripts/gate5/snapshot-live-spawns.mjs`,
`scripts/gate5/build-new-spawns.mjs`, `scripts/gate5/check-world-spawns.mjs`,
`scripts/gate7/build-world.mjs`, `scripts/gate7/reachability.mjs`,
`scripts/gate7/terrain-collision.mjs`, `scripts/gate7/world-model.mjs`.

`package.json` gains `identity:check` and `reconcile:check`.

## Before / after

| artifact | before (repo) | after (repo) | live |
| --- | --- | --- | --- |
| content manifest hash | `a0d654a9…1cff77` | `8b2b3877…f76ee9` | `8b2b3877…f76ee9` |
| spawn hash | `9d1bc1c2…cdc9e0` | `24130e87…2d31fa` | `24130e87…2d31fa` |
| node spawns | 368 | 369 | 369 |
| monster spawns | 361 | 361 | 361 |
| total spawns | 729 | 730 | 730 |
| clusters | 142 | 152 | 152 |
| items | 174 | 174 | 174 |
| recipes | 108 | 108 | 108 |
| node defs | 27 | 27 | 27 |
| monster defs | 32 | 32 | 32 |
| quests | 8 | 8 | 8 |
| carry-forward / generated | 435 / 294 | 436 / 294 | — |

Row-level proof: all 730 `game_content_spawns` rows for `v2` compare equal on
`(entity_type, spawn_id, kind, ordinal, biome, subzone, x, y)` — 0 rows only in
live, 0 rows only in the repo. Items, recipes, node defs, monster defs and quests
also compare equal on their key fields.

### Willowbrook Maple verification

Present in the reconciled repo artifact and identical to live:

```
spawn_id  44b4276c-cae1-5190-89fc-9cb28f4fc53d
kind      maple      ordinal 11
biome     forest     subzone willowbrook_wilds
x 1534    y 461
cluster   node:maple:willowbrook_wilds:01   selection carry_forward
```

## Migration-ledger findings

`supabase_migrations.schema_migrations` ends at `20260820065717`. The ten later
repository migrations (`20260823234500` … `20260827150500`) are **absent from the
ledger although their effects are live** — they were applied out of band.

Verified against the live schema/data:

- Gate 6 (`20260824090000`) — live content rows match its embedded manifest `8b2b3877…`
- Gate 7 (`20260824100000`) — live `game_content_spawns` (730 rows), spawn set row
  (`spawn_hash 24130e87…`, model `tomlandia-gate7-world-model/v1`, 5600×3750,
  speed 130, cell 40, cluster probability 0.9), and its legacy guard values
  (234 v1 nodes, 170 v1 monsters, 17 Tungsten) all match live exactly.

No ledger rows were inserted. Marking them applied would require matching the
ledger's stored statement checksums, which cannot be verified from here, so per
the reconciliation rules this is documented rather than back-filled. The safe
forward option, if you want it, is a separate provenance table recording
`filename → sha256 → verified-effects` rather than touching `schema_migrations`.

## Commands and results

| command | result |
| --- | --- |
| `bun run identity:check` | PASS |
| `bun run content:check` | PASS (`8b2b3877…`) |
| `bun run test:content` | PASS |
| `bun run typecheck` | PASS (0 errors) |
| `bun run test` (unit + static) | PASS — 17 unit tests, Gate 1 (26 RPCs / 49 migrations), Gate 2 authority |
| `bun run gate3:check` | PASS |
| `bun run gate5:check` | PASS (10 check groups) |
| `bun run gate6:check` | PASS |
| `bun run gate7:check` | PASS — 730 spawns, 152 clusters, hash `24130e87…` |
| `bun run gate8:check` | PASS |
| `bun run reconcile:check` | PASS (all of the above in one run) |
| `bun run gate5:build && gate6:build && gate7:build` then re-check | PASS — clean regeneration, zero artifact drift, migrations reproduce byte-identically (`190d39ea…`) |
| `bun run build` | PASS |

## Production untouched

| item | value |
| --- | --- |
| `game_content_control.active_content_version` | `v2` |
| `game_content_control.active_spawn_set_version` | `v2` |
| `game_content_control.manifest_hash` | `8b2b3877…f76ee9` |
| `maintenance_mode` | `false` |
| `player_saves` | 21 (unchanged) |
| `market_listings` | 18 (unchanged) |

## Rollback target

The verified current production release **`v2` / `v2`** is the rollback target.
Its content rows, 730 spawn rows, spawn-set row, hashes, client compatibility
(`minimum_client_content_version = v2`) and control-plane values are intact and
now exactly reproducible from this repository.

There is **no `v1` content-version row** in `game_content_versions`; V1 is not an
available content-layer rollback target and none was fabricated.

# Gate 4 — canonical content contract

Status: implemented on `codex/gate-4-canonical-schema`; not activated.

## Safety boundary

Gate 4 creates the contract and inactive storage required by later gates. It does **not**:

- write to the production database;
- insert or activate a v2 content version;
- create an active runtime-control row;
- change any player save, inventory, listing, quest or world row;
- publish the game or merge to `main`;
- use the Lovable agent.

The existing v1 definition tables remain untouched. New versioned canonical tables sit beside them. This is intentionally additive: Gate 6 can stage complete v2 rows without making current v1 RPCs read duplicate in-place IDs, while v1 data remains available for rollback.

## One source and four generated outputs

The canonical authoring source is [`content/v2/manifest.authoring.json`](../../../content/v2/manifest.authoring.json). Its machine-readable structure is [`content/schema/manifest.schema.json`](../../../content/schema/manifest.schema.json), with semantic and cross-reference checks in `scripts/content/model.mjs`.

Gate 4 keeps the canonical file at `lifecycle: draft` because Gate 5 owns the complete values. Runtime generation from that draft throws. Its generated SQL also raises unconditionally if somebody tries to apply it.

The generator deterministically produces:

| Output | Purpose |
|---|---|
| `src/generated/content-manifest.ts` | Locked literal IDs, tier pairs, manifest hash and visible unknown-ID assertions. |
| `supabase/generated/content-manifest.sql` | Generated SQL contract. While the manifest is draft, it is a hard non-runnable guard. |
| `content/generated/dependency-graph.json` | Normalized entity/reference graph for closed-world checks. |
| `content/generated/spawn-manifest.json` | Versioned spawn rows with deterministic UUIDv5 identities. |

All four contain the same canonical SHA-256. `node scripts/content/generate.mjs --check` compares bytes, so a manual edit to any generated file fails CI.

## Runtime rejection rules

A runtime manifest is rejected before generation if it contains any of the following:

- `TBD`, `TODO`, placeholder text, null or a non-finite number;
- a duplicate item, recipe, node, monster, fish, quest, boss, migration or spawn identity;
- an unknown, inactive or dangling item/monster/node/fish reference;
- an invalid content ID, colour, enum, quantity, chance, duration, stat or coordinate;
- a `tier_index` / `level_requirement` pair that differs from the locked 16-tier registry;
- a renamed locked tier theme;
- a recipe ID that is not `{station}_{output_item_id}`;
- stackable gear, gear without an equip skill, or missing required food/potion/gear stats;
- a spawn without explicit biome, sub-zone, spawn-set ownership and stable ordinal.

The complete test fixture exercises the runtime path without becoming game content. Its SQL is applied only to an isolated disposable Supabase database in CI.

## Database contract

Migration `20260824070000_gate4_content_contract.sql` adds:

- version, hash, status and single-active-version control tables;
- locked tier/palette rows;
- versioned item, recipe/input, node, monster/loot, fish/spot, quest, boss and migration-rule tables;
- explicit monster levels and recipe stations;
- unified stable UUID spawn rows with content version, spawn-set, biome and sub-zone ownership;
- ordinary foreign keys for direct references plus a deferred validator for polymorphic and JSON references;
- activation triggers that refuse an incomplete version or a mismatched version/spawn/hash control row;
- RLS that exposes only the version selected by the active control row;
- `content_version` on market listings, trades and prices, with the price key changed to `(content_version, item_id, plus)`.

All historical market rows become `v1`. The current market settlement propagates that version and fails closed if it encounters a staged v2 listing; the later v2 action cutover will replace that temporary compatibility boundary.

## Evidence commands

```sh
node scripts/content/generate.mjs --check
node scripts/content/check.mjs
node --test tests/content/manifest-contract.test.mjs
bun run test:gate4
supabase test db supabase/tests/gate4_content_contract.sql
```

Gate 4 CI also rebuilds the database from migration zero, runs the inherited Gate 1 and Gate 2 suites, generates a complete closed runtime fixture, applies the generated SQL to the disposable database, and verifies that it is valid but still `staged` with no active control row.

## Gate 5 hand-off

Gate 5 replaces the draft inventory with complete records for every item, recipe, node, monster, fish, quest, boss, migration rule and spawn source. It must use the approved Gate 3 numeric model and may switch the authoring file to `lifecycle: runtime` only when all fields and references are complete. Activation remains forbidden until the later rehearsal and cutover gates.

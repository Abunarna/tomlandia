/**
 * Forward-only V4 migrations, generated from the V4 artifacts.
 *
 *   1. stage content — v4 rows in the content tables, status 'staged'
 *      (verbatim copy of artifacts/v4/supabase/generated/content-manifest.sql)
 *   2. stage world   — v4 spawn set, spawns and world node/monster rows
 *   3. activate      — validate, carry player holdings across the armour
 *                      retirements, flip v4 to 'active', retire v3
 *
 * The V4 world is byte-identical in geometry to the live V3 world: the armour
 * overhaul changes item, recipe and loot definitions only. The world staging
 * step therefore copies the v3 spawn and world rows under the v4 labels, and
 * asserts the copy reproduces the committed artifact digests exactly.
 *
 * Nothing here deletes v3 content rows, so release rollback stays a control-row
 * flip. Rollback does not restore the deleted tester-era item holdings.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DELETED_ITEMS } from "./model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const checkOnly = process.argv.includes("--check");
const VERSION = "v4";
const PREVIOUS = "v3";
const RUN_ID = "v4-armour-overhaul-20260831";
const UUID_NAMESPACE = "bf50882c-ad8a-57ab-bb73-3ea3dd8fcb5c";

const paths = {
  contentSql: resolve(root, "artifacts/v4/supabase/generated/content-manifest.sql"),
  world: resolve(root, "content/v4/world-spawn-manifest.json"),
  previousWorld: resolve(root, "content/v3/world-spawn-manifest.json"),
  stageContent: resolve(root, "supabase/migrations/20260831120000_v4_stage_content.sql"),
  stageWorld: resolve(root, "supabase/migrations/20260831120100_v4_stage_world.sql"),
  activate: resolve(root, "supabase/migrations/20260831120200_v4_activate.sql"),
};

const [contentSql, worldText, previousWorldText] = await Promise.all([
  readFile(paths.contentSql, "utf8"),
  readFile(paths.world, "utf8"),
  readFile(paths.previousWorld, "utf8"),
]);
const world = JSON.parse(worldText);
const previousWorld = JSON.parse(previousWorldText);

if (world.content_version !== VERSION) throw new Error("World manifest is not v4");
const contentHash = world.source_content_manifest_hash;
if (!contentSql.includes(`Manifest SHA-256: ${contentHash}`)) {
  throw new Error("Generated content SQL hash does not match the v4 manifest");
}
if (!contentSql.includes(`Content version: ${VERSION}`)) {
  throw new Error("Generated content SQL is not the v4 cut");
}

// The armour overhaul must not move a single spawn. Prove it before emitting.
const key = (spawn) => `${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`;
const previousById = new Map(previousWorld.spawns.map((spawn) => [key(spawn), spawn]));
if (previousById.size !== world.spawns.length) throw new Error("v3/v4 spawn counts differ");
for (const spawn of world.spawns) {
  const previous = previousById.get(key(spawn));
  if (!previous) throw new Error(`v4 spawn ${key(spawn)} has no v3 counterpart`);
  if (previous.x !== spawn.x || previous.y !== spawn.y || previous.biome !== spawn.biome || previous.subzone !== spawn.subzone) {
    throw new Error(`v4 relocated ${key(spawn)}; the armour overhaul must not move spawns`);
  }
}

const md5 = (value) => createHash("md5").update(value).digest("hex");
const num = (value) => String(Number(value));
const bySpawnId = [...world.spawns].sort((left, right) => (left.spawn_id < right.spawn_id ? -1 : 1));
const spawnDigest = md5(
  bySpawnId
    .map((s) => `${s.spawn_id}:${s.entity_type}:${s.kind}:${s.ordinal}:${num(s.x)}:${num(s.y)}:${s.biome}:${s.subzone}`)
    .join(","),
);
const nodeDigest = md5(
  bySpawnId
    .filter((s) => s.entity_type === "node")
    .map((s) => `${s.spawn_id}:${s.kind}:${s.cell}:${num(s.x)}:${num(s.y)}:${s.max_charges}:${num(s.gather_s)}:${s.respawn_s}`)
    .join(","),
);
const monsterDigest = md5(
  bySpawnId
    .filter((s) => s.entity_type === "monster")
    .map((s) => `${s.spawn_id}:${s.kind}:${s.cell}:${num(s.x)}:${num(s.y)}:${s.max_hp}:${s.respawn_s}`)
    .join(","),
);

const spawnCount = world.spawns.length;
const nodeCount = world.counts.nodes;
const monsterCount = world.counts.monsters;
const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sqlJson = (value) => `${sqlText(JSON.stringify(value))}::jsonb`;
const set = world.spawn_set ?? world;

// ---- 1. stage content ------------------------------------------------------
// The v4 catalogue is the live v3 catalogue plus an enumerated armour delta, so
// the migration copies the v3 content rows inside the database and then applies
// only the changed rows, taken verbatim from the generated artifact. This keeps
// the migration small and makes every carried-over value provably identical to
// the live release. The delta is proved exhaustive at build time below.
const v3Manifest = JSON.parse(await readFile(resolve(root, "content/v3/manifest.authoring.json"), "utf8")).runtime;
const v4Manifest = JSON.parse(await readFile(resolve(root, "content/v4/manifest.authoring.json"), "utf8")).runtime;
const stable = (value) => JSON.stringify(value);

const deletedIds = DELETED_ITEMS;
const armourIds = v4Manifest.items.filter((item) => item.kind === "armor").map((item) => item.id).sort();
const trophyIds = v4Manifest.items
  .filter((item) => !v3Manifest.items.some((prev) => prev.id === item.id) && item.kind !== "armor")
  .map((item) => item.id)
  .sort();
const itemDelta = [...new Set([...deletedIds, ...armourIds, ...trophyIds])].sort();
const recipeDelta = [
  ...new Set([
    ...v3Manifest.recipes.filter((r) => !v4Manifest.recipes.some((x) => x.id === r.id)).map((r) => r.id),
    ...v4Manifest.recipes.filter((r) => r.station === "armor").map((r) => r.id),
  ]),
].sort();
const lootDelta = v4Manifest.monsters
  .filter((m) => stable(m.loot ?? []) !== stable(v3Manifest.monsters.find((x) => x.kind === m.kind)?.loot ?? []))
  .map((m) => m.kind)
  .sort();

// Build-time proof that the delta above is exhaustive: everything outside it is
// byte-identical to v3, so copying the v3 rows is exact.
const withoutLoot = ({ loot, ...rest }) => rest;
const sameOutside = (list3, list4, key, skip) => {
  const a = list3.filter((row) => !skip.includes(row[key])).sort((l, r) => (l[key] < r[key] ? -1 : 1));
  const b = list4.filter((row) => !skip.includes(row[key])).sort((l, r) => (l[key] < r[key] ? -1 : 1));
  return stable(a) === stable(b);
};
if (!sameOutside(v3Manifest.items, v4Manifest.items, "id", itemDelta)) {
  throw new Error("v4 changes an item outside the enumerated delta");
}
if (!sameOutside(v3Manifest.recipes, v4Manifest.recipes, "id", recipeDelta)) {
  throw new Error("v4 changes a recipe outside the enumerated delta");
}
if (!sameOutside(v3Manifest.monsters.map(withoutLoot), v4Manifest.monsters.map(withoutLoot), "kind", [])) {
  throw new Error("v4 changes a monster definition, which the armour overhaul must not do");
}
if (!sameOutside(v3Manifest.monsters, v4Manifest.monsters, "kind", lootDelta)) {
  throw new Error("v4 changes monster loot outside the enumerated delta");
}
for (const table of ["tiers", "nodes", "fish", "fishing_spots", "quests", "bosses", "progression_levels"]) {
  if (stable(v3Manifest[table]) !== stable(v4Manifest[table])) {
    throw new Error(`v4 changes ${table}, which the armour overhaul must not do`);
  }
}

// Verbatim row extraction from the generated artifact.
const sqlLines = contentSql.split("\n");
const blockRows = (header) => {
  const start = sqlLines.findIndex((line) => line.startsWith(header));
  if (start < 0) throw new Error(`generated SQL has no ${header} block`);
  let index = start;
  while (index < sqlLines.length && !sqlLines[index].startsWith("  ('v4'")) index += 1;
  const rows = [];
  for (; index < sqlLines.length; index += 1) {
    const line = sqlLines[index];
    if (!line.startsWith("  ('v4'")) break;
    rows.push(line.trim().replace(/[,;]$/, ""));
  }
  if (!rows.length) throw new Error(`generated SQL block ${header} is empty`);
  return rows;
};
const field = (row, index) => row.split(", ")[index].replace(/^'|'$/g, "");
const keep = (rows, index, ids) => rows.filter((row) => ids.includes(field(row, index)));
const values = (rows) => rows.join(",\n  ");

const itemRows = blockRows("INSERT INTO public.game_content_items");
const recipeRows = blockRows("INSERT INTO public.game_content_recipes");
const inputRows = blockRows("INSERT INTO public.game_content_recipe_inputs");
const lootRows = blockRows("INSERT INTO public.game_content_monster_loot");
const ruleRows = blockRows("INSERT INTO public.game_content_migration_rules");
const versionStart = sqlLines.findIndex((line) => line.startsWith("INSERT INTO public.game_content_versions"));
const versionBlock = sqlLines.slice(versionStart, versionStart + 4).join("\n");
if (!versionBlock.includes("ON CONFLICT")) throw new Error("could not extract the v4 version row");

const newItemRows = keep(itemRows, 1, [...armourIds, ...trophyIds]);
const newRecipeRows = keep(recipeRows, 1, recipeDelta);
const newInputRows = keep(inputRows, 1, recipeDelta);
const newLootRows = keep(lootRows, 1, lootDelta);
if (newItemRows.length !== armourIds.length + trophyIds.length) throw new Error("armour/trophy item extraction is incomplete");
if (newRecipeRows.length !== v4Manifest.recipes.filter((r) => r.station === "armor").length) {
  throw new Error("armour recipe extraction is incomplete");
}
if (ruleRows.length !== v4Manifest.migration_rules.length) throw new Error("migration rule extraction is incomplete");

const list = (ids) => ids.map((id) => `'${id}'`).join(", ");
const inputCount = v4Manifest.recipes.reduce((total, recipe) => total + recipe.inputs.length, 0);
const copyTables = [
  "game_content_tiers",
  "game_content_items",
  "game_content_recipes",
  "game_content_recipe_inputs",
  "game_content_nodes",
  "game_content_monsters",
  "game_content_monster_loot",
  "game_content_fish",
  "game_content_fishing_spots",
  "game_content_quests",
  "game_content_bosses",
  "game_content_progression_levels",
];
const versionLiteral = "'" + VERSION + "'";
const quotedVersionLiteral = "'''" + VERSION + "'''";

const stageContent = `-- V4 armour overhaul, step 1/3: stage the v4 content (inactive).
--
-- GENERATED by scripts/v4/build-migrations.mjs from
-- artifacts/v4/supabase/generated/content-manifest.sql. Do not edit directly.
-- Content manifest sha256: ${contentHash}
--
-- v4 = live v3 content plus an enumerated armour delta. Every unchanged row is
-- copied from v3 inside the database, so it cannot drift; the changed rows are
-- inserted verbatim from the generated artifact:
--   * ${deletedIds.length} superseded tester-era item ids deleted
--   * ${armourIds.length} armour items re-stated, ${trophyIds.length} new trophies added
--   * ${newRecipeRows.length} armour recipes re-cut onto one ingredient matrix
--   * ${lootDelta.length} monster loot tables gain a tier trophy
-- v1, v2 and v3 rows are left untouched, so rollback stays a control-row flip.

BEGIN;

DO $v4_stage_content_guard$
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V4 staging expects ${PREVIOUS} to be the active release';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_versions WHERE content_version = '${VERSION}' AND status = 'active') THEN
    RAISE EXCEPTION 'V4 is already active; staging must not run again';
  END IF;
END
$v4_stage_content_guard$;

${versionBlock}

DO $v4_copy_content$
DECLARE
  target text;
  column_list text;
  projection text;
  copied bigint;
  expected bigint;
BEGIN
  FOREACH target IN ARRAY ARRAY[${copyTables.map((name) => `'${name}'`).join(", ")}] LOOP
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum),
           string_agg(CASE WHEN attname = 'content_version' THEN ${quotedVersionLiteral}
                           ELSE quote_ident(attname) END, ', ' ORDER BY attnum)
      INTO column_list, projection
    FROM pg_attribute
    WHERE attrelid = format('public.%I', target)::regclass AND attnum > 0 AND NOT attisdropped;

    EXECUTE format('DELETE FROM public.%I WHERE content_version = %L', target, ${versionLiteral});
    EXECUTE format(
      'INSERT INTO public.%I (%s) SELECT %s FROM public.%I WHERE content_version = %L',
      target, column_list, projection, target, ${"'" + PREVIOUS + "'"});

    EXECUTE format('SELECT count(*) FROM public.%I WHERE content_version = %L', target, ${versionLiteral}) INTO copied;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE content_version = %L', target, ${"'" + PREVIOUS + "'"}) INTO expected;
    IF copied <> expected OR expected = 0 THEN
      RAISE EXCEPTION 'V4 copy of % is incomplete (% of %)', target, copied, expected;
    END IF;
  END LOOP;
END
$v4_copy_content$;

-- ---------------------------------------------------------------------------
-- Armour delta. Deletions first, then the re-stated definitions.
-- ---------------------------------------------------------------------------
DELETE FROM public.game_content_recipe_inputs
WHERE content_version = '${VERSION}' AND recipe_id IN (${list(recipeDelta)});
DELETE FROM public.game_content_recipes
WHERE content_version = '${VERSION}' AND id IN (${list(recipeDelta)});
DELETE FROM public.game_content_monster_loot
WHERE content_version = '${VERSION}' AND monster_kind IN (${list(lootDelta)});
DELETE FROM public.game_content_items
WHERE content_version = '${VERSION}' AND id IN (${list(itemDelta)});
DELETE FROM public.game_content_migration_rules WHERE content_version = '${VERSION}';

INSERT INTO public.game_content_items
  (content_version, id, name, active, tier_index, level_requirement, kind, family, icon_key, colour, rarity, tradable, stackable, value, equip_skill, attack, defense, heal, speed, dmg_boost, boost_hits)
VALUES
  ${values(newItemRows)};

INSERT INTO public.game_content_recipes
  (content_version, id, active, tier_index, level_requirement, station, skill, output_item_id, output_qty, xp, time_s)
VALUES
  ${values(newRecipeRows)};

INSERT INTO public.game_content_recipe_inputs (content_version, recipe_id, item_id, qty)
VALUES
  ${values(newInputRows)};

INSERT INTO public.game_content_monster_loot
  (content_version, monster_kind, ordinal, item_id, chance, qty_min, qty_max, channel, xp)
VALUES
  ${values(newLootRows)};

INSERT INTO public.game_content_migration_rules
  (content_version, from_id, action, to_id, captured_value_required, notice_key, equipped_action, unequipped_action)
VALUES
  ${values(ruleRows)};

DO $v4_stage_content_exit$
BEGIN
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${VERSION}') <> 'staged' THEN
    RAISE EXCEPTION 'V4 content must remain staged after step 1';
  END IF;
  IF (SELECT manifest_hash FROM public.game_content_versions WHERE content_version = '${VERSION}') <> '${contentHash}' THEN
    RAISE EXCEPTION 'V4 manifest hash was not recorded';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${VERSION}') <> ${v4Manifest.items.length} THEN
    RAISE EXCEPTION 'V4 must stage exactly ${v4Manifest.items.length} items';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${VERSION}' AND kind = 'armor') <> ${armourIds.length} THEN
    RAISE EXCEPTION 'V4 must stage exactly ${armourIds.length} armour items';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipes WHERE content_version = '${VERSION}') <> ${v4Manifest.recipes.length} THEN
    RAISE EXCEPTION 'V4 must stage exactly ${v4Manifest.recipes.length} recipes';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipe_inputs WHERE content_version = '${VERSION}') <> ${inputCount} THEN
    RAISE EXCEPTION 'V4 recipe inputs are incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_items WHERE content_version = '${VERSION}' AND id IN (${list(deletedIds)})) THEN
    RAISE EXCEPTION 'V4 still stages a deleted tester item id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.game_content_recipe_inputs
    WHERE content_version = '${VERSION}'
      AND item_id NOT IN (SELECT id FROM public.game_content_items WHERE content_version = '${VERSION}')
  ) OR EXISTS (
    SELECT 1 FROM public.game_content_recipes
    WHERE content_version = '${VERSION}'
      AND output_item_id NOT IN (SELECT id FROM public.game_content_items WHERE content_version = '${VERSION}')
  ) THEN
    RAISE EXCEPTION 'A staged V4 recipe references an item v4 does not define';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${PREVIOUS}') <> ${v3Manifest.items.length} THEN
    RAISE EXCEPTION 'V4 staging modified the ${PREVIOUS} catalogue';
  END IF;
END
$v4_stage_content_exit$;

COMMIT;
`;

// ---- 2. stage world --------------------------------------------------------
const stageWorld = `-- V4 armour overhaul, step 2/3: stage the v4 world (inactive).
--
-- GENERATED by scripts/v4/build-migrations.mjs. Do not edit this file directly.
-- Stable spawn payload sha256: ${world.spawn_hash}
-- ${nodeCount} nodes, ${monsterCount} monsters, 0 relocated from ${PREVIOUS}:
-- the armour overhaul changes definitions only, never world geometry.

BEGIN;

DO $v4_stage_world_guard$
BEGIN
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${VERSION}') <> 'staged' THEN
    RAISE EXCEPTION 'V4 world staging requires staged v4 content';
  END IF;
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V4 world staging expects ${PREVIOUS} to be the active release';
  END IF;
END
$v4_stage_world_guard$;

INSERT INTO public.game_world_spawn_sets
  (content_version, spawn_set_version, source_content_manifest_hash, spawn_hash, model_version,
   cluster_probability, world_width, world_height, movement_speed, path_cell_size,
   winter_geometry, reachability_summary)
SELECT '${VERSION}', '${VERSION}', ${sqlText(contentHash)}, ${sqlText(world.spawn_hash)}, model_version,
       cluster_probability, world_width, world_height, movement_speed, path_cell_size,
       winter_geometry, reachability_summary
FROM public.game_world_spawn_sets
WHERE content_version = '${PREVIOUS}' AND spawn_set_version = '${PREVIOUS}'
ON CONFLICT (content_version, spawn_set_version) DO UPDATE SET
  source_content_manifest_hash = EXCLUDED.source_content_manifest_hash,
  spawn_hash = EXCLUDED.spawn_hash;

DELETE FROM public.game_world_nodes WHERE content_version = '${VERSION}';
DELETE FROM public.game_world_monsters WHERE content_version = '${VERSION}';
DELETE FROM public.game_content_spawns WHERE content_version = '${VERSION}';

-- Spawn identities carry forward unchanged; only the UUID namespace input
-- changes (${PREVIOUS}:... -> ${VERSION}:...), exactly as the artifact encodes.
INSERT INTO public.game_content_spawns
  (spawn_id, content_version, spawn_set_version, entity_type, kind, ordinal, active, biome, subzone, x, y)
SELECT extensions.uuid_generate_v5(
         '${UUID_NAMESPACE}'::uuid,
         '${VERSION}' || ':' || entity_type || ':' || kind || ':' || ordinal),
       '${VERSION}', '${VERSION}', entity_type, kind, ordinal, active, biome, subzone, x, y
FROM public.game_content_spawns
WHERE content_version = '${PREVIOUS}';

INSERT INTO public.game_world_nodes
  (spawn_id, content_version, spawn_set_version, entity_type, kind, cell, biome, subzone, x, y,
   charges, max_charges, gather_s, respawn_s)
SELECT spawn.spawn_id, '${VERSION}', '${VERSION}', 'node', spawn.kind, previous_world.cell, spawn.biome, spawn.subzone,
       spawn.x, spawn.y, definition.max_charges, definition.max_charges, definition.gather_s, definition.respawn_s
FROM public.game_content_spawns AS spawn
JOIN public.game_content_nodes AS definition ON definition.content_version = '${VERSION}' AND definition.kind = spawn.kind
JOIN public.game_content_spawns AS previous ON previous.content_version = '${PREVIOUS}'
  AND previous.entity_type = spawn.entity_type AND previous.kind = spawn.kind AND previous.ordinal = spawn.ordinal
JOIN public.game_world_nodes AS previous_world ON previous_world.spawn_id = previous.spawn_id
WHERE spawn.content_version = '${VERSION}' AND spawn.entity_type = 'node';

INSERT INTO public.game_world_monsters
  (spawn_id, content_version, spawn_set_version, entity_type, kind, cell, biome, subzone, x, y, hp, max_hp, respawn_s)
SELECT spawn.spawn_id, '${VERSION}', '${VERSION}', 'monster', spawn.kind, previous_world.cell, spawn.biome, spawn.subzone,
       spawn.x, spawn.y, definition.hp, definition.hp, definition.respawn_s
FROM public.game_content_spawns AS spawn
JOIN public.game_content_monsters AS definition ON definition.content_version = '${VERSION}' AND definition.kind = spawn.kind
JOIN public.game_content_spawns AS previous ON previous.content_version = '${PREVIOUS}'
  AND previous.entity_type = spawn.entity_type AND previous.kind = spawn.kind AND previous.ordinal = spawn.ordinal
JOIN public.game_world_monsters AS previous_world ON previous_world.spawn_id = previous.spawn_id
WHERE spawn.content_version = '${VERSION}' AND spawn.entity_type = 'monster';

DO $v4_stage_world_exit$
DECLARE
  digest text;
BEGIN
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${VERSION}') <> ${spawnCount} THEN
    RAISE EXCEPTION 'V4 spawn set is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_world_nodes WHERE content_version = '${VERSION}') <> ${nodeCount} THEN
    RAISE EXCEPTION 'V4 node state is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_world_monsters WHERE content_version = '${VERSION}') <> ${monsterCount} THEN
    RAISE EXCEPTION 'V4 monster state is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${PREVIOUS}') <> ${spawnCount} THEN
    RAISE EXCEPTION 'V4 staging modified the ${PREVIOUS} spawn set';
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || entity_type || ':' || kind || ':' || ordinal || ':' || x::float8::text
             || ':' || y::float8::text || ':' || biome || ':' || subzone, ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_content_spawns WHERE content_version = '${VERSION}';
  IF digest <> '${spawnDigest}' THEN
    RAISE EXCEPTION 'V4 spawn rows do not match the released artifact (%)', digest;
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || kind || ':' || cell || ':' || x::float8::text || ':' || y::float8::text
             || ':' || max_charges::text || ':' || gather_s::float8::text || ':' || respawn_s::text,
           ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_world_nodes WHERE content_version = '${VERSION}';
  IF digest <> '${nodeDigest}' THEN
    RAISE EXCEPTION 'V4 world nodes do not match the released artifact (%)', digest;
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || kind || ':' || cell || ':' || x::float8::text || ':' || y::float8::text
             || ':' || max_hp::text || ':' || respawn_s::text, ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_world_monsters WHERE content_version = '${VERSION}';
  IF digest <> '${monsterDigest}' THEN
    RAISE EXCEPTION 'V4 world monsters do not match the released artifact (%)', digest;
  END IF;
END
$v4_stage_world_exit$;

COMMIT;
`;
void sqlJson;
void set;

// ---- 3. activate -----------------------------------------------------------
// Owner decision (2026-08-31): the nine superseded ids are tester-era data.
// V4 deletes the definitions and every holding of them outright: no
// compensation, no replacement grant, no preserved plus level.
const deletedList = deletedIds.map((id) => `'${id}'`).join(", ");
const deletedArray = `ARRAY[${deletedList}]::text[]`;

const activate = `-- V4 armour overhaul, step 3/3: atomically activate v4.
--
-- GENERATED by scripts/v4/build-migrations.mjs. Do not edit this file directly.
-- Content manifest sha256: ${contentHash}
-- Stable spawn payload sha256: ${world.spawn_hash}
--
-- ${PREVIOUS} keeps every content, spawn and world row and is marked 'retired',
-- so release rollback is: retire v4, re-activate ${PREVIOUS} and repoint
-- game_content_control. Rollback does NOT restore the deleted tester items.
--
-- Deletion allowlist (superseded tester-era ids, owner-authorised):
${deletedIds.map((id) => `--   * ${id}`).join("\n")}
-- Every allowlisted id is removed from equipped gear, inventory, bank, market
-- listings and market price history. Player accounts, saves, skills, XP, gold,
-- quests and all unrelated items are untouched. Every save that is edited is
-- snapshotted into player_save_backups first.

BEGIN;

DO $v4_activate_guard$
DECLARE
  issues integer;
  spawn_rows integer;
  bad integer;
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V4 activation expects ${PREVIOUS} to be the active release';
  END IF;
  SELECT count(*) INTO issues FROM public.game_validate_content_version('${VERSION}');
  IF issues <> 0 THEN
    RAISE EXCEPTION 'V4 content failed validation with % issue(s)', issues;
  END IF;
  SELECT count(*) INTO spawn_rows FROM public.game_content_spawns WHERE content_version = '${VERSION}';
  IF spawn_rows <> ${spawnCount} THEN
    RAISE EXCEPTION 'V4 spawn set is not fully staged';
  END IF;
  IF (SELECT spawn_hash FROM public.game_world_spawn_sets WHERE content_version = '${VERSION}' AND spawn_set_version = '${VERSION}') <> '${world.spawn_hash}' THEN
    RAISE EXCEPTION 'V4 spawn hash does not match the released artifact';
  END IF;
  IF (SELECT manifest_hash FROM public.game_content_versions WHERE content_version = '${VERSION}') <> '${contentHash}' THEN
    RAISE EXCEPTION 'V4 manifest hash does not match the released artifact';
  END IF;

  -- The deletion ledger must name every allowlisted id, all as hard stops.
  SELECT count(*) INTO bad FROM public.game_content_migration_rules
  WHERE content_version = '${VERSION}' AND from_id = ANY (${deletedArray}) AND action = 'stop' AND to_id IS NULL;
  IF bad <> ${deletedIds.length} THEN
    RAISE EXCEPTION 'V4 deletion ledger is incomplete (% of ${deletedIds.length} stop rules)', bad;
  END IF;

  -- Content-side assertions: v4 must not define or reference a deleted id.
  IF EXISTS (SELECT 1 FROM public.game_content_items
             WHERE content_version = '${VERSION}' AND id = ANY (${deletedArray})) THEN
    RAISE EXCEPTION 'V4 still defines a deleted item id';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_recipes
             WHERE content_version = '${VERSION}' AND output_item_id = ANY (${deletedArray}))
     OR EXISTS (SELECT 1 FROM public.game_content_recipe_inputs
                WHERE content_version = '${VERSION}' AND item_id = ANY (${deletedArray})) THEN
    RAISE EXCEPTION 'A V4 recipe references a deleted item id';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_monster_loot
             WHERE content_version = '${VERSION}' AND item_id = ANY (${deletedArray})) THEN
    RAISE EXCEPTION 'V4 monster loot references a deleted item id';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_quests AS q
             WHERE q.content_version = '${VERSION}'
               AND (q.target_id = ANY (${deletedArray})
                    OR EXISTS (SELECT 1 FROM jsonb_array_elements(q.reward_items) AS reward
                               WHERE reward->>'item_id' = ANY (${deletedArray})))) THEN
    RAISE EXCEPTION 'A V4 quest references a deleted item id';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_versions AS v, unnest(${deletedArray}) AS d(id)
             WHERE v.content_version = '${VERSION}' AND v.starter_loadout::text LIKE '%"' || d.id || '"%') THEN
    RAISE EXCEPTION 'The V4 starter loadout references a deleted item id';
  END IF;
END
$v4_activate_guard$;

-- ---------------------------------------------------------------------------
-- Player-side cleanup. Snapshot first, then purge.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE v4_deleted (id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO v4_deleted (id) SELECT unnest(${deletedArray});

CREATE TEMP TABLE v4_touched_saves ON COMMIT DROP AS
SELECT s.user_id, s.data AS before_data
FROM public.player_saves AS s
WHERE EXISTS (SELECT 1 FROM v4_deleted d WHERE s.data::text LIKE '%"' || d.id || '"%');

INSERT INTO public.player_save_backups (user_id, rev, data)
SELECT t.user_id, s.rev, t.before_data
FROM v4_touched_saves AS t
JOIN public.player_saves AS s ON s.user_id = t.user_id;

-- 1. Equipped gear: the slot is emptied, exactly as an unequipped character.
UPDATE public.player_saves AS s
SET data = jsonb_set(s.data, '{armor}', 'null'::jsonb)
WHERE s.data->'armor'->>'id' = ANY (${deletedArray});

UPDATE public.player_saves AS s
SET data = jsonb_set(s.data, '{weapon}', 'null'::jsonb)
WHERE s.data->'weapon'->>'id' = ANY (${deletedArray});

-- 2. Inventory slots: cleared in place, so slot count and ordering survive.
WITH cleared AS (
  SELECT s.user_id,
         jsonb_agg(CASE WHEN slot->>'id' = ANY (${deletedArray}) THEN 'null'::jsonb ELSE slot END
                   ORDER BY ordinality) AS inv
  FROM public.player_saves AS s
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.data->'inv', '[]'::jsonb)) WITH ORDINALITY AS t(slot, ordinality)
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(s.data->'inv', '[]'::jsonb)) AS probe
    WHERE probe->>'id' = ANY (${deletedArray}))
  GROUP BY s.user_id
)
UPDATE public.player_saves AS s
SET data = jsonb_set(s.data, '{inv}', cleared.inv)
FROM cleared
WHERE s.user_id = cleared.user_id;

-- 3. Bank slots: same treatment.
WITH cleared AS (
  SELECT s.user_id,
         jsonb_agg(CASE WHEN slot->>'id' = ANY (${deletedArray}) THEN 'null'::jsonb ELSE slot END
                   ORDER BY ordinality) AS items
  FROM public.player_saves AS s
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.data->'bank'->'items', '[]'::jsonb)) WITH ORDINALITY AS t(slot, ordinality)
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(s.data->'bank'->'items', '[]'::jsonb)) AS probe
    WHERE probe->>'id' = ANY (${deletedArray}))
  GROUP BY s.user_id
)
UPDATE public.player_saves AS s
SET data = jsonb_set(s.data, '{bank,items}', cleared.items)
FROM cleared
WHERE s.user_id = cleared.user_id;

-- 4. Market listings and price history for deleted definitions are removed.
DELETE FROM public.market_listings WHERE item_id = ANY (${deletedArray});
DELETE FROM public.market_prices WHERE item_id = ANY (${deletedArray});

-- ---------------------------------------------------------------------------
-- Activation. Only one row may hold status 'active', so ${PREVIOUS} retires in
-- the same transaction; its content, spawn and world rows all stay in place.
-- ---------------------------------------------------------------------------
UPDATE public.game_content_versions
SET status = 'retired'
WHERE content_version = '${PREVIOUS}';

UPDATE public.game_content_versions
SET status = 'active'
WHERE content_version = '${VERSION}';

UPDATE public.game_content_control
SET active_content_version = '${VERSION}',
    active_spawn_set_version = '${VERSION}',
    minimum_client_content_version = '${VERSION}',
    manifest_hash = '${contentHash}',
    activation_timestamp = now(),
    migration_run_id = '${RUN_ID}'
WHERE singleton;

UPDATE public.game_release_control
SET minimum_client_content_version = '${VERSION}',
    updated_at = now()
WHERE singleton;

DO $v4_activate_exit$
DECLARE
  stragglers integer;
  touched integer;
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${VERSION}' THEN
    RAISE EXCEPTION 'V4 activation did not take effect';
  END IF;
  IF (SELECT active_spawn_set_version FROM public.game_content_control WHERE singleton) <> '${VERSION}' THEN
    RAISE EXCEPTION 'V4 spawn set activation did not take effect';
  END IF;
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${PREVIOUS}') <> 'retired' THEN
    RAISE EXCEPTION '${PREVIOUS} must be retained as retired for rollback';
  END IF;
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${PREVIOUS}') <> ${spawnCount} THEN
    RAISE EXCEPTION '${PREVIOUS} rollback data was modified';
  END IF;

  -- No dangling deleted ids anywhere in player-visible state.
  SELECT count(*) INTO stragglers FROM public.player_saves AS s
  WHERE EXISTS (SELECT 1 FROM v4_deleted d WHERE s.data::text LIKE '%"' || d.id || '"%');
  IF stragglers <> 0 THEN
    RAISE EXCEPTION '% save(s) still reference a deleted item id', stragglers;
  END IF;
  IF EXISTS (SELECT 1 FROM public.market_listings WHERE item_id = ANY (${deletedArray}))
     OR EXISTS (SELECT 1 FROM public.market_prices WHERE item_id = ANY (${deletedArray})) THEN
    RAISE EXCEPTION 'The market still references a deleted item id';
  END IF;

  -- Every remaining item reference in every save must resolve against v4, so
  -- saves keep deserializing after the purge.
  IF EXISTS (
    SELECT 1 FROM public.player_saves AS s
    CROSS JOIN LATERAL (
      SELECT s.data->'armor'->>'id' AS id
      UNION ALL SELECT s.data->'weapon'->>'id'
      UNION ALL SELECT slot->>'id' FROM jsonb_array_elements(coalesce(s.data->'inv', '[]'::jsonb)) AS slot
      UNION ALL SELECT slot->>'id' FROM jsonb_array_elements(coalesce(s.data->'bank'->'items', '[]'::jsonb)) AS slot
    ) AS ref
    WHERE ref.id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.game_content_items i
                      WHERE i.content_version = '${VERSION}' AND i.id = ref.id)
  ) THEN
    RAISE EXCEPTION 'A save references an item definition v4 does not define';
  END IF;

  -- Saves still parse into the shape the client contract expects.
  IF EXISTS (
    SELECT 1 FROM public.player_saves AS s
    WHERE jsonb_typeof(s.data->'inv') <> 'array'
       OR jsonb_typeof(s.data->'bank'->'items') <> 'array'
       OR jsonb_typeof(s.data->'skills') <> 'object'
       OR (s.data->'armor') IS NULL
       OR jsonb_typeof(s.data->'armor') NOT IN ('null', 'object')
       OR jsonb_typeof(s.data->'weapon') NOT IN ('null', 'object')
  ) THEN
    RAISE EXCEPTION 'A save no longer matches the expected save shape';
  END IF;

  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${VERSION}' AND kind = 'armor') <> 32 THEN
    RAISE EXCEPTION 'V4 must publish exactly 32 armour definitions';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipes r
      JOIN public.game_content_items i ON i.content_version = r.content_version AND i.id = r.output_item_id
      WHERE r.content_version = '${VERSION}' AND i.kind = 'armor') <> 32 THEN
    RAISE EXCEPTION 'V4 must publish a recipe for every armour definition';
  END IF;
  IF (SELECT maintenance_mode FROM public.game_release_control WHERE singleton) THEN
    RAISE EXCEPTION 'V4 activation must not leave the game in maintenance mode';
  END IF;

  SELECT count(*) INTO touched FROM v4_touched_saves;
  RAISE NOTICE 'V4 cleanup: % save(s) purged of % deleted tester item id(s)', touched, ${deletedIds.length};
END
$v4_activate_exit$;

COMMIT;
`;

const outputs = [
  [paths.stageContent, stageContent],
  [paths.stageWorld, stageWorld],
  [paths.activate, activate],
];

let drift = 0;
for (const [file, body] of outputs) {
  if (checkOnly) {
    const actual = await readFile(file, "utf8").catch(() => null);
    if (actual !== body) {
      drift += 1;
      console.error(`drift: ${file.slice(root.length + 1)}`);
    }
  } else {
    await writeFile(file, body, "utf8");
  }
}
if (drift) throw new Error("V4 migrations drifted from the artifacts; rerun scripts/v4/build-migrations.mjs");

console.log(
  `${checkOnly ? "Verified" : "Wrote"} 3 V4 migrations; content ${contentHash.slice(0, 12)}, spawns ${world.spawn_hash.slice(0, 12)}, ` +
    `${spawnCount} spawns (${nodeCount} nodes / ${monsterCount} monsters), ${deletedIds.length} deletions`,
);

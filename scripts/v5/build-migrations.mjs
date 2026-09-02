/**
 * Forward-only V5 migrations, generated from the V5 artifacts.
 *
 *   1. stage content — v5 rows in the content tables, status 'staged'
 *   2. stage world   — v5 spawn set (geometry identical to v4)
 *   3. activate      — validate, purge the four tester weapons, flip v5 to
 *                      'active', retire v4
 *
 * V5 is the live V4 catalogue plus an enumerated sword delta: 16 renamed swords
 * and 4 deleted tester weapons. Everything else — recipes, ingredients,
 * Smithing requirements, XP, craft durations, monsters, loot, quests, nodes,
 * fish, bosses and the world — is copied inside the database from the v4 rows,
 * so it provably cannot drift.
 *
 * Nothing here deletes v4 rows, so release rollback stays a control-row flip.
 * Rollback does NOT restore the deleted tester weapon holdings.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DELETED_ITEMS, SWORD_IDS } from "./model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const checkOnly = process.argv.includes("--check");
const VERSION = "v5";
const PREVIOUS = "v4";
const RUN_ID = "v5-sword-release-20260901";
const UUID_NAMESPACE = "bf50882c-ad8a-57ab-bb73-3ea3dd8fcb5c";

const paths = {
  contentSql: resolve(root, "artifacts/v5/supabase/generated/content-manifest.sql"),
  world: resolve(root, "content/v5/world-spawn-manifest.json"),
  previousWorld: resolve(root, "content/v4/world-spawn-manifest.json"),
  stageContent: resolve(root, "supabase/migrations/20260901120000_v5_stage_content.sql"),
  stageWorld: resolve(root, "supabase/migrations/20260901120100_v5_stage_world.sql"),
  activate: resolve(root, "supabase/migrations/20260901120200_v5_activate.sql"),
};

const [contentSql, worldText, previousWorldText] = await Promise.all([
  readFile(paths.contentSql, "utf8"),
  readFile(paths.world, "utf8"),
  readFile(paths.previousWorld, "utf8"),
]);
const world = JSON.parse(worldText);
const previousWorld = JSON.parse(previousWorldText);

if (world.content_version !== VERSION) throw new Error("World manifest is not v5");
const contentHash = world.source_content_manifest_hash;
if (!contentSql.includes(`Manifest SHA-256: ${contentHash}`)) {
  throw new Error("Generated content SQL hash does not match the v5 manifest");
}
if (!contentSql.includes(`Content version: ${VERSION}`))
  throw new Error("Generated content SQL is not the v5 cut");

// The sword release must not move a single spawn. Prove it before emitting.
const key = (spawn) => `${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`;
const previousById = new Map(previousWorld.spawns.map((spawn) => [key(spawn), spawn]));
if (previousById.size !== world.spawns.length) throw new Error("v4/v5 spawn counts differ");
for (const spawn of world.spawns) {
  const previous = previousById.get(key(spawn));
  if (!previous) throw new Error(`v5 spawn ${key(spawn)} has no v4 counterpart`);
  if (
    previous.x !== spawn.x ||
    previous.y !== spawn.y ||
    previous.biome !== spawn.biome ||
    previous.subzone !== spawn.subzone
  ) {
    throw new Error(`v5 relocated ${key(spawn)}; the sword release must not move spawns`);
  }
}

const md5 = (value) => createHash("md5").update(value).digest("hex");
const num = (value) => String(Number(value));
const bySpawnId = [...world.spawns].sort((left, right) =>
  left.spawn_id < right.spawn_id ? -1 : 1,
);
const spawnDigest = md5(
  bySpawnId
    .map(
      (s) =>
        `${s.spawn_id}:${s.entity_type}:${s.kind}:${s.ordinal}:${num(s.x)}:${num(s.y)}:${s.biome}:${s.subzone}`,
    )
    .join(","),
);
const nodeDigest = md5(
  bySpawnId
    .filter((s) => s.entity_type === "node")
    .map(
      (s) =>
        `${s.spawn_id}:${s.kind}:${s.cell}:${num(s.x)}:${num(s.y)}:${s.max_charges}:${num(s.gather_s)}:${s.respawn_s}`,
    )
    .join(","),
);
const monsterDigest = md5(
  bySpawnId
    .filter((s) => s.entity_type === "monster")
    .map(
      (s) => `${s.spawn_id}:${s.kind}:${s.cell}:${num(s.x)}:${num(s.y)}:${s.max_hp}:${s.respawn_s}`,
    )
    .join(","),
);

const spawnCount = world.spawns.length;
const nodeCount = world.counts.nodes;
const monsterCount = world.counts.monsters;
const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;

// ---- 1. stage content ------------------------------------------------------
const v4Manifest = JSON.parse(
  await readFile(resolve(root, "content/v4/manifest.authoring.json"), "utf8"),
).runtime;
const v5Manifest = JSON.parse(
  await readFile(resolve(root, "content/v5/manifest.authoring.json"), "utf8"),
).runtime;
const stable = (value) => JSON.stringify(value);

const deletedIds = [...DELETED_ITEMS];
const itemDelta = [...new Set([...deletedIds, ...SWORD_IDS])].sort();

// Build-time proof that the delta is exhaustive.
const sameOutside = (before, after, field, skip) => {
  const pick = (rows) =>
    rows.filter((row) => !skip.includes(row[field])).sort((l, r) => (l[field] < r[field] ? -1 : 1));
  return stable(pick(before)) === stable(pick(after));
};
if (!sameOutside(v4Manifest.items, v5Manifest.items, "id", itemDelta)) {
  throw new Error("v5 changes an item outside the enumerated sword delta");
}
// Name-only proof: every target sword must be byte-identical to its v4 row on
// every field except `name`. Generation fails if anything else moved.
const swordRenames = [];
for (const id of SWORD_IDS) {
  const before = v4Manifest.items.find((item) => item.id === id);
  const after = v5Manifest.items.find((item) => item.id === id);
  if (!before) throw new Error(`v4 does not define target sword ${id}`);
  if (!after) throw new Error(`v5 does not define target sword ${id}`);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const fieldName of fields) {
    if (fieldName === "name") continue;
    if (stable(before[fieldName]) !== stable(after[fieldName])) {
      throw new Error(
        `v5 changes ${fieldName} of ${id} (${stable(before[fieldName])} -> ${stable(after[fieldName])}); ` +
          "the sword release may only change display names",
      );
    }
  }
  swordRenames.push({ id, name: after.name });
}

for (const table of ["recipes", "monsters", "nodes", "fish", "fishing_spots", "quests", "bosses"]) {
  if (stable(v4Manifest[table]) !== stable(v5Manifest[table])) {
    throw new Error(`v5 changes ${table}, which the sword release must not do`);
  }
}
if (stable(v4Manifest.starter_loadout) !== stable(v5Manifest.starter_loadout)) {
  throw new Error("v5 changes the starter loadout, which the sword release must not do");
}

// Verbatim row extraction from the generated artifact.
const sqlLines = contentSql.split("\n");
const rowPrefix = `  ('${VERSION}'`;
const blockRows = (header) => {
  const start = sqlLines.findIndex((line) => line.startsWith(header));
  if (start < 0) throw new Error(`generated SQL has no ${header} block`);
  let index = start;
  while (index < sqlLines.length && !sqlLines[index].startsWith(rowPrefix)) index += 1;
  const rows = [];
  for (; index < sqlLines.length; index += 1) {
    if (!sqlLines[index].startsWith(rowPrefix)) break;
    rows.push(sqlLines[index].trim().replace(/[,;]$/, ""));
  }
  if (!rows.length) throw new Error(`generated SQL block ${header} is empty`);
  return rows;
};
const field = (row, index) => row.split(", ")[index].replace(/^'|'$/g, "");
const values = (rows) => rows.join(",\n  ");

const itemRows = blockRows("INSERT INTO public.game_content_items");
const ruleRows = blockRows("INSERT INTO public.game_content_migration_rules");
const swordRows = itemRows.filter((row) => SWORD_IDS.includes(field(row, 1)));
if (swordRows.length !== SWORD_IDS.length) throw new Error("sword item extraction is incomplete");
for (const row of swordRows) {
  const id = field(row, 1);
  const expected = swordRenames.find((entry) => entry.id === id);
  if (field(row, 2) !== expected.name) {
    throw new Error(`generated artifact names ${id} "${field(row, 2)}", expected "${expected.name}"`);
  }
}
if (ruleRows.length !== v5Manifest.migration_rules.length)
  throw new Error("migration rule extraction is incomplete");


const versionStart = sqlLines.findIndex((line) =>
  line.startsWith("INSERT INTO public.game_content_versions"),
);
const versionBlock = sqlLines.slice(versionStart, versionStart + 4).join("\n");
if (!versionBlock.includes("ON CONFLICT")) throw new Error("could not extract the v5 version row");

const list = (ids) => ids.map((id) => `'${id}'`).join(", ");
const inputCount = v5Manifest.recipes.reduce((total, recipe) => total + recipe.inputs.length, 0);
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
const deletedList = list(deletedIds);
const deletedArray = `ARRAY[${deletedList}]::text[]`;
const swordArray = `ARRAY[${list([...SWORD_IDS].sort())}]::text[]`;

const stageContent = `-- V5 sword release, step 1/3: stage the v5 content (inactive).
--
-- GENERATED by scripts/v5/build-migrations.mjs from
-- artifacts/v5/supabase/generated/content-manifest.sql. Do not edit directly.
-- Content manifest sha256: ${contentHash}
--
-- v5 = live v4 content plus an enumerated sword delta. Every unchanged row is
-- copied from v4 inside the database, so it cannot drift; the changed rows are
-- inserted verbatim from the generated artifact:
--   * ${SWORD_IDS.length} swords re-stated with normalised display names (ids, attack,
--     recipes, requirements, XP and craft durations unchanged)
--   * ${deletedIds.length} tester-era weapon ids deleted
-- v1..v4 rows are left untouched, so rollback stays a control-row flip.

BEGIN;

DO $v5_stage_content_guard$
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V5 staging expects ${PREVIOUS} to be the active release';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_versions WHERE content_version = '${VERSION}' AND status = 'active') THEN
    RAISE EXCEPTION 'V5 is already active; staging must not run again';
  END IF;
END
$v5_stage_content_guard$;

${versionBlock}

DO $v5_copy_content$
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
      RAISE EXCEPTION 'V5 copy of % is incomplete (% of %)', target, copied, expected;
    END IF;
  END LOOP;
END
$v5_copy_content$;

-- ---------------------------------------------------------------------------
-- Sword delta. Deletions first, then the re-stated sword definitions.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Sword delta. The four tester definitions are deleted; the 16 stable target
-- swords are renamed in place, so nothing ever drops a row that the copied v5
-- recipes reference.
-- ---------------------------------------------------------------------------
DELETE FROM public.game_content_items
WHERE content_version = '${VERSION}' AND id IN (${deletedList});
DELETE FROM public.game_content_migration_rules WHERE content_version = '${VERSION}';

UPDATE public.game_content_items AS item
SET name = renamed.name
FROM (VALUES
  ${swordRenames.map((entry) => `('${entry.id}', ${sqlText(entry.name)})`).join(",\n  ")}
) AS renamed(id, name)
WHERE item.content_version = '${VERSION}'
  AND item.id = renamed.id;


INSERT INTO public.game_content_migration_rules
  (content_version, from_id, action, to_id, captured_value_required, notice_key, equipped_action, unequipped_action)
VALUES
  ${values(ruleRows)};

DO $v5_stage_content_exit$
BEGIN
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${VERSION}') <> 'staged' THEN
    RAISE EXCEPTION 'V5 content must remain staged after step 1';
  END IF;
  IF (SELECT manifest_hash FROM public.game_content_versions WHERE content_version = '${VERSION}') <> '${contentHash}' THEN
    RAISE EXCEPTION 'V5 manifest hash was not recorded';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${VERSION}') <> ${v5Manifest.items.length} THEN
    RAISE EXCEPTION 'V5 must stage exactly ${v5Manifest.items.length} items';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${VERSION}' AND kind = 'weapon') <> ${SWORD_IDS.length} THEN
    RAISE EXCEPTION 'V5 must stage exactly ${SWORD_IDS.length} swords';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'weapon' AND id = ANY (${swordArray})) <> ${SWORD_IDS.length} THEN
    RAISE EXCEPTION 'V5 sword ids are not the approved stable ids';
  END IF;
  IF (SELECT count(DISTINCT tier_index) FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'weapon') <> ${SWORD_IDS.length} THEN
    RAISE EXCEPTION 'V5 must publish exactly one sword per tier';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipes WHERE content_version = '${VERSION}') <> ${v5Manifest.recipes.length} THEN
    RAISE EXCEPTION 'V5 must stage exactly ${v5Manifest.recipes.length} recipes';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipe_inputs WHERE content_version = '${VERSION}') <> ${inputCount} THEN
    RAISE EXCEPTION 'V5 recipe inputs are incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_items WHERE content_version = '${VERSION}' AND id = ANY (${deletedArray})) THEN
    RAISE EXCEPTION 'V5 still stages a deleted tester weapon id';
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
    RAISE EXCEPTION 'A staged V5 recipe references an item v5 does not define';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${PREVIOUS}') <> ${v4Manifest.items.length} THEN
    RAISE EXCEPTION 'V5 staging modified the ${PREVIOUS} catalogue';
  END IF;
END
$v5_stage_content_exit$;

COMMIT;
`;

// ---- 2. stage world --------------------------------------------------------
const stageWorld = `-- V5 sword release, step 2/3: stage the v5 world (inactive).
--
-- GENERATED by scripts/v5/build-migrations.mjs. Do not edit this file directly.
-- Stable spawn payload sha256: ${world.spawn_hash}
-- ${nodeCount} nodes, ${monsterCount} monsters, 0 relocated from ${PREVIOUS}:
-- the sword release changes item definitions only, never world geometry.

BEGIN;

DO $v5_stage_world_guard$
BEGIN
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${VERSION}') <> 'staged' THEN
    RAISE EXCEPTION 'V5 world staging requires staged v5 content';
  END IF;
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V5 world staging expects ${PREVIOUS} to be the active release';
  END IF;
END
$v5_stage_world_guard$;

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

DO $v5_stage_world_exit$
DECLARE
  digest text;
BEGIN
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${VERSION}') <> ${spawnCount} THEN
    RAISE EXCEPTION 'V5 spawn set is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_world_nodes WHERE content_version = '${VERSION}') <> ${nodeCount} THEN
    RAISE EXCEPTION 'V5 node state is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_world_monsters WHERE content_version = '${VERSION}') <> ${monsterCount} THEN
    RAISE EXCEPTION 'V5 monster state is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${PREVIOUS}') <> ${spawnCount} THEN
    RAISE EXCEPTION 'V5 staging modified the ${PREVIOUS} spawn set';
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || entity_type || ':' || kind || ':' || ordinal || ':' || x::float8::text
             || ':' || y::float8::text || ':' || biome || ':' || subzone, ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_content_spawns WHERE content_version = '${VERSION}';
  IF digest <> '${spawnDigest}' THEN
    RAISE EXCEPTION 'V5 spawn rows do not match the released artifact (%)', digest;
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || kind || ':' || cell || ':' || x::float8::text || ':' || y::float8::text
             || ':' || max_charges::text || ':' || gather_s::float8::text || ':' || respawn_s::text,
           ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_world_nodes WHERE content_version = '${VERSION}';
  IF digest <> '${nodeDigest}' THEN
    RAISE EXCEPTION 'V5 world nodes do not match the released artifact (%)', digest;
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || kind || ':' || cell || ':' || x::float8::text || ':' || y::float8::text
             || ':' || max_hp::text || ':' || respawn_s::text, ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_world_monsters WHERE content_version = '${VERSION}';
  IF digest <> '${monsterDigest}' THEN
    RAISE EXCEPTION 'V5 world monsters do not match the released artifact (%)', digest;
  END IF;
END
$v5_stage_world_exit$;

COMMIT;
`;

// ---- 3. activate -----------------------------------------------------------
// Owner decision (2026-09-01): the four tester weapons are tester-era data.
// V5 deletes the definitions and every holding of them outright: no
// compensation, no conversion, no replacement grant, no preserved plus level.
const activate = `-- V5 sword release, step 3/3: atomically activate v5.
--
-- GENERATED by scripts/v5/build-migrations.mjs. Do not edit this file directly.
-- Content manifest sha256: ${contentHash}
-- Stable spawn payload sha256: ${world.spawn_hash}
--
-- ${PREVIOUS} keeps every content, spawn and world row and is marked 'retired',
-- so release rollback is: retire v5, re-activate ${PREVIOUS} and repoint
-- game_content_control. Rollback does NOT restore the deleted tester weapons.
--
-- Deletion allowlist (tester-era weapon ids, owner-authorised):
${deletedIds.map((id) => `--   * ${id}`).join("\n")}
-- Every allowlisted id is removed from equipped weapons, inventory, bank,
-- market listings and market price history. Player accounts, saves, skills, XP,
-- gold, quests, all unrelated items and all 16 swords (including their plus
-- levels) are untouched. Every save that is edited is snapshotted into
-- player_save_backups first.

BEGIN;

DO $v5_activate_guard$
DECLARE
  issues integer;
  spawn_rows integer;
  bad integer;
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V5 activation expects ${PREVIOUS} to be the active release';
  END IF;
  SELECT count(*) INTO issues FROM public.game_validate_content_version('${VERSION}');
  IF issues <> 0 THEN
    RAISE EXCEPTION 'V5 content failed validation with % issue(s)', issues;
  END IF;
  SELECT count(*) INTO spawn_rows FROM public.game_content_spawns WHERE content_version = '${VERSION}';
  IF spawn_rows <> ${spawnCount} THEN
    RAISE EXCEPTION 'V5 spawn set is not fully staged';
  END IF;
  IF (SELECT spawn_hash FROM public.game_world_spawn_sets WHERE content_version = '${VERSION}' AND spawn_set_version = '${VERSION}') <> '${world.spawn_hash}' THEN
    RAISE EXCEPTION 'V5 spawn hash does not match the released artifact';
  END IF;
  IF (SELECT manifest_hash FROM public.game_content_versions WHERE content_version = '${VERSION}') <> '${contentHash}' THEN
    RAISE EXCEPTION 'V5 manifest hash does not match the released artifact';
  END IF;

  -- The deletion ledger must name every allowlisted id, all as hard stops.
  SELECT count(*) INTO bad FROM public.game_content_migration_rules
  WHERE content_version = '${VERSION}' AND from_id = ANY (${deletedArray}) AND action = 'stop' AND to_id IS NULL;
  IF bad <> ${deletedIds.length} THEN
    RAISE EXCEPTION 'V5 deletion ledger is incomplete (% of ${deletedIds.length} stop rules)', bad;
  END IF;

  -- The sword ladder must be exactly the approved 16 stable ids, one per tier,
  -- each craftable and strictly stronger than the tier below it.
  IF (SELECT count(*) FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'weapon' AND active) <> ${SWORD_IDS.length} THEN
    RAISE EXCEPTION 'V5 must publish exactly ${SWORD_IDS.length} active swords';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_items
             WHERE content_version = '${VERSION}' AND kind = 'weapon' AND NOT (id = ANY (${swordArray}))) THEN
    RAISE EXCEPTION 'V5 publishes a weapon outside the approved stable id set';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT attack, level_requirement, tier_index,
             lag(attack) OVER (ORDER BY tier_index) AS previous_attack,
             lag(level_requirement) OVER (ORDER BY tier_index) AS previous_level
      FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'weapon'
    ) AS ladder
    WHERE previous_attack IS NOT NULL AND (attack <= previous_attack OR level_requirement <= previous_level)
  ) THEN
    RAISE EXCEPTION 'V5 sword progression is not monotonic';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.game_content_items AS i
    WHERE i.content_version = '${VERSION}' AND i.kind = 'weapon'
      AND NOT EXISTS (SELECT 1 FROM public.game_content_recipes AS r
                      WHERE r.content_version = i.content_version AND r.output_item_id = i.id)
  ) THEN
    RAISE EXCEPTION 'V5 must publish a recipe for every sword';
  END IF;

  -- Content-side assertions: v5 must not define or reference a deleted id.
  IF EXISTS (SELECT 1 FROM public.game_content_items
             WHERE content_version = '${VERSION}' AND id = ANY (${deletedArray})) THEN
    RAISE EXCEPTION 'V5 still defines a deleted weapon id';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_recipes
             WHERE content_version = '${VERSION}' AND output_item_id = ANY (${deletedArray}))
     OR EXISTS (SELECT 1 FROM public.game_content_recipe_inputs
                WHERE content_version = '${VERSION}' AND item_id = ANY (${deletedArray})) THEN
    RAISE EXCEPTION 'A V5 recipe references a deleted weapon id';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_monster_loot
             WHERE content_version = '${VERSION}' AND item_id = ANY (${deletedArray})) THEN
    RAISE EXCEPTION 'V5 monster loot references a deleted weapon id';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_quests AS q
             WHERE q.content_version = '${VERSION}'
               AND (q.target_id = ANY (${deletedArray})
                    OR EXISTS (SELECT 1 FROM jsonb_array_elements(q.reward_items) AS reward
                               WHERE reward->>'item_id' = ANY (${deletedArray})))) THEN
    RAISE EXCEPTION 'A V5 quest references a deleted weapon id';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_versions AS v, unnest(${deletedArray}) AS d(id)
             WHERE v.content_version = '${VERSION}' AND v.starter_loadout::text LIKE '%"' || d.id || '"%') THEN
    RAISE EXCEPTION 'The V5 starter loadout references a deleted weapon id';
  END IF;
END
$v5_activate_guard$;

-- ---------------------------------------------------------------------------
-- Player-side cleanup. Snapshot first, then purge.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE v5_deleted (id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO v5_deleted (id) SELECT unnest(${deletedArray});

CREATE TEMP TABLE v5_touched_saves ON COMMIT DROP AS
SELECT s.user_id, s.data AS before_data
FROM public.player_saves AS s
WHERE EXISTS (SELECT 1 FROM v5_deleted d WHERE s.data::text LIKE '%"' || d.id || '"%');

INSERT INTO public.player_save_backups (user_id, rev, data)
SELECT t.user_id, s.rev, t.before_data
FROM v5_touched_saves AS t
JOIN public.player_saves AS s ON s.user_id = t.user_id;

-- 1. Equipped weapon: the slot is emptied, exactly as an unequipped character.
--    Armour slots are never touched by the sword release.
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

DO $v5_activate_exit$
DECLARE
  stragglers integer;
  touched integer;
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${VERSION}' THEN
    RAISE EXCEPTION 'V5 activation did not take effect';
  END IF;
  IF (SELECT active_spawn_set_version FROM public.game_content_control WHERE singleton) <> '${VERSION}' THEN
    RAISE EXCEPTION 'V5 spawn set activation did not take effect';
  END IF;
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${PREVIOUS}') <> 'retired' THEN
    RAISE EXCEPTION '${PREVIOUS} must be retained as retired for rollback';
  END IF;
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${PREVIOUS}') <> ${spawnCount} THEN
    RAISE EXCEPTION '${PREVIOUS} rollback data was modified';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${PREVIOUS}') <> ${v4Manifest.items.length} THEN
    RAISE EXCEPTION '${PREVIOUS} rollback catalogue was modified';
  END IF;

  -- No dangling deleted ids anywhere in player-visible state.
  SELECT count(*) INTO stragglers FROM public.player_saves AS s
  WHERE EXISTS (SELECT 1 FROM v5_deleted d WHERE s.data::text LIKE '%"' || d.id || '"%');
  IF stragglers <> 0 THEN
    RAISE EXCEPTION '% save(s) still reference a deleted weapon id', stragglers;
  END IF;
  IF EXISTS (SELECT 1 FROM public.market_listings WHERE item_id = ANY (${deletedArray}))
     OR EXISTS (SELECT 1 FROM public.market_prices WHERE item_id = ANY (${deletedArray})) THEN
    RAISE EXCEPTION 'The market still references a deleted weapon id';
  END IF;

  -- Every remaining item reference in every save must resolve against v5, so
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
    RAISE EXCEPTION 'A save references an item definition v5 does not define';
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

  IF (SELECT maintenance_mode FROM public.game_release_control WHERE singleton) THEN
    RAISE EXCEPTION 'V5 activation must not leave the game in maintenance mode';
  END IF;

  SELECT count(*) INTO touched FROM v5_touched_saves;
  RAISE NOTICE 'V5 cleanup: % save(s) purged of % deleted tester weapon id(s)', touched, ${deletedIds.length};
END
$v5_activate_exit$;

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
if (drift)
  throw new Error(
    "V5 migrations drifted from the artifacts; rerun scripts/v5/build-migrations.mjs",
  );

console.log(
  `${checkOnly ? "Verified" : "Wrote"} 3 V5 migrations: ${SWORD_IDS.length} swords re-stated, ` +
    `${deletedIds.length} tester weapons deleted; content ${contentHash}; spawns ${world.spawn_hash}`,
);

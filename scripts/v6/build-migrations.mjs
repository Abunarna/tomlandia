/**
 * Forward-only V6 migrations, generated from the V6 artifacts.
 *
 *   1. stage content — the strength-potion runtime (schema + functions) and the
 *                      v6 content rows, status 'staged'
 *   2. stage world   — the v6 spawn set (geometry identical to v5)
 *   3. activate      — validate, convert active v5 potion buffs, flip v6 to
 *                      'active', retire v5
 *
 * V6 is the live V5 catalogue plus an enumerated potion delta: 16 renamed
 * potions that gain an authoritative strength percentage. Nothing is deleted,
 * nothing is re-identified, no recipe, ingredient, requirement, XP value, craft
 * duration, boosted-hit count, intrinsic value, food definition, monster, node,
 * quest or spawn changes. Every unchanged row is copied from v5 inside the
 * database, so it provably cannot drift.
 *
 * v1..v5 rows are left untouched, so release rollback is a control-row flip.
 * The runtime helper keeps applying the legacy flat `dmg` bonus whenever
 * strength_pct is 0, which is exactly what a v5 rollback needs.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DELETED_ITEMS, POTIONS, POTION_IDS, RUN_ID, V5_VERSION, V6_VERSION } from "./model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const checkOnly = process.argv.includes("--check");
const VERSION = V6_VERSION;
const PREVIOUS = V5_VERSION;
const UUID_NAMESPACE = "bf50882c-ad8a-57ab-bb73-3ea3dd8fcb5c";

const paths = {
  contentSql: resolve(root, "artifacts/v6/supabase/generated/content-manifest.sql"),
  runtime: resolve(root, "supabase/v6/strength-runtime.sql"),
  entrypoints: resolve(root, "supabase/v6/public-entrypoints.sql"),
  world: resolve(root, "content/v6/world-spawn-manifest.json"),
  previousWorld: resolve(root, "content/v5/world-spawn-manifest.json"),
  stageContent: resolve(root, "supabase/migrations/20260903120000_v6_stage_content.sql"),
  stageWorld: resolve(root, "supabase/migrations/20260903120100_v6_stage_world.sql"),
  activate: resolve(root, "supabase/migrations/20260903120200_v6_activate.sql"),
};

const [contentSql, runtimeSql, entrypointsSql, worldText, previousWorldText] = await Promise.all([
  readFile(paths.contentSql, "utf8"),
  readFile(paths.runtime, "utf8"),
  readFile(paths.entrypoints, "utf8"),
  readFile(paths.world, "utf8"),
  readFile(paths.previousWorld, "utf8"),
]);
const world = JSON.parse(worldText);
const previousWorld = JSON.parse(previousWorldText);

if (world.content_version !== VERSION) throw new Error("World manifest is not v6");
const contentHash = world.source_content_manifest_hash;
if (!contentSql.includes(`Manifest SHA-256: ${contentHash}`)) {
  throw new Error("Generated content SQL hash does not match the v6 manifest");
}
if (!contentSql.includes(`Content version: ${VERSION}`))
  throw new Error("Generated content SQL is not the v6 cut");
if (DELETED_ITEMS.length) throw new Error("V6 must not delete any item definition");

// The potion release must not move a single spawn. Prove it before emitting.
const key = (spawn) => `${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`;
const previousById = new Map(previousWorld.spawns.map((spawn) => [key(spawn), spawn]));
if (previousById.size !== world.spawns.length) throw new Error("v5/v6 spawn counts differ");
for (const spawn of world.spawns) {
  const previous = previousById.get(key(spawn));
  if (!previous) throw new Error(`v6 spawn ${key(spawn)} has no v5 counterpart`);
  if (
    previous.x !== spawn.x ||
    previous.y !== spawn.y ||
    previous.biome !== spawn.biome ||
    previous.subzone !== spawn.subzone
  ) {
    throw new Error(`v6 relocated ${key(spawn)}; the potion release must not move spawns`);
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

// ---- field-level v5 -> v6 delta -------------------------------------------
const v5Manifest = JSON.parse(
  await readFile(resolve(root, "content/v5/manifest.authoring.json"), "utf8"),
).runtime;
const v6Manifest = JSON.parse(
  await readFile(resolve(root, "content/v6/manifest.authoring.json"), "utf8"),
).runtime;
const stable = (value) => JSON.stringify(value);

const sameOutside = (before, after, field, skip) => {
  const pick = (rows) =>
    rows.filter((row) => !skip.includes(row[field])).sort((l, r) => (l[field] < r[field] ? -1 : 1));
  return stable(pick(before)) === stable(pick(after));
};
if (!sameOutside(v5Manifest.items, v6Manifest.items, "id", [...POTION_IDS])) {
  throw new Error("v6 changes an item outside the enumerated potion delta");
}
// Name-only proof: every stable potion must be byte-identical to its v5 row on
// every field except `name`. The percentage lives in runtime.mechanics, so even
// the potions keep their v5 stats (dmg_boost, boost_hits, value) untouched.
const potionRenames = [];
for (const id of POTION_IDS) {
  const before = v5Manifest.items.find((item) => item.id === id);
  const after = v6Manifest.items.find((item) => item.id === id);
  if (!before) throw new Error(`v5 does not define stable potion ${id}`);
  if (!after) throw new Error(`v6 does not define stable potion ${id}`);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const fieldName of fields) {
    if (fieldName === "name") continue;
    if (stable(before[fieldName]) !== stable(after[fieldName])) {
      throw new Error(
        `v6 changes ${fieldName} of ${id} (${stable(before[fieldName])} -> ${stable(after[fieldName])}); ` +
          "the potion release may only change display names and add a strength percentage",
      );
    }
  }
  potionRenames.push({ id, name: after.name });
}
for (const table of ["recipes", "monsters", "nodes", "fish", "fishing_spots", "quests", "bosses"]) {
  if (stable(v5Manifest[table]) !== stable(v6Manifest[table])) {
    throw new Error(`v6 changes ${table}, which the potion release must not do`);
  }
}
if (stable(v5Manifest.starter_loadout) !== stable(v6Manifest.starter_loadout)) {
  throw new Error("v6 changes the starter loadout, which the potion release must not do");
}
// Healing food is explicitly out of scope for this release.
const foods = (manifest) => manifest.items.filter((item) => item.kind === "food");
if (stable(foods(v5Manifest)) !== stable(foods(v6Manifest))) {
  throw new Error("v6 changes a healing food definition, which this release must not do");
}

const strengthRows = [...v6Manifest.mechanics.strength_potions].sort(
  (left, right) => left.tier_index - right.tier_index,
);
if (strengthRows.length !== POTIONS.length) throw new Error("v6 must define 16 strength potions");
strengthRows.forEach((row, index) => {
  const potion = POTIONS[index];
  if (row.item_id !== potion.id || row.tier_index !== potion.tier) {
    throw new Error(`v6 strength ladder disagrees with the frozen model at tier ${index + 1}`);
  }
  if (row.strength_pct !== potion.strength_pct) {
    throw new Error(`v6 strength percentage for ${row.item_id} is not the approved value`);
  }
  if (index > 0 && row.strength_pct < strengthRows[index - 1].strength_pct) {
    throw new Error("v6 strength progression must never decrease");
  }
  const item = v6Manifest.items.find((entry) => entry.id === row.item_id);
  if (row.boost_hits !== item.stats.boost_hits) {
    throw new Error(`v6 strength ladder hit count disagrees with ${row.item_id}`);
  }
});

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
const potionRows = itemRows.filter((row) => POTION_IDS.includes(field(row, 1)));
if (potionRows.length !== POTION_IDS.length)
  throw new Error("potion item extraction is incomplete");
for (const row of potionRows) {
  const id = field(row, 1);
  const expected = potionRenames.find((entry) => entry.id === id);
  if (field(row, 2) !== expected.name) {
    throw new Error(
      `generated artifact names ${id} "${field(row, 2)}", expected "${expected.name}"`,
    );
  }
}
if (ruleRows.length !== v6Manifest.migration_rules.length) {
  throw new Error("migration rule extraction is incomplete");
}

const versionStart = sqlLines.findIndex((line) =>
  line.startsWith("INSERT INTO public.game_content_versions"),
);
const versionBlock = sqlLines.slice(versionStart, versionStart + 4).join("\n");
if (!versionBlock.includes("ON CONFLICT")) throw new Error("could not extract the v6 version row");

const list = (ids) => ids.map((id) => `'${id}'`).join(", ");
const inputCount = v6Manifest.recipes.reduce((total, recipe) => total + recipe.inputs.length, 0);
const alchemyRecipes = v6Manifest.recipes.filter((recipe) =>
  POTION_IDS.includes(recipe.output_item_id),
);
if (alchemyRecipes.length !== POTION_IDS.length)
  throw new Error("v6 must define one recipe per potion");
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
const potionArray = `ARRAY[${list([...POTION_IDS].sort())}]::text[]`;

// ---- 1. stage content ------------------------------------------------------
const stageContent = `-- V6 strength potion release, step 1/3: stage the v6 content (inactive).
--
-- GENERATED by scripts/v6/build-migrations.mjs from
-- artifacts/v6/supabase/generated/content-manifest.sql and
-- supabase/v6/strength-runtime.sql. Do not edit this file directly.
-- Content manifest sha256: ${contentHash}
--
-- v6 = live v5 content plus an enumerated potion delta. Every unchanged row is
-- copied from v5 inside the database, so it cannot drift; the changed rows are
-- updated in place:
--   * ${POTION_IDS.length} strength potions renamed (ids, recipes, ingredients, Alchemy
--     requirements, XP, craft durations, boosted hits and values unchanged)
--   * each potion gains an authoritative strength_pct
--   * 0 items deleted, converted or re-identified
-- The shared runtime helper still applies the legacy flat bonus when
-- strength_pct is 0, so v1..v5 keep their exact combat behaviour.

BEGIN;

DO $v6_stage_content_guard$
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V6 staging expects ${PREVIOUS} to be the active release';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_versions WHERE content_version = '${VERSION}' AND status = 'active') THEN
    RAISE EXCEPTION 'V6 is already active; staging must not run again';
  END IF;
END
$v6_stage_content_guard$;

-- ---------------------------------------------------------------------------
-- Strength potion runtime (schema, runtime view, shared buff helper,
-- server-authoritative use_potion, ordinary and boss combat).
-- ---------------------------------------------------------------------------
${runtimeSql.trim()}

${versionBlock}

DO $v6_copy_content$
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
      RAISE EXCEPTION 'V6 copy of % is incomplete (% of %)', target, copied, expected;
    END IF;
  END LOOP;
END
$v6_copy_content$;

-- ---------------------------------------------------------------------------
-- Potion delta. Nothing is deleted: the 16 stable potions are renamed in place
-- and given their approved strength percentage, so no foreign-key parent row is
-- ever dropped and re-inserted.
-- ---------------------------------------------------------------------------
DELETE FROM public.game_content_migration_rules WHERE content_version = '${VERSION}';

UPDATE public.game_content_items AS item
SET name = updated.name,
    strength_pct = updated.strength_pct
FROM (VALUES
  ${POTIONS.map(
    (potion) =>
      `('${potion.id}', ${sqlText(potionRenames.find((entry) => entry.id === potion.id).name)}, ${potion.strength_pct})`,
  ).join(",\n  ")}
) AS updated(id, name, strength_pct)
WHERE item.content_version = '${VERSION}'
  AND item.id = updated.id;

INSERT INTO public.game_content_migration_rules
  (content_version, from_id, action, to_id, captured_value_required, notice_key, equipped_action, unequipped_action)
VALUES
  ${values(ruleRows)};

DO $v6_stage_content_exit$
BEGIN
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${VERSION}') <> 'staged' THEN
    RAISE EXCEPTION 'V6 content must remain staged after step 1';
  END IF;
  IF (SELECT manifest_hash FROM public.game_content_versions WHERE content_version = '${VERSION}') <> '${contentHash}' THEN
    RAISE EXCEPTION 'V6 manifest hash was not recorded';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${VERSION}') <> ${v6Manifest.items.length} THEN
    RAISE EXCEPTION 'V6 must stage exactly ${v6Manifest.items.length} items';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${VERSION}' AND kind = 'potion') <> ${POTION_IDS.length} THEN
    RAISE EXCEPTION 'V6 must stage exactly ${POTION_IDS.length} potions';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'potion' AND id = ANY (${potionArray})) <> ${POTION_IDS.length} THEN
    RAISE EXCEPTION 'V6 potion ids are not the approved stable ids';
  END IF;
  IF (SELECT count(DISTINCT tier_index) FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'potion') <> ${POTION_IDS.length} THEN
    RAISE EXCEPTION 'V6 must publish exactly one potion per tier';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_items
             WHERE content_version = '${VERSION}' AND kind = 'potion' AND (strength_pct <= 0 OR boost_hits <= 0)) THEN
    RAISE EXCEPTION 'Every V6 potion needs a positive strength percentage and hit count';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT strength_pct, tier_index, lag(strength_pct) OVER (ORDER BY tier_index) AS previous_pct
      FROM public.game_content_items WHERE content_version = '${VERSION}' AND kind = 'potion'
    ) AS ladder
    WHERE previous_pct IS NOT NULL AND strength_pct < previous_pct
  ) THEN
    RAISE EXCEPTION 'V6 strength progression is not non-decreasing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_items
             WHERE content_version = '${VERSION}' AND kind <> 'potion' AND strength_pct <> 0) THEN
    RAISE EXCEPTION 'Only V6 potions may carry a strength percentage';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipes WHERE content_version = '${VERSION}') <> ${v6Manifest.recipes.length} THEN
    RAISE EXCEPTION 'V6 must stage exactly ${v6Manifest.recipes.length} recipes';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipe_inputs WHERE content_version = '${VERSION}') <> ${inputCount} THEN
    RAISE EXCEPTION 'V6 recipe inputs are incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipes
      WHERE content_version = '${VERSION}' AND output_item_id = ANY (${potionArray}) AND skill = 'alchemy') <> ${POTION_IDS.length} THEN
    RAISE EXCEPTION 'V6 must stage exactly ${POTION_IDS.length} Alchemy potion recipes';
  END IF;
  -- Every ingredient must exist, be active and be reachable at or below the
  -- recipe's own Alchemy requirement.
  IF EXISTS (
    SELECT 1
    FROM public.game_content_recipes AS recipe
    JOIN public.game_content_recipe_inputs AS input
      ON input.content_version = recipe.content_version AND input.recipe_id = recipe.id
    LEFT JOIN public.game_content_items AS ingredient
      ON ingredient.content_version = recipe.content_version AND ingredient.id = input.item_id
    WHERE recipe.content_version = '${VERSION}'
      AND recipe.output_item_id = ANY (${potionArray})
      AND (ingredient.id IS NULL OR NOT ingredient.active OR input.qty <= 0)
  ) THEN
    RAISE EXCEPTION 'A V6 potion recipe uses an undefined, inactive or empty ingredient';
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
    RAISE EXCEPTION 'A staged V6 recipe references an item v6 does not define';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${PREVIOUS}') <> ${v5Manifest.items.length} THEN
    RAISE EXCEPTION 'V6 staging modified the ${PREVIOUS} catalogue';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_items WHERE content_version = '${PREVIOUS}' AND strength_pct <> 0) THEN
    RAISE EXCEPTION 'V6 staging must not give ${PREVIOUS} a strength percentage';
  END IF;
END
$v6_stage_content_exit$;

COMMIT;
`;

// ---- 2. stage world --------------------------------------------------------
const stageWorld = `-- V6 strength potion release, step 2/3: stage the v6 world (inactive).
--
-- GENERATED by scripts/v6/build-migrations.mjs. Do not edit this file directly.
-- Stable spawn payload sha256: ${world.spawn_hash}
-- ${nodeCount} nodes, ${monsterCount} monsters, 0 relocated from ${PREVIOUS}:
-- the potion release changes item definitions only, never world geometry.

BEGIN;

DO $v6_stage_world_guard$
BEGIN
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${VERSION}') <> 'staged' THEN
    RAISE EXCEPTION 'V6 world staging requires staged v6 content';
  END IF;
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V6 world staging expects ${PREVIOUS} to be the active release';
  END IF;
END
$v6_stage_world_guard$;

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

DO $v6_stage_world_exit$
DECLARE
  digest text;
BEGIN
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${VERSION}') <> ${spawnCount} THEN
    RAISE EXCEPTION 'V6 spawn set is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_world_nodes WHERE content_version = '${VERSION}') <> ${nodeCount} THEN
    RAISE EXCEPTION 'V6 node state is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_world_monsters WHERE content_version = '${VERSION}') <> ${monsterCount} THEN
    RAISE EXCEPTION 'V6 monster state is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${PREVIOUS}') <> ${spawnCount} THEN
    RAISE EXCEPTION 'V6 staging modified the ${PREVIOUS} spawn set';
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || entity_type || ':' || kind || ':' || ordinal || ':' || x::float8::text
             || ':' || y::float8::text || ':' || biome || ':' || subzone, ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_content_spawns WHERE content_version = '${VERSION}';
  IF digest <> '${spawnDigest}' THEN
    RAISE EXCEPTION 'V6 spawn rows do not match the released artifact (%)', digest;
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || kind || ':' || cell || ':' || x::float8::text || ':' || y::float8::text
             || ':' || max_charges::text || ':' || gather_s::float8::text || ':' || respawn_s::text,
           ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_world_nodes WHERE content_version = '${VERSION}';
  IF digest <> '${nodeDigest}' THEN
    RAISE EXCEPTION 'V6 world nodes do not match the released artifact (%)', digest;
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || kind || ':' || cell || ':' || x::float8::text || ':' || y::float8::text
             || ':' || max_hp::text || ':' || respawn_s::text, ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_world_monsters WHERE content_version = '${VERSION}';
  IF digest <> '${monsterDigest}' THEN
    RAISE EXCEPTION 'V6 world monsters do not match the released artifact (%)', digest;
  END IF;
END
$v6_stage_world_exit$;

COMMIT;
`;

// ---- 3. activate -----------------------------------------------------------
const activate = `-- V6 strength potion release, step 3/3: atomically activate v6.
--
-- GENERATED by scripts/v6/build-migrations.mjs. Do not edit this file directly.
-- Content manifest sha256: ${contentHash}
-- Stable spawn payload sha256: ${world.spawn_hash}
--
-- ${PREVIOUS} keeps every content, spawn and world row and is marked 'retired',
-- so release rollback is: retire v6, re-activate ${PREVIOUS} and repoint
-- game_content_control. The runtime helper still understands the legacy flat
-- buff, so a rollback needs no function restore.
--
-- No item is deleted, converted, compensated or re-identified. Player accounts,
-- saves, skills, XP, progression, quests, gold, bank gold, equipment, inventory,
-- bank, potion holdings, healing food, market sellers, listings, quantities,
-- prices, expiries and trades are all preserved. The only player-state change is
-- the active potion buff, which is converted in place from the v5 flat shape to
-- the v6 percentage shape with its remaining hits intact. Every save that is
-- edited is snapshotted into player_save_backups first.

BEGIN;

DO $v6_activate_guard$
DECLARE
  issues integer;
  spawn_rows integer;
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V6 activation expects ${PREVIOUS} to be the active release';
  END IF;
  SELECT count(*) INTO issues FROM public.game_validate_content_version('${VERSION}');
  IF issues <> 0 THEN
    RAISE EXCEPTION 'V6 content failed validation with % issue(s)', issues;
  END IF;
  SELECT count(*) INTO spawn_rows FROM public.game_content_spawns WHERE content_version = '${VERSION}';
  IF spawn_rows <> ${spawnCount} THEN
    RAISE EXCEPTION 'V6 spawn set is not fully staged';
  END IF;
  IF (SELECT spawn_hash FROM public.game_world_spawn_sets WHERE content_version = '${VERSION}' AND spawn_set_version = '${VERSION}') <> '${world.spawn_hash}' THEN
    RAISE EXCEPTION 'V6 spawn hash does not match the released artifact';
  END IF;
  IF (SELECT manifest_hash FROM public.game_content_versions WHERE content_version = '${VERSION}') <> '${contentHash}' THEN
    RAISE EXCEPTION 'V6 manifest hash does not match the released artifact';
  END IF;

  -- The potion ladder must be exactly the approved 16 stable ids, one per tier,
  -- each active, craftable with Alchemy and never weaker than the tier below.
  IF (SELECT count(*) FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'potion' AND active) <> ${POTION_IDS.length} THEN
    RAISE EXCEPTION 'V6 must publish exactly ${POTION_IDS.length} active potions';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_items
             WHERE content_version = '${VERSION}' AND kind = 'potion' AND NOT (id = ANY (${potionArray}))) THEN
    RAISE EXCEPTION 'V6 publishes a potion outside the approved stable id set';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT strength_pct, level_requirement, tier_index,
             lag(strength_pct) OVER (ORDER BY tier_index) AS previous_pct,
             lag(level_requirement) OVER (ORDER BY tier_index) AS previous_level
      FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'potion'
    ) AS ladder
    WHERE previous_pct IS NOT NULL AND (strength_pct < previous_pct OR level_requirement <= previous_level)
  ) THEN
    RAISE EXCEPTION 'V6 potion progression is not monotonic';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.game_content_items AS i
    WHERE i.content_version = '${VERSION}' AND i.kind = 'potion'
      AND NOT EXISTS (SELECT 1 FROM public.game_content_recipes AS r
                      WHERE r.content_version = i.content_version AND r.output_item_id = i.id AND r.skill = 'alchemy')
  ) THEN
    RAISE EXCEPTION 'V6 must publish an Alchemy recipe for every potion';
  END IF;

  -- Nothing may be missing from the v6 catalogue that v5 defined.
  IF EXISTS (
    SELECT 1 FROM public.game_content_items AS before
    WHERE before.content_version = '${PREVIOUS}'
      AND NOT EXISTS (SELECT 1 FROM public.game_content_items AS after
                      WHERE after.content_version = '${VERSION}' AND after.id = before.id)
  ) THEN
    RAISE EXCEPTION 'V6 drops an item that ${PREVIOUS} defines; the potion release deletes nothing';
  END IF;
  -- Healing food must be byte-identical to v5.
  IF EXISTS (
    SELECT 1 FROM public.game_content_items AS before
    JOIN public.game_content_items AS after ON after.content_version = '${VERSION}' AND after.id = before.id
    WHERE before.content_version = '${PREVIOUS}' AND before.kind = 'food'
      AND (before.name, before.heal, before.value, before.level_requirement, before.tier_index)
       IS DISTINCT FROM (after.name, after.heal, after.value, after.level_requirement, after.tier_index)
  ) THEN
    RAISE EXCEPTION 'V6 changes a healing food definition';
  END IF;
END
$v6_activate_guard$;

-- ---------------------------------------------------------------------------
-- Active potion buffs. A valid v5 flat buff is converted by stable potion id to
-- the v6 percentage shape, keeping its remaining hits. Buffs that name an
-- unknown potion, or that are corrupt or exhausted, are cleared. No other save
-- field is touched.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE v6_buff_saves ON COMMIT DROP AS
SELECT s.user_id, s.rev, s.data AS before_data
FROM public.player_saves AS s
WHERE s.data ? 'buff' AND jsonb_typeof(s.data->'buff') = 'object';

INSERT INTO public.player_save_backups (user_id, rev, data)
SELECT b.user_id, b.rev, b.before_data FROM v6_buff_saves AS b;

-- 1. Convertible buffs: a known, active v6 potion with hits remaining.
UPDATE public.player_saves AS s
SET data = jsonb_set(
      s.data,
      '{buff}',
      jsonb_build_object(
        'strength_pct', potion.strength_pct,
        'hits', (s.data#>>'{buff,hits}')::integer,
        'item', s.data#>>'{buff,item}',
        'content_version', '${VERSION}'
      ),
      true
    )
FROM public.game_content_items AS potion
WHERE potion.content_version = '${VERSION}'
  AND potion.kind = 'potion'
  AND potion.active
  AND potion.id = s.data#>>'{buff,item}'
  AND jsonb_typeof(s.data->'buff') = 'object'
  AND (s.data#>>'{buff,hits}') ~ '^[0-9]+$'
  AND (s.data#>>'{buff,hits}')::integer > 0;

-- 2. Everything else that still looks like a buff is unresolvable: clear it.
UPDATE public.player_saves AS s
SET data = s.data - 'buff'
WHERE s.data ? 'buff'
  AND NOT (
    jsonb_typeof(s.data->'buff') = 'object'
    AND (s.data#>>'{buff,strength_pct}') IS NOT NULL
    AND (s.data#>>'{buff,hits}') ~ '^[0-9]+$'
    AND (s.data#>>'{buff,hits}')::integer > 0
  );

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

-- ---------------------------------------------------------------------------
-- Least-privilege hardening. public.apply_strength_buff is a pure, IMMUTABLE,
-- SECURITY INVOKER helper with SET search_path = public; it is only ever called
-- from inside the authoritative SECURITY DEFINER combat RPCs, which execute as
-- the function owner and therefore keep working. No client role needs, or after
-- this statement has, a direct EXECUTE path to it.
REVOKE ALL
ON FUNCTION public.apply_strength_buff(jsonb, numeric)
FROM PUBLIC, anon, authenticated, service_role;

${entrypointsSql.trim()}





DO $v6_activate_exit$
DECLARE
  converted integer;
  cleared integer;
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${VERSION}' THEN
    RAISE EXCEPTION 'V6 activation did not take effect';
  END IF;
  IF (SELECT active_spawn_set_version FROM public.game_content_control WHERE singleton) <> '${VERSION}' THEN
    RAISE EXCEPTION 'V6 spawn set activation did not take effect';
  END IF;
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${PREVIOUS}') <> 'retired' THEN
    RAISE EXCEPTION '${PREVIOUS} must be retained as retired for rollback';
  END IF;
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${PREVIOUS}') <> ${spawnCount} THEN
    RAISE EXCEPTION '${PREVIOUS} rollback data was modified';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${PREVIOUS}') <> ${v5Manifest.items.length} THEN
    RAISE EXCEPTION '${PREVIOUS} rollback catalogue was modified';
  END IF;

  -- No save may keep a legacy or malformed buff after conversion.
  IF EXISTS (
    SELECT 1 FROM public.player_saves AS s
    WHERE s.data ? 'buff'
      AND (
        (s.data#>>'{buff,strength_pct}') IS NULL
        OR (s.data#>>'{buff,hits}') !~ '^[0-9]+$'
        OR (s.data#>>'{buff,hits}')::integer <= 0
        OR NOT EXISTS (SELECT 1 FROM public.game_content_items i
                       WHERE i.content_version = '${VERSION}' AND i.kind = 'potion'
                         AND i.active AND i.id = s.data#>>'{buff,item}')
      )
  ) THEN
    RAISE EXCEPTION 'A save still carries an unconverted or unresolvable potion buff';
  END IF;

  -- Every item reference in every save must resolve against v6.
  IF EXISTS (
    SELECT 1 FROM public.player_saves AS s
    CROSS JOIN LATERAL (
      SELECT s.data->'armor'->>'id' AS id
      UNION ALL SELECT s.data->'weapon'->>'id'
      UNION ALL SELECT s.data->>'food'
      UNION ALL SELECT slot->>'id' FROM jsonb_array_elements(coalesce(s.data->'inv', '[]'::jsonb)) AS slot
      UNION ALL SELECT slot->>'id' FROM jsonb_array_elements(coalesce(s.data->'bank'->'items', '[]'::jsonb)) AS slot
    ) AS ref
    WHERE ref.id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.game_content_items i
                      WHERE i.content_version = '${VERSION}' AND i.id = ref.id)
  ) THEN
    RAISE EXCEPTION 'A save references an item definition v6 does not define';
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
    RAISE EXCEPTION 'V6 activation must not leave the game in maintenance mode';
  END IF;

  SELECT count(*) INTO converted FROM public.player_saves WHERE data ? 'buff';
  SELECT count(*) INTO cleared FROM v6_buff_saves;
  RAISE NOTICE 'V6 buff conversion: % save(s) inspected, % active buff(s) now on the v6 shape', cleared, converted;
END
$v6_activate_exit$;

COMMIT;
`;

// ---- emitted-SQL regression proofs ----------------------------------------
// V6 deletes no item at all, renames the stable potions in place and never
// touches player holdings, market rows or healing food.
for (const [name, body] of [
  ["stage-content", stageContent],
  ["stage-world", stageWorld],
  ["activate", activate],
]) {
  if (/DELETE FROM public\.game_content_items/.test(body)) {
    throw new Error(`${name} deletes an item definition; V6 must delete nothing`);
  }
  if (/DELETE FROM public\.market_(listings|prices|trades)/.test(body)) {
    throw new Error(`${name} deletes market state; V6 must preserve the market`);
  }
  if (/DELETE FROM public\.player_saves/.test(body)) {
    throw new Error(`${name} deletes player saves`);
  }
  // Inspect each DELETE statement on its own, up to its terminating semicolon.
  for (const statement of body.match(/DELETE FROM[\s\S]*?;/g) ?? []) {
    for (const id of POTION_IDS) {
      if (statement.includes(`'${id}'`)) throw new Error(`${name} deletes stable potion id ${id}`);
    }
  }
}
if (
  !/UPDATE public\.game_content_items AS item\nSET name = updated\.name,\n {4}strength_pct = updated\.strength_pct/.test(
    stageContent,
  )
) {
  throw new Error("stage-content does not update the potions in place");
}
for (const potion of POTIONS) {
  const name = potionRenames.find((entry) => entry.id === potion.id).name;
  if (!stageContent.includes(`('${potion.id}', ${sqlText(name)}, ${potion.strength_pct})`)) {
    throw new Error(`stage-content does not rename and re-rate ${potion.id}`);
  }
}
if (!activate.includes("'strength_pct', potion.strength_pct")) {
  throw new Error("activate does not convert active potion buffs to the percentage shape");
}
// Least-privilege hardening ships with activation, never as a fourth migration.
if (
  !activate.includes(
    "REVOKE ALL\nON FUNCTION public.apply_strength_buff(jsonb, numeric)\nFROM PUBLIC, anon, authenticated, service_role;",
  )
) {
  throw new Error("activate does not revoke direct EXECUTE on the shared strength helper");
}
for (const [name, body] of [
  ["stage-content", stageContent],
  ["stage-world", stageWorld],
]) {
  if (body.includes("FROM PUBLIC, anon, authenticated, service_role;")) {
    throw new Error(`${name} must not carry the activation-time revoke`);
  }
}

// The public boss entry point must keep an action gate, but not the legacy-v1
// world contract that made it unusable under v5/v6.
if (!activate.includes("CREATE OR REPLACE FUNCTION public.attack_boss(")) {
  throw new Error("activate does not rebuild the public attack_boss wrapper");
}
if (!activate.includes("PERFORM public.game_assert_action_allowed(false);")) {
  throw new Error("activate does not keep a non-legacy action gate on attack_boss");
}
if (activate.includes("PERFORM public.game_assert_action_allowed(true);")) {
  throw new Error("activate still asserts the legacy v1 world contract");
}
if (!activate.includes("RETURN public.attack_boss_v1(_x, _y, _bx, _by, _passive);")) {
  throw new Error("the public wrapper must delegate to attack_boss_v1");
}
if (
  !activate.includes(
    "REVOKE ALL ON FUNCTION public.attack_boss_v1(numeric, numeric, numeric, numeric, boolean)",
  )
) {
  throw new Error("activate does not keep attack_boss_v1 non-public");
}

if (!/jsonb_set\(\n {6}s\.data,\n {6}'\{buff\}'/.test(activate)) {
  throw new Error(
    "activate must convert buffs with a targeted jsonb_set, not a whole-save rewrite",
  );
}
if (!stageContent.includes("CREATE OR REPLACE FUNCTION public.apply_strength_buff")) {
  throw new Error("stage-content does not install the shared buff helper");
}
for (const fn of ["public.use_potion", "public.attack_monster_v2", "public.attack_boss_v1"]) {
  if (!stageContent.includes(`CREATE OR REPLACE FUNCTION ${fn}`)) {
    throw new Error(`stage-content does not update ${fn}`);
  }
}
const helperCalls = (stageContent.match(/public\.apply_strength_buff\(data, attack_stat\)/g) ?? [])
  .length;
if (helperCalls !== 2) {
  throw new Error(`the shared helper must be called once per combat path, found ${helperCalls}`);
}

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
    "V6 migrations drifted from the artifacts; rerun scripts/v6/build-migrations.mjs",
  );

console.log(
  `${checkOnly ? "Verified" : "Wrote"} 3 V6 migrations: ${POTION_IDS.length} potions renamed and re-rated, ` +
    `0 items deleted; content ${contentHash}; spawns ${world.spawn_hash}`,
);

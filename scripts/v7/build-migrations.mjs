/**
 * Forward-only V7 migrations, generated from the V7 artifacts.
 *
 *   1. stage content — the v7 content rows (status 'staged') plus the
 *                      authoritative manual-eating runtime
 *   2. stage world   — the v7 spawn set (geometry identical to v6)
 *   3. activate      — validate, flip v7 to 'active', retire v6
 *
 * V7 is the live V6 catalogue plus an enumerated healing delta: 16 dishes whose
 * `heal` changes. Nothing is deleted, nothing is re-identified, and no name,
 * value, recipe, ingredient, quantity, requirement, XP value, craft duration,
 * output quantity, monster, node, quest or spawn changes. Every unchanged row
 * is copied from v6 inside the database, so it provably cannot drift.
 *
 * v1..v6 rows are left untouched, so release rollback is a control-row flip.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DELETED_ITEMS, FOODS, FOOD_IDS, RUN_ID, V6_VERSION, V7_VERSION } from "./model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const checkOnly = process.argv.includes("--check");
const VERSION = V7_VERSION;
const PREVIOUS = V6_VERSION;
const UUID_NAMESPACE = "bf50882c-ad8a-57ab-bb73-3ea3dd8fcb5c";

const paths = {
  contentSql: resolve(root, "artifacts/v7/supabase/generated/content-manifest.sql"),
  runtime: resolve(root, "supabase/v7/food-runtime.sql"),
  world: resolve(root, "content/v7/world-spawn-manifest.json"),
  previousWorld: resolve(root, "content/v6/world-spawn-manifest.json"),
  stageContent: resolve(root, "supabase/migrations/20260908120000_v7_stage_content.sql"),
  stageWorld: resolve(root, "supabase/migrations/20260908120100_v7_stage_world.sql"),
  activate: resolve(root, "supabase/migrations/20260908120200_v7_activate.sql"),
};

const [contentSql, runtimeSql, worldText, previousWorldText] = await Promise.all([
  readFile(paths.contentSql, "utf8"),
  readFile(paths.runtime, "utf8"),
  readFile(paths.world, "utf8"),
  readFile(paths.previousWorld, "utf8"),
]);
const world = JSON.parse(worldText);
const previousWorld = JSON.parse(previousWorldText);

if (world.content_version !== VERSION) throw new Error("World manifest is not v7");
const contentHash = world.source_content_manifest_hash;
if (!contentSql.includes(`Manifest SHA-256: ${contentHash}`)) {
  throw new Error("Generated content SQL hash does not match the v7 manifest");
}
if (!contentSql.includes(`Content version: ${VERSION}`))
  throw new Error("Generated content SQL is not the v7 cut");
if (DELETED_ITEMS.length) throw new Error("V7 must not delete any item definition");

// The healing release must not move a single spawn. Prove it before emitting.
const key = (spawn) => `${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`;
const previousById = new Map(previousWorld.spawns.map((spawn) => [key(spawn), spawn]));
if (previousById.size !== world.spawns.length) throw new Error("v6/v7 spawn counts differ");
for (const spawn of world.spawns) {
  const previous = previousById.get(key(spawn));
  if (!previous) throw new Error(`v7 spawn ${key(spawn)} has no v6 counterpart`);
  if (
    previous.x !== spawn.x ||
    previous.y !== spawn.y ||
    previous.biome !== spawn.biome ||
    previous.subzone !== spawn.subzone
  ) {
    throw new Error(`v7 relocated ${key(spawn)}; the healing release must not move spawns`);
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

// ---- field-level v6 -> v7 delta -------------------------------------------
const v6Manifest = JSON.parse(
  await readFile(resolve(root, "content/v6/manifest.authoring.json"), "utf8"),
).runtime;
const v7Manifest = JSON.parse(
  await readFile(resolve(root, "content/v7/manifest.authoring.json"), "utf8"),
).runtime;
const stable = (value) => JSON.stringify(value);

const sameOutside = (before, after, field, skip) => {
  const pick = (rows) =>
    rows.filter((row) => !skip.includes(row[field])).sort((l, r) => (l[field] < r[field] ? -1 : 1));
  return stable(pick(before)) === stable(pick(after));
};
if (!sameOutside(v6Manifest.items, v7Manifest.items, "id", [...FOOD_IDS])) {
  throw new Error("v7 changes an item outside the enumerated food delta");
}
// Heal-only proof: every stable food must be byte-identical to its v6 row on
// every field except stats.heal.
const foodHeals = [];
for (const id of FOOD_IDS) {
  const before = v6Manifest.items.find((item) => item.id === id);
  const after = v7Manifest.items.find((item) => item.id === id);
  if (!before) throw new Error(`v6 does not define stable food ${id}`);
  if (!after) throw new Error(`v7 does not define stable food ${id}`);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const fieldName of fields) {
    if (fieldName === "stats") continue;
    if (stable(before[fieldName]) !== stable(after[fieldName])) {
      throw new Error(
        `v7 changes ${fieldName} of ${id} (${stable(before[fieldName])} -> ${stable(after[fieldName])}); ` +
          "the healing release may only change how much a dish heals",
      );
    }
  }
  for (const statName of [...new Set([...Object.keys(before.stats), ...Object.keys(after.stats)])]) {
    if (statName === "heal") continue;
    if (stable(before.stats[statName]) !== stable(after.stats[statName])) {
      throw new Error(`v7 changes stat ${statName} of ${id}`);
    }
  }
  if (before.value !== after.value) throw new Error(`v7 changes the intrinsic value of ${id}`);
  const expected = FOODS.find((food) => food.id === id).heal;
  if (after.stats.heal !== expected) {
    throw new Error(`v7 heal for ${id} is not the frozen value ${expected}`);
  }
  foodHeals.push({ id, heal: after.stats.heal, previous: before.stats.heal });
}
for (const table of ["recipes", "monsters", "nodes", "fish", "fishing_spots", "quests", "bosses"]) {
  if (stable(v6Manifest[table]) !== stable(v7Manifest[table])) {
    throw new Error(`v7 changes ${table}, which the healing release must not do`);
  }
}
if (stable(v6Manifest.starter_loadout) !== stable(v7Manifest.starter_loadout)) {
  throw new Error("v7 changes the starter loadout, which the healing release must not do");
}
if (stable(v6Manifest.mechanics.strength_potions) !== stable(v7Manifest.mechanics.strength_potions)) {
  throw new Error("v7 changes the strength potion ladder, which this release must not do");
}

const healingRows = [...v7Manifest.mechanics.healing_foods].sort(
  (left, right) => left.tier_index - right.tier_index,
);
if (healingRows.length !== FOODS.length) throw new Error("v7 must define 16 healing foods");
healingRows.forEach((row, index) => {
  const food = FOODS[index];
  if (row.item_id !== food.id || row.tier_index !== food.tier) {
    throw new Error(`v7 food ladder disagrees with the frozen model at tier ${index + 1}`);
  }
  if (row.heal !== food.heal) throw new Error(`v7 heal for ${row.item_id} is not approved`);
  if (index > 0 && row.heal <= healingRows[index - 1].heal) {
    throw new Error("v7 healing progression must strictly increase");
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
const values = (rows) => rows.join(",\n  ");
const ruleRows = blockRows("INSERT INTO public.game_content_migration_rules");
if (ruleRows.length !== v7Manifest.migration_rules.length) {
  throw new Error("migration rule extraction is incomplete");
}

const versionStart = sqlLines.findIndex((line) =>
  line.startsWith("INSERT INTO public.game_content_versions"),
);
const versionBlock = sqlLines.slice(versionStart, versionStart + 4).join("\n");
if (!versionBlock.includes("ON CONFLICT")) throw new Error("could not extract the v7 version row");

const list = (ids) => ids.map((id) => `'${id}'`).join(", ");
const inputCount = v7Manifest.recipes.reduce((total, recipe) => total + recipe.inputs.length, 0);
const cookRecipes = v7Manifest.recipes.filter((recipe) => FOOD_IDS.includes(recipe.output_item_id));
if (cookRecipes.length !== FOOD_IDS.length) throw new Error("v7 must define one recipe per food");
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
const foodArray = `ARRAY[${list([...FOOD_IDS].sort())}]::text[]`;

// ---- 1. stage content ------------------------------------------------------
const stageContent = `-- V7 healing food release, step 1/3: stage the v7 content (inactive).
--
-- GENERATED by scripts/v7/build-migrations.mjs from
-- artifacts/v7/supabase/generated/content-manifest.sql and
-- supabase/v7/food-runtime.sql. Do not edit this file directly.
-- Content manifest sha256: ${contentHash}
--
-- v7 = live v6 content plus an enumerated healing delta. Every unchanged row is
-- copied from v6 inside the database, so it cannot drift; the changed rows are
-- updated in place:
--   * ${FOOD_IDS.length} dishes get their approved healing amount
--   * names, ids, values, recipes, ingredients, quantities, Cooking
--     requirements, XP, durations and output quantities are unchanged
--   * 0 items deleted, converted or re-identified
-- Manual eating is repaired generically at the same time: it resolves the dish
-- from the active runtime catalogue, exactly like auto-eat already does.

BEGIN;

DO $v7_stage_content_guard$
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V7 staging expects ${PREVIOUS} to be the active release';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_versions WHERE content_version = '${VERSION}' AND status = 'active') THEN
    RAISE EXCEPTION 'V7 is already active; staging must not run again';
  END IF;
END
$v7_stage_content_guard$;

${versionBlock}

DO $v7_copy_content$
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
      RAISE EXCEPTION 'V7 copy of % is incomplete (% of %)', target, copied, expected;
    END IF;
  END LOOP;
END
$v7_copy_content$;

-- ---------------------------------------------------------------------------
-- Healing delta. Nothing is deleted: the ${FOOD_IDS.length} stable dishes are updated in place,
-- so no foreign-key parent row is ever dropped and re-inserted.
-- ---------------------------------------------------------------------------
DELETE FROM public.game_content_migration_rules WHERE content_version = '${VERSION}';

UPDATE public.game_content_items AS item
SET heal = updated.heal
FROM (VALUES
  ${FOODS.map((food) => `('${food.id}', ${food.heal})`).join(",\n  ")}
) AS updated(id, heal)
WHERE item.content_version = '${VERSION}'
  AND item.id = updated.id;

INSERT INTO public.game_content_migration_rules
  (content_version, from_id, action, to_id, captured_value_required, notice_key, equipped_action, unequipped_action)
VALUES
  ${values(ruleRows)};

-- ---------------------------------------------------------------------------
-- Authoritative manual eating (generic, catalogue-driven; auto-eat unchanged).
-- ---------------------------------------------------------------------------
${runtimeSql.trim()}

DO $v7_stage_content_exit$
BEGIN
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${VERSION}') <> 'staged' THEN
    RAISE EXCEPTION 'V7 content must remain staged after step 1';
  END IF;
  IF (SELECT manifest_hash FROM public.game_content_versions WHERE content_version = '${VERSION}') <> '${contentHash}' THEN
    RAISE EXCEPTION 'V7 manifest hash was not recorded';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${VERSION}') <> ${v7Manifest.items.length} THEN
    RAISE EXCEPTION 'V7 must stage exactly ${v7Manifest.items.length} items';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${VERSION}' AND kind = 'food') <> ${FOOD_IDS.length} THEN
    RAISE EXCEPTION 'V7 must stage exactly ${FOOD_IDS.length} dishes';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'food' AND id = ANY (${foodArray})) <> ${FOOD_IDS.length} THEN
    RAISE EXCEPTION 'V7 food ids are not the approved stable ids';
  END IF;
${FOODS.map(
  (food) => `  IF (SELECT heal FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND id = '${food.id}') <> ${food.heal} THEN
    RAISE EXCEPTION 'V7 staged the wrong healing amount for ${food.id}';
  END IF;`,
).join("\n")}
  IF EXISTS (
    SELECT 1 FROM public.game_content_items AS after
    JOIN public.game_content_items AS before
      ON before.content_version = '${PREVIOUS}' AND before.id = after.id
    WHERE after.content_version = '${VERSION}'
      AND (after.name, after.value, after.level_requirement, after.tier_index, after.kind, after.stackable, after.tradable)
       IS DISTINCT FROM (before.name, before.value, before.level_requirement, before.tier_index, before.kind, before.stackable, before.tradable)
  ) THEN
    RAISE EXCEPTION 'V7 changed an item field outside the healing delta';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.game_content_items AS after
    JOIN public.game_content_items AS before
      ON before.content_version = '${PREVIOUS}' AND before.id = after.id
    WHERE after.content_version = '${VERSION}'
      AND after.kind <> 'food'
      AND after.heal IS DISTINCT FROM before.heal
  ) THEN
    RAISE EXCEPTION 'V7 changed healing outside the released dishes';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipes WHERE content_version = '${VERSION}') <> ${v7Manifest.recipes.length} THEN
    RAISE EXCEPTION 'V7 must stage exactly ${v7Manifest.recipes.length} recipes';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipe_inputs WHERE content_version = '${VERSION}') <> ${inputCount} THEN
    RAISE EXCEPTION 'V7 recipe inputs are incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_content_recipes
      WHERE content_version = '${VERSION}' AND output_item_id = ANY (${foodArray}) AND skill = 'cooking') <> ${FOOD_IDS.length} THEN
    RAISE EXCEPTION 'V7 must stage exactly ${FOOD_IDS.length} Cooking recipes';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.game_content_recipes AS recipe
    JOIN public.game_content_recipe_inputs AS input
      ON input.content_version = recipe.content_version AND input.recipe_id = recipe.id
    LEFT JOIN public.game_content_items AS ingredient
      ON ingredient.content_version = recipe.content_version AND ingredient.id = input.item_id
    WHERE recipe.content_version = '${VERSION}'
      AND recipe.output_item_id = ANY (${foodArray})
      AND (ingredient.id IS NULL OR NOT ingredient.active OR input.qty <= 0)
  ) THEN
    RAISE EXCEPTION 'A V7 Cooking recipe uses an undefined, inactive or empty ingredient';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${PREVIOUS}') <> ${v6Manifest.items.length} THEN
    RAISE EXCEPTION 'V7 staging modified the ${PREVIOUS} catalogue';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.game_content_items
    WHERE content_version = '${PREVIOUS}' AND kind = 'food' AND id = ANY (${foodArray})
      AND heal NOT IN (${[...new Set(foodHeals.map((row) => row.previous))].sort((l, r) => l - r).join(", ")})
  ) THEN
    RAISE EXCEPTION 'V7 staging modified ${PREVIOUS} healing amounts';
  END IF;
END
$v7_stage_content_exit$;

COMMIT;
`;

// ---- 2. stage world --------------------------------------------------------
const stageWorld = `-- V7 healing food release, step 2/3: stage the v7 world (inactive).
--
-- GENERATED by scripts/v7/build-migrations.mjs. Do not edit this file directly.
-- Stable spawn payload sha256: ${world.spawn_hash}
-- ${nodeCount} nodes, ${monsterCount} monsters, 0 relocated from ${PREVIOUS}:
-- the healing release changes item definitions only, never world geometry.

BEGIN;

DO $v7_stage_world_guard$
BEGIN
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${VERSION}') <> 'staged' THEN
    RAISE EXCEPTION 'V7 world staging requires staged v7 content';
  END IF;
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V7 world staging expects ${PREVIOUS} to be the active release';
  END IF;
END
$v7_stage_world_guard$;

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

DO $v7_stage_world_exit$
DECLARE
  digest text;
BEGIN
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${VERSION}') <> ${spawnCount} THEN
    RAISE EXCEPTION 'V7 spawn set is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_world_nodes WHERE content_version = '${VERSION}') <> ${nodeCount} THEN
    RAISE EXCEPTION 'V7 node state is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_world_monsters WHERE content_version = '${VERSION}') <> ${monsterCount} THEN
    RAISE EXCEPTION 'V7 monster state is incomplete';
  END IF;
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${PREVIOUS}') <> ${spawnCount} THEN
    RAISE EXCEPTION 'V7 staging modified the ${PREVIOUS} spawn set';
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || entity_type || ':' || kind || ':' || ordinal || ':' || x::float8::text
             || ':' || y::float8::text || ':' || biome || ':' || subzone, ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_content_spawns WHERE content_version = '${VERSION}';
  IF digest <> '${spawnDigest}' THEN
    RAISE EXCEPTION 'V7 spawn rows do not match the released artifact (%)', digest;
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || kind || ':' || cell || ':' || x::float8::text || ':' || y::float8::text
             || ':' || max_charges::text || ':' || gather_s::float8::text || ':' || respawn_s::text,
           ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_world_nodes WHERE content_version = '${VERSION}';
  IF digest <> '${nodeDigest}' THEN
    RAISE EXCEPTION 'V7 world nodes do not match the released artifact (%)', digest;
  END IF;

  SELECT md5(string_agg(
           spawn_id::text || ':' || kind || ':' || cell || ':' || x::float8::text || ':' || y::float8::text
             || ':' || max_hp::text || ':' || respawn_s::text, ',' ORDER BY spawn_id::text))
    INTO digest FROM public.game_world_monsters WHERE content_version = '${VERSION}';
  IF digest <> '${monsterDigest}' THEN
    RAISE EXCEPTION 'V7 world monsters do not match the released artifact (%)', digest;
  END IF;
END
$v7_stage_world_exit$;

COMMIT;
`;

// ---- 3. activate -----------------------------------------------------------
const activate = `-- V7 healing food release, step 3/3: atomically activate v7.
--
-- GENERATED by scripts/v7/build-migrations.mjs. Do not edit this file directly.
-- Content manifest sha256: ${contentHash}
-- Stable spawn payload sha256: ${world.spawn_hash}
--
-- ${PREVIOUS} keeps every content, spawn and world row and is marked 'retired',
-- so release rollback is: retire v7, re-activate ${PREVIOUS} and repoint
-- game_content_control.
--
-- No item is deleted, converted, compensated or re-identified, and no player
-- state is touched at all: saves, skills, XP, quests, gold, bank, equipment,
-- inventory, food holdings, market listings, prices and trades are untouched.

BEGIN;

DO $v7_activate_guard$
DECLARE
  issues integer;
  spawn_rows integer;
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${PREVIOUS}' THEN
    RAISE EXCEPTION 'V7 activation expects ${PREVIOUS} to be the active release';
  END IF;
  SELECT count(*) INTO issues FROM public.game_validate_content_version('${VERSION}');
  IF issues <> 0 THEN
    RAISE EXCEPTION 'V7 content failed validation with % issue(s)', issues;
  END IF;
  SELECT count(*) INTO spawn_rows FROM public.game_content_spawns WHERE content_version = '${VERSION}';
  IF spawn_rows <> ${spawnCount} THEN
    RAISE EXCEPTION 'V7 spawn set is not fully staged';
  END IF;
  IF (SELECT spawn_hash FROM public.game_world_spawn_sets WHERE content_version = '${VERSION}' AND spawn_set_version = '${VERSION}') <> '${world.spawn_hash}' THEN
    RAISE EXCEPTION 'V7 spawn hash does not match the released artifact';
  END IF;
  IF (SELECT manifest_hash FROM public.game_content_versions WHERE content_version = '${VERSION}') <> '${contentHash}' THEN
    RAISE EXCEPTION 'V7 manifest hash does not match the released artifact';
  END IF;

  -- The food ladder must be exactly the approved 16 stable ids, one per tier,
  -- each active, cooked with Cooking and healing strictly more than the tier below.
  IF (SELECT count(*) FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'food' AND active) <> ${FOOD_IDS.length} THEN
    RAISE EXCEPTION 'V7 must publish exactly ${FOOD_IDS.length} active dishes';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_content_items
             WHERE content_version = '${VERSION}' AND kind = 'food' AND NOT (id = ANY (${foodArray}))) THEN
    RAISE EXCEPTION 'V7 publishes a dish outside the approved stable id set';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT heal, level_requirement, tier_index,
             lag(heal) OVER (ORDER BY tier_index) AS previous_heal,
             lag(level_requirement) OVER (ORDER BY tier_index) AS previous_level
      FROM public.game_content_items
      WHERE content_version = '${VERSION}' AND kind = 'food'
    ) AS ladder
    WHERE previous_heal IS NOT NULL AND (heal <= previous_heal OR level_requirement <= previous_level)
  ) THEN
    RAISE EXCEPTION 'V7 food progression is not monotonic';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.game_content_items AS i
    WHERE i.content_version = '${VERSION}' AND i.kind = 'food'
      AND NOT EXISTS (SELECT 1 FROM public.game_content_recipes AS r
                      WHERE r.content_version = i.content_version AND r.output_item_id = i.id AND r.skill = 'cooking')
  ) THEN
    RAISE EXCEPTION 'V7 must publish a Cooking recipe for every dish';
  END IF;

  -- Nothing may be missing from the v7 catalogue that v6 defined.
  IF EXISTS (
    SELECT 1 FROM public.game_content_items AS before
    WHERE before.content_version = '${PREVIOUS}'
      AND NOT EXISTS (SELECT 1 FROM public.game_content_items AS after
                      WHERE after.content_version = '${VERSION}' AND after.id = before.id)
  ) THEN
    RAISE EXCEPTION 'V7 drops an item that ${PREVIOUS} defines; the healing release deletes nothing';
  END IF;
  -- Intrinsic values are frozen: this release changes healing only.
  IF EXISTS (
    SELECT 1 FROM public.game_content_items AS before
    JOIN public.game_content_items AS after ON after.content_version = '${VERSION}' AND after.id = before.id
    WHERE before.content_version = '${PREVIOUS}'
      AND (before.name, before.value, before.level_requirement, before.tier_index)
       IS DISTINCT FROM (after.name, after.value, after.level_requirement, after.tier_index)
  ) THEN
    RAISE EXCEPTION 'V7 changes an item name, value, level or tier';
  END IF;
  -- Strength potions are untouched.
  IF EXISTS (
    SELECT 1 FROM public.game_content_items AS before
    JOIN public.game_content_items AS after ON after.content_version = '${VERSION}' AND after.id = before.id
    WHERE before.content_version = '${PREVIOUS}' AND before.kind = 'potion'
      AND (before.strength_pct, before.boost_hits) IS DISTINCT FROM (after.strength_pct, after.boost_hits)
  ) THEN
    RAISE EXCEPTION 'V7 changes a strength potion';
  END IF;
END
$v7_activate_guard$;

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

DO $v7_activate_exit$
BEGIN
  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> '${VERSION}' THEN
    RAISE EXCEPTION 'V7 activation did not take effect';
  END IF;
  IF (SELECT active_spawn_set_version FROM public.game_content_control WHERE singleton) <> '${VERSION}' THEN
    RAISE EXCEPTION 'V7 spawn set activation did not take effect';
  END IF;
  IF (SELECT status FROM public.game_content_versions WHERE content_version = '${PREVIOUS}') <> 'retired' THEN
    RAISE EXCEPTION '${PREVIOUS} must be retained as retired for rollback';
  END IF;
  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = '${PREVIOUS}') <> ${spawnCount} THEN
    RAISE EXCEPTION '${PREVIOUS} rollback data was modified';
  END IF;
  IF (SELECT count(*) FROM public.game_content_items WHERE content_version = '${PREVIOUS}') <> ${v6Manifest.items.length} THEN
    RAISE EXCEPTION '${PREVIOUS} rollback catalogue was modified';
  END IF;

  -- Every item reference in every save must resolve against v7.
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
    RAISE EXCEPTION 'A save references an item definition v7 does not define';
  END IF;

  -- Manual eating must resolve every published dish through the runtime view.
  IF (SELECT count(*) FROM public.game_runtime_items
      WHERE kind = 'food' AND heal > 0 AND id = ANY (${foodArray})) <> ${FOOD_IDS.length} THEN
    RAISE EXCEPTION 'Not every released dish is resolvable by the runtime catalogue';
  END IF;

  IF (SELECT maintenance_mode FROM public.game_release_control WHERE singleton) THEN
    RAISE EXCEPTION 'V7 activation must not leave the game in maintenance mode';
  END IF;
END
$v7_activate_exit$;

COMMIT;
`;

// ---- emitted-SQL regression proofs ----------------------------------------
// The staged runtime function legitimately writes the caller's own save row;
// the migration DDL around it must not touch player state at all.
const stageContentDdl = stageContent.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\n\$\$;/g, "");
for (const [name, body] of [
  ["stage-content", stageContentDdl],
  ["stage-world", stageWorld],
  ["activate", activate],
]) {
  if (/DELETE FROM public\.game_content_items/.test(body)) {
    throw new Error(`${name} deletes an item definition; V7 must delete nothing`);
  }
  if (/DELETE FROM public\.market_(listings|prices|trades)/.test(body)) {
    throw new Error(`${name} deletes market state; V7 must preserve the market`);
  }
  if (/(DELETE FROM|UPDATE) public\.player_saves/.test(body)) {
    throw new Error(`${name} mutates player saves; V7 must not touch player state`);
  }
  for (const statement of body.match(/DELETE FROM[\s\S]*?;/g) ?? []) {
    for (const id of FOOD_IDS) {
      if (statement.includes(`'${id}'`)) throw new Error(`${name} deletes stable food id ${id}`);
    }
  }
  if (/UPDATE public\.game_content_items[\s\S]{0,200}SET[^;]*\bvalue\s*=/.test(body)) {
    throw new Error(`${name} changes an intrinsic value; V7 freezes food prices`);
  }
}
if (!/UPDATE public\.game_content_items AS item\nSET heal = updated\.heal/.test(stageContent)) {
  throw new Error("stage-content does not update the dishes in place");
}
for (const food of FOODS) {
  if (!stageContent.includes(`('${food.id}', ${food.heal})`)) {
    throw new Error(`stage-content does not re-rate ${food.id}`);
  }
}
if (!stageContent.includes("CREATE OR REPLACE FUNCTION public.consume_food(_index integer)")) {
  throw new Error("stage-content does not install the repaired manual-eating entry point");
}
if (!stageContent.includes("FROM public.game_runtime_items AS item")) {
  throw new Error("manual eating must resolve food from the active runtime catalogue");
}
const consumeFoodBody = (stageContent.match(
  /CREATE OR REPLACE FUNCTION public\.consume_food\(_index integer\)[\s\S]*?\n\$\$;/,
) ?? [""])[0];
if (!consumeFoodBody) throw new Error("stage-content has no manual-eating function body");
if (/public\.game_items/.test(consumeFoodBody)) {
  throw new Error("manual eating still reads the legacy game_items table");
}
for (const guard of ["FOR UPDATE", "'not_food'", "'too_fast'", "'full_health'", "least(heal, max_hp - hp)"]) {
  if (!consumeFoodBody.includes(guard)) {
    throw new Error(`manual eating is missing its ${guard} guarantee`);
  }
}
if (/CREATE OR REPLACE FUNCTION public\.try_auto_eat/.test(stageContent + activate)) {
  throw new Error("V7 must not change auto-eat semantics");
}

const outputs = [
  [paths.stageContent, stageContent],
  [paths.stageWorld, stageWorld],
  [paths.activate, activate],
];
for (const [file, body] of outputs) {
  if (checkOnly) {
    const existing = await readFile(file, "utf8").catch(() => "");
    if (existing !== body) {
      throw new Error(`V7 migration drifted: ${file.slice(root.length + 1)}; run bun run v7:build`);
    }
  } else {
    await writeFile(file, body);
  }
}

console.log(
  `${checkOnly ? "Verified" : "Wrote"} 3 V7 migrations (content ${contentHash.slice(0, 12)}, ` +
    `spawns ${world.spawn_hash.slice(0, 12)}, ${FOOD_IDS.length} dishes re-rated, 0 deleted)`,
);

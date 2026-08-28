/**
 * Forward-only V3 migrations, generated from the V3 artifacts.
 *
 *   1. stage content  — v3 rows in the content tables, status 'staged'
 *   2. stage world    — v3 spawn set, spawns and world node/monster rows
 *   3. activate       — validate, flip v3 to 'active', repoint the control row
 *
 * V3 gameplay content is by definition the live V2 content, so the migrations
 * copy the v2 rows inside the database instead of re-inserting a literal dump:
 * the copy is the proof that nothing changed. Only the four spawns the current
 * world blocks are patched, from literals taken straight from the artifact, and
 * every step ends with a digest assertion against the artifact hashes so the
 * database cannot silently diverge from the committed release.
 *
 * Nothing here touches v1 or v2 rows, player saves or market listings, so
 * rollback is a single control-row update back to v2.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const checkOnly = process.argv.includes("--check");
const VERSION = "v3";
const PREVIOUS = "v2";
const RUN_ID = "v3-consolidation-20260828";

// Every content table that is keyed by content_version and is pure content.
// game_content_versions, game_content_spawns, the world tables and the market
// tables are handled explicitly.
const CONTENT_TABLES = [
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
  "game_content_migration_rules",
  "game_content_progression_levels",
];

const paths = {
  contentSql: resolve(root, "supabase/generated/content-manifest.sql"),
  world: resolve(root, "content/v3/world-spawn-manifest.json"),
  v2World: resolve(root, "content/v2/world-spawn-manifest.json"),
  reachability: resolve(root, "docs/overhaul/v3/reachability-report.json"),
  stageContent: resolve(root, "supabase/migrations/20260828120000_v3_stage_content.sql"),
  stageWorld: resolve(root, "supabase/migrations/20260828120100_v3_stage_world.sql"),
  activate: resolve(root, "supabase/migrations/20260828120200_v3_activate.sql"),
};

const [contentSqlRaw, worldText, v2WorldText, reachabilityText] = await Promise.all([
  readFile(paths.contentSql, "utf8"),
  readFile(paths.world, "utf8"),
  readFile(paths.v2World, "utf8"),
  readFile(paths.reachability, "utf8"),
]);
const world = JSON.parse(worldText);
const v2World = JSON.parse(v2WorldText);
const reachability = JSON.parse(reachabilityText);

if (world.content_version !== VERSION) throw new Error("World manifest is not v3");
if (reachability.spawn_hash !== world.spawn_hash) throw new Error("v3 spawn/reachability hash mismatch");
if (reachability.summary.spawn_issues || reachability.summary.unreachable_clusters || reachability.summary.failed_tiers) {
  throw new Error("Refusing to generate v3 SQL from failing reachability evidence");
}

const contentHash = world.source_content_manifest_hash;
if (!contentSqlRaw.includes(`Manifest SHA-256: ${contentHash}`)) {
  throw new Error("Generated content SQL hash does not match the v3 manifest");
}

const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sqlJson = (value) => `${sqlText(JSON.stringify(value))}::jsonb`;
const sqlNumber = (value) => {
  if (!Number.isFinite(value)) throw new Error(`Cannot emit non-finite SQL number: ${value}`);
  return String(value);
};
const sha = (value) => createHash("sha256").update(value).digest("hex");
const md5 = (value) => createHash("md5").update(value).digest("hex");

// Digests mirror `md5(string_agg(..., ',' ORDER BY spawn_id))` in SQL.
const bySpawnId = [...world.spawns].sort((left, right) => (left.spawn_id < right.spawn_id ? -1 : 1));
const num = (value) => String(Number(value));
const spawnDigest = md5(
  bySpawnId.map((s) => `${s.spawn_id}:${s.entity_type}:${s.kind}:${s.ordinal}:${num(s.x)}:${num(s.y)}:${s.biome}:${s.subzone}`).join(","),
);
const nodeDigest = md5(
  bySpawnId.filter((s) => s.entity_type === "node")
    .map((s) => `${s.spawn_id}:${s.kind}:${s.cell}:${num(s.x)}:${num(s.y)}:${s.max_charges}:${num(s.gather_s)}:${s.respawn_s}`).join(","),
);
const monsterDigest = md5(
  bySpawnId.filter((s) => s.entity_type === "monster")
    .map((s) => `${s.spawn_id}:${s.kind}:${s.cell}:${num(s.x)}:${num(s.y)}:${s.max_hp}:${s.respawn_s}`).join(","),
);

const v2ById = new Map(v2World.spawns.map((spawn) => [`${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`, spawn]));
const relocated = world.spawns
  .map((spawn) => ({ spawn, previous: v2ById.get(`${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`) }))
  .filter(({ spawn, previous }) => previous && (previous.x !== spawn.x || previous.y !== spawn.y))
  .sort((left, right) => (left.spawn.spawn_id < right.spawn.spawn_id ? -1 : 1));
if (relocated.length !== world.relocation.relocated_rows) {
  throw new Error("Relocation set does not match the world manifest");
}

const nodeCount = world.counts.nodes;
const monsterCount = world.counts.monsters;
const spawnCount = world.spawns.length;
const versionRow = {
  notice: null,
};
void versionRow;

// ---- 1. stage content ------------------------------------------------------
const stageContent = [
  "-- V3 consolidation, step 1/3: stage v3 content (inactive).",
  "--",
  "-- GENERATED by scripts/v3/build-migrations.mjs. Do not edit this file directly.",
  `-- Content manifest sha256: ${contentHash}`,
  `-- Generated content SQL sha256: ${sha(contentSqlRaw)}`,
  "-- v3 gameplay content is the live v2 content: every content row is copied",
  "-- from v2 inside the database, so no value can drift during the release.",
  "-- v1 and v2 rows are left untouched so rollback stays a control-row update.",
  "",
  "BEGIN;",
  "",
  "DO $v3_stage_content_guard$",
  "BEGIN",
  `  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> ${sqlText(PREVIOUS)} THEN`,
  `    RAISE EXCEPTION 'V3 staging expects ${PREVIOUS} to be the active release';`,
  "  END IF;",
  `  IF EXISTS (SELECT 1 FROM public.game_content_versions WHERE content_version = ${sqlText(VERSION)} AND status = 'active') THEN`,
  "    RAISE EXCEPTION 'V3 is already active; staging must not run again';",
  "  END IF;",
  "END",
  "$v3_stage_content_guard$;",
  "",
  "-- The version row: same player notice and content as v2, new identity/hash.",
  "INSERT INTO public.game_content_versions",
  "  (content_version, spawn_set_version, uuid_namespace, status, manifest_hash, player_notice, starter_loadout, mechanics)",
  `SELECT ${sqlText(VERSION)}, ${sqlText(VERSION)}, uuid_namespace, 'staged', ${sqlText(contentHash)}, player_notice, starter_loadout, mechanics`,
  `FROM public.game_content_versions WHERE content_version = ${sqlText(PREVIOUS)}`,
  "ON CONFLICT (content_version) DO UPDATE SET",
  "  spawn_set_version = EXCLUDED.spawn_set_version,",
  "  uuid_namespace = EXCLUDED.uuid_namespace,",
  "  manifest_hash = EXCLUDED.manifest_hash,",
  "  player_notice = EXCLUDED.player_notice,",
  "  starter_loadout = EXCLUDED.starter_loadout,",
  "  mechanics = EXCLUDED.mechanics;",
  "",
  "DO $v3_copy_content$",
  "DECLARE",
  "  target text;",
  "  column_list text;",
  "  projection text;",
  "  copied bigint;",
  "  expected bigint;",
  "BEGIN",
  `  FOREACH target IN ARRAY ARRAY[${CONTENT_TABLES.map(sqlText).join(", ")}] LOOP`,
  "    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum),",
  `           string_agg(CASE WHEN attname = 'content_version' THEN ${sqlText(sqlText(VERSION))}`,
  "                           ELSE quote_ident(attname) END, ', ' ORDER BY attnum)",
  "      INTO column_list, projection",
  "    FROM pg_attribute",
  "    WHERE attrelid = format('public.%I', target)::regclass AND attnum > 0 AND NOT attisdropped;",
  "",
  "    EXECUTE format(",
  "      'DELETE FROM public.%I WHERE content_version = %L', target, " + sqlText(VERSION) + ");",
  "    EXECUTE format(",
  "      'INSERT INTO public.%I (%s) SELECT %s FROM public.%I WHERE content_version = %L',",
  "      target, column_list, projection, target, " + sqlText(PREVIOUS) + ");",
  "",
  "    EXECUTE format('SELECT count(*) FROM public.%I WHERE content_version = %L', target, " + sqlText(VERSION) + ") INTO copied;",
  "    EXECUTE format('SELECT count(*) FROM public.%I WHERE content_version = %L', target, " + sqlText(PREVIOUS) + ") INTO expected;",
  "    IF copied <> expected OR expected = 0 THEN",
  "      RAISE EXCEPTION 'V3 copy of % is incomplete (% of %)', target, copied, expected;",
  "    END IF;",
  "  END LOOP;",
  "END",
  "$v3_copy_content$;",
  "",
  "DO $v3_stage_content_exit$",
  "BEGIN",
  `  IF (SELECT status FROM public.game_content_versions WHERE content_version = ${sqlText(VERSION)}) <> 'staged' THEN`,
  "    RAISE EXCEPTION 'V3 content must remain staged after step 1';",
  "  END IF;",
  `  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> ${sqlText(PREVIOUS)} THEN`,
  "    RAISE EXCEPTION 'V3 staging changed the active release';",
  "  END IF;",
  "END",
  "$v3_stage_content_exit$;",
  "",
  "COMMIT;",
  "",
].join("\n");

// ---- 2. stage world --------------------------------------------------------
const relocationUpdates = relocated.flatMap(({ spawn }) => [
  `UPDATE public.game_content_spawns SET x = ${sqlNumber(spawn.x)}, y = ${sqlNumber(spawn.y)}`,
  `WHERE content_version = ${sqlText(VERSION)} AND entity_type = ${sqlText(spawn.entity_type)}`,
  `  AND kind = ${sqlText(spawn.kind)} AND ordinal = ${sqlNumber(spawn.ordinal)};`,
  "",
]);
const cellFixes = relocated.flatMap(({ spawn }) => {
  const table = spawn.entity_type === "node" ? "game_world_nodes" : "game_world_monsters";
  return [
    `UPDATE public.${table} SET x = ${sqlNumber(spawn.x)}, y = ${sqlNumber(spawn.y)}, cell = ${sqlText(spawn.cell)}`,
    `WHERE spawn_id = ${sqlText(spawn.spawn_id)};`,
    "",
  ];
});

const stageWorld = [
  "-- V3 consolidation, step 2/3: stage the v3 world (inactive).",
  "--",
  "-- GENERATED by scripts/v3/build-migrations.mjs. Do not edit this file directly.",
  `-- World manifest artifact sha256: ${sha(worldText)}`,
  `-- Reachability artifact sha256: ${sha(reachabilityText)}`,
  `-- Stable spawn payload sha256: ${world.spawn_hash}`,
  `-- ${nodeCount} nodes, ${monsterCount} monsters, ${relocated.length} relocated from v2.`,
  "",
  "BEGIN;",
  "",
  "DO $v3_stage_world_guard$",
  "BEGIN",
  `  IF (SELECT status FROM public.game_content_versions WHERE content_version = ${sqlText(VERSION)}) <> 'staged' THEN`,
  "    RAISE EXCEPTION 'V3 world staging requires staged v3 content';",
  "  END IF;",
  `  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> ${sqlText(PREVIOUS)} THEN`,
  `    RAISE EXCEPTION 'V3 world staging expects ${PREVIOUS} to be the active release';`,
  "  END IF;",
  "END",
  "$v3_stage_world_guard$;",
  "",
  "INSERT INTO public.game_world_spawn_sets",
  "  (content_version, spawn_set_version, source_content_manifest_hash, spawn_hash, model_version,",
  "   cluster_probability, world_width, world_height, movement_speed, path_cell_size,",
  "   winter_geometry, reachability_summary)",
  `VALUES (${sqlText(VERSION)}, ${sqlText(VERSION)}, ${sqlText(world.source_content_manifest_hash)}, ` +
    `${sqlText(world.spawn_hash)}, ${sqlText(world.model_version)}, ` +
    `${sqlNumber(world.cluster_selection.clustered_probability)}, ` +
    `${sqlNumber(world.world.width)}, ${sqlNumber(world.world.height)}, ` +
    `${sqlNumber(world.world.movement_speed_world_units_per_second)}, ${sqlNumber(world.world.path_cell_size)}, ` +
    `${sqlJson(world.winter_geometry)}, ${sqlJson(reachability.summary)})`,
  "ON CONFLICT (content_version, spawn_set_version) DO UPDATE SET",
  "  source_content_manifest_hash = EXCLUDED.source_content_manifest_hash,",
  "  spawn_hash = EXCLUDED.spawn_hash,",
  "  model_version = EXCLUDED.model_version,",
  "  cluster_probability = EXCLUDED.cluster_probability,",
  "  world_width = EXCLUDED.world_width,",
  "  world_height = EXCLUDED.world_height,",
  "  movement_speed = EXCLUDED.movement_speed,",
  "  path_cell_size = EXCLUDED.path_cell_size,",
  "  winter_geometry = EXCLUDED.winter_geometry,",
  "  reachability_summary = EXCLUDED.reachability_summary;",
  "",
  "-- Spawn identities carry forward from v2; only the UUID namespace input",
  "-- changes (v2:... -> v3:...), which is exactly what the artifact encodes.",
  `DELETE FROM public.game_world_nodes WHERE content_version = ${sqlText(VERSION)};`,
  `DELETE FROM public.game_world_monsters WHERE content_version = ${sqlText(VERSION)};`,
  `DELETE FROM public.game_content_spawns WHERE content_version = ${sqlText(VERSION)};`,
  "",
  "INSERT INTO public.game_content_spawns",
  "  (spawn_id, content_version, spawn_set_version, entity_type, kind, ordinal, active, biome, subzone, x, y)",
  "SELECT extensions.uuid_generate_v5(",
  `         ${sqlText(world.uuid_namespace)}::uuid,`,
  `         ${sqlText(VERSION)} || ':' || entity_type || ':' || kind || ':' || ordinal),`,
  `       ${sqlText(VERSION)}, ${sqlText(VERSION)}, entity_type, kind, ordinal, active, biome, subzone, x, y`,
  "FROM public.game_content_spawns",
  `WHERE content_version = ${sqlText(PREVIOUS)};`,
  "",
  "-- Spawns the current world blocks, moved to their artifact positions.",
  ...relocationUpdates,
  "INSERT INTO public.game_world_nodes",
  "  (spawn_id, content_version, spawn_set_version, entity_type, kind, cell, biome, subzone, x, y,",
  "   charges, max_charges, gather_s, respawn_s)",
  `SELECT spawn.spawn_id, ${sqlText(VERSION)}, ${sqlText(VERSION)}, 'node', spawn.kind, previous_world.cell, spawn.biome, spawn.subzone,`,
  "       spawn.x, spawn.y, definition.max_charges, definition.max_charges, definition.gather_s, definition.respawn_s",
  "FROM public.game_content_spawns AS spawn",
  `JOIN public.game_content_nodes AS definition ON definition.content_version = ${sqlText(VERSION)} AND definition.kind = spawn.kind`,
  `JOIN public.game_content_spawns AS previous ON previous.content_version = ${sqlText(PREVIOUS)}`,
  "  AND previous.entity_type = spawn.entity_type AND previous.kind = spawn.kind AND previous.ordinal = spawn.ordinal",
  "JOIN public.game_world_nodes AS previous_world ON previous_world.spawn_id = previous.spawn_id",
  `WHERE spawn.content_version = ${sqlText(VERSION)} AND spawn.entity_type = 'node';`,
  "",
  "INSERT INTO public.game_world_monsters",
  "  (spawn_id, content_version, spawn_set_version, entity_type, kind, cell, biome, subzone, x, y, hp, max_hp, respawn_s)",
  `SELECT spawn.spawn_id, ${sqlText(VERSION)}, ${sqlText(VERSION)}, 'monster', spawn.kind, previous_world.cell, spawn.biome, spawn.subzone,`,
  "       spawn.x, spawn.y, definition.hp, definition.hp, definition.respawn_s",
  "FROM public.game_content_spawns AS spawn",
  `JOIN public.game_content_monsters AS definition ON definition.content_version = ${sqlText(VERSION)} AND definition.kind = spawn.kind`,
  `JOIN public.game_content_spawns AS previous ON previous.content_version = ${sqlText(PREVIOUS)}`,
  "  AND previous.entity_type = spawn.entity_type AND previous.kind = spawn.kind AND previous.ordinal = spawn.ordinal",
  "JOIN public.game_world_monsters AS previous_world ON previous_world.spawn_id = previous.spawn_id",
  `WHERE spawn.content_version = ${sqlText(VERSION)} AND spawn.entity_type = 'monster';`,
  "",
  "-- Relocated rows also change subscription cell.",
  ...cellFixes,
  "DO $v3_stage_world_exit$",
  "DECLARE",
  "  digest text;",
  "BEGIN",
  `  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = ${sqlText(VERSION)}) <> ${spawnCount} THEN`,
  "    RAISE EXCEPTION 'V3 spawn set is incomplete';",
  "  END IF;",
  `  IF (SELECT count(*) FROM public.game_world_nodes WHERE content_version = ${sqlText(VERSION)}) <> ${nodeCount} THEN`,
  "    RAISE EXCEPTION 'V3 node state is incomplete';",
  "  END IF;",
  `  IF (SELECT count(*) FROM public.game_world_monsters WHERE content_version = ${sqlText(VERSION)}) <> ${monsterCount} THEN`,
  "    RAISE EXCEPTION 'V3 monster state is incomplete';",
  "  END IF;",
  `  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = ${sqlText(PREVIOUS)}) <> ${v2World.spawns.length} THEN`,
  "    RAISE EXCEPTION 'V3 staging modified the v2 spawn set';",
  "  END IF;",
  "",
  "  SELECT md5(string_agg(",
  "           spawn_id::text || ':' || entity_type || ':' || kind || ':' || ordinal || ':' || x::float8::text",
  "             || ':' || y::float8::text || ':' || biome || ':' || subzone, ',' ORDER BY spawn_id::text))",
  `    INTO digest FROM public.game_content_spawns WHERE content_version = ${sqlText(VERSION)};`,
  `  IF digest <> ${sqlText(spawnDigest)} THEN`,
  "    RAISE EXCEPTION 'V3 spawn rows do not match the released artifact (%)', digest;",
  "  END IF;",
  "",
  "  SELECT md5(string_agg(",
  "           spawn_id::text || ':' || kind || ':' || cell || ':' || x::float8::text || ':' || y::float8::text",
  "             || ':' || max_charges || ':' || gather_s::float8::text || ':' || respawn_s, ',' ORDER BY spawn_id::text))",
  `    INTO digest FROM public.game_world_nodes WHERE content_version = ${sqlText(VERSION)};`,
  `  IF digest <> ${sqlText(nodeDigest)} THEN`,
  "    RAISE EXCEPTION 'V3 node rows do not match the released artifact (%)', digest;",
  "  END IF;",
  "",
  "  SELECT md5(string_agg(",
  "           spawn_id::text || ':' || kind || ':' || cell || ':' || x::float8::text || ':' || y::float8::text",
  "             || ':' || max_hp || ':' || respawn_s, ',' ORDER BY spawn_id::text))",
  `    INTO digest FROM public.game_world_monsters WHERE content_version = ${sqlText(VERSION)};`,
  `  IF digest <> ${sqlText(monsterDigest)} THEN`,
  "    RAISE EXCEPTION 'V3 monster rows do not match the released artifact (%)', digest;",
  "  END IF;",
  "",
  `  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> ${sqlText(PREVIOUS)} THEN`,
  "    RAISE EXCEPTION 'V3 world staging changed the active release';",
  "  END IF;",
  "END",
  "$v3_stage_world_exit$;",
  "",
  "COMMIT;",
  "",
].join("\n");

// ---- 3. activate -----------------------------------------------------------
const activate = [
  "-- V3 consolidation, step 3/3: atomically activate v3.",
  "--",
  "-- GENERATED by scripts/v3/build-migrations.mjs. Do not edit this file directly.",
  `-- Content manifest sha256: ${contentHash}`,
  `-- Stable spawn payload sha256: ${world.spawn_hash}`,
  "-- v2 keeps every content, spawn and world row and is marked 'retired', so",
  "-- rollback is: retire v3, re-activate v2 and repoint game_content_control.",
  "",
  "BEGIN;",
  "",
  "DO $v3_activate_guard$",
  "DECLARE",
  "  issues integer;",
  "  spawn_rows integer;",
  "BEGIN",
  `  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> ${sqlText(PREVIOUS)} THEN`,
  `    RAISE EXCEPTION 'V3 activation expects ${PREVIOUS} to be the active release';`,
  "  END IF;",
  `  SELECT count(*) INTO issues FROM public.game_validate_content_version(${sqlText(VERSION)});`,
  "  IF issues <> 0 THEN",
  "    RAISE EXCEPTION 'V3 content failed validation with % issue(s)', issues;",
  "  END IF;",
  `  SELECT count(*) INTO spawn_rows FROM public.game_content_spawns WHERE content_version = ${sqlText(VERSION)};`,
  `  IF spawn_rows <> ${spawnCount} THEN`,
  "    RAISE EXCEPTION 'V3 spawn set is not fully staged';",
  "  END IF;",
  `  IF (SELECT spawn_hash FROM public.game_world_spawn_sets WHERE content_version = ${sqlText(VERSION)} AND spawn_set_version = ${sqlText(VERSION)}) <> ${sqlText(world.spawn_hash)} THEN`,
  "    RAISE EXCEPTION 'V3 spawn hash does not match the released artifact';",
  "  END IF;",
  `  IF (SELECT manifest_hash FROM public.game_content_versions WHERE content_version = ${sqlText(VERSION)}) <> ${sqlText(contentHash)} THEN`,
  "    RAISE EXCEPTION 'V3 manifest hash does not match the released artifact';",
  "  END IF;",
  "END",
  "$v3_activate_guard$;",
  "",
  "-- Only one row may hold status 'active', so v2 retires in the same",
  "-- transaction. Its content, spawn and world rows are all kept intact.",
  "UPDATE public.game_content_versions",
  "SET status = 'retired'",
  `WHERE content_version = ${sqlText(PREVIOUS)};`,
  "",
  "UPDATE public.game_content_versions",
  "SET status = 'active'",
  `WHERE content_version = ${sqlText(VERSION)};`,
  "",
  "UPDATE public.game_content_control",
  `SET active_content_version = ${sqlText(VERSION)},`,
  `    active_spawn_set_version = ${sqlText(VERSION)},`,
  `    minimum_client_content_version = ${sqlText(VERSION)},`,
  `    manifest_hash = ${sqlText(contentHash)},`,
  "    activation_timestamp = now(),",
  `    migration_run_id = ${sqlText(RUN_ID)}`,
  "WHERE singleton;",
  "",
  "UPDATE public.game_release_control",
  `SET minimum_client_content_version = ${sqlText(VERSION)},`,
  "    updated_at = now()",
  "WHERE singleton;",
  "",
  "DO $v3_activate_exit$",
  "BEGIN",
  `  IF (SELECT active_content_version FROM public.game_content_control WHERE singleton) <> ${sqlText(VERSION)} THEN`,
  "    RAISE EXCEPTION 'V3 activation did not take effect';",
  "  END IF;",
  `  IF (SELECT active_spawn_set_version FROM public.game_content_control WHERE singleton) <> ${sqlText(VERSION)} THEN`,
  "    RAISE EXCEPTION 'V3 spawn set activation did not take effect';",
  "  END IF;",
  `  IF (SELECT status FROM public.game_content_versions WHERE content_version = ${sqlText(PREVIOUS)}) <> 'retired' THEN`,
  "    RAISE EXCEPTION 'v2 must be retained as retired for rollback';",
  "  END IF;",
  `  IF (SELECT count(*) FROM public.game_content_spawns WHERE content_version = ${sqlText(PREVIOUS)}) <> ${v2World.spawns.length} THEN`,
  "    RAISE EXCEPTION 'v2 rollback data was modified';",
  "  END IF;",
  "  IF (SELECT maintenance_mode FROM public.game_release_control WHERE singleton) THEN",
  "    RAISE EXCEPTION 'V3 activation must not leave the game in maintenance mode';",
  "  END IF;",
  "END",
  "$v3_activate_exit$;",
  "",
  "COMMIT;",
  "",
].join("\n");

const outputs = [
  [paths.stageContent, stageContent],
  [paths.stageWorld, stageWorld],
  [paths.activate, activate],
];

for (const [file, rendered] of outputs) {
  if (checkOnly) {
    const existing = await readFile(file, "utf8").catch(() => "");
    if (existing !== rendered) throw new Error(`V3 migration drifted: ${file}; run bun run v3:build`);
  } else {
    await writeFile(file, rendered);
  }
}

console.log(
  `${checkOnly ? "Verified" : "Wrote"} 3 V3 migrations (content ${contentHash.slice(0, 8)}, spawns ${world.spawn_hash.slice(0, 8)})`,
);

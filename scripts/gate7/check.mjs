import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { manifestHash, uuidV5 } from "../content/model.mjs";
import { auditLegacyV1World } from "./legacy-v1-world.mjs";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function runGenerator(label, script, needsTypeScriptLoader = false) {
  const args = needsTypeScriptLoader
    ? [
        "--no-warnings",
        "--experimental-strip-types",
        "--loader",
        resolve(root, "scripts/gate5/ts-loader.mjs"),
        resolve(root, script),
        "--check",
      ]
    : [resolve(root, script), "--check"];
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${result.stderr || result.stdout || "unknown error"}`);
  }
}

runGenerator("Gate 7 world manifest check", "scripts/gate7/build-world.mjs", true);
runGenerator("Gate 7 reachability check", "scripts/gate7/reachability.mjs", true);
runGenerator("Gate 7 migration check", "scripts/gate7/build-migration.mjs");

const [
  manifestText,
  reportText,
  contentText,
  liveText,
  runtime,
  migration,
  gate4,
  gate5,
  gate6,
  legacyV1,
] = await Promise.all([
  read("content/v2/world-spawn-manifest.json"),
  read("docs/overhaul/gate-7/reachability-report.json"),
  read("content/v2/manifest.authoring.json"),
  read("docs/overhaul/gate-5/live-v1-spawns.json"),
  read("supabase/gate7/world-runtime.sql"),
  read("supabase/migrations/20260824100000_gate7_versioned_world.sql"),
  read("supabase/migrations/20260824070000_gate4_content_contract.sql"),
  read("supabase/migrations/20260824080000_gate5_complete_content_contract.sql"),
  read("supabase/migrations/20260824090000_gate6_inactive_server_content.sql"),
  auditLegacyV1World(root),
]);
const manifest = JSON.parse(manifestText);
const report = JSON.parse(reportText);
const content = JSON.parse(contentText);
const live = JSON.parse(liveText);

const expectedHistoryHashes = {
  gate4: "f063c816e8915333404a5fd1c19a499d0828f2849c2d70bdcee61dacdc0c3dd9",
  gate5: "d21b4f659ebf8e897d006312ca08e61867708a46382fd345c492b47c929f8157",
  gate6: "14182078010419c1093cfdb574d3cdcdf5ad39b5b311ef1e24ae319d5494200a",
};
assert(sha256(gate4) === expectedHistoryHashes.gate4, "Gate 4 migration history changed");
assert(sha256(gate5) === expectedHistoryHashes.gate5, "Gate 5 migration history changed");
assert(sha256(gate6) === expectedHistoryHashes.gate6, "Gate 6 migration history changed");

assert(manifest.schema_version === "tomlandia-world-spawn-manifest/v1", "Unexpected world manifest schema");
assert(manifest.model_version === "tomlandia-gate7-world-model/v1", "Unexpected world model version");
assert(manifest.content_version === "v2" && manifest.spawn_set_version === "v2", "Gate 7 must stage v2/v2");
assert(manifest.source_content_manifest_hash === manifestHash(content), "World source content hash drifted");
assert(
  manifest.spawn_hash === manifestHash({
    content_version: manifest.content_version,
    spawn_set_version: manifest.spawn_set_version,
    spawns: manifest.spawns,
  }),
  "Stable spawn payload hash drifted",
);
assert(manifest.world.width === 5600 && manifest.world.height === 3750, "World dimensions drifted");
assert(manifest.world.path_cell_size === 40, "A* path cell size drifted");
assert(manifest.world.movement_speed_world_units_per_second === 130, "Movement speed drifted");
assert(
  manifest.world.subscription_cell.width === 700 && manifest.world.subscription_cell.height === 500,
  "Subscription cell dimensions drifted",
);

const spawns = manifest.spawns;
const spawnIds = new Set(spawns.map((spawn) => spawn.spawn_id));
assert(spawns.length === 730 && spawnIds.size === 730, "Gate 7 requires exactly 730 unique UUID spawns");
assert(manifest.counts.nodes === 369 && manifest.counts.monsters === 361, "Gate 7 spawn counts drifted");
assert(spawns.filter((spawn) => spawn.entity_type === "node").length === 369, "Node count is not 369");
assert(spawns.filter((spawn) => spawn.entity_type === "monster").length === 361, "Monster count is not 361");
assert(new Set(spawns.map((spawn) => spawn.cluster_id)).size === 152, "Cluster count is not 152");
assert(
  spawns.every((spawn, index) => index === 0 || spawns[index - 1].spawn_id < spawn.spawn_id),
  "World manifest is not strictly UUID-sorted",
);

const nodeDefinitions = new Map(content.runtime.nodes.map((row) => [row.kind, row]));
const monsterDefinitions = new Map(content.runtime.monsters.map((row) => [row.kind, row]));
const sourceSpawns = new Map();
for (const entityType of ["node", "monster"]) {
  for (const spawn of content.runtime[`${entityType}_spawns`]) {
    sourceSpawns.set(`${entityType}:${spawn.kind}:${spawn.ordinal}`, spawn);
  }
}
const stableUnit = (key) => createHash("sha256").update(key).digest().readUInt32BE(0) / 0x1_0000_0000;
let carryForward = 0;
let generated = 0;
let clustered = 0;
let fallback = 0;
for (const spawn of spawns) {
  const key = `${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`;
  const source = sourceSpawns.get(key);
  const definition = spawn.entity_type === "node"
    ? nodeDefinitions.get(spawn.kind)
    : monsterDefinitions.get(spawn.kind);
  assert(source, `Missing source spawn ${key}`);
  assert(definition, `Missing definition for ${spawn.entity_type}:${spawn.kind}`);
  assert(
    spawn.spawn_id === uuidV5(manifest.uuid_namespace, `${manifest.spawn_set_version}:${key}`),
    `Stable UUID drifted for ${key}`,
  );
  assert(spawn.cell === `${Math.floor(spawn.x / 700)}:${Math.floor(spawn.y / 500)}`, `Cell drifted for ${key}`);
  assert(spawn.x >= 0 && spawn.x < 5600 && spawn.y >= 0 && spawn.y < 3750, `Out-of-world spawn ${key}`);
  assert(spawn.active === source.active, `Active state drifted for ${key}`);
  assert(spawn.level_requirement === definition.level_requirement, `Level drifted for ${key}`);
  assert(Boolean(spawn.subzone) && !/legacy/i.test(spawn.subzone), `Invalid subzone for ${key}`);
  assert(Boolean(spawn.cluster_id), `Missing cluster identity for ${key}`);

  if (spawn.entity_type === "node") {
    assert(spawn.charges === definition.max_charges && spawn.max_charges === definition.max_charges, `Charges drifted for ${key}`);
    assert(spawn.gather_s === definition.gather_s && spawn.respawn_s === definition.respawn_s, `Node timing drifted for ${key}`);
    assert(spawn.interaction_radius === 70 && spawn.collision_radius > 0, `Node collision contract drifted for ${key}`);
  } else {
    assert(spawn.hp === definition.hp && spawn.max_hp === definition.hp, `Monster HP drifted for ${key}`);
    assert(spawn.respawn_s === definition.respawn_s && spawn.interaction_radius === 120, `Monster timing drifted for ${key}`);
    assert(manifestHash(spawn.expected_loot) === manifestHash(definition.loot.map(
      ({ item_id, chance, qty_min, qty_max, channel }) => ({ item_id, chance, qty_min, qty_max, channel }),
    )), `Monster loot drifted for ${key}`);
  }

  if (spawn.selection_mode === "carry_forward") {
    carryForward += 1;
    assert(spawn.x === source.x && spawn.y === source.y, `Carried coordinate drifted for ${key}`);
  } else {
    generated += 1;
    const roll = stableUnit(`${manifest.spawn_set_version}:${key}:cluster-selection`);
    if (spawn.selection_mode === "cluster_90") {
      clustered += 1;
      assert(roll < 0.9, `90% cluster selection drifted for ${key}`);
    } else if (spawn.selection_mode === "fallback_10") {
      fallback += 1;
      assert(roll >= 0.9, `10% fallback selection drifted for ${key}`);
    } else {
      throw new Error(`Unknown generation mode for ${key}`);
    }
    assert(Boolean(spawn.placement_cluster), `Generated spawn lacks placement cluster: ${key}`);
  }
}
assert(carryForward === 436 && generated === 294, "Carry-forward/generated split drifted");
assert(clustered === 262 && fallback === 32, "Deterministic 90/10 result drifted");
assert(manifest.cluster_selection.clustered_probability === 0.9, "Cluster probability is not 0.9");

const winterBands = [
  { id: "lower_slopes", min: 55, max: 79, minY: 0, maxY: 2000, area: 620000 },
  { id: "mid_mountain", min: 80, max: 99, minY: 2000, maxY: 2400, area: 780000 },
  { id: "upper_peaks", min: 100, max: 119, minY: 2400, maxY: 2800, area: 1060000 },
  { id: "high_peaks", min: 120, max: 139, minY: 2800, maxY: 3300, area: 1460000 },
  { id: "deepest_frontier", min: 140, max: 150, minY: 3300, maxY: 3750, area: 1305000 },
];
for (const spawn of spawns.filter((row) => row.biome === "winter")) {
  const band = winterBands.find((candidate) => spawn.level_requirement >= candidate.min && spawn.level_requirement <= candidate.max);
  assert(band && spawn.subzone === band.id, `Winter level/subzone mismatch for ${spawn.spawn_id}`);
  assert(spawn.y >= band.minY && spawn.y < band.maxY, `Winter depth mismatch for ${spawn.spawn_id}`);
}
for (const expected of winterBands) {
  const actual = manifest.winter_geometry.bands.find((band) => band.id === expected.id);
  assert(actual && actual.min_level === expected.min && actual.max_level === expected.max, `Winter level band ${expected.id} drifted`);
  assert(actual.min_y === expected.minY && actual.max_y === expected.maxY && actual.area === expected.area, `Winter geometry ${expected.id} drifted`);
}
assert(manifest.winter_geometry.total_area === 5225000, "Winter total area drifted");
assert(manifest.winter_geometry.southern_extension.area === 2195000, "Winter southern extension area drifted");
assert(manifest.winter_geometry.southern_extension.share_of_winter === 0.420096, "Winter southern share drifted");

const runite = spawns.filter((spawn) => spawn.entity_type === "node" && spawn.kind === "runite");
assert(runite.length === 23, "Gate 7 requires exactly 23 Runite nodes");
assert(runite.every((spawn) => spawn.biome === "desert" && spawn.subzone === "desert_evil_boundary"), "Runite boundary ownership drifted");
assert(spawns.every((spawn) => spawn.kind !== "tungsten"), "Tungsten leaked into v2");
assert(live.node_spawns.length === 311 && live.monster_spawns.length === 289, "v1 client spawn snapshot counts drifted");
assert(live.node_spawns.filter((spawn) => spawn.kind === "tungsten").length === 20, "v1 Tungsten rollback evidence drifted");
assert(
  legacyV1.node_count === 234 && legacyV1.monster_count === 170 && legacyV1.tungsten_node_count === 17,
  "Historical v1 database seed audit drifted",
);
assert(manifest.retirement.legacy_tungsten_nodes === 20 && manifest.retirement.v2_tungsten_nodes === 0, "Tungsten retirement metadata drifted");
assert(manifest.rollback.v1_tables_mutated === false && manifest.rollback.player_state_mutated === false, "Rollback promise drifted");

assert(report.spawn_hash === manifest.spawn_hash, "Reachability report uses a different spawn set");
assert(report.summary.spawns_evaluated === 730, "Reachability did not inspect every spawn");
assert(report.summary.clusters_evaluated === 152 && report.cluster_coverage.length === 152, "Reachability did not inspect every cluster");
assert(report.summary.tiers_evaluated === 16 && report.tier_reports.length === 16, "Reachability did not inspect every tier");
assert(report.summary.spawn_issues === 0 && report.spawn_issues.length === 0, "Spawn collision/ownership issues remain");
assert(report.summary.unreachable_clusters === 0 && report.unreachable_clusters.length === 0, "Unreachable clusters remain");
assert(report.summary.failed_tiers === 0, "Tier loop failures remain");
assert(report.cluster_coverage.every((row) => row.reachable), "A cluster lacks a node/monster/station/bank route");
assert(report.method.movement_speed_world_units_per_second === 130 && report.method.path_cell_size === 40, "Reachability physics drifted");
assert(report.intentional_cross_biome_exceptions.length === 5, "Approved cross-biome exception registry drifted");
for (const tier of report.tier_reports) {
  assert(tier.status.startsWith("pass"), `Tier ${tier.tier_index} failed`);
  assert(tier.reachable_clusters === tier.evaluated_clusters, `Tier ${tier.tier_index} has unreachable clusters`);
  assert(tier.node_monster_seconds.p90 <= 30, `Tier ${tier.tier_index} exceeds the 30-second pair target`);
  assert(tier.samples.every((sample) => sample.reachable && sample.resource_model.bag_pass), `Tier ${tier.tier_index} fails reachability or bag capacity`);
}

const requiredRuntimeMarkers = [
  "CREATE TABLE public.game_world_spawn_sets",
  "CREATE TABLE public.game_world_nodes",
  "CREATE TABLE public.game_world_monsters",
  "game_world_nodes_cell_position_check",
  "game_world_monsters_cell_position_check",
  "CREATE POLICY \"Players can read active UUID world nodes\"",
  "CREATE POLICY \"Players can read active UUID world monsters\"",
  "CREATE OR REPLACE FUNCTION public.game_world_runtime_status()",
  "CREATE OR REPLACE FUNCTION public.harvest_node_v2",
  "CREATE OR REPLACE FUNCTION public.attack_monster_v2",
  "game_assert_action_allowed(false)",
  "content_version = public.game_active_content_version()",
  "spawn_set_version = public.game_active_spawn_set_version()",
];
for (const marker of requiredRuntimeMarkers) assert(runtime.includes(marker), `Missing Gate 7 runtime marker: ${marker}`);
assert(migration.includes(`Stable spawn payload sha256: ${manifest.spawn_hash}`), "Migration lacks exact spawn hash");
assert(
  migration.includes("Legacy integer v1 DB audit: 234 nodes, 170 monsters, 17 Tungsten"),
  "Migration lacks the exact historical v1 database audit",
);
assert(!/INSERT\s+INTO\s+public\.game_content_control/i.test(migration), "Gate 7 must not activate a content control row");
assert(!/UPDATE\s+public\.game_content_control/i.test(migration), "Gate 7 must not modify activation control");
assert(!/UPDATE\s+public\.game_content_versions\s+SET[\s\S]{0,200}?status\s*=\s*'active'/i.test(migration), "Gate 7 must not activate v2");
assert(!/supabase\.co|postgres(?:ql)?:\/\//i.test(`${runtime}\n${migration}`), "Gate 7 contains an external database target");

console.log(
  `Gate 7 deterministic world checks passed: ${spawns.length} UUID spawns, ` +
  `${manifest.counts.clusters} reachable clusters, ${report.tier_reports.length} tier loops, hash ${manifest.spawn_hash}.`,
);

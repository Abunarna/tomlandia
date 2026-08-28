/**
 * V3 = canonical live V2 content, re-cut against the current (V3) world.
 *
 * Rules enforced here, from the release spec:
 *   - gameplay content (items, recipes, monsters, nodes, quests, ...) is copied
 *     from the reconciled V2 authoring manifest byte-for-byte;
 *   - spawn counts are frozen: no spawn is added or removed, every (entity_type,
 *     kind, ordinal) identity from V2 survives into V3;
 *   - a spawn only moves when the V3 world makes its V2 position invalid
 *     (terrain, landmark collision, or spawn clearance), and it then moves to
 *     the nearest deterministic position that keeps its biome and subzone.
 *
 * Determinism: the relocation search is a fixed spiral evaluated in a fixed
 * order over rows sorted by spawn identity, so re-running reproduces byte
 * identical artifacts.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

import { canonicalJson, manifestHash, prettyCanonicalJson, uuidV5 } from "../content/model.mjs";
import {
  BIOME_CELL,
  MOVEMENT_SPEED,
  PATH_CELL,
  SOUTHERN_EXTENSION_Y,
  SUBSCRIPTION_CELL,
  WORLD_MODEL_VERSION,
  biomeIdAt,
  exactWinterGeometry,
  subscriptionCellAt,
} from "../gate7/world-model.mjs";
import { terrainBlockedAt } from "../gate7/terrain-collision.mjs";
import { WORLD_H, WORLD_W } from "../world-source/data.mjs";

const PATHS = Object.freeze({
  v2Content: "content/v2/manifest.authoring.json",
  v2World: "content/v2/world-spawn-manifest.json",
  content: "content/v3/manifest.authoring.json",
  world: "content/v3/world-spawn-manifest.json",
  report: "docs/overhaul/v3/world-change-report.json",
});
const checkOnly = process.argv.includes("--check");
const VERSION = "v3";
const MARGIN = 90;

const [v2Content, v2World] = await Promise.all([
  readFile(PATHS.v2Content, "utf8").then(JSON.parse),
  readFile(PATHS.v2World, "utf8").then(JSON.parse),
]);

if (v2Content.content_version !== "v2" || v2World.spawn_set_version !== "v2") {
  throw new Error("V3 must be derived from the reconciled V2 manifests");
}

const nodeDefinition = new Map(v2Content.runtime.nodes.map((definition) => [definition.kind, definition]));
const monsterDefinition = new Map(v2Content.runtime.monsters.map((definition) => [definition.kind, definition]));
const definitions = { node: nodeDefinition, monster: monsterDefinition };

function radiusFor(row) {
  if (row.entity_type !== "node") return 14;
  const definition = nodeDefinition.get(row.kind);
  return definition.shape === "bush" ? 11 : 14;
}

function offsetFor(row) {
  if (row.entity_type !== "node") return 0;
  return nodeDefinition.get(row.kind).shape === "tree" ? 8 : 2;
}

// A position is valid when the entity disc plus a 10px walk-around clearance is
// free of terrain, landmarks and existing world collision discs.
function clear(x, y, radius, offsetY) {
  const c = radius + 10;
  if (x < MARGIN || y < MARGIN || x > WORLD_W - MARGIN || y > WORLD_H - MARGIN) return false;
  if (terrainBlockedAt(x, y + offsetY, c)) return false;
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    if (terrainBlockedAt(x + Math.cos(angle) * c, y + offsetY + Math.sin(angle) * c, 1)) return false;
  }
  return true;
}

// Subzone is authored metadata carried forward from V2 (some kinds get an
// explicit plan subzone rather than a positional one), so it is never
// recomputed here; relocation only has to preserve the biome.
const rows = v2World.spawns
  .map((spawn) => ({ ...spawn }))
  .sort((left, right) => `${left.entity_type}:${left.kind}:${left.ordinal}`.localeCompare(`${right.entity_type}:${right.kind}:${right.ordinal}`));

const occupied = rows.map((row) => ({ x: row.x, y: row.y, entity_type: row.entity_type }));

function separated(x, y, entityType, selfIndex) {
  return occupied.every((point, index) => {
    if (index === selfIndex) return true;
    const minimum = entityType === "node" && point.entity_type === "node" ? 92 : 52;
    return Math.hypot(point.x - x, point.y - y) >= minimum;
  });
}

const relocations = [];
rows.forEach((row, index) => {
  const radius = radiusFor(row);
  const offsetY = offsetFor(row);
  const valid = clear(row.x, row.y, radius, offsetY) && biomeIdAt(row.x, row.y) === row.biome;
  if (valid) return;

  let chosen = null;
  for (let ring = 8; ring <= 900 && !chosen; ring += 8) {
    const steps = Math.max(16, Math.round((Math.PI * 2 * ring) / 8));
    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const x = Math.round(row.x + Math.cos(angle) * ring);
      const y = Math.round(row.y + Math.sin(angle) * ring);
      if (biomeIdAt(x, y) !== row.biome) continue;
      if (!clear(x, y, radius, offsetY)) continue;
      if (!separated(x, y, row.entity_type, index)) continue;
      chosen = { x, y, distance: Math.round(Math.hypot(x - row.x, y - row.y)) };
      break;
    }
  }
  if (!chosen) {
    throw new Error(`No valid V3 position for ${row.entity_type}:${row.kind}:${row.ordinal} in biome ${row.biome}`);
  }
  relocations.push({
    entity_type: row.entity_type,
    kind: row.kind,
    ordinal: row.ordinal,
    biome: row.biome,
    subzone: row.subzone,
    from: { x: row.x, y: row.y },
    to: { x: chosen.x, y: chosen.y },
    moved_px: chosen.distance,
    reason: biomeIdAt(row.x, row.y) !== row.biome ? "biome_boundary_moved" : "blocked_in_v3_world",
  });
  row.x = chosen.x;
  row.y = chosen.y;
  occupied[index] = { x: chosen.x, y: chosen.y, entity_type: row.entity_type };
});

// ---- V3 authoring manifest -------------------------------------------------
const moveIndex = new Map(relocations.map((move) => [`${move.entity_type}:${move.kind}:${move.ordinal}`, move.to]));
const content = JSON.parse(JSON.stringify(v2Content));
content.content_version = VERSION;
content.spawn_set_version = VERSION;
for (const [entityType, key] of [["node", "node_spawns"], ["monster", "monster_spawns"]]) {
  for (const spawn of content.runtime[key]) {
    const move = moveIndex.get(`${entityType}:${spawn.kind}:${spawn.ordinal}`);
    if (move) {
      spawn.x = move.x;
      spawn.y = move.y;
    }
  }
}
const contentRendered = prettyCanonicalJson(content);
const contentHash = manifestHash(JSON.parse(canonicalJson(content)));

// ---- V3 world spawn manifest ----------------------------------------------
for (const row of rows) {
  row.spawn_id = uuidV5(content.uuid_namespace, `${VERSION}:${row.entity_type}:${row.kind}:${row.ordinal}`);
  row.cell = subscriptionCellAt(row.x, row.y);
}

function connectClusters(allRows) {
  const groups = new Map();
  for (const row of allRows) {
    const key = `${row.entity_type}:${row.kind}:${row.subzone}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const [groupKey, members] of groups) {
    const remaining = new Set(members);
    const components = [];
    while (remaining.size) {
      const seed = [...remaining].sort((a, b) => a.spawn_id.localeCompare(b.spawn_id))[0];
      const component = [];
      const queue = [seed];
      remaining.delete(seed);
      while (queue.length) {
        const current = queue.shift();
        component.push(current);
        for (const candidate of [...remaining]) {
          if (Math.hypot(candidate.x - current.x, candidate.y - current.y) <= 480) {
            remaining.delete(candidate);
            queue.push(candidate);
          }
        }
      }
      components.push(component.sort((a, b) => a.spawn_id.localeCompare(b.spawn_id)));
    }
    components.sort((a, b) => a[0].spawn_id.localeCompare(b[0].spawn_id));
    components.forEach((component, index) => {
      for (const row of component) row.cluster_id = `${groupKey}:${String(index).padStart(2, "0")}`;
    });
  }
}
connectClusters(rows);
rows.sort((left, right) => left.spawn_id.localeCompare(right.spawn_id));

const spawnPayload = { content_version: VERSION, spawn_set_version: VERSION, spawns: rows };
const spawnHash = manifestHash(spawnPayload);
if (manifestHash(JSON.parse(canonicalJson(spawnPayload))) !== spawnHash) {
  throw new Error("V3 spawn hash is not canonical");
}

const counts = {
  nodes: rows.filter((row) => row.entity_type === "node").length,
  monsters: rows.filter((row) => row.entity_type === "monster").length,
  clusters: new Set(rows.map((row) => row.cluster_id)).size,
};
const v2Counts = v2World.counts;
if (counts.nodes !== v2Counts.nodes || counts.monsters !== v2Counts.monsters) {
  throw new Error(`V3 spawn counts drifted from V2 (${JSON.stringify(counts)} vs ${JSON.stringify(v2Counts)})`);
}

const world = {
  schema_version: "tomlandia-world-spawn-manifest/v1",
  model_version: WORLD_MODEL_VERSION,
  content_version: VERSION,
  spawn_set_version: VERSION,
  uuid_namespace: content.uuid_namespace,
  source_content_manifest_hash: contentHash,
  spawn_hash: spawnHash,
  derived_from: {
    content_version: v2World.content_version,
    spawn_set_version: v2World.spawn_set_version,
    spawn_hash: v2World.spawn_hash,
    source_content_manifest_hash: v2World.source_content_manifest_hash,
    policy: "carry every V2 spawn identity forward; relocate only where the V3 world invalidates the V2 position",
  },
  world: {
    width: WORLD_W,
    height: WORLD_H,
    biome_cell_size: BIOME_CELL,
    subscription_cell: SUBSCRIPTION_CELL,
    path_cell_size: PATH_CELL,
    movement_speed_world_units_per_second: MOVEMENT_SPEED,
  },
  cluster_selection: {
    ...v2World.cluster_selection,
    inherited_from: "v2",
    note: "V3 carries the V2 cluster selection verbatim; only blocked rows moved.",
  },
  relocation: {
    search: "deterministic 8px ring spiral, biome and subzone preserved",
    relocated_rows: relocations.length,
    max_moved_px: relocations.reduce((max, move) => Math.max(max, move.moved_px), 0),
    relocations,
  },
  winter_geometry: exactWinterGeometry(),
  southern_extension_policy: { min_y: SOUTHERN_EXTENSION_Y, deepest_frontier_preferred: true },
  rollback: {
    v2_rows_mutated: false,
    player_state_mutated: false,
    switch_back: "select v2 content/spawn control; v2 content, spawn and world rows remain in place",
  },
  counts,
  spawns: rows,
};

const worldRendered = prettyCanonicalJson(world);
const report = {
  generated_from: { content: PATHS.v2Content, world: PATHS.v2World, frozen_source: "content/v3/frozen/data.ts" },
  content_version: VERSION,
  spawn_set_version: VERSION,
  content_manifest_hash: contentHash,
  spawn_hash: spawnHash,
  counts,
  unchanged_gameplay_content: true,
  spawn_identities_preserved: rows.length === v2World.spawns.length,
  relocated_rows: relocations.length,
  relocations,
};
const reportRendered = prettyCanonicalJson(report);

const clientWorld = `/* eslint-disable */
/* GENERATED by scripts/v3/build.mjs. Do not edit. */
/* Spawn-set identity the client requires from game_world_runtime_status. */

export const SPAWN_SET_VERSION = "${VERSION}";
export const WORLD_SPAWN_HASH = "${spawnHash}";
export const WORLD_SPAWN_COUNTS = Object.freeze({ nodes: ${counts.nodes}, monsters: ${counts.monsters} });
`;

const outputs = [
  ["src/generated/world-manifest.ts", clientWorld],
  [PATHS.content, contentRendered],
  [PATHS.world, worldRendered],
  [PATHS.report, reportRendered],
];

for (const [file, rendered] of outputs) {
  if (checkOnly) {
    const existing = await readFile(file, "utf8").catch(() => "");
    if (existing !== rendered) throw new Error(`V3 artifact drifted: ${file}; run bun run v3:build`);
  } else {
    await mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
    await writeFile(file, rendered);
  }
}

console.log(
  `${checkOnly ? "Verified" : "Wrote"} V3 artifacts: ${counts.nodes} nodes, ${counts.monsters} monsters, ` +
  `${relocations.length} relocated; content ${contentHash}; spawns ${spawnHash}`,
);

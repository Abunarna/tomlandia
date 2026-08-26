import { readFile, writeFile } from "node:fs/promises";

import {
  canonicalJson,
  manifestHash,
  prettyCanonicalJson,
  uuidV5,
} from "../content/model.mjs";
import {
  BIOME_CELL,
  CLUSTER_SELECTION_RATE,
  GENERATION_PLANS,
  MOVEMENT_SPEED,
  PATH_CELL,
  SOUTHERN_EXTENSION_Y,
  SUBSCRIPTION_CELL,
  WINTER_BANDS,
  WORLD_MODEL_VERSION,
  exactWinterGeometry,
  planAllows,
  stableUnit,
  subzoneAt,
  subscriptionCellAt,
  winterBandForLevel,
} from "./world-model.mjs";
import { WORLD_H, WORLD_W } from "../../src/game/data.ts";

const PATHS = Object.freeze({
  content: "content/v2/manifest.authoring.json",
  registry: "docs/overhaul/gate-0/id-registry.json",
  liveSpawns: "docs/overhaul/gate-5/live-v1-spawns.json",
  lockedPlacements: "content/v2/locked-world-placements.json",
  output: "content/v2/world-spawn-manifest.json",
});
const checkOnly = process.argv.includes("--check");

const [content, registry, liveSpawns, lockedPlacements] = await Promise.all([
  readFile(PATHS.content, "utf8").then(JSON.parse),
  readFile(PATHS.registry, "utf8").then(JSON.parse),
  readFile(PATHS.liveSpawns, "utf8").then(JSON.parse),
  readFile(PATHS.lockedPlacements, "utf8").then(JSON.parse),
]);

const nodeDefinition = new Map(content.runtime.nodes.map((definition) => [definition.kind, definition]));
const monsterDefinition = new Map(content.runtime.monsters.map((definition) => [definition.kind, definition]));
const definitions = { node: nodeDefinition, monster: monsterDefinition };
const inputSpawns = {
  node: content.runtime.node_spawns,
  monster: content.runtime.monster_spawns,
};

function stableIdentity(entityType, kind, ordinal) {
  return `${content.spawn_set_version}:${entityType}:${kind}:${ordinal}`;
}

function outputSubzone(entityType, spawn, definition) {
  const plan = GENERATION_PLANS[entityType][spawn.kind];
  if (plan?.subzone) return plan.subzone;
  if ((plan?.biome ?? spawn.biome) === "winter") return winterBandForLevel(definition.level_requirement).id;
  return subzoneAt(plan?.biome ?? spawn.biome, spawn.x, spawn.y);
}

const generatedKeys = new Set();
for (const entityType of ["node", "monster"]) {
  for (const kind of Object.keys(GENERATION_PLANS[entityType])) generatedKeys.add(`${entityType}:${kind}`);
}

const occupied = [];
const carried = [];
for (const entityType of ["node", "monster"]) {
  for (const spawn of inputSpawns[entityType]) {
    if (generatedKeys.has(`${entityType}:${spawn.kind}`)) continue;
    const definition = definitions[entityType].get(spawn.kind);
    if (!definition) throw new Error(`Missing ${entityType} definition ${spawn.kind}`);
    const row = {
      spawn_id: uuidV5(content.uuid_namespace, stableIdentity(entityType, spawn.kind, spawn.ordinal)),
      entity_type: entityType,
      kind: spawn.kind,
      ordinal: spawn.ordinal,
      active: spawn.active,
      biome: spawn.biome,
      subzone: outputSubzone(entityType, spawn, definition),
      x: spawn.x,
      y: spawn.y,
      cell: subscriptionCellAt(spawn.x, spawn.y),
      level_requirement: definition.level_requirement,
      selection_mode: "carry_forward",
      placement_cluster: null,
    };
    carried.push(row);
    occupied.push({ x: row.x, y: row.y, entity_type: entityType });
  }
}

function candidatePool(entityType, kind, level, plan) {
  const candidates = [];
  const step = 40;
  let index = 0;
  for (let yBase = 100; yBase < WORLD_H - 90; yBase += step) {
    for (let xBase = 100; xBase < WORLD_W - 90; xBase += step) {
      index += 1;
      const x = Math.round(xBase + (stableUnit(`${entityType}:${kind}:x:${index}`) - 0.5) * 20);
      const y = Math.round(yBase + (stableUnit(`${entityType}:${kind}:y:${index}`) - 0.5) * 20);
      if (!planAllows(plan, level, x, y)) continue;
      candidates.push({ x, y, rank: stableUnit(`${entityType}:${kind}:candidate:${x}:${y}`) });
    }
  }
  if (!candidates.length) throw new Error(`No safe candidate cells for ${entityType}:${kind}`);
  return candidates;
}

function chooseCenters(pool, plan, count, key) {
  const centerCount = Math.max(1, Math.round(count / 6));
  const centers = [];
  for (let index = 0; index < centerCount; index += 1) {
    const angle = stableUnit(`${key}:center-angle:${index}`) * Math.PI * 2;
    const radius = index === 0 ? 0 : 240 + Math.floor(index / 4) * 220;
    const target = {
      x: plan.anchor[0] + Math.cos(angle) * radius,
      y: plan.anchor[1] + Math.sin(angle) * radius,
    };
    const selected = [...pool].sort((left, right) => {
      const distance = Math.hypot(left.x - target.x, left.y - target.y) - Math.hypot(right.x - target.x, right.y - target.y);
      return distance || left.rank - right.rank;
    }).find((candidate) => centers.every((center) => Math.hypot(center.x - candidate.x, center.y - candidate.y) >= 180));
    if (!selected) throw new Error(`Could not allocate ${centerCount} centers for ${key}`);
    centers.push(selected);
  }
  return centers;
}

// Resource-to-resource spacing matches the live anti-sealing rule. Monsters
// are not collision discs, so their visual spacing can remain tighter without
// forming a movement wall.
function separated(candidate, entityType) {
  return occupied.every((point) => {
    const minimum = entityType === "node" && point.entity_type === "node" ? 92 : 52;
    return Math.hypot(point.x - candidate.x, point.y - candidate.y) >= minimum;
  });
}

const lockedGenerated = new Map(
  lockedPlacements.placements.map((placement) => [
    `${placement.entity_type}:${placement.kind}:${placement.ordinal}`,
    placement,
  ]),
);
const generated = [];
for (const entityType of ["node", "monster"]) {
  for (const [kind, plan] of Object.entries(GENERATION_PLANS[entityType])) {
    const source = inputSpawns[entityType]
      .filter((spawn) => spawn.kind === kind)
      .sort((a, b) => a.ordinal - b.ordinal);
    const definition = definitions[entityType].get(kind);
    if (!source.length || !definition) throw new Error(`Missing locked source data for ${entityType}:${kind}`);
    for (const spawn of source) {
      const key = `${entityType}:${kind}:${spawn.ordinal}`;
      const placement = lockedGenerated.get(key);
      if (!placement) throw new Error(`Missing locked placement for ${key}`);
      if (placement.cell !== subscriptionCellAt(placement.x, placement.y)) {
        throw new Error(`Locked placement cell drifted for ${key}`);
      }
      occupied.push({ x: placement.x, y: placement.y, entity_type: entityType });
      generated.push({
        spawn_id: uuidV5(content.uuid_namespace, stableIdentity(entityType, kind, spawn.ordinal)),
        entity_type: entityType,
        kind,
        ordinal: spawn.ordinal,
        active: spawn.active,
        biome: plan.biome,
        subzone: placement.subzone,
        x: placement.x,
        y: placement.y,
        cell: placement.cell,
        level_requirement: definition.level_requirement,
        selection_mode: placement.selection_mode,
        placement_cluster: placement.placement_cluster,
      });
    }
  }
}
if (generated.length !== lockedGenerated.size) {
  throw new Error(`Locked placement coverage drifted: generated ${generated.length}, locked ${lockedGenerated.size}`);
}
function connectClusters(rows) {
  const groups = new Map();
  for (const row of rows) {
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

const rows = [...carried, ...generated];
connectClusters(rows);
for (const row of rows) {
  const definition = definitions[row.entity_type].get(row.kind);
  if (row.entity_type === "node") {
    row.charges = definition.max_charges;
    row.max_charges = definition.max_charges;
    row.gather_s = definition.gather_s;
    row.respawn_s = definition.respawn_s;
    row.collision_radius = definition.shape === "bush" ? 11 : 14;
    row.collision_offset_y = definition.shape === "tree" ? 8 : 2;
    row.interaction_radius = 70;
  } else {
    row.hp = definition.hp;
    row.max_hp = definition.hp;
    row.respawn_s = definition.respawn_s;
    row.interaction_radius = 120;
    row.expected_loot = definition.loot.map(({ item_id, chance, qty_min, qty_max, channel }) => ({
      item_id, chance, qty_min, qty_max, channel,
    }));
  }
}
rows.sort((left, right) => left.spawn_id.localeCompare(right.spawn_id));

const spawnPayload = {
  content_version: content.content_version,
  spawn_set_version: content.spawn_set_version,
  spawns: rows,
};
const output = {
  schema_version: "tomlandia-world-spawn-manifest/v1",
  model_version: WORLD_MODEL_VERSION,
  content_version: content.content_version,
  spawn_set_version: content.spawn_set_version,
  uuid_namespace: content.uuid_namespace,
  source_content_manifest_hash: manifestHash(content),
  spawn_hash: manifestHash(spawnPayload),
  world: {
    width: WORLD_W,
    height: WORLD_H,
    biome_cell_size: BIOME_CELL,
    subscription_cell: SUBSCRIPTION_CELL,
    path_cell_size: PATH_CELL,
    movement_speed_world_units_per_second: MOVEMENT_SPEED,
  },
  cluster_selection: {
    comparator: "stable_sha256_roll < 0.9",
    clustered_probability: CLUSTER_SELECTION_RATE,
    generated_rows: generated.length,
    carry_forward_rows: carried.length,
    clustered_rows: generated.filter((row) => row.selection_mode === "cluster_90").length,
    fallback_rows: generated.filter((row) => row.selection_mode === "fallback_10").length,
  },
  winter_geometry: exactWinterGeometry(),
  southern_extension_policy: {
    min_y: SOUTHERN_EXTENSION_Y,
    deepest_frontier_preferred: true,
  },
  retirement: {
    legacy_tungsten_nodes: liveSpawns.node_spawns.filter((spawn) => spawn.kind === "tungsten").length,
    v2_tungsten_nodes: rows.filter((spawn) => spawn.entity_type === "node" && spawn.kind === "tungsten").length,
    policy: "v1 rows retained; no Tungsten node exists in v2",
  },
  rollback: {
    v1_tables_mutated: false,
    player_state_mutated: false,
    switch_back: "select v1 content/spawn control; legacy integer world tables remain unchanged",
  },
  counts: {
    nodes: rows.filter((row) => row.entity_type === "node").length,
    monsters: rows.filter((row) => row.entity_type === "monster").length,
    clusters: new Set(rows.map((row) => row.cluster_id)).size,
  },
  spawns: rows,
};

if (output.spawn_hash !== lockedPlacements.spawn_hash) {
  throw new Error(`Locked Gate 7 spawn hash drifted: ${output.spawn_hash}`);
}

// Hashing canonical JSON twice catches accidental dependence on object insertion
// order inside this generator before anything reaches SQL.
if (manifestHash(JSON.parse(canonicalJson(spawnPayload))) !== output.spawn_hash) {
  throw new Error("World spawn hash is not canonical");
}

const rendered = prettyCanonicalJson(output);
if (checkOnly) {
  const existing = await readFile(PATHS.output, "utf8").catch(() => "");
  if (existing !== rendered) throw new Error(`Gate 7 world manifest drifted; run node scripts/gate7/build-world.mjs`);
  console.log(`Gate 7 world manifest is deterministic (${output.spawn_hash}).`);
} else {
  await writeFile(PATHS.output, rendered);
  console.log(
    `Wrote ${PATHS.output}: ${output.counts.nodes} nodes, ${output.counts.monsters} monsters, ` +
    `${output.counts.clusters} clusters; hash ${output.spawn_hash}`,
  );
}

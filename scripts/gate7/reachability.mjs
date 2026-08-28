import { readFile, writeFile } from "node:fs/promises";

import { prettyCanonicalJson } from "../content/model.mjs";
import {
  MOVEMENT_SPEED,
  PATH_CELL,
  biomeIdAt,
} from "./world-model.mjs";
import {
  NPCS,
  WORLD_H,
  WORLD_W,
} from "../../content/v2/frozen/data.ts";
import { terrainBlockedAt } from "./terrain-collision.mjs";

const PATHS = Object.freeze({
  content: "content/v2/manifest.authoring.json",
  world: "content/v2/world-spawn-manifest.json",
  output: "docs/overhaul/gate-7/reachability-report.json",
});
const checkOnly = process.argv.includes("--check");
const BAG_CAPACITY = 20;
const BIOME_MIN_LEVEL = Object.freeze({ fields: 1, forest: 2, desert: 10, evil: 23, winter: 55 });

const TIER_LOOPS = Object.freeze([
  { tier: 1, level: 1, node: "copper", monster: "chicken" },
  { tier: 2, level: 10, node: "copper", monster: "goblin_brute" },
  { tier: 3, level: 20, node: "iron", monster: "ironback_boar" },
  { tier: 4, level: 30, node: "coal_seam", monster: "forest_boar" },
  { tier: 5, level: 40, node: "mithril", monster: "dust_jackal" },
  { tier: 6, level: 50, node: "sunstone_vein", monster: "desert_raider" },
  { tier: 7, level: 60, node: "runite", monster: "withered_ghoul" },
  { tier: 8, level: 70, node: "cursed_rock", monster: "cursed_knight", secondaryNodes: ["runite"] },
  { tier: 9, level: 80, node: "frost_crystal_vein", monster: "frost_troll" },
  { tier: 10, level: 90, node: "frost_crystal_vein", monster: "ice_wraith" },
  { tier: 11, level: 100, node: "glacial_vein", monster: "frost_revenant" },
  { tier: 12, level: 110, node: "starsteel_vein", monster: "frost_giant" },
  { tier: 13, level: 120, node: "voidsteel_vein", monster: "wyrm_knight" },
  { tier: 14, level: 130, node: "wyrmforged_vein", monster: "void_wraith" },
  { tier: 15, level: 140, node: "ancient_vein", monster: "void_wraith" },
  { tier: 16, level: 150, node: "ascendant_vein", monster: "ascendant_wyrm" },
]);

const APPROVED_CROSS_BIOME = Object.freeze([
  {
    tier: 2,
    level: 10,
    id: "bronze_fields_forest",
    biomes: ["fields", "forest"],
    basis: "The approved Bronze weapon uses Fields copper/oak and the level-10 Forest Goblin Brute trophy.",
  },
  {
    tier: 7,
    level: 60,
    id: "runite_preserved_ghoul_trophy",
    biomes: ["desert", "evil"],
    basis: "The approved in-place Runite Greatsword preserves its live Ghoul Essence trophy ingredient.",
  },
  {
    tier: 8,
    level: 70,
    id: "shadowsteel_desert_evil_boundary",
    biomes: ["desert", "evil"],
    basis: "Pre-approved design exception: Desert Runite combines with Evil Woods Cursed Shard at their real boundary.",
  },
  {
    tier: 9,
    level: 80,
    id: "froststeel_inherits_shadowsteel",
    biomes: ["desert", "evil", "winter"],
    basis: "Froststeel intentionally upgrades the approved Shadowsteel chain with a Winter Frost Crystal.",
  },
  {
    tier: 10,
    level: 90,
    id: "wyrmsteel_inherits_froststeel",
    biomes: ["desert", "evil", "winter"],
    basis: "Wyrmsteel intentionally upgrades the approved Froststeel chain with a Winter Wraith Ice Core.",
  },
]);

const [content, world] = await Promise.all([
  readFile(PATHS.content, "utf8").then(JSON.parse),
  readFile(PATHS.world, "utf8").then(JSON.parse),
]);

const nodes = world.spawns.filter((spawn) => spawn.entity_type === "node");
const monsters = world.spawns.filter((spawn) => spawn.entity_type === "monster");
const nodeDefinitions = new Map(content.runtime.nodes.map((definition) => [definition.kind, definition]));
const monsterDefinitions = new Map(content.runtime.monsters.map((definition) => [definition.kind, definition]));
const itemDefinitions = new Map(content.runtime.items.map((definition) => [definition.id, definition]));
const recipeByOutput = new Map(
  content.runtime.recipes.filter((recipe) => recipe.active).map((recipe) => [recipe.output_item_id, recipe]),
);
const nodeProducers = new Map();
const monsterProducers = new Map();
for (const definition of content.runtime.nodes) {
  if (!nodeProducers.has(definition.item_id)) nodeProducers.set(definition.item_id, []);
  nodeProducers.get(definition.item_id).push(definition);
}
for (const definition of content.runtime.monsters) {
  for (const loot of definition.loot) {
    if (!monsterProducers.has(loot.item_id)) monsterProducers.set(loot.item_id, []);
    monsterProducers.get(loot.item_id).push({ definition, loot });
  }
}

const nodeDiscs = nodes.map((node) => ({
  x: node.x,
  y: node.y + node.collision_offset_y,
  radius: node.collision_radius,
  spawn_id: node.spawn_id,
}));

function blockedByWorld(x, y, pad = 12) {
  if (x < pad || y < pad || x > WORLD_W - pad || y > WORLD_H - pad) return true;
  if (terrainBlockedAt(x, y, pad)) return true;
  return nodeDiscs.some((disc) => Math.hypot(x - disc.x, y - disc.y) < disc.radius + pad);
}

const columns = Math.ceil(WORLD_W / PATH_CELL);
const rows = Math.ceil(WORLD_H / PATH_CELL);
const cellCount = columns * rows;
const gridOpen = new Uint8Array(cellCount);
const gridBiome = new Array(cellCount);
for (let cy = 0; cy < rows; cy += 1) {
  for (let cx = 0; cx < columns; cx += 1) {
    const index = cy * columns + cx;
    const x = Math.min(WORLD_W - 1, cx * PATH_CELL + PATH_CELL / 2);
    const y = Math.min(WORLD_H - 1, cy * PATH_CELL + PATH_CELL / 2);
    gridOpen[index] = blockedByWorld(x, y) ? 0 : 1;
    gridBiome[index] = biomeIdAt(x, y);
  }
}

const cellX = (index) => (index % columns) * PATH_CELL + PATH_CELL / 2;
const cellY = (index) => Math.floor(index / columns) * PATH_CELL + PATH_CELL / 2;
const allowed = (index, level) => Boolean(gridOpen[index]) && BIOME_MIN_LEVEL[gridBiome[index]] <= level;

function nearestOpenCell(point, level, radius) {
  const minCx = Math.max(0, Math.floor((point.x - radius) / PATH_CELL));
  const maxCx = Math.min(columns - 1, Math.floor((point.x + radius) / PATH_CELL));
  const minCy = Math.max(0, Math.floor((point.y - radius) / PATH_CELL));
  const maxCy = Math.min(rows - 1, Math.floor((point.y + radius) / PATH_CELL));
  let best = -1;
  let bestDistance = Infinity;
  for (let cy = minCy; cy <= maxCy; cy += 1) {
    for (let cx = minCx; cx <= maxCx; cx += 1) {
      const index = cy * columns + cx;
      if (!allowed(index, level)) continue;
      const distance = Math.hypot(cellX(index) - point.x, cellY(index) - point.y);
      if (distance <= radius && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
  }
  return best;
}

class MinHeap {
  values = [];

  push(value) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].score <= value.score) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop() {
    if (!this.values.length) return null;
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.values.length) break;
        let child = left;
        if (right < this.values.length && this.values[right].score < this.values[left].score) child = right;
        if (this.values[child].score >= last.score) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = last;
    }
    return first;
  }
}

const distanceCache = new Map();
function pathDistance(start, goal, level) {
  if (start < 0 || goal < 0) return Infinity;
  if (start === goal) return 0;
  const low = Math.min(start, goal);
  const high = Math.max(start, goal);
  const cacheKey = `${level}:${low}:${high}`;
  if (distanceCache.has(cacheKey)) return distanceCache.get(cacheKey);

  const distance = new Float64Array(cellCount);
  distance.fill(Infinity);
  const closed = new Uint8Array(cellCount);
  const heap = new MinHeap();
  distance[start] = 0;
  heap.push({ index: start, score: Math.hypot(cellX(start) - cellX(goal), cellY(start) - cellY(goal)) });

  let result = Infinity;
  while (heap.values.length) {
    const current = heap.pop().index;
    if (closed[current]) continue;
    if (current === goal) {
      result = distance[current];
      break;
    }
    closed[current] = 1;
    const cx = current % columns;
    const cy = Math.floor(current / columns);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue;
        const next = ny * columns + nx;
        if (!allowed(next, level)) continue;
        if (dx && dy) {
          const horizontal = cy * columns + nx;
          const vertical = ny * columns + cx;
          if (!allowed(horizontal, level) || !allowed(vertical, level)) continue;
        }
        const step = PATH_CELL * (dx && dy ? Math.SQRT2 : 1);
        const candidate = distance[current] + step;
        if (candidate >= distance[next]) continue;
        distance[next] = candidate;
        const heuristic = Math.hypot(cellX(next) - cellX(goal), cellY(next) - cellY(goal));
        heap.push({ index: next, score: candidate + heuristic });
      }
    }
  }
  distanceCache.set(cacheKey, result);
  return result;
}

function medoid(members) {
  return [...members].sort((left, right) => {
    const leftScore = members.reduce((sum, member) => sum + Math.hypot(left.x - member.x, left.y - member.y), 0);
    const rightScore = members.reduce((sum, member) => sum + Math.hypot(right.x - member.x, right.y - member.y), 0);
    return leftScore - rightScore || left.spawn_id.localeCompare(right.spawn_id);
  })[0];
}

const spawnGroups = new Map();
for (const spawn of world.spawns) {
  if (!spawnGroups.has(spawn.cluster_id)) spawnGroups.set(spawn.cluster_id, []);
  spawnGroups.get(spawn.cluster_id).push(spawn);
}
const clusters = [...spawnGroups].map(([id, members]) => {
  const representative = medoid(members);
  return {
    id,
    entity_type: representative.entity_type,
    kind: representative.kind,
    level_requirement: representative.level_requirement,
    biome: representative.biome,
    subzone: representative.subzone,
    spawn_count: members.length,
    members,
    representative,
  };
}).sort((left, right) => left.id.localeCompare(right.id));
const clustersByKind = new Map();
for (const cluster of clusters) {
  const key = `${cluster.entity_type}:${cluster.kind}`;
  if (!clustersByKind.has(key)) clustersByKind.set(key, []);
  clustersByKind.get(key).push(cluster);
}

const endpointCache = new Map();
function clusterEndpoint(cluster, level) {
  const key = `${cluster.id}:${level}`;
  if (endpointCache.has(key)) return endpointCache.get(key);
  const radius = cluster.entity_type === "node" ? cluster.representative.interaction_radius : 80;
  const endpoint = nearestOpenCell(cluster.representative, level, radius);
  endpointCache.set(key, endpoint);
  return endpoint;
}

const services = NPCS.flatMap((npc) => npc.services.map((service) => ({
  service,
  id: npc.id,
  x: npc.x,
  y: npc.y,
  biome: biomeIdAt(npc.x, npc.y),
})));
const serviceEndpointCache = new Map();
function serviceEndpoint(service, level) {
  const key = `${service.id}:${level}`;
  if (serviceEndpointCache.has(key)) return serviceEndpointCache.get(key);
  const endpoint = BIOME_MIN_LEVEL[service.biome] <= level ? nearestOpenCell(service, level, 240) : -1;
  serviceEndpointCache.set(key, endpoint);
  return endpoint;
}

function bestServiceChain(origin, level) {
  let best = null;
  for (const smelt of services.filter((service) => service.service === "smelt")) {
    const smeltCell = serviceEndpoint(smelt, level);
    if (smeltCell < 0) continue;
    const first = pathDistance(origin, smeltCell, level);
    if (!Number.isFinite(first)) continue;
    for (const forge of services.filter((service) => service.service === "forge")) {
      const forgeCell = serviceEndpoint(forge, level);
      if (forgeCell < 0) continue;
      const second = pathDistance(smeltCell, forgeCell, level);
      if (!Number.isFinite(second)) continue;
      for (const bank of services.filter((service) => service.service === "bank")) {
        const bankCell = serviceEndpoint(bank, level);
        if (bankCell < 0) continue;
        const third = pathDistance(forgeCell, bankCell, level);
        const distance = first + second + third;
        if (!Number.isFinite(third) || (best && distance >= best.distance)) continue;
        best = {
          distance,
          smelt: smelt.id,
          forge: forge.id,
          bank: bank.id,
          legs: { monster_to_smelt: first, smelt_to_forge: second, forge_to_bank: third },
        };
      }
    }
  }
  return best;
}

function nearestCluster(origin, candidates, level) {
  const originCell = clusterEndpoint(origin, level);
  let best = null;
  for (const candidate of candidates) {
    const candidateCell = clusterEndpoint(candidate, level);
    const distance = pathDistance(originCell, candidateCell, level);
    if (!Number.isFinite(distance) || (best && distance >= best.distance)) continue;
    best = { cluster: candidate, distance };
  }
  return best;
}

function quantile(values, probability) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function expandItem(itemId, quantity, leaves, stack = []) {
  if (stack.includes(itemId)) throw new Error(`Recipe cycle: ${[...stack, itemId].join(" -> ")}`);
  const recipe = recipeByOutput.get(itemId);
  if (!recipe) {
    leaves.set(itemId, (leaves.get(itemId) ?? 0) + quantity);
    return;
  }
  for (const input of recipe.inputs) {
    expandItem(input.item_id, quantity * input.qty / recipe.output_qty, leaves, [...stack, itemId]);
  }
}

function tierRequirements(tier) {
  const weapon = content.runtime.items.find((item) => item.active && item.kind === "weapon" && item.tier_index === tier.tier);
  if (!weapon) throw new Error(`No active tier-${tier.tier} weapon`);
  const leaves = new Map();
  expandItem(weapon.id, 1, leaves);
  const nodeItems = [];
  const monsterItems = [];
  const otherItems = [];
  for (const [item_id, quantity] of [...leaves].sort()) {
    if (nodeProducers.has(item_id)) nodeItems.push({ item_id, quantity, producers: nodeProducers.get(item_id).map((producer) => producer.kind) });
    else if (monsterProducers.has(item_id)) monsterItems.push({ item_id, quantity, producers: monsterProducers.get(item_id).map((producer) => producer.definition.kind) });
    else otherItems.push({ item_id, quantity });
  }
  return { weapon: weapon.id, node_items: nodeItems, monster_items: monsterItems, other_items: otherItems };
}

function resourceModel(tier, nodeCluster, monsterCluster, requirements) {
  const nodeDefinition = nodeDefinitions.get(tier.node);
  const monsterDefinition = monsterDefinitions.get(tier.monster);
  const nodeQuantity = requirements.node_items.find((item) => item.item_id === nodeDefinition.item_id)?.quantity ?? 1;
  const relevantLoot = monsterDefinition.loot.filter((loot) =>
    requirements.monster_items.some((item) => item.item_id === loot.item_id),
  );
  const expectedKills = relevantLoot.length
    ? Math.max(...relevantLoot.map((loot) => {
      const quantity = requirements.monster_items.find((item) => item.item_id === loot.item_id)?.quantity ?? 0;
      return quantity / loot.chance;
    }))
    : 1;
  const nodeCapacity = nodeCluster.members.reduce((sum, node) => sum + node.max_charges, 0);
  const nodeCycles = Math.max(1, Math.ceil(nodeQuantity / nodeCapacity));
  const monsterCycles = Math.max(1, Math.ceil(expectedKills / monsterCluster.spawn_count));
  const nodeRespawnWait = (nodeCycles - 1) * Math.max(...nodeCluster.members.map((node) => node.respawn_s));
  const monsterRespawnWait = (monsterCycles - 1) * Math.max(...monsterCluster.members.map((monster) => monster.respawn_s));
  const incidental = new Set(monsterDefinition.loot.map((loot) => loot.item_id));
  const bagStacks = new Set([
    ...requirements.node_items.map((item) => item.item_id),
    ...requirements.monster_items.map((item) => item.item_id),
    ...requirements.other_items.map((item) => item.item_id),
    ...incidental,
  ]).size;
  return {
    primary_node_item: nodeDefinition.item_id,
    primary_node_quantity: nodeQuantity,
    shared_node_capacity: nodeCapacity,
    node_respawn_cycles: nodeCycles,
    node_respawn_wait_seconds: nodeRespawnWait,
    expected_primary_monster_kills: round(expectedKills),
    monster_spawns_in_cluster: monsterCluster.spawn_count,
    monster_respawn_cycles: monsterCycles,
    monster_respawn_wait_seconds: monsterRespawnWait,
    expected_trophy_drops: relevantLoot.map((loot) => ({ item_id: loot.item_id, chance: loot.chance })),
    bag_capacity: BAG_CAPACITY,
    modeled_distinct_stacks: bagStacks,
    bag_pass: bagStacks <= BAG_CAPACITY,
    gather_seconds: round(nodeQuantity * nodeDefinition.gather_s),
  };
}

const spawnIssues = [];
for (const spawn of world.spawns) {
  if (terrainBlockedAt(spawn.x, spawn.y, 14)) spawnIssues.push(`${spawn.spawn_id}: terrain-blocked`);
  if (biomeIdAt(spawn.x, spawn.y) !== spawn.biome) spawnIssues.push(`${spawn.spawn_id}: biome mismatch`);
  const endpoint = nearestOpenCell(spawn, spawn.level_requirement, spawn.interaction_radius);
  if (endpoint < 0) spawnIssues.push(`${spawn.spawn_id}: no reachable interaction cell`);
}

const clusterCoverage = [];
for (const cluster of clusters) {
  const oppositeType = cluster.entity_type === "node" ? "monster" : "node";
  const oppositeDefinitions = oppositeType === "node" ? nodeDefinitions : monsterDefinitions;
  const eligibleLevels = [...oppositeDefinitions.values()]
    .map((definition) => definition.level_requirement)
    .filter((level) => level <= cluster.level_requirement);
  const targetLevel = Math.max(...eligibleLevels);
  const candidateKinds = [...oppositeDefinitions.values()]
    .filter((definition) => definition.level_requirement === targetLevel)
    .map((definition) => definition.kind);
  const candidates = candidateKinds.flatMap((kind) => clustersByKind.get(`${oppositeType}:${kind}`) ?? []);
  const paired = nearestCluster(cluster, candidates, cluster.level_requirement);
  const endpoint = clusterEndpoint(cluster, cluster.level_requirement);
  const chainOrigin = cluster.entity_type === "monster"
    ? endpoint
    : paired ? clusterEndpoint(paired.cluster, cluster.level_requirement) : -1;
  const chain = chainOrigin >= 0 ? bestServiceChain(chainOrigin, cluster.level_requirement) : null;
  clusterCoverage.push({
    cluster_id: cluster.id,
    entity_type: cluster.entity_type,
    kind: cluster.kind,
    level_requirement: cluster.level_requirement,
    biome: cluster.biome,
    subzone: cluster.subzone,
    spawn_count: cluster.spawn_count,
    counterpart_cluster_id: paired?.cluster.id ?? null,
    counterpart_kind: paired?.cluster.kind ?? null,
    counterpart_seconds: paired ? round(paired.distance / MOVEMENT_SPEED) : null,
    station_bank_seconds: chain ? round(chain.distance / MOVEMENT_SPEED) : null,
    reachable: endpoint >= 0 && Boolean(paired) && Boolean(chain),
  });
}

const tierReports = [];
for (const tier of TIER_LOOPS) {
  const nodeClusters = clustersByKind.get(`node:${tier.node}`) ?? [];
  const monsterClusters = clustersByKind.get(`monster:${tier.monster}`) ?? [];
  if (!nodeClusters.length || !monsterClusters.length) throw new Error(`Missing Gate 7 tier-${tier.tier} clusters`);
  const requirements = tierRequirements(tier);
  const samples = [];
  const origins = [
    ...nodeClusters.map((cluster) => ({ origin: cluster, candidates: monsterClusters, nodeOrigin: true })),
    ...monsterClusters.map((cluster) => ({ origin: cluster, candidates: nodeClusters, nodeOrigin: false })),
  ];
  for (const { origin, candidates, nodeOrigin } of origins) {
    const paired = nearestCluster(origin, candidates, tier.level);
    if (!paired) {
      samples.push({ origin_cluster_id: origin.id, reachable: false });
      continue;
    }
    const nodeCluster = nodeOrigin ? origin : paired.cluster;
    const monsterCluster = nodeOrigin ? paired.cluster : origin;
    const monsterCell = clusterEndpoint(monsterCluster, tier.level);
    const chain = bestServiceChain(monsterCell, tier.level);
    if (!chain) {
      samples.push({ origin_cluster_id: origin.id, reachable: false });
      continue;
    }
    const resources = resourceModel(tier, nodeCluster, monsterCluster, requirements);
    const walkingSeconds = (paired.distance + chain.distance) / MOVEMENT_SPEED;
    samples.push({
      origin_cluster_id: origin.id,
      node_cluster_id: nodeCluster.id,
      monster_cluster_id: monsterCluster.id,
      reachable: true,
      node_monster_seconds: round(paired.distance / MOVEMENT_SPEED),
      walking_loop_seconds: round(walkingSeconds),
      modeled_cycle_seconds: round(
        walkingSeconds + resources.gather_seconds + resources.node_respawn_wait_seconds + resources.monster_respawn_wait_seconds,
      ),
      services: { smelt: chain.smelt, forge: chain.forge, bank: chain.bank },
      resource_model: resources,
    });
  }
  const reachable = samples.filter((sample) => sample.reachable);
  const pairTimes = reachable.map((sample) => sample.node_monster_seconds);
  const loopTimes = reachable.map((sample) => sample.walking_loop_seconds);
  const p90Pair = quantile(pairTimes, 0.9);
  const aboveTarget = reachable.filter((sample) => sample.node_monster_seconds > 30).length;
  const belowTarget = reachable.filter((sample) => sample.node_monster_seconds < 15).length;
  const exception = APPROVED_CROSS_BIOME.find((candidate) => candidate.tier === tier.tier) ?? null;
  tierReports.push({
    tier_index: tier.tier,
    level_requirement: tier.level,
    primary_node_kind: tier.node,
    primary_monster_kind: tier.monster,
    secondary_node_kinds: tier.secondaryNodes ?? [],
    requirements,
    evaluated_clusters: origins.length,
    reachable_clusters: reachable.length,
    node_monster_seconds: {
      median: round(quantile(pairTimes, 0.5)),
      p90: round(p90Pair),
      target_min: 15,
      target_max: 30,
      below_target_samples: belowTarget,
      above_target_samples: aboveTarget,
    },
    walking_loop_seconds: {
      median: round(quantile(loopTimes, 0.5)),
      p90: round(quantile(loopTimes, 0.9)),
    },
    status: reachable.length !== origins.length
      ? "fail_unreachable"
      : aboveTarget === 0
        ? (belowTarget ? "pass_compact" : "pass_target")
        : exception
          ? "pass_approved_cross_biome_exception"
          : "fail_unapproved_distance",
    approved_exception_id: exception?.id ?? null,
    samples,
  });
}

const failedTiers = tierReports.filter((tier) => tier.status.startsWith("fail"));
const unreachableClusters = clusterCoverage.filter((cluster) => !cluster.reachable);
const output = {
  schema_version: "tomlandia-gate7-reachability/v1",
  content_version: world.content_version,
  spawn_set_version: world.spawn_set_version,
  spawn_hash: world.spawn_hash,
  method: {
    collision_source: "terrainBlockedAt plus every v2 node collision disc",
    path_algorithm: "8-neighbour A* with diagonal corner-cut prevention",
    path_cell_size: PATH_CELL,
    movement_speed_world_units_per_second: MOVEMENT_SPEED,
    biome_min_levels: BIOME_MIN_LEVEL,
    station_chain: ["node", "monster", "smelt", "forge", "bank"],
    cluster_rule: "same entity kind/subzone connected within 480 world units",
    target_node_monster_seconds: { min: 15, max: 30, hard: false },
    bag_capacity: BAG_CAPACITY,
    combat_time_included: false,
  },
  summary: {
    spawns_evaluated: world.spawns.length,
    spawn_issues: spawnIssues.length,
    clusters_evaluated: clusterCoverage.length,
    unreachable_clusters: unreachableClusters.length,
    tiers_evaluated: tierReports.length,
    failed_tiers: failedTiers.length,
    overall_cluster_counterpart_seconds: {
      median: round(quantile(clusterCoverage.map((cluster) => cluster.counterpart_seconds).filter(Number.isFinite), 0.5)),
      p90: round(quantile(clusterCoverage.map((cluster) => cluster.counterpart_seconds).filter(Number.isFinite), 0.9)),
    },
    overall_cluster_station_bank_seconds: {
      median: round(quantile(clusterCoverage.map((cluster) => cluster.station_bank_seconds).filter(Number.isFinite), 0.5)),
      p90: round(quantile(clusterCoverage.map((cluster) => cluster.station_bank_seconds).filter(Number.isFinite), 0.9)),
    },
  },
  intentional_cross_biome_exceptions: APPROVED_CROSS_BIOME,
  spawn_issues: spawnIssues,
  unreachable_clusters: unreachableClusters,
  tier_reports: tierReports,
  cluster_coverage: clusterCoverage,
};

const rendered = prettyCanonicalJson(output);
if (checkOnly) {
  const existing = await readFile(PATHS.output, "utf8").catch(() => "");
  if (existing !== rendered) throw new Error(`Gate 7 reachability drifted; run node scripts/gate7/reachability.mjs`);
  console.log("Gate 7 reachability report is deterministic and current.");
} else {
  await writeFile(PATHS.output, rendered);
  console.log(
    `Wrote ${PATHS.output}: ${world.spawns.length} spawns, ${clusters.length} clusters, ` +
    `${failedTiers.length} failed tiers, ${unreachableClusters.length} unreachable clusters.`,
  );
}

if (spawnIssues.length || unreachableClusters.length || failedTiers.length) process.exitCode = 1;

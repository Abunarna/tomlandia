/**
 * V6 = canonical production V5 content, plus the approved additive strength
 * potion release.
 *
 * Rules enforced here:
 *   - every definition outside the enumerated potion delta is copied from the
 *     V5 authoring manifest byte-for-byte;
 *   - the 16 potion ids are stable; only their display names change on the
 *     item rows;
 *   - the percentage effect lives in a dedicated `strength_pct` field carried
 *     by runtime.mechanics.strength_potions — the legacy flat `dmg_boost`
 *     values are preserved untouched so V5 rollback keeps working;
 *   - potion recipes, ingredients, quantities, Alchemy requirements, XP, craft
 *     durations, boost_hits and intrinsic values are carried over untouched;
 *   - healing food is untouched;
 *   - the world is unchanged: every V5 spawn identity and position carries
 *     forward, only the version labels move to v6.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

import { manifestHash, prettyCanonicalJson, uuidV5 } from "../content/model.mjs";
import {
  BASE_ATTACK_INTERVAL_S,
  DELETED_ITEMS,
  PLAYER_NOTICE,
  POTIONS,
  POTION_IDS,
  V5_VERSION,
  V6_VERSION,
} from "./model.mjs";

const PATHS = Object.freeze({
  v5Content: "content/v5/manifest.authoring.json",
  v5World: "content/v5/world-spawn-manifest.json",
  content: "content/v6/manifest.authoring.json",
  world: "content/v6/world-spawn-manifest.json",
  report: "docs/overhaul/v6/content-change-report.json",
});
const checkOnly = process.argv.includes("--check");
const promote = process.argv.includes("--promote");

const [v5Content, v5World] = await Promise.all([
  readFile(PATHS.v5Content, "utf8").then(JSON.parse),
  readFile(PATHS.v5World, "utf8").then(JSON.parse),
]);
if (v5Content.content_version !== V5_VERSION || v5World.spawn_set_version !== V5_VERSION) {
  throw new Error("V6 must be derived from the canonical V5 manifests");
}
if (DELETED_ITEMS.length !== 0) throw new Error("V6 must not delete any content id");

const src = v5Content.runtime;
const v5Items = new Map(src.items.map((item) => [item.id, item]));
const nameById = new Map(POTIONS.map((potion) => [potion.id, potion.name]));

// ---------------------------------------------------------------------------
// Preconditions: the delta must apply to exactly the ids the release names.
// ---------------------------------------------------------------------------
const v5Potions = src.items
  .filter((item) => item.kind === "potion")
  .map((item) => item.id)
  .sort();
if (JSON.stringify(v5Potions) !== JSON.stringify([...POTION_IDS].sort())) {
  throw new Error("V5 potion catalogue does not match the enumerated V6 potion delta");
}
for (const potion of POTIONS) {
  const item = v5Items.get(potion.id);
  if (!item) throw new Error(`target potion ${potion.id} is not a V5 item`);
  if (item.kind !== "potion") throw new Error(`target potion ${potion.id} is not a potion`);
  if (item.tier_index !== potion.tier) {
    throw new Error(`target potion ${potion.id} is tier ${item.tier_index}, expected ${potion.tier}`);
  }
  if (!(item.stats.boost_hits > 0)) throw new Error(`potion ${potion.id} has no boost hits`);
}

// ---------------------------------------------------------------------------
// Items: copy V5, rename the potions. Nothing else moves.
// ---------------------------------------------------------------------------
const items = src.items
  .map((item) => (nameById.has(item.id) ? { ...item, active: true, name: nameById.get(item.id) } : item))
  .sort((left, right) => left.id.localeCompare(right.id));
const itemIds = new Set(items.map((item) => item.id));

for (const item of items) {
  const before = v5Items.get(item.id);
  for (const field of [...new Set([...Object.keys(before), ...Object.keys(item)])]) {
    if (field === "name" && nameById.has(item.id)) continue;
    if (JSON.stringify(before[field]) !== JSON.stringify(item[field])) {
      throw new Error(`V6 changes ${field} of ${item.id}; only potion display names may change`);
    }
  }
}

// Healing food isolation: byte-identical, including recipes.
const foodBefore = src.items.filter((item) => item.kind === "food");
const foodAfter = items.filter((item) => item.kind === "food");
if (
  JSON.stringify([...foodBefore].sort((l, r) => l.id.localeCompare(r.id))) !==
  JSON.stringify([...foodAfter].sort((l, r) => l.id.localeCompare(r.id)))
) {
  throw new Error("V6 changed a healing food definition");
}

// ---------------------------------------------------------------------------
// Recipes: preserved exactly.
// ---------------------------------------------------------------------------
const recipes = [...src.recipes].sort((left, right) => left.id.localeCompare(right.id));
if (JSON.stringify(recipes) !== JSON.stringify([...src.recipes].sort((l, r) => l.id.localeCompare(r.id)))) {
  throw new Error("V6 changed the recipe table");
}
const potionRecipes = recipes.filter((recipe) => POTION_IDS.includes(recipe.output_item_id));
if (potionRecipes.length !== 16) {
  throw new Error(`V6 must publish 16 potion recipes, found ${potionRecipes.length}`);
}
for (const potion of POTIONS) {
  const recipe = potionRecipes.find((entry) => entry.output_item_id === potion.id);
  if (!recipe) throw new Error(`potion ${potion.id} has no recipe`);
  if (recipe.skill !== "alchemy") throw new Error(`recipe ${recipe.id} is not an Alchemy recipe`);
  if (recipe.tier_index !== potion.tier) throw new Error(`recipe for ${potion.id} is not tier ${potion.tier}`);
  for (const input of recipe.inputs) {
    if (!itemIds.has(input.item_id)) throw new Error(`recipe ${recipe.id} consumes unknown item ${input.item_id}`);
  }
}

// ---------------------------------------------------------------------------
// Acquisition proof: every ingredient must be reachable at or below its gate.
// ---------------------------------------------------------------------------
const sourceOf = new Map();
const note = (itemId, entry) => {
  if (!sourceOf.has(itemId)) sourceOf.set(itemId, []);
  sourceOf.get(itemId).push(entry);
};
for (const node of src.nodes) {
  note(node.item_id, { kind: "node", key: node.kind, level_requirement: node.level_requirement });
}
for (const monster of src.monsters) {
  for (const drop of monster.loot ?? []) {
    note(drop.item_id, {
      kind: "monster",
      key: monster.kind,
      level_requirement: monster.level_requirement,
      chance: drop.chance,
    });
  }
}
for (const recipe of recipes) {
  note(recipe.output_item_id, { kind: "recipe", key: recipe.id, level_requirement: recipe.level_requirement });
}
for (const fish of src.fish ?? []) {
  note(fish.item_id, { kind: "fish", key: fish.item_id, level_requirement: fish.level_requirement });
}

const acquisition = [];
for (const recipe of potionRecipes) {
  for (const input of recipe.inputs) {
    const sources = sourceOf.get(input.item_id) ?? [];
    if (!sources.length) throw new Error(`ingredient ${input.item_id} has no acquisition source`);
    const definition = v5Items.get(input.item_id);
    if (!definition?.active) throw new Error(`ingredient ${input.item_id} is not an active definition`);
    const cheapest = Math.min(...sources.map((entry) => entry.level_requirement));
    acquisition.push({
      recipe_id: recipe.id,
      recipe_level_requirement: recipe.level_requirement,
      item_id: input.item_id,
      qty: input.qty,
      value: definition.value,
      earliest_source_level: cheapest,
      sources,
      obtainable_at_gate: cheapest <= recipe.level_requirement,
      capstone: cheapest > recipe.level_requirement,
    });
  }
}
// Tier 16's Ascendant Core is an explicit soft capstone: the level-150 boss
// monster gates it above the recipe requirement. Everything else must be
// obtainable at or below the recipe gate.
for (const entry of acquisition) {
  if (entry.obtainable_at_gate) continue;
  if (entry.item_id !== "ascendant_core") {
    throw new Error(
      `ingredient ${entry.item_id} for ${entry.recipe_id} is gated at ${entry.earliest_source_level}, ` +
        `above the recipe gate ${entry.recipe_level_requirement}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Assemble, hash and emit.
// ---------------------------------------------------------------------------
const strengthPotions = POTIONS.map((potion) => ({
  boost_hits: v5Items.get(potion.id).stats.boost_hits,
  item_id: potion.id,
  strength_pct: potion.strength_pct,
  tier_index: potion.tier,
})).sort((left, right) => left.tier_index - right.tier_index);

for (let index = 1; index < strengthPotions.length; index += 1) {
  if (strengthPotions[index].strength_pct < strengthPotions[index - 1].strength_pct) {
    throw new Error(`strength progression decreases at tier ${strengthPotions[index].tier_index}`);
  }
}

const runtime = {
  ...src,
  items,
  mechanics: { ...src.mechanics, strength_potions: strengthPotions },
  player_notice: PLAYER_NOTICE,
  recipes,
};

const content = {
  content_version: V6_VERSION,
  lifecycle: "runtime",
  runtime,
  schema_version: v5Content.schema_version,
  spawn_set_version: V6_VERSION,
  tiers: v5Content.tiers,
  uuid_namespace: v5Content.uuid_namespace,
};

const contentRendered = prettyCanonicalJson(content);
const contentHash = manifestHash(JSON.parse(contentRendered));

const v6Spawns = v5World.spawns
  .map((spawn) => ({
    ...spawn,
    spawn_id: uuidV5(
      v5Content.uuid_namespace,
      `${V6_VERSION}:${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`,
    ),
  }))
  .sort((left, right) => left.spawn_id.localeCompare(right.spawn_id));

const world = {
  ...v5World,
  spawns: v6Spawns,
  content_version: V6_VERSION,
  spawn_set_version: V6_VERSION,
  source_content_manifest_hash: contentHash,
  derived_from: {
    content_version: v5World.content_version,
    spawn_set_version: v5World.spawn_set_version,
    spawn_hash: v5World.spawn_hash,
    source_content_manifest_hash: v5World.source_content_manifest_hash,
    policy:
      "V6 changes potion effect semantics and display names only; every V5 spawn identity and position is carried forward unchanged",
  },
  rollback: {
    v5_rows_mutated: false,
    player_state_mutated: false,
    switch_back: "select v5 content/spawn control; v5 content, spawn and world rows remain in place",
  },
};
const spawnHash = manifestHash({
  content_version: V6_VERSION,
  spawn_set_version: V6_VERSION,
  spawns: world.spawns,
});
world.spawn_hash = spawnHash;
const worldRendered = prettyCanonicalJson(world);

if (world.spawns.length !== v5World.spawns.length) throw new Error("V6 must not change the spawn count");
if (world.counts.nodes !== v5World.counts.nodes || world.counts.monsters !== v5World.counts.monsters) {
  throw new Error("V6 spawn counts drifted from V5");
}

const report = {
  generated_from: { content: PATHS.v5Content, world: PATHS.v5World },
  content_version: V6_VERSION,
  spawn_set_version: V6_VERSION,
  content_manifest_hash: contentHash,
  spawn_hash: spawnHash,
  counts: world.counts,
  world_unchanged: true,
  base_attack_interval_s: BASE_ATTACK_INTERVAL_S,
  deleted_items: DELETED_ITEMS,
  healing_food_unchanged: true,
  effect_semantics: {
    field: "strength_pct",
    legacy_field_preserved: "dmg_boost",
    formula:
      "base_attack = round(3 + combat_level + weapon_attack + armour_attack); " +
      "strength_bonus = round(base_attack * strength_pct / 100); " +
      "damage = max(1, floor((base_attack + strength_bonus) * U[0.6,1.2) - monster_defense * 0.4))",
  },
  potions: POTIONS.map((potion) => {
    const before = v5Items.get(potion.id);
    const after = items.find((entry) => entry.id === potion.id);
    return {
      tier: potion.tier,
      id: potion.id,
      name: potion.name,
      previous_name: before.name,
      strength_pct: potion.strength_pct,
      legacy_dmg_boost: before.stats.dmg_boost,
      boost_hits: after.stats.boost_hits,
      value: after.value,
      level_requirement: after.level_requirement,
      recipe_id: potionRecipes.find((recipe) => recipe.output_item_id === potion.id).id,
    };
  }),
  recipes: {
    total: recipes.length,
    potions: potionRecipes.length,
    v5_total: src.recipes.length,
    detail: potionRecipes
      .map((recipe) => ({
        id: recipe.id,
        output_item_id: recipe.output_item_id,
        tier_index: recipe.tier_index,
        level_requirement: recipe.level_requirement,
        xp: recipe.xp,
        time_s: recipe.time_s,
        inputs: [...recipe.inputs].sort((l, r) => l.item_id.localeCompare(r.item_id)),
      }))
      .sort((l, r) => l.tier_index - r.tier_index),
  },
  ingredient_acquisition: acquisition.sort(
    (l, r) => l.recipe_id.localeCompare(r.recipe_id) || l.item_id.localeCompare(r.item_id),
  ),
  items: { total: items.length, v5_total: src.items.length },
};
const reportRendered = prettyCanonicalJson(report);

const clientWorld = `/* eslint-disable */
/* GENERATED by scripts/v6/build.mjs. Do not edit. */
/* Spawn-set identity the client requires from game_world_runtime_status. */

export const SPAWN_SET_VERSION = "${V6_VERSION}";
export const WORLD_SPAWN_HASH = "${spawnHash}";
export const WORLD_SPAWN_COUNTS = Object.freeze({ nodes: ${world.counts.nodes}, monsters: ${world.counts.monsters} });
`;

// The generated client pins stay on the active release (v5) until rollout; the
// v6 pin is written only when --promote is passed.
const outputs = [
  ...(promote ? [["src/generated/world-manifest.ts", clientWorld]] : []),
  [PATHS.content, contentRendered],
  [PATHS.world, worldRendered],
  [PATHS.report, reportRendered],
];

for (const [file, rendered] of outputs) {
  if (checkOnly) {
    const existing = await readFile(file, "utf8").catch(() => "");
    if (existing !== rendered) throw new Error(`V6 artifact drifted: ${file}; run bun run v6:build`);
  } else {
    await mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
    await writeFile(file, rendered);
  }
}

console.log(
  `${checkOnly ? "Verified" : "Wrote"} V6 artifacts: ${items.length} items (16 potions, 0 deleted), ` +
    `${recipes.length} recipes, ${world.counts.nodes} nodes, ${world.counts.monsters} monsters; ` +
    `content ${contentHash}; spawns ${spawnHash}`,
);

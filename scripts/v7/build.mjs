/**
 * V7 = canonical production V6 content, plus the approved additive healing-food
 * release.
 *
 * Rules enforced here:
 *   - every definition outside the enumerated food delta is copied from the V6
 *     authoring manifest byte-for-byte;
 *   - the 16 food ids, names, values, recipes, ingredients, quantities, Cooking
 *     requirements, XP, durations and output quantities are stable;
 *   - the only field that may change is `stats.heal`, to the frozen curve;
 *   - the world is unchanged: every V6 spawn identity and position carries
 *     forward, only the version labels move to v7.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

import { manifestHash, prettyCanonicalJson, uuidV5 } from "../content/model.mjs";
import {
  DELETED_ITEMS,
  FOODS,
  FOOD_IDS,
  PLAYER_NOTICE,
  V6_VERSION,
  V7_VERSION,
} from "./model.mjs";

const PATHS = Object.freeze({
  v6Content: "content/v6/manifest.authoring.json",
  v6World: "content/v6/world-spawn-manifest.json",
  content: "content/v7/manifest.authoring.json",
  world: "content/v7/world-spawn-manifest.json",
  report: "docs/overhaul/v7/content-change-report.json",
});
const checkOnly = process.argv.includes("--check");
const promote = process.argv.includes("--promote");

const [v6Content, v6World] = await Promise.all([
  readFile(PATHS.v6Content, "utf8").then(JSON.parse),
  readFile(PATHS.v6World, "utf8").then(JSON.parse),
]);
if (v6Content.content_version !== V6_VERSION || v6World.spawn_set_version !== V6_VERSION) {
  throw new Error("V7 must be derived from the canonical V6 manifests");
}
if (DELETED_ITEMS.length !== 0) throw new Error("V7 must not delete any content id");

const src = v6Content.runtime;
const v6Items = new Map(src.items.map((item) => [item.id, item]));
const healById = new Map(FOODS.map((food) => [food.id, food.heal]));

// ---------------------------------------------------------------------------
// Preconditions: the delta applies to exactly the ids the release names.
// ---------------------------------------------------------------------------
const v6Foods = src.items.filter((item) => item.kind === "food");
if (v6Foods.length !== FOODS.length) {
  throw new Error(`V6 defines ${v6Foods.length} foods; the release names ${FOODS.length}`);
}
for (const food of FOODS) {
  const before = v6Items.get(food.id);
  if (!before) throw new Error(`stable food ${food.id} is not a canonical V6 item`);
  if (before.kind !== "food") throw new Error(`${food.id} is not a food in V6`);
  if (before.tier_index !== food.tier) throw new Error(`${food.id} is not tier ${food.tier} in V6`);
  if (!Number.isInteger(food.heal) || food.heal <= 0) {
    throw new Error(`${food.id} has a non-positive healing amount`);
  }
}
for (let index = 1; index < FOODS.length; index += 1) {
  if (FOODS[index].heal <= FOODS[index - 1].heal) {
    throw new Error(`healing curve is not strictly increasing at tier ${FOODS[index].tier}`);
  }
}

// ---------------------------------------------------------------------------
// Items: copy V6, replace only the healing amount of the 16 stable foods.
// ---------------------------------------------------------------------------
const items = src.items
  .map((item) => {
    if (!healById.has(item.id)) return item;
    return { ...item, stats: { ...item.stats, heal: healById.get(item.id) } };
  })
  .sort((left, right) => left.id.localeCompare(right.id));

for (const item of items) {
  const before = v6Items.get(item.id);
  const strip = (entry) => JSON.stringify({ ...entry, stats: { ...entry.stats, heal: 0 } });
  if (strip(item) !== strip(before)) {
    throw new Error(`V7 changes a field of ${item.id} outside the healing delta`);
  }
  if (!FOOD_IDS.includes(item.id) && item.stats.heal !== before.stats.heal) {
    throw new Error(`V7 changes the healing of ${item.id}, which is not a released food`);
  }
  if (item.value !== before.value) throw new Error(`V7 changes the value of ${item.id}`);
}

const recipes = src.recipes;
const cookRecipes = recipes.filter((recipe) => FOOD_IDS.includes(recipe.output_item_id));
if (cookRecipes.length !== FOOD_IDS.length) {
  throw new Error("V7 must carry exactly one Cooking recipe per stable food");
}
for (const recipe of cookRecipes) {
  if (recipe.skill !== "cooking" || recipe.station !== "cook") {
    throw new Error(`recipe ${recipe.id} is not a Cooking craft`);
  }
  if (recipe.output_qty !== 1) throw new Error(`recipe ${recipe.id} no longer outputs one dish`);
  for (const input of recipe.inputs) {
    const ingredient = v6Items.get(input.item_id);
    if (!ingredient?.active) throw new Error(`ingredient ${input.item_id} is not active`);
    if (input.qty <= 0) throw new Error(`recipe ${recipe.id} consumes a non-positive quantity`);
  }
}

// ---------------------------------------------------------------------------
// Assemble, hash and emit.
// ---------------------------------------------------------------------------
const healingFoods = FOODS.map((food) => {
  const item = items.find((entry) => entry.id === food.id);
  return {
    heal: food.heal,
    item_id: food.id,
    recipe_id: cookRecipes.find((recipe) => recipe.output_item_id === food.id).id,
    tier_index: food.tier,
    value: item.value,
  };
}).sort((left, right) => left.tier_index - right.tier_index);

const runtime = {
  ...src,
  items,
  mechanics: { ...src.mechanics, healing_foods: healingFoods },
  player_notice: PLAYER_NOTICE,
  recipes,
};

const content = {
  content_version: V7_VERSION,
  lifecycle: "runtime",
  runtime,
  schema_version: v6Content.schema_version,
  spawn_set_version: V7_VERSION,
  tiers: v6Content.tiers,
  uuid_namespace: v6Content.uuid_namespace,
};

const contentRendered = prettyCanonicalJson(content);
const contentHash = manifestHash(JSON.parse(contentRendered));

const v7Spawns = v6World.spawns
  .map((spawn) => ({
    ...spawn,
    spawn_id: uuidV5(
      v6Content.uuid_namespace,
      `${V7_VERSION}:${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`,
    ),
  }))
  .sort((left, right) => left.spawn_id.localeCompare(right.spawn_id));

const world = {
  ...v6World,
  spawns: v7Spawns,
  content_version: V7_VERSION,
  spawn_set_version: V7_VERSION,
  source_content_manifest_hash: contentHash,
  derived_from: {
    content_version: v6World.content_version,
    spawn_set_version: v6World.spawn_set_version,
    spawn_hash: v6World.spawn_hash,
    source_content_manifest_hash: v6World.source_content_manifest_hash,
    policy:
      "V7 changes healing amounts only; every V6 spawn identity and position is carried forward unchanged",
  },
  rollback: {
    v6_rows_mutated: false,
    player_state_mutated: false,
    switch_back:
      "select v6 content/spawn control; v6 content, spawn and world rows remain in place",
  },
};
const spawnHash = manifestHash({
  content_version: V7_VERSION,
  spawn_set_version: V7_VERSION,
  spawns: world.spawns,
});
world.spawn_hash = spawnHash;
const worldRendered = prettyCanonicalJson(world);

if (world.spawns.length !== v6World.spawns.length)
  throw new Error("V7 must not change the spawn count");
if (
  world.counts.nodes !== v6World.counts.nodes ||
  world.counts.monsters !== v6World.counts.monsters
) {
  throw new Error("V7 spawn counts drifted from V6");
}

const report = {
  generated_from: { content: PATHS.v6Content, world: PATHS.v6World },
  content_version: V7_VERSION,
  spawn_set_version: V7_VERSION,
  content_manifest_hash: contentHash,
  spawn_hash: spawnHash,
  counts: world.counts,
  world_unchanged: true,
  deleted_items: DELETED_ITEMS,
  values_unchanged: true,
  recipes_unchanged: true,
  foods: healingFoods.map((row) => ({
    ...row,
    previous_heal: v6Items.get(row.item_id).stats.heal,
    delta: row.heal - v6Items.get(row.item_id).stats.heal,
  })),
  items: { total: items.length, v6_total: src.items.length },
  recipes: { total: recipes.length, cooking: cookRecipes.length },
};
const reportRendered = prettyCanonicalJson(report);

const clientWorld = `/* eslint-disable */
/* GENERATED by scripts/v7/build.mjs. Do not edit. */
/* Spawn-set identity the client requires from game_world_runtime_status. */

export const SPAWN_SET_VERSION = "${V7_VERSION}";
export const WORLD_SPAWN_HASH = "${spawnHash}";
export const WORLD_SPAWN_COUNTS = Object.freeze({ nodes: ${world.counts.nodes}, monsters: ${world.counts.monsters} });
`;

// The generated client pins stay on the active release (v6) until rollout; the
// v7 pin is written only when --promote is passed.
const outputs = [
  ...(promote ? [["src/generated/world-manifest.ts", clientWorld]] : []),
  [PATHS.content, contentRendered],
  [PATHS.world, worldRendered],
  [PATHS.report, reportRendered],
];

for (const [file, rendered] of outputs) {
  if (checkOnly) {
    const existing = await readFile(file, "utf8").catch(() => "");
    if (existing !== rendered)
      throw new Error(`V7 artifact drifted: ${file}; run bun run v7:build`);
  } else {
    await mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
    await writeFile(file, rendered);
  }
}

console.log(
  `${checkOnly ? "Verified" : "Wrote"} V7 artifacts: ${items.length} items (16 foods, 0 deleted), ` +
    `${recipes.length} recipes, ${world.counts.nodes} nodes, ${world.counts.monsters} monsters; ` +
    `content ${contentHash}; spawns ${spawnHash}`,
);

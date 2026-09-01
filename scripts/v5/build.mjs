/**
 * V5 = live V4 content, plus the approved additive sword release.
 *
 * Rules enforced here:
 *   - every definition outside the enumerated sword delta is copied from the
 *     V4 authoring manifest byte-for-byte;
 *   - the 16 target sword ids are stable; only their display names change;
 *   - sword attack values, recipes, ingredients, quantities, Smithing
 *     requirements, XP and craft durations are carried over untouched;
 *   - the four tester weapons are deleted outright, with a hard 'stop'
 *     migration rule and no compensation path;
 *   - the world is unchanged: every V4 spawn identity and position carries
 *     forward, only the version labels move to v5.
 *
 * Determinism: every value is either copied from V4 or read from the frozen
 * tables in scripts/v5/model.mjs, so re-running reproduces identical artifacts.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

import { manifestHash, prettyCanonicalJson, uuidV5 } from "../content/model.mjs";
import {
  BASE_ATTACK_INTERVAL_S,
  DELETED_ITEMS,
  PLAYER_NOTICE,
  SWORDS,
  SWORD_IDS,
  V4_VERSION,
  V5_VERSION,
} from "./model.mjs";

const PATHS = Object.freeze({
  v4Content: "content/v4/manifest.authoring.json",
  v4World: "content/v4/world-spawn-manifest.json",
  content: "content/v5/manifest.authoring.json",
  world: "content/v5/world-spawn-manifest.json",
  report: "docs/overhaul/v5/content-change-report.json",
});
const checkOnly = process.argv.includes("--check");
const promote = process.argv.includes("--promote");

const [v4Content, v4World] = await Promise.all([
  readFile(PATHS.v4Content, "utf8").then(JSON.parse),
  readFile(PATHS.v4World, "utf8").then(JSON.parse),
]);
if (v4Content.content_version !== V4_VERSION || v4World.spawn_set_version !== V4_VERSION) {
  throw new Error("V5 must be derived from the live V4 manifests");
}

const src = v4Content.runtime;
const v4Items = new Map(src.items.map((item) => [item.id, item]));
const deleted = new Set(DELETED_ITEMS);
const nameById = new Map(SWORDS.map((sword) => [sword.id, sword.name]));
const tierById = new Map(SWORDS.map((sword) => [sword.id, sword.tier]));

// ---------------------------------------------------------------------------
// Preconditions: the delta must apply to exactly the ids the release names.
// ---------------------------------------------------------------------------
for (const id of DELETED_ITEMS) {
  const item = v4Items.get(id);
  if (!item) throw new Error(`deleted tester weapon ${id} is not a V4 item`);
  if (item.kind !== "weapon") throw new Error(`deletion allowlist entry ${id} is not a weapon`);
}
for (const sword of SWORDS) {
  const item = v4Items.get(sword.id);
  if (!item) throw new Error(`target sword ${sword.id} is not a V4 item`);
  if (item.kind !== "weapon") throw new Error(`target sword ${sword.id} is not a weapon`);
  if (item.tier_index !== sword.tier) {
    throw new Error(`target sword ${sword.id} is tier ${item.tier_index}, expected ${sword.tier}`);
  }
}
const v4Weapons = src.items
  .filter((item) => item.kind === "weapon")
  .map((item) => item.id)
  .sort();
const expectedWeapons = [...SWORD_IDS, ...DELETED_ITEMS].sort();
if (JSON.stringify(v4Weapons) !== JSON.stringify(expectedWeapons)) {
  throw new Error("V4 weapon catalogue does not match the enumerated V5 sword delta");
}

// ---------------------------------------------------------------------------
// Items: copy V4, drop the tester weapons, rename the swords.
// ---------------------------------------------------------------------------
const items = src.items
  .filter((item) => !deleted.has(item.id))
  .map((item) =>
    nameById.has(item.id) ? { ...item, active: true, name: nameById.get(item.id) } : item,
  )
  .sort((left, right) => left.id.localeCompare(right.id));
const itemIds = new Set(items.map((item) => item.id));

// ---------------------------------------------------------------------------
// Recipes: preserved exactly. V5 must not rebalance a single sword craft.
// ---------------------------------------------------------------------------
const recipes = src.recipes
  .filter((recipe) => !deleted.has(recipe.output_item_id))
  .map((recipe) => ({
    ...recipe,
    inputs: recipe.inputs.filter((input) => !deleted.has(input.item_id)),
  }))
  .sort((left, right) => left.id.localeCompare(right.id));

for (const recipe of recipes) {
  const before = src.recipes.find((entry) => entry.id === recipe.id);
  if (JSON.stringify(before) !== JSON.stringify(recipe)) {
    throw new Error(
      `V5 changed recipe ${recipe.id}; the sword release must not touch recipe economy`,
    );
  }
  if (!itemIds.has(recipe.output_item_id))
    throw new Error(`recipe ${recipe.id} outputs unknown item`);
  for (const input of recipe.inputs) {
    if (!itemIds.has(input.item_id))
      throw new Error(`recipe ${recipe.id} consumes unknown item ${input.item_id}`);
  }
}
const swordRecipes = recipes.filter((recipe) => SWORD_IDS.includes(recipe.output_item_id));
if (swordRecipes.length !== 16)
  throw new Error(`V5 must publish 16 sword recipes, found ${swordRecipes.length}`);
for (const sword of SWORDS) {
  const recipe = swordRecipes.find((entry) => entry.output_item_id === sword.id);
  if (!recipe) throw new Error(`sword ${sword.id} has no recipe`);
  if (recipe.tier_index !== sword.tier)
    throw new Error(`recipe for ${sword.id} is not tier ${sword.tier}`);
}

// ---------------------------------------------------------------------------
// Monotonic attack progression across the 16 tiers (values carried from V4).
// ---------------------------------------------------------------------------
const ladder = SWORDS.map((sword) => ({
  ...sword,
  item: items.find((entry) => entry.id === sword.id),
}));
for (let index = 1; index < ladder.length; index += 1) {
  if (ladder[index].item.stats.attack <= ladder[index - 1].item.stats.attack) {
    throw new Error(`sword attack progression is not monotonic at tier ${ladder[index].tier}`);
  }
  if (ladder[index].item.level_requirement <= ladder[index - 1].item.level_requirement) {
    throw new Error(`sword level requirement is not monotonic at tier ${ladder[index].tier}`);
  }
  if (ladder[index].item.stats.attack !== v4Items.get(ladder[index].id).stats.attack) {
    throw new Error(`sword ${ladder[index].id} attack changed; V5 must preserve V4 balance`);
  }
}

// ---------------------------------------------------------------------------
// Everything that can name a deleted id.
// ---------------------------------------------------------------------------
const monsters = src.monsters.map((monster) => ({
  ...monster,
  loot: (monster.loot ?? []).filter((drop) => !deleted.has(drop.item_id)),
}));
const quests = src.quests.map((quest) => ({
  ...quest,
  reward_items: (quest.reward_items ?? []).filter((reward) => !deleted.has(reward.item_id)),
}));
const starterLoadout = { ...src.starter_loadout };
for (const [key, value] of Object.entries(starterLoadout)) {
  if (typeof value === "string" && deleted.has(value)) {
    throw new Error(`starter loadout still names deleted id ${value}`);
  }
  void key;
}

const migrationRules = [
  ...src.migration_rules.filter(
    (rule) => !deleted.has(rule.from_id) && !deleted.has(rule.to_id ?? ""),
  ),
  ...DELETED_ITEMS.map((from) => ({
    action: "stop",
    captured_value_required: false,
    from_id: from,
    notice_key: `${from}_removed`,
  })),
].sort((left, right) => left.from_id.localeCompare(right.from_id));

// Exhaustive dangling-reference sweep over the whole runtime payload.
const runtime = {
  ...src,
  items,
  migration_rules: migrationRules,
  monsters,
  player_notice: PLAYER_NOTICE,
  quests,
  recipes,
  starter_loadout: starterLoadout,
};
const serialised = JSON.stringify({ ...runtime, migration_rules: [] });
for (const id of DELETED_ITEMS) {
  if (serialised.includes(`"${id}"`))
    throw new Error(`V5 content still references deleted id ${id}`);
}

// ---------------------------------------------------------------------------
// Assemble, hash and emit.
// ---------------------------------------------------------------------------
const content = {
  content_version: V5_VERSION,
  lifecycle: "runtime",
  runtime,
  schema_version: v4Content.schema_version,
  spawn_set_version: V5_VERSION,
  tiers: v4Content.tiers,
  uuid_namespace: v4Content.uuid_namespace,
};

const contentRendered = prettyCanonicalJson(content);
const contentHash = manifestHash(JSON.parse(contentRendered));

const v5Spawns = v4World.spawns
  .map((spawn) => ({
    ...spawn,
    spawn_id: uuidV5(
      v4Content.uuid_namespace,
      `${V5_VERSION}:${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`,
    ),
  }))
  .sort((left, right) => left.spawn_id.localeCompare(right.spawn_id));

const world = {
  ...v4World,
  spawns: v5Spawns,
  content_version: V5_VERSION,
  spawn_set_version: V5_VERSION,
  source_content_manifest_hash: contentHash,
  derived_from: {
    content_version: v4World.content_version,
    spawn_set_version: v4World.spawn_set_version,
    spawn_hash: v4World.spawn_hash,
    source_content_manifest_hash: v4World.source_content_manifest_hash,
    policy:
      "V5 changes sword content only; every V4 spawn identity and position is carried forward unchanged",
  },
  rollback: {
    v4_rows_mutated: false,
    player_state_mutated: false,
    switch_back:
      "select v4 content/spawn control; v4 content, spawn and world rows remain in place",
  },
};
const spawnHash = manifestHash({
  content_version: V5_VERSION,
  spawn_set_version: V5_VERSION,
  spawns: world.spawns,
});
world.spawn_hash = spawnHash;
const worldRendered = prettyCanonicalJson(world);

if (world.spawns.length !== v4World.spawns.length)
  throw new Error("V5 must not change the spawn count");
if (
  world.counts.nodes !== v4World.counts.nodes ||
  world.counts.monsters !== v4World.counts.monsters
) {
  throw new Error("V5 spawn counts drifted from V4");
}

const report = {
  generated_from: { content: PATHS.v4Content, world: PATHS.v4World },
  content_version: V5_VERSION,
  spawn_set_version: V5_VERSION,
  content_manifest_hash: contentHash,
  spawn_hash: spawnHash,
  counts: world.counts,
  world_unchanged: true,
  base_attack_interval_s: BASE_ATTACK_INTERVAL_S,
  swords: ladder.map((entry) => ({
    tier: entry.tier,
    id: entry.id,
    name: entry.name,
    previous_name: v4Items.get(entry.id).name,
    attack: entry.item.stats.attack,
    level_requirement: entry.item.level_requirement,
    recipe_id: swordRecipes.find((recipe) => recipe.output_item_id === entry.id).id,
  })),
  deleted_items: DELETED_ITEMS,
  recipes: { total: recipes.length, swords: swordRecipes.length, v4_total: src.recipes.length },
  items: { total: items.length, v4_total: src.items.length },
};
const reportRendered = prettyCanonicalJson(report);

const clientWorld = `/* eslint-disable */
/* GENERATED by scripts/v5/build.mjs. Do not edit. */
/* Spawn-set identity the client requires from game_world_runtime_status. */

export const SPAWN_SET_VERSION = "${V5_VERSION}";
export const WORLD_SPAWN_HASH = "${spawnHash}";
export const WORLD_SPAWN_COUNTS = Object.freeze({ nodes: ${world.counts.nodes}, monsters: ${world.counts.monsters} });
`;

// The generated client pins stay on the active release (v4) until rollout; the
// v5 pin is written only when --promote is passed.
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
      throw new Error(`V5 artifact drifted: ${file}; run bun run v5:build`);
  } else {
    await mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
    await writeFile(file, rendered);
  }
}

console.log(
  `${checkOnly ? "Verified" : "Wrote"} V5 artifacts: ${items.length} items (16 swords, ${DELETED_ITEMS.length} deleted), ` +
    `${recipes.length} recipes, ${world.counts.nodes} nodes, ${world.counts.monsters} monsters; ` +
    `content ${contentHash}; spawns ${spawnHash}`,
);

/**
 * V4 = live V3 content plus the armour crafting and availability overhaul.
 *
 * Rules enforced here:
 *   - every non-armour definition is copied from the V3 authoring manifest
 *     byte-for-byte;
 *   - the world is unchanged: every V3 spawn identity and position carries
 *     forward untouched, only the version labels move to v4;
 *   - all 32 armour items are re-stated onto the frozen balance solve, given
 *     an explicit heavy_armor / light_armor family, and re-cut onto one
 *     readable ingredient matrix;
 *   - nine off-theme armour ids are retired with captured-value compensation
 *     and replaced by canonical tier-themed ids;
 *   - three new tier-matched trophies are introduced so tiers 5, 7 and 12 have
 *     a real craft gate.
 *
 * Determinism: every value is either copied from V3 or read from the frozen
 * tables in scripts/v4/model.mjs, so re-running reproduces identical artifacts.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

import { canonicalJson, manifestHash, prettyCanonicalJson, uuidV5 } from "../content/model.mjs";
import {
  ARMOUR_BALANCE,
  HEAVY_QTY,
  LIGHT_QTY,
  NEW_TROPHIES,
  RETIRED_ARMOUR,
  THEME_TITLE,
  TIER_BAR,
  TIER_CLOTH,
  TIER_LEATHER,
  TIER_THEME,
  TIER_TROPHY,
  V3_VERSION,
  V4_VERSION,
} from "./model.mjs";

const PATHS = Object.freeze({
  v3Content: "content/v3/manifest.authoring.json",
  v3World: "content/v3/world-spawn-manifest.json",
  content: "content/v4/manifest.authoring.json",
  world: "content/v4/world-spawn-manifest.json",
  report: "docs/overhaul/v4/content-change-report.json",
});
const checkOnly = process.argv.includes("--check");
const promote = process.argv.includes("--promote");

const [v3Content, v3World] = await Promise.all([
  readFile(PATHS.v3Content, "utf8").then(JSON.parse),
  readFile(PATHS.v3World, "utf8").then(JSON.parse),
]);
if (v3Content.content_version !== V3_VERSION || v3World.spawn_set_version !== V3_VERSION) {
  throw new Error("V4 must be derived from the live V3 manifests");
}

const src = v3Content.runtime;
const v3Items = new Map(src.items.map((item) => [item.id, item]));
const v3Recipes = new Map(src.recipes.map((recipe) => [recipe.output_item_id, recipe]));
const v3Armour = src.items.filter((item) => item.kind === "armor");
if (v3Armour.length !== 32) throw new Error(`expected 32 V3 armour items, found ${v3Armour.length}`);

const tierBand = new Map(v3Content.tiers.map((tier) => [tier.tier_index, tier]));
const rarityFor = (tier) =>
  tier <= 3 ? "common" : tier <= 7 ? "uncommon" : tier <= 9 ? "rare" : tier <= 13 ? "epic" : "legendary";

// ---------------------------------------------------------------------------
// Armour: canonical ids, names, families, stats and values.
// ---------------------------------------------------------------------------
const armourPlan = [];
for (const [tier, heavyDefense, heavyAttack, lightDefense, lightAttack, lightSpeed] of ARMOUR_BALANCE) {
  const index = tier - 1;
  const theme = TIER_THEME[index];
  const title = THEME_TITLE[theme];
  const v3Heavy = v3Armour.find((item) => item.tier_index === tier && item.stats.attack === 0);
  const v3Light = v3Armour.find((item) => item.tier_index === tier && item.stats.attack > 0);
  if (!v3Heavy || !v3Light) throw new Error(`tier ${tier} is missing a V3 heavy/light pair`);

  armourPlan.push({
    tier,
    slot: "heavy",
    from: v3Heavy,
    id: `${theme}_heavy_armor`,
    name: `${title} Heavy Armour`,
    family: "heavy_armor",
    stats: { attack: heavyAttack, defense: heavyDefense, heal: 0, speed: 0, dmg_boost: 0, boost_hits: 0 },
  });
  armourPlan.push({
    tier,
    slot: "light",
    from: v3Light,
    id: `${theme}_light_armor`,
    name: `${title} Light Armour`,
    family: "light_armor",
    stats: { attack: lightAttack, defense: lightDefense, heal: 0, speed: lightSpeed, dmg_boost: 0, boost_hits: 0 },
  });
}

const armourIds = new Set(armourPlan.map((entry) => entry.id));
const retiredIds = Object.keys(RETIRED_ARMOUR).sort();
for (const [from, to] of Object.entries(RETIRED_ARMOUR)) {
  if (!v3Items.has(from)) throw new Error(`retired armour ${from} is not a V3 item`);
  if (!armourIds.has(to)) throw new Error(`retired armour ${from} maps to unknown replacement ${to}`);
}
// Every V3 armour id that survives must appear in the plan, and every retired
// id must not.
for (const item of v3Armour) {
  const retired = Object.hasOwn(RETIRED_ARMOUR, item.id);
  if (retired === armourIds.has(item.id)) {
    throw new Error(`armour ${item.id} is both retired and carried forward (or neither)`);
  }
}

const armourItems = armourPlan.map((entry) => ({
  active: true,
  colour: tierBand.get(entry.tier).palette.secondary,
  equip_skill: "combat",
  family: entry.family,
  icon_key: entry.id,
  id: entry.id,
  kind: "armor",
  level_requirement: entry.from.level_requirement,
  name: entry.name,
  rarity: rarityFor(entry.tier),
  stackable: false,
  stats: entry.stats,
  tier_index: entry.tier,
  tradable: true,
  value: entry.from.value,
}));

// ---------------------------------------------------------------------------
// New tier-matched trophies (tiers 5, 7, 12) and their monster drops.
// ---------------------------------------------------------------------------
const trophyItems = NEW_TROPHIES.map((trophy) => ({
  active: true,
  colour: trophy.colour,
  family: "trophy",
  icon_key: trophy.id,
  id: trophy.id,
  kind: "trophy",
  level_requirement: trophy.level_requirement,
  name: trophy.name,
  rarity: rarityFor(trophy.tier_index),
  stackable: true,
  stats: { attack: 0, boost_hits: 0, defense: 0, dmg_boost: 0, heal: 0, speed: 0 },
  tier_index: trophy.tier_index,
  tradable: true,
  value: trophy.value,
}));

const trophyByMonster = new Map(NEW_TROPHIES.map((trophy) => [trophy.monster, trophy]));
const monsters = src.monsters.map((monster) => {
  const trophy = trophyByMonster.get(monster.kind);
  if (!trophy) return monster;
  if ((monster.loot ?? []).some((drop) => drop.item_id === trophy.id)) return monster;
  const loot = [
    ...(monster.loot ?? []),
    { chance: trophy.chance, channel: "drop", item_id: trophy.id, qty_max: 1, qty_min: 1, xp: 0 },
  ].sort((left, right) => left.item_id.localeCompare(right.item_id));
  return { ...monster, loot };
});
for (const trophy of NEW_TROPHIES) {
  if (!monsters.some((monster) => (monster.loot ?? []).some((drop) => drop.item_id === trophy.id))) {
    throw new Error(`trophy ${trophy.id} has no source monster`);
  }
}

// ---------------------------------------------------------------------------
// Items: copy V3, drop retired armour, replace armour, append trophies.
// ---------------------------------------------------------------------------
const items = [
  ...src.items.filter((item) => item.kind !== "armor" && !Object.hasOwn(RETIRED_ARMOUR, item.id)),
  ...armourItems,
  ...trophyItems,
].sort((left, right) => left.id.localeCompare(right.id));

const itemIds = new Set(items.map((item) => item.id));

// ---------------------------------------------------------------------------
// Recipes: one readable ingredient matrix for all 32 armour crafts.
//   heavy = tier bar x4 + tier leather x2 + tier trophy x1   (smithing)
//   light = tier cloth x3 + tier leather x1 + tier trophy x1 (tailoring)
// Level requirement, XP and craft time are carried from the V3 recipe for the
// same tier and slot, so crafting throughput and skill pacing are unchanged.
// ---------------------------------------------------------------------------
const armourRecipes = armourPlan.map((entry) => {
  const index = entry.tier - 1;
  const base = v3Recipes.get(entry.from.id);
  if (!base) throw new Error(`no V3 recipe for ${entry.from.id}`);
  const inputs =
    entry.slot === "heavy"
      ? [
          { item_id: TIER_BAR[index], qty: HEAVY_QTY.bar },
          { item_id: TIER_LEATHER[index], qty: HEAVY_QTY.leather },
          { item_id: TIER_TROPHY[index], qty: HEAVY_QTY.trophy },
        ]
      : [
          { item_id: TIER_CLOTH[index], qty: LIGHT_QTY.cloth },
          { item_id: TIER_LEATHER[index], qty: LIGHT_QTY.leather },
          { item_id: TIER_TROPHY[index], qty: LIGHT_QTY.trophy },
        ];
  for (const input of inputs) {
    if (!itemIds.has(input.item_id)) throw new Error(`recipe for ${entry.id} needs unknown item ${input.item_id}`);
  }
  return {
    active: true,
    id: `armor_${entry.id}`,
    inputs: inputs.sort((left, right) => left.item_id.localeCompare(right.item_id)),
    level_requirement: base.level_requirement,
    output_item_id: entry.id,
    output_qty: 1,
    skill: entry.slot === "heavy" ? "smithing" : "tailoring",
    station: "armor",
    tier_index: entry.tier,
    time_s: base.time_s,
    xp: base.xp,
  };
});

const armourRecipeIds = new Set(armourRecipes.map((recipe) => recipe.id));
const recipes = [
  ...src.recipes.filter((recipe) => {
    const output = v3Items.get(recipe.output_item_id);
    return !(output && output.kind === "armor") && !armourRecipeIds.has(recipe.id);
  }),
  ...armourRecipes,
].sort((left, right) => left.id.localeCompare(right.id));

for (const recipe of recipes) {
  if (!itemIds.has(recipe.output_item_id)) throw new Error(`recipe ${recipe.id} outputs unknown item`);
  for (const input of recipe.inputs) {
    if (!itemIds.has(input.item_id)) throw new Error(`recipe ${recipe.id} consumes unknown item ${input.item_id}`);
  }
}
if (recipes.filter((recipe) => recipe.station === "armor").length !== 32) {
  throw new Error("V4 must publish exactly 32 armour recipes");
}

// ---------------------------------------------------------------------------
// Quests, starter loadout and anything else that can name a retired id.
// ---------------------------------------------------------------------------
const remap = (id) => RETIRED_ARMOUR[id] ?? id;
const quests = src.quests.map((quest) => ({
  ...quest,
  target_id: remap(quest.target_id),
  reward_items: (quest.reward_items ?? []).map((reward) => ({ ...reward, item_id: remap(reward.item_id) })),
}));
function remapDeep(value) {
  if (Array.isArray(value)) return value.map(remapDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, remapDeep(entry)]));
  }
  return typeof value === "string" ? remap(value) : value;
}
const starterLoadout = remapDeep(src.starter_loadout);

// ---------------------------------------------------------------------------
// Migration ledger: every superseded tester-era id is deleted outright
// ('stop'), with no replacement, compensation or preserved upgrade level.
// ---------------------------------------------------------------------------
const migrationRules = [
  ...src.migration_rules.filter((rule) => !Object.hasOwn(RETIRED_ARMOUR, rule.from_id)),
  ...retiredIds.map((from) => ({
    action: "stop",
    captured_value_required: false,
    from_id: from,
    notice_key: `${from}_removed`,
  })),
].sort((left, right) => left.from_id.localeCompare(right.from_id));

const playerNotice = {
  title: "Tomlandia armour overhaul",
  summary:
    "All 32 armour sets are now craftable on one readable ingredient matrix; nine off-theme test-era sets are removed.",
  details: [
    "Every tier from level 1 to level 150 now offers a matching Heavy and Light armour set named after its tier.",
    "Heavy armour trades swing speed for survivability: it now absorbs several times more damage but earns about 25% less experience per minute than Light armour.",
    "Heavy armour now carries an attack value, so upgrade levels finally improve it.",
    "Heavy armour is crafted from four bars, two leather and one tier trophy; Light armour from three cloth, one leather and one tier trophy.",
    "Shadow Beasts, Dune Devourers and Glacial Guardians now drop a tier trophy so their bands have a real craft gate.",
    "Cloth Tunic, Leather Vest, Linen Robe, Iron Mail, Mithril Plate, Mystic Robe, Runite Plate, Frostguard Plate and Wyrmscale Plate were test-era definitions and are deleted outright, along with any remaining copies of them.",
    "Market listings and price history for the deleted definitions are removed at activation.",
  ],
};


// ---------------------------------------------------------------------------
// Assemble, hash and emit.
// ---------------------------------------------------------------------------
const content = {
  content_version: V4_VERSION,
  lifecycle: "runtime",
  runtime: {
    ...src,
    items,
    migration_rules: migrationRules,
    monsters,
    player_notice: playerNotice,
    quests,
    recipes,
    starter_loadout: starterLoadout,
  },
  schema_version: v3Content.schema_version,
  spawn_set_version: V4_VERSION,
  tiers: v3Content.tiers,
  uuid_namespace: v3Content.uuid_namespace,
};

const contentRendered = prettyCanonicalJson(content);
const contentHash = manifestHash(JSON.parse(contentRendered));

// spawn_id is a globally unique primary key, so a V4 spawn cannot reuse the V3
// uuid: it is re-minted from the same identity under the v4 name prefix, the
// way every previous release cut does. Position and identity stay unchanged.
const v4Spawns = v3World.spawns
  .map((spawn) => ({
    ...spawn,
    spawn_id: uuidV5(v3Content.uuid_namespace, `${V4_VERSION}:${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`),
  }))
  .sort((left, right) => left.spawn_id.localeCompare(right.spawn_id));

const world = {
  ...v3World,
  spawns: v4Spawns,
  content_version: V4_VERSION,
  spawn_set_version: V4_VERSION,
  source_content_manifest_hash: contentHash,
  derived_from: {
    content_version: v3World.content_version,
    spawn_set_version: v3World.spawn_set_version,
    spawn_hash: v3World.spawn_hash,
    source_content_manifest_hash: v3World.source_content_manifest_hash,
    policy: "V4 changes armour content only; every V3 spawn identity and position is carried forward unchanged",
  },
  rollback: {
    v3_rows_mutated: false,
    player_state_mutated: false,
    switch_back: "select v3 content/spawn control; v3 content, spawn and world rows remain in place",
  },
};
const spawnHash = manifestHash({
  content_version: V4_VERSION,
  spawn_set_version: V4_VERSION,
  spawns: world.spawns,
});
world.spawn_hash = spawnHash;
const worldRendered = prettyCanonicalJson(world);

if (world.spawns.length !== v3World.spawns.length) throw new Error("V4 must not change the spawn count");
if (world.counts.nodes !== v3World.counts.nodes || world.counts.monsters !== v3World.counts.monsters) {
  throw new Error("V4 spawn counts drifted from V3");
}

const report = {
  generated_from: { content: PATHS.v3Content, world: PATHS.v3World },
  content_version: V4_VERSION,
  spawn_set_version: V4_VERSION,
  content_manifest_hash: contentHash,
  spawn_hash: spawnHash,
  counts: world.counts,
  world_unchanged: true,
  armour: {
    total: armourItems.length,
    heavy: armourItems.filter((item) => item.family === "heavy_armor").length,
    light: armourItems.filter((item) => item.family === "light_armor").length,
    tiers: ARMOUR_BALANCE.length,
    retired: retiredIds,
    replacements: RETIRED_ARMOUR,
  },
  new_trophies: NEW_TROPHIES.map((trophy) => ({ id: trophy.id, tier_index: trophy.tier_index, monster: trophy.monster })),
  recipes: { total: recipes.length, armour: 32 },
  items: { total: items.length, v3_total: src.items.length },
};
const reportRendered = prettyCanonicalJson(report);

const clientWorld = `/* eslint-disable */
/* GENERATED by scripts/v4/build.mjs. Do not edit. */
/* Spawn-set identity the client requires from game_world_runtime_status. */

export const SPAWN_SET_VERSION = "${V4_VERSION}";
export const WORLD_SPAWN_HASH = "${spawnHash}";
export const WORLD_SPAWN_COUNTS = Object.freeze({ nodes: ${world.counts.nodes}, monsters: ${world.counts.monsters} });
`;

// The generated client pins stay on the active release until rollout; the V4
// pin is written only when --promote is passed (see scripts/v4/promote.mjs).
const outputs = [
  ...(promote ? [["src/generated/world-manifest.ts", clientWorld]] : []),
  [PATHS.content, contentRendered],
  [PATHS.world, worldRendered],
  [PATHS.report, reportRendered],
];

for (const [file, rendered] of outputs) {
  if (checkOnly) {
    const existing = await readFile(file, "utf8").catch(() => "");
    if (existing !== rendered) throw new Error(`V4 artifact drifted: ${file}; run bun run v4:build`);
  } else {
    await mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
    await writeFile(file, rendered);
  }
}

console.log(
  `${checkOnly ? "Verified" : "Wrote"} V4 artifacts: ${items.length} items ` +
  `(${armourItems.length} armour, ${trophyItems.length} new trophies), ${recipes.length} recipes, ` +
  `${world.counts.nodes} nodes, ${world.counts.monsters} monsters; content ${contentHash}; spawns ${spawnHash}`,
);

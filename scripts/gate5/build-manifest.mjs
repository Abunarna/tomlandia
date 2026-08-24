import { readFile, writeFile } from "node:fs/promises";

import {
  manifestHash,
  prettyCanonicalJson,
  validateManifest,
} from "../content/model.mjs";
import { NEW_MONSTER_SPAWN_SPECS, NEW_NODE_SPAWN_SPECS } from "./spawn-spec.mjs";

const PATHS = Object.freeze({
  registry: "docs/overhaul/gate-0/id-registry.json",
  model: "docs/overhaul/gate-3/balance-model.proposed.json",
  approval: "docs/overhaul/gate-3/approval-record.json",
  live: "docs/overhaul/gate-5/live-v1-snapshot.json",
  spawns: "docs/overhaul/gate-5/live-v1-spawns.json",
  sprites: "content/v2/sprite-metadata.json",
  newSpawns: "content/v2/new-spawn-placements.json",
  manifest: "content/v2/manifest.authoring.json",
  summary: "docs/overhaul/gate-5/content-summary.json",
});

const PALETTES = [
  ["#9a5f3b", "#6f4932", "#d89a62"],
  ["#a66f3f", "#5f4632", "#d3a05d"],
  ["#5d6673", "#343943", "#9aa3ad"],
  ["#8795a8", "#4e5968", "#c8d4df"],
  ["#5781a8", "#263f5a", "#9fc8ec"],
  ["#d18a2d", "#734319", "#ffd074"],
  ["#9d343c", "#4c1d24", "#ef6970"],
  ["#5e3b76", "#241a31", "#a577c4"],
  ["#4f86ad", "#243e58", "#9bd4f1"],
  ["#90b8d0", "#3b5970", "#e2f5ff"],
  ["#69c8d9", "#286a7b", "#c9fbff"],
  ["#35518e", "#171f4b", "#81a6ff"],
  ["#3c245f", "#130f22", "#8f65c9"],
  ["#8d2534", "#2d0d13", "#df5260"],
  ["#b79b62", "#5c4c2d", "#e8d49b"],
  ["#e8d892", "#6f622e", "#fff3b0"],
];

const WEAPONS = [
  "copper_sword", "bronze_sword", "iron_sword", "steel_sword", "mithril_blade",
  "sunsteel_blade", "runite_greatsword", "shadow_blade", "frost_greatblade",
  "wyrmsteel_blade", "glacial_greatblade", "starsteel_blade", "voidsteel_greatblade",
  "wyrmforged_blade", "ancient_greatblade", "ascendant_blade",
];

const HEAVY_ARMOR = [
  "copper_heavy_armor", "bronze_heavy_armor", "iron_heavy_armor", "iron_mail",
  "mithril_heavy_armor", "mithril_plate", "runite_heavy_armor", "shadowsteel_heavy_armor",
  "runite_plate", "wyrmsteel_heavy_armor", "glacial_heavy_armor", "frostguard_plate",
  "wyrmscale_plate", "wyrmforged_heavy_armor", "ancient_heavy_armor", "ascendant_heavy_armor",
];

const LIGHT_ARMOR = [
  "cloth_tunic", "leather_vest", "linen_robe", "steel_light_armor", "mithril_light_armor",
  "sunsteel_light_armor", "runite_light_armor", "mystic_robe", "froststeel_light_armor",
  "wyrmsteel_light_armor", "glacial_light_armor", "starsteel_light_armor",
  "voidsteel_light_armor", "wyrmforged_light_armor", "ancient_light_armor",
  "ascendant_light_armor",
];

const FOODS = [
  "honey_bun", "berry_pie", "hearty_stew", "fishermans_stew", "golden_koi_feast",
  "sunspiced_eel", "runic_fish_stew", "shadow_stew", "frost_tonic", "wyrm_feast",
  "phoenix_fillet", "starsteel_feast", "void_feast", "wyrmforged_feast",
  "ancient_feast", "ascendant_feast",
];

const POTIONS = [
  "minor_venom_draught", "bronze_damage_potion", "goblins_fury_tonic",
  "steel_damage_potion", "serpents_bite_elixir", "sunsteel_damage_potion",
  "runite_damage_potion", "shadow_venom", "froststeel_damage_potion",
  "wyrmsteel_damage_potion", "frostfire_brew", "starsteel_damage_potion",
  "voidsteel_damage_potion", "wyrmforged_damage_potion", "ancient_damage_potion",
  "ascendant_damage_potion",
];

const BARS = [
  "copper_bar", "bronze_bar", "iron_bar", "steel_bar", "mithril_bar", "sunsteel_bar",
  "runite_bar", "shadowsteel_bar", "froststeel_bar", "wyrmsteel_bar", "glacial_bar",
  "starsteel_bar", "voidsteel_bar", "wyrmforged_bar", "ancient_bar", "ascendant_bar",
];

const EXISTING_ITEM_LEVELS = Object.freeze({
  copper_ore: 1, iron_ore: 15, sandstone: 40, mithril_ore: 40, cursed_shard: 70,
  runite_ore: 60, tungsten_ore: 110,
  oak_logs: 1, willow_logs: 15, maple_logs: 28, palm_logs: 40, cursed_bark: 70,
  frostpine_logs: 100,
  flax: 1, meadow_berries: 1, forest_herbs: 18, desert_bloom: 42, gloomcap: 68,
  frost_lichen: 98, feather: 1, goblin_charm: 1,
  raw_hide: 1, thick_hide: 7, scale_hide: 14, shadow_pelt: 23, frost_pelt: 55,
  ram_horn: 1, boar_tusk: 2, lynx_claw: 5, jackal_fang: 10,
  scorpion_stinger: 15, ghoul_essence: 23, reaper_bone: 36, frost_fang: 55,
  wraith_ice_core: 88, wyrm_scale: 146,
  copper_bar: 1, iron_bar: 20, mithril_bar: 40, runite_bar: 60, tungsten_bar: 100,
  light_leather: 1, thick_leather: 20, shadow_leather: 70,
  linen_cloth: 1, herb_weave: 20, mystic_cloth: 50,
  wooden_club: 1, bronze_dagger: 3, tungsten_maul: 105, sunspire_wand: 45,
  river_minnow: 1, silver_trout: 10, golden_koi: 20, deepwater_eel: 40,
  starlight_salmon: 70,
});

const MONSTER_LEVELS = Object.freeze({
  chicken: 1, disgruntled_ram: 1, goblin: 1, forest_boar: 2, wolf: 3,
  forest_lynx: 5, bear: 7, dust_jackal: 10, serpent: 14, scorpion_stalker: 15,
  bandit: 17, withered_ghoul: 23, wraith: 32, bone_reaper: 36, shadow_beast: 41,
  frost_wolf: 55, yeti: 73, ice_wraith: 88, frost_giant: 105,
  ancient_frost_wyrm: 146,
});

const NEW_ITEM_SPECS = Object.freeze({
  coal: ["Coal", 25, "resource", "ore"],
  sunstone: ["Sunstone", 45, "resource", "ore"],
  frost_crystal: ["Frost Crystal", 78, "resource", "ore"],
  glacial_ore: ["Glacial Ore", 100, "resource", "ore"],
  starsteel_ore: ["Starsteel Ore", 110, "resource", "ore"],
  voidsteel_ore: ["Voidsteel Ore", 120, "resource", "ore"],
  wyrmforged_ore: ["Wyrmforged Ore", 130, "resource", "ore"],
  ancient_ore: ["Ancient Ore", 140, "resource", "ore"],
  ascendant_ore: ["Ascendant Ore", 150, "resource", "ore"],
  wyrm_hide: ["Wyrm Hide", 120, "resource", "hide"],
  shadowweave: ["Shadowweave", 70, "material", "cloth"],
  frostweave: ["Frostweave", 100, "material", "cloth"],
  ascendant_weave: ["Ascendant Weave", 130, "material", "cloth"],
  scaled_leather: ["Scaled Leather", 40, "material", "leather"],
  frost_leather: ["Frost Leather", 100, "material", "leather"],
  wyrm_leather: ["Wyrm Leather", 130, "material", "leather"],
  brute_fang: ["Brute Fang", 10, "trophy", "trophy"],
  ironback_tusk: ["Ironback Tusk", 20, "trophy", "trophy"],
  raider_fang: ["Raider Fang", 50, "trophy", "trophy"],
  cursed_rune: ["Cursed Rune", 70, "trophy", "trophy"],
  troll_fang: ["Troll Fang", 80, "trophy", "trophy"],
  revenant_essence: ["Revenant Essence", 90, "trophy", "trophy"],
  frost_giant_heart: ["Frost Giant's Heart", 105, "trophy", "trophy"],
  wyrm_knight_fang: ["Wyrm Knight Fang", 120, "trophy", "trophy"],
  void_essence: ["Void Essence", 130, "trophy", "trophy"],
  ascendant_core: ["Ascendant Core", 150, "trophy", "trophy"],
});

const BAR_RAW_IDS = Object.freeze({
  bronze_bar: 10, steel_bar: 30, sunsteel_bar: 50, shadowsteel_bar: 70,
  froststeel_bar: 80, wyrmsteel_bar: 90, glacial_bar: 100, starsteel_bar: 110,
  voidsteel_bar: 120, wyrmforged_bar: 130, ancient_bar: 140, ascendant_bar: 150,
});

const DISPLAY_NAMES = Object.freeze({
  fishermans_stew: "Fisherman's Stew",
  goblins_fury_tonic: "Goblin's Fury Tonic",
  serpents_bite_elixir: "Serpent's Bite Elixir",
  copper_heavy_armor: "Copper Heavy Armour",
  bronze_heavy_armor: "Bronze Heavy Armour",
  iron_heavy_armor: "Iron Heavy Armour",
});

function titleCase(id) {
  return DISPLAY_NAMES[id] ?? id.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ")
    .replace(" Armor", " Armour");
}

function zeroStats() {
  return { attack: 0, defense: 0, heal: 0, speed: 0, dmg_boost: 0, boost_hits: 0 };
}

function rarity(tierIndex) {
  if (tierIndex <= 3) return "common";
  if (tierIndex <= 6) return "uncommon";
  if (tierIndex <= 9) return "rare";
  if (tierIndex <= 13) return "epic";
  return "legendary";
}

const json = async (path) => JSON.parse(await readFile(path, "utf8"));

const [registry, model, approval, liveSnapshot, spawnSnapshot, spriteMetadata, newSpawnPlacements] = await Promise.all([
  json(PATHS.registry), json(PATHS.model), json(PATHS.approval), json(PATHS.live), json(PATHS.spawns),
  json(PATHS.sprites), json(PATHS.newSpawns),
]);

if (approval.status !== "owner_approved" || approval.approvedModelHash !== model.modelHash) {
  throw new Error("Gate 5 requires the exact owner-approved Gate 3 model hash");
}

const tierByIndex = new Map(model.tiers.map((tier) => [tier.tierIndex, tier]));
const tierForLevel = (level) => [...model.tiers].reverse().find((tier) => tier.levelRequirement <= level);
const itemTierOverrides = new Map();
for (const [index, id] of WEAPONS.entries()) itemTierOverrides.set(id, index + 1);
for (const [index, id] of HEAVY_ARMOR.entries()) itemTierOverrides.set(id, index + 1);
for (const [index, id] of LIGHT_ARMOR.entries()) itemTierOverrides.set(id, index + 1);
for (const [index, id] of FOODS.entries()) itemTierOverrides.set(id, index + 1);
for (const [index, id] of POTIONS.entries()) itemTierOverrides.set(id, index + 1);
for (const [index, id] of BARS.entries()) itemTierOverrides.set(id, index + 1);

const retired = new Set(registry.retired_ids);
const liveItemById = new Map(liveSnapshot.captured_fields.items.map((item) => [item.id, item]));

function baseItem({ id, name, level, kind, family, colour, value, active = true, stackable = true, stats = zeroStats() }) {
  const tier = tierForLevel(level);
  return {
    id,
    name,
    active,
    tier_index: tier.tierIndex,
    level_requirement: level,
    kind,
    family,
    icon_key: id,
    colour,
    rarity: rarity(tier.tierIndex),
    tradable: active,
    stackable,
    value,
    ...(kind === "weapon" || kind === "armor" ? { equip_skill: "combat" } : {}),
    stats,
  };
}

function tierItem(id, tierIndex, kind) {
  const tier = tierByIndex.get(tierIndex);
  const isHeavy = HEAVY_ARMOR[tierIndex - 1] === id;
  const stats = kind === "weapon"
    ? { ...zeroStats(), attack: tier.weaponAttack }
    : kind === "armor"
      ? {
          ...zeroStats(),
          attack: isHeavy ? 0 : tier.lightAttack,
          defense: isHeavy ? tier.heavyDefense : tier.lightDefense,
          speed: isHeavy ? 0 : tier.lightSpeed,
        }
      : kind === "food"
        ? { ...zeroStats(), heal: tier.food.heal }
        : kind === "potion"
          ? { ...zeroStats(), dmg_boost: tier.potion.damageBoost, boost_hits: tier.potion.boostHits }
          : zeroStats();
  const value = kind === "weapon" ? tier.economy.weaponNpcValue
    : kind === "armor" ? tier.economy.armorNpcValue
      : kind === "food" ? tier.food.npcValue
        : kind === "potion" ? tier.potion.npcValue : tier.economy.barNpcFloor;
  return baseItem({
    id,
    name: liveItemById.get(id)?.name ?? titleCase(id),
    level: tier.levelRequirement,
    kind,
    family: kind === "material" ? "bar" : kind,
    colour: PALETTES[tierIndex - 1][1],
    value,
    stackable: kind !== "weapon" && kind !== "armor",
    stats,
  });
}

const items = liveSnapshot.captured_fields.items.map((liveItem) => {
  const tierIndex = itemTierOverrides.get(liveItem.id);
  if (tierIndex && !retired.has(liveItem.id)) {
    return tierItem(liveItem.id, tierIndex, liveItem.kind);
  }
  const level = EXISTING_ITEM_LEVELS[liveItem.id];
  if (level === undefined) throw new Error(`No audited level mapping for live item ${liveItem.id}`);
  const stats = {
    ...zeroStats(),
    attack: liveItem.attack ?? 0,
    defense: liveItem.defense ?? 0,
    heal: liveItem.heal ?? 0,
    speed: liveItem.speed ?? 0,
    dmg_boost: liveItem.dmgBoost ?? 0,
    boost_hits: liveItem.boostHits ?? 0,
  };
  return baseItem({
    id: liveItem.id,
    name: liveItem.name,
    level,
    kind: liveItem.kind,
    family: liveItem.family,
    colour: liveItem.color,
    value: liveItem.value,
    active: !retired.has(liveItem.id),
    stackable: liveItem.stackable,
    stats,
  });
});

for (const [id, tierIndex] of itemTierOverrides) {
  if (liveItemById.has(id)) continue;
  const kind = WEAPONS.includes(id) ? "weapon" : HEAVY_ARMOR.includes(id) || LIGHT_ARMOR.includes(id)
    ? "armor" : FOODS.includes(id) ? "food" : POTIONS.includes(id) ? "potion" : null;
  if (kind) items.push(tierItem(id, tierIndex, kind));
}

for (const [id, level] of Object.entries(BAR_RAW_IDS)) {
  const tier = tierForLevel(level);
  items.push(baseItem({
    id, name: titleCase(id), level, kind: "material", family: "bar",
    colour: PALETTES[tier.tierIndex - 1][1], value: tier.economy.barNpcFloor,
  }));
}

for (const [id, [name, level, kind, family]] of Object.entries(NEW_ITEM_SPECS)) {
  const tier = tierForLevel(level);
  const material = kind === "material";
  const value = material ? tier.economy.barNpcFloor : tier.economy.rawNpcFloor;
  items.push(baseItem({
    id, name, level, kind, family, colour: PALETTES[tier.tierIndex - 1][0], value,
  }));
}

items.sort((a, b) => a.tier_index - b.tier_index || a.id.localeCompare(b.id));

function makeRecipe(output, station, skill, level, inputs) {
  const tier = tierForLevel(level);
  return {
    id: `${station}_${output}`,
    active: true,
    tier_index: tier.tierIndex,
    level_requirement: level,
    station,
    skill,
    output_item_id: output,
    output_qty: 1,
    xp: tier.skillRewards[skill].xpPerAction,
    time_s: tier.activityCadence[skill].actionSeconds,
    inputs: inputs.map(([item_id, qty]) => ({ item_id, qty })),
  };
}

const recipes = [];
const addRecipe = (...args) => recipes.push(makeRecipe(...args));

const BAR_RECIPES = [
  ["copper_bar", 1, [["copper_ore", 2]]],
  ["bronze_bar", 10, [["copper_ore", 4]]],
  ["iron_bar", 20, [["iron_ore", 2]]],
  ["steel_bar", 30, [["iron_bar", 1], ["coal", 2]]],
  ["mithril_bar", 40, [["mithril_ore", 2], ["sandstone", 1]]],
  ["sunsteel_bar", 50, [["mithril_bar", 1], ["sunstone", 2]]],
  ["runite_bar", 60, [["runite_ore", 2]]],
  ["shadowsteel_bar", 70, [["runite_bar", 1], ["cursed_shard", 2]]],
  ["froststeel_bar", 80, [["shadowsteel_bar", 1], ["frost_crystal", 2]]],
  ["wyrmsteel_bar", 90, [["froststeel_bar", 1], ["wraith_ice_core", 1]]],
  ["glacial_bar", 100, [["glacial_ore", 3]]],
  ["starsteel_bar", 110, [["starsteel_ore", 3]]],
  ["voidsteel_bar", 120, [["voidsteel_ore", 3]]],
  ["wyrmforged_bar", 130, [["wyrmforged_ore", 3]]],
  ["ancient_bar", 140, [["ancient_ore", 3]]],
  ["ascendant_bar", 150, [["ascendant_ore", 3]]],
];
for (const [output, level, inputs] of BAR_RECIPES) addRecipe(output, "smelt", "smithing", level, inputs);

const WEAPON_INPUTS = [
  [["copper_bar", 3]],
  [["bronze_bar", 3], ["oak_logs", 1], ["brute_fang", 1]],
  [["iron_bar", 3], ["willow_logs", 1], ["ironback_tusk", 1]],
  [["steel_bar", 3], ["maple_logs", 1], ["boar_tusk", 1]],
  [["mithril_bar", 3], ["palm_logs", 1], ["jackal_fang", 1]],
  [["sunsteel_bar", 3], ["palm_logs", 1], ["raider_fang", 1]],
  [["runite_bar", 3], ["palm_logs", 1], ["ghoul_essence", 1]],
  [["shadowsteel_bar", 3], ["cursed_bark", 1], ["cursed_rune", 1]],
  [["froststeel_bar", 3], ["cursed_bark", 1], ["troll_fang", 1]],
  [["wyrmsteel_bar", 3], ["cursed_bark", 1], ["wraith_ice_core", 1]],
  [["glacial_bar", 3], ["frostpine_logs", 1], ["revenant_essence", 1]],
  [["starsteel_bar", 3], ["frostpine_logs", 1], ["frost_giant_heart", 1]],
  [["voidsteel_bar", 3], ["frostpine_logs", 1], ["wyrm_knight_fang", 1]],
  [["wyrmforged_bar", 3], ["frostpine_logs", 1], ["void_essence", 1]],
  [["ancient_bar", 3], ["frostpine_logs", 1], ["void_essence", 2]],
  [["ascendant_bar", 3], ["frostpine_logs", 1], ["ascendant_core", 1], ["wyrm_scale", 1]],
];
for (const [index, output] of WEAPONS.entries()) {
  addRecipe(output, "forge", "smithing", model.tiers[index].levelRequirement, WEAPON_INPUTS[index]);
}

const REFINEMENT_RECIPES = [
  ["light_leather", "skin", "skinning", 1, [["raw_hide", 3]]],
  ["thick_leather", "skin", "skinning", 20, [["thick_hide", 3]]],
  ["scaled_leather", "skin", "skinning", 40, [["scale_hide", 3]]],
  ["shadow_leather", "skin", "skinning", 70, [["shadow_pelt", 3], ["scale_hide", 1]]],
  ["frost_leather", "skin", "skinning", 100, [["frost_pelt", 3]]],
  ["wyrm_leather", "skin", "skinning", 130, [["wyrm_hide", 3]]],
  ["linen_cloth", "weave", "tailoring", 1, [["flax", 3], ["meadow_berries", 1]]],
  ["herb_weave", "weave", "tailoring", 20, [["forest_herbs", 3], ["linen_cloth", 1]]],
  ["mystic_cloth", "weave", "tailoring", 50, [["desert_bloom", 1], ["herb_weave", 2]]],
  ["shadowweave", "weave", "tailoring", 70, [["gloomcap", 2], ["mystic_cloth", 2]]],
  ["frostweave", "weave", "tailoring", 100, [["frost_lichen", 2], ["shadowweave", 2]]],
  ["ascendant_weave", "weave", "tailoring", 130, [["frost_lichen", 3], ["frostweave", 2]]],
];
for (const args of REFINEMENT_RECIPES) addRecipe(...args);

const HEAVY_INPUTS = [
  [["copper_bar", 4], ["ram_horn", 1]],
  [["bronze_bar", 4], ["goblin_charm", 1]],
  [["iron_bar", 4], ["ironback_tusk", 1]],
  [["steel_bar", 4], ["boar_tusk", 1]],
  [["mithril_bar", 4], ["jackal_fang", 1]],
  [["sunsteel_bar", 4], ["raider_fang", 1]],
  [["runite_bar", 5], ["ghoul_essence", 1]],
  [["shadowsteel_bar", 5], ["cursed_rune", 1]],
  [["froststeel_bar", 5], ["troll_fang", 1]],
  [["wyrmsteel_bar", 5], ["wraith_ice_core", 1]],
  [["glacial_bar", 5], ["revenant_essence", 1]],
  [["starsteel_bar", 5], ["frost_giant_heart", 1]],
  [["voidsteel_bar", 6], ["wyrm_knight_fang", 1]],
  [["wyrmforged_bar", 6], ["void_essence", 1]],
  [["ancient_bar", 6], ["void_essence", 2]],
  [["ascendant_bar", 6], ["ascendant_core", 1], ["wyrm_scale", 1]],
];

const LIGHT_INPUTS = [
  [["linen_cloth", 3]],
  [["light_leather", 3]],
  [["thick_leather", 3]],
  [["thick_leather", 3], ["steel_bar", 1]],
  [["scaled_leather", 3]],
  [["scaled_leather", 3], ["sunstone", 1]],
  [["scaled_leather", 4], ["runite_bar", 1]],
  [["shadowweave", 3], ["shadow_leather", 1]],
  [["shadow_leather", 3], ["froststeel_bar", 1]],
  [["shadow_leather", 3], ["wyrmsteel_bar", 1]],
  [["frostweave", 3]],
  [["frost_leather", 3], ["starsteel_bar", 1]],
  [["frost_leather", 4], ["voidsteel_bar", 1]],
  [["wyrm_leather", 3]],
  [["wyrm_leather", 3], ["ancient_bar", 1]],
  [["ascendant_weave", 3], ["ascendant_bar", 1]],
];

for (const [index, output] of HEAVY_ARMOR.entries()) {
  addRecipe(output, "armor", "smithing", model.tiers[index].levelRequirement, HEAVY_INPUTS[index]);
}
for (const [index, output] of LIGHT_ARMOR.entries()) {
  addRecipe(output, "armor", "tailoring", model.tiers[index].levelRequirement, LIGHT_INPUTS[index]);
}

const FOOD_INPUTS = [
  [["river_minnow", 2]],
  [["silver_trout", 2], ["feather", 1]],
  [["golden_koi", 2], ["goblin_charm", 1]],
  [["silver_trout", 2], ["forest_herbs", 1]],
  [["golden_koi", 2], ["forest_herbs", 1]],
  [["deepwater_eel", 2], ["desert_bloom", 1]],
  [["golden_koi", 2], ["forest_herbs", 2]],
  [["deepwater_eel", 2], ["gloomcap", 1]],
  [["deepwater_eel", 2], ["thick_leather", 1]],
  [["starlight_salmon", 2], ["gloomcap", 1]],
  [["starlight_salmon", 3], ["frost_pelt", 1]],
  [["starlight_salmon", 2], ["frost_lichen", 1]],
  [["starlight_salmon", 2], ["frost_lichen", 2]],
  [["starlight_salmon", 3], ["frost_lichen", 2]],
  [["starlight_salmon", 3], ["frost_lichen", 3]],
  [["starlight_salmon", 4], ["frost_lichen", 3]],
];
for (const [index, output] of FOODS.entries()) {
  addRecipe(output, "cook", "cooking", model.tiers[index].levelRequirement, FOOD_INPUTS[index]);
}

const POTION_INPUTS = [
  [["raw_hide", 2]],
  [["brute_fang", 1], ["meadow_berries", 2]],
  [["goblin_charm", 2], ["thick_hide", 1]],
  [["ironback_tusk", 1], ["forest_herbs", 2]],
  [["scale_hide", 2]],
  [["raider_fang", 1], ["desert_bloom", 1]],
  [["ghoul_essence", 2], ["desert_bloom", 1]],
  [["shadow_pelt", 2], ["feather", 1]],
  [["troll_fang", 1], ["frost_crystal", 1]],
  [["wraith_ice_core", 1], ["gloomcap", 2]],
  [["frost_pelt", 2], ["goblin_charm", 1]],
  [["frost_giant_heart", 1], ["frost_lichen", 2]],
  [["wyrm_knight_fang", 1], ["frost_lichen", 2]],
  [["void_essence", 1], ["frost_lichen", 2]],
  [["void_essence", 2], ["frost_lichen", 3]],
  [["ascendant_core", 1], ["frost_lichen", 3]],
];
for (const [index, output] of POTIONS.entries()) {
  addRecipe(output, "alchemy", "alchemy", model.tiers[index].levelRequirement, POTION_INPUTS[index]);
}
recipes.sort((a, b) => a.tier_index - b.tier_index || a.id.localeCompare(b.id));

const NODE_LEVEL_CORRECTIONS = Object.freeze({
  berries: 1,
  mithril: 40,
  runite: 60,
  palm: 40,
});
const nodes = Object.entries(liveSnapshot.captured_fields.nodes)
  .filter(([kind]) => kind !== "tungsten")
  .map(([kind, node]) => {
    const level = NODE_LEVEL_CORRECTIONS[kind] ?? node.req;
    const tier = tierForLevel(level);
    return {
      kind,
      name: node.name,
      active: true,
      tier_index: tier.tierIndex,
      level_requirement: level,
      skill: node.skill,
      item_id: node.item,
      xp: node.xp,
      gather_s: node.time,
      respawn_s: node.respawn,
      max_charges: 4,
      cluster_min: tier.activityCadence[node.skill].minimumClusterNodesPerActivePlayer,
      shape: node.shape,
      family: node.shape,
      colour: node.color,
      visual_key: kind,
    };
  });

const NEW_NODE_SPECS = [
  ["coal_seam", "Coal Seam", 25, "coal"],
  ["sunstone_vein", "Sunstone Vein", 45, "sunstone"],
  ["frost_crystal_vein", "Frost Crystal Vein", 78, "frost_crystal"],
  ["glacial_vein", "Glacial Vein", 100, "glacial_ore"],
  ["starsteel_vein", "Starsteel Vein", 110, "starsteel_ore"],
  ["voidsteel_vein", "Voidsteel Vein", 120, "voidsteel_ore"],
  ["wyrmforged_vein", "Wyrmforged Vein", 130, "wyrmforged_ore"],
  ["ancient_vein", "Ancient Vein", 140, "ancient_ore"],
  ["ascendant_vein", "Ascendant Vein", 150, "ascendant_ore"],
];
for (const [kind, name, level, itemId] of NEW_NODE_SPECS) {
  const tier = tierForLevel(level);
  nodes.push({
    kind, name, active: true, tier_index: tier.tierIndex, level_requirement: level,
    skill: "mining", item_id: itemId, xp: tier.skillRewards.mining.xpPerAction,
    gather_s: tier.activityCadence.mining.actionSeconds,
    respawn_s: tier.activityCadence.mining.proposedRespawnSeconds,
    max_charges: 4,
    cluster_min: tier.activityCadence.mining.minimumClusterNodesPerActivePlayer,
    shape: "rock", family: "rock", colour: PALETTES[tier.tierIndex - 1][0], visual_key: kind,
  });
}
nodes.sort((a, b) => a.level_requirement - b.level_requirement || a.kind.localeCompare(b.kind));

const spriteByKind = new Map(spriteMetadata.sprites.map((sprite) => [sprite.kind, sprite]));

function visualFor(kind, fallback) {
  const sprite = spriteByKind.get(kind);
  if (!sprite) throw new Error(`No prepared sprite metadata for ${kind}`);
  const { kind: ignoredKind, name: ignoredName, ...visual } = sprite;
  void ignoredKind;
  void ignoredName;
  return { ...visual, fallback };
}

function loot(item_id, chance, channel = "drop", xp = 0) {
  return { item_id, chance, qty_min: 1, qty_max: 1, channel, xp };
}

const monsters = Object.entries(liveSnapshot.captured_fields.monsters).map(([kind, monster]) => {
  const level = MONSTER_LEVELS[kind];
  const drops = [];
  if (monster.drop) drops.push(loot(kind === "frost_giant" ? "frost_giant_heart" : monster.drop, monster.dropChance));
  if (monster.hide) drops.push(loot(monster.hide, 1, "hide", monster.hideXp));
  const tier = tierForLevel(level);
  return {
    kind,
    name: monster.name,
    active: true,
    tier_index: tier.tierIndex,
    level_requirement: level,
    hp: monster.hp,
    attack: monster.attack,
    defense: monster.defense,
    xp: monster.xp,
    gold_min: monster.gold[0],
    gold_max: monster.gold[1],
    respawn_s: 12,
    visual_key: `${kind}_sprite`,
    visual: visualFor(kind, {
      body: monster.body, accent: monster.accent, size: monster.size, ears: monster.ears,
    }),
    loot: drops,
  };
});

const NEW_MONSTER_NAMES = Object.freeze({
  goblin_brute: "Goblin Brute", ironback_boar: "Ironback Boar",
  mithril_stalker: "Mithril Stalker", desert_raider: "Desert Raider",
  dune_devourer: "Dune Devourer", cursed_knight: "Cursed Knight",
  frost_troll: "Frost Troll", frost_revenant: "Frost Revenant",
  glacial_guardian: "Glacial Guardian", wyrm_knight: "Wyrm Knight",
  void_wraith: "Void Wraith", ascendant_wyrm: "Ascendant Wyrm",
});

const NEW_MONSTER_LOOT = Object.freeze({
  goblin_brute: [["brute_fang", 0.45, "drop"], ["raw_hide", 1, "hide"]],
  ironback_boar: [["ironback_tusk", 0.45, "drop"], ["thick_hide", 1, "hide"]],
  mithril_stalker: [["scale_hide", 0.5, "drop"], ["scale_hide", 1, "hide"]],
  desert_raider: [["raider_fang", 0.45, "drop"], ["scale_hide", 1, "hide"]],
  dune_devourer: [["scale_hide", 0.55, "drop"], ["scale_hide", 1, "hide"]],
  cursed_knight: [["cursed_rune", 0.45, "drop"], ["shadow_pelt", 1, "hide"]],
  frost_troll: [["troll_fang", 0.45, "drop"], ["frost_pelt", 1, "hide"]],
  frost_revenant: [["revenant_essence", 0.45, "drop"], ["frost_pelt", 1, "hide"]],
  glacial_guardian: [["frost_crystal", 0.5, "drop"], ["frost_pelt", 1, "hide"]],
  wyrm_knight: [["wyrm_knight_fang", 0.45, "drop"], ["wyrm_hide", 1, "hide"]],
  void_wraith: [["void_essence", 0.45, "drop"], ["frost_pelt", 1, "hide"]],
  ascendant_wyrm: [["ascendant_core", 0.45, "drop"]],
});

for (const proposal of model.proposedNewMonsters) {
  const tier = tierForLevel(proposal.level);
  const fallback = {
    body: PALETTES[tier.tierIndex - 1][0],
    accent: PALETTES[tier.tierIndex - 1][2],
    size: [1.2, 1.3, 1.25, 1.15, 1.4, 1.35, 1.55, 1.35, 1.6, 1.5, 1.4, 2][model.proposedNewMonsters.indexOf(proposal)],
    ears: ["horns", "spikes", "horns", "none", "spikes", "spikes", "horns", "spikes", "spikes", "spikes", "spikes", "spikes"][model.proposedNewMonsters.indexOf(proposal)],
  };
  monsters.push({
    kind: proposal.id,
    name: NEW_MONSTER_NAMES[proposal.id],
    active: true,
    tier_index: tier.tierIndex,
    level_requirement: proposal.level,
    hp: proposal.hp,
    attack: proposal.attack,
    defense: proposal.defense,
    xp: proposal.xp,
    gold_min: proposal.goldMin,
    gold_max: proposal.goldMax,
    respawn_s: 12,
    visual_key: `${proposal.id}_sprite`,
    visual: visualFor(proposal.id, fallback),
    loot: NEW_MONSTER_LOOT[proposal.id].map(([itemId, chance, channel]) => loot(
      itemId,
      chance,
      channel,
      channel === "hide" ? tier.skillRewards.skinning.xpPerAction : 0,
    )),
  });
}
monsters.sort((a, b) => a.level_requirement - b.level_requirement || a.kind.localeCompare(b.kind));

const FISH_LEVELS = [1, 10, 20, 40, 70];
const FISH_START = [0.9, 0.04, 0.03, 0.02, 0.01];
const fish = liveSnapshot.captured_fields.fish.map((entry, index) => {
  const level = FISH_LEVELS[index];
  const tier = tierForLevel(level);
  return {
    item_id: entry.id,
    active: true,
    tier_index: tier.tierIndex,
    level_requirement: level,
    xp: entry.xp,
    weights: [
      { level: 1, weight: FISH_START[index] },
      { level: 100, weight: 0.2 },
      { level: 150, weight: 0.2 },
    ],
  };
});

const SPOT_ZONE = Object.freeze({
  fields: ["fields", "grand_haven_outskirts"],
  forest: ["forest", "willowbrook_lakes"],
  winter: ["winter", "lower_slopes"],
  evil: ["evil", "duskmere_waters"],
});
const fishingSpots = liveSnapshot.captured_fields.fishing_spots.map((spot) => {
  const [biome, subzone] = SPOT_ZONE[spot.lake];
  return {
    id: `${spot.lake}_${spot.id}`,
    active: true,
    biome,
    subzone,
    x: spot.x,
    y: spot.y,
    fish_item_ids: liveSnapshot.captured_fields.fish.map((entry) => entry.id),
  };
});

const QUEST_REWARDS = Object.freeze({
  goblin_trouble: [{ item_id: "copper_bar", qty: 1 }],
  wolf_watch: [{ item_id: "bronze_sword", qty: 1 }],
});
const targetLevel = (quest) => quest.kind === "kill"
  ? MONSTER_LEVELS[quest.key]
  : items.find((item) => item.id === quest.key)?.level_requirement;
const quests = liveSnapshot.captured_fields.quests.map((quest) => {
  const level = targetLevel(quest);
  const tier = tierForLevel(level);
  return {
    id: quest.id,
    name: quest.name,
    description: quest.desc,
    active: true,
    tier_index: tier.tierIndex,
    level_requirement: level,
    kind: quest.kind,
    target_id: quest.key,
    count: quest.count,
    gold: quest.gold,
    xp_skill: quest.xpSkill,
    xp: quest.xp,
    reward_items: QUEST_REWARDS[quest.id] ?? [],
  };
});

const bossModel = model.boss;
const bossBudget = bossModel.rewardBudget;
const bosses = [{
  id: "desolatus",
  name: bossModel.name,
  active: true,
  level_requirement: 150,
  hp: bossModel.hp,
  attack: bossModel.attack,
  defense: bossModel.defense,
  respawn_s: bossModel.respawnMinutes * 60,
  visual_key: "desolatus_procedural",
  reward_mode: bossModel.rewardMode,
  target_contributors: bossBudget.targetContributors,
  minimum_damage: bossBudget.minimumDamage,
  xp_pool: bossBudget.xpPool,
  xp_per_player_cap: bossBudget.xpPerPlayerCap,
  gold_pool_min: bossBudget.goldPool[0],
  gold_pool_max: bossBudget.goldPool[1],
  gold_per_player_cap_min: bossBudget.goldPerPlayerCap[0],
  gold_per_player_cap_max: bossBudget.goldPerPlayerCap[1],
  rewards: [],
}];

function addOrdinals(rows) {
  const next = new Map();
  return rows.map((row) => {
    const ordinal = next.get(row.kind) ?? 0;
    next.set(row.kind, ordinal + 1);
    return { ...row, ordinal };
  });
}

const nodeSpawns = addOrdinals(
  spawnSnapshot.node_spawns
    .filter((spawn) => spawn.kind !== "tungsten")
    .map((spawn) => ({
      kind: spawn.kind,
      active: true,
      biome: spawn.biome,
      subzone: "legacy_v1_position",
      x: spawn.x,
      y: spawn.y,
    })),
);

for (const [kind] of NEW_NODE_SPAWN_SPECS) {
  const definition = nodes.find((node) => node.kind === kind);
  const candidates = newSpawnPlacements.node_spawns.filter((spawn) => spawn.kind === kind);
  for (const [ordinal, spawn] of candidates.slice(0, definition.cluster_min).entries()) {
    nodeSpawns.push({ ...spawn, ordinal, active: true });
  }
}

const monsterSpawns = addOrdinals(spawnSnapshot.monster_spawns.map((spawn) => ({
  kind: spawn.kind,
  active: true,
  biome: spawn.biome,
  subzone: "legacy_v1_position",
  x: spawn.x,
  y: spawn.y,
})));

for (const [kind] of NEW_MONSTER_SPAWN_SPECS) {
  const candidates = newSpawnPlacements.monster_spawns.filter((spawn) => spawn.kind === kind);
  for (const [ordinal, spawn] of candidates.entries()) {
    monsterSpawns.push({ ...spawn, ordinal, active: true });
  }
}

const migrationRules = [
  {
    from_id: "wooden_club",
    action: "replace_or_compensate",
    to_id: "copper_sword",
    captured_value_required: true,
    equipped_action: "replace_preserve_plus",
    unequipped_action: "compensate_captured_value",
    notice_key: "wooden_club_equipped_replace_unequipped_compensate",
  },
  ...["bronze_dagger", "sunspire_wand", "tungsten_maul", "tungsten_ore", "tungsten_bar"].map((from_id) => ({
    from_id,
    action: "compensate",
    captured_value_required: true,
    notice_key: `${from_id}_captured_value_compensation`,
  })),
];

const mechanics = {
  approved_balance_model_hash: model.modelHash,
  max_level: 150,
  max_plus: 100,
  market_fee_pct: 5,
  weapon_multiplier_rule: "1 + 2% * min(plus, 50) + 0.5% * max(plus - 50, 0)",
  light_attack_multiplier_rule: "1 + 5% * min(plus, 20) + 1% * max(plus - 20, 0)",
  defense_multiplier_rule: "1 + 0.1% * plus",
  upgrade_cost_rule: "round_to_5(max(25, item_value * (0.08 + 3.4 * sqrt(next_plus))))",
  gear_resale_rule: "floor(item_value * 0.40 + cumulative_upgrade_spend * 0.15)",
  fishing_xp_curve: model.tiers.map((tier) => ({
    tier_index: tier.tierIndex,
    level_requirement: tier.levelRequirement,
    xp_per_action: tier.skillRewards.fishing.xpPerAction,
  })),
};

const tiers = registry.tiers.map((tier, index) => ({
  ...tier,
  palette: {
    primary: PALETTES[index][0],
    secondary: PALETTES[index][1],
    accent: PALETTES[index][2],
  },
}));

const manifest = {
  schema_version: "tomlandia-content-manifest/v1",
  content_version: "v2",
  lifecycle: "runtime",
  spawn_set_version: "v2",
  uuid_namespace: "bf50882c-ad8a-57ab-bb73-3ea3dd8fcb5c",
  tiers,
  runtime: {
    items,
    recipes,
    nodes,
    monsters,
    fish,
    fishing_spots: fishingSpots,
    quests,
    bosses,
    node_spawns: nodeSpawns,
    monster_spawns: monsterSpawns,
    migration_rules: migrationRules,
    starter_loadout: { weapon_item_id: "copper_sword", armor_item_id: "cloth_tunic", plus: 0 },
    mechanics,
    player_notice: {
      title: "Tomlandia level 1–150 progression overhaul",
      summary: "Your compatible gear and supplies keep their identity; six retired IDs follow the published one-time compensation ledger.",
      details: [
        "Existing compatible items keep their quantity, upgrade level and inventory, bank or equipped location.",
        "An equipped Wooden Club becomes a Copper Sword with the same plus level; an unequipped club receives captured-value compensation instead.",
        "Frostguard Plate is reassigned to Starsteel at level 110 and Wyrmscale Plate to Voidsteel at level 120 because the progression ceiling now extends to level 150.",
        "Bronze Dagger, Sunspire Wand, Tungsten Maul, Tungsten Ore and Tungsten Bar receive captured cutover unit value multiplied by owned quantity exactly once.",
        "Market listings for retired or materially changed definitions are cancelled and returned before activation.",
      ],
    },
  },
};

validateManifest(manifest, registry);

const summary = {
  schema_version: "tomlandia-gate5-content-summary/v1",
  manifest_hash: manifestHash(manifest),
  approved_balance_model_hash: model.modelHash,
  live_definition_source_sha256: liveSnapshot.source_sha256,
  live_spawn_source_sha256: spawnSnapshot.source_sha256,
  counts: {
    tiers: tiers.length,
    items: items.length,
    active_items: items.filter((item) => item.active).length,
    inactive_items: items.filter((item) => !item.active).length,
    recipes: recipes.length,
    nodes: nodes.length,
    monsters: monsters.length,
    fish: fish.length,
    fishing_spots: fishingSpots.length,
    quests: quests.length,
    bosses: bosses.length,
    node_spawns: nodeSpawns.length,
    monster_spawns: monsterSpawns.length,
    migration_rules: migrationRules.length,
    sprites: spriteMetadata.sprites.length,
  },
  safety: {
    lifecycle: manifest.lifecycle,
    activation_performed: false,
    production_database_writes: false,
    existing_node_positions_preserved: spawnSnapshot.node_spawns.filter((spawn) => spawn.kind !== "tungsten").length,
    existing_monster_positions_preserved: spawnSnapshot.monster_spawns.length,
  },
  audited_resolutions: {
    in_place_item_count: 23,
    explanation: "The locked Gate 0 inventory contains 4 weapons, 9 armour pieces, 5 foods and 5 potions. The master document's repeated total of 18 omitted the five in-place potions even though Phase 8 requires them to retain IDs.",
    meadow_berries_level_requirement: 1,
    meadow_berries_explanation: "The live Berry Bush requirement of 3 conflicted with the locked level-1 Linen Cloth recipe. Gate 5 applies a lower-only requirement correction to 1 so the tier-1 dependency graph is reachable without weakening or replacing the unchanged recipe.",
    light_armor_skill: "tailoring",
    light_armor_skill_explanation: "Live Armourer recipes use Smithing for Heavy armour and Tailoring for Light armour. Gate 5 corrects the Gate 4 one-skill station map and preserves that established split.",
  },
};

const outputs = new Map([
  [PATHS.manifest, prettyCanonicalJson(manifest)],
  [PATHS.summary, prettyCanonicalJson(summary)],
]);

if (process.argv.includes("--check")) {
  let failed = false;
  for (const [path, expected] of outputs) {
    const current = await readFile(path, "utf8").catch(() => "");
    if (current !== expected) {
      console.error(`Gate 5 generated artifact drift: ${path}`);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
  else console.log(`Gate 5 manifest verified (${summary.manifest_hash})`);
} else {
  for (const [path, output] of outputs) await writeFile(path, output, "utf8");
  console.log(`Gate 5 manifest written (${summary.manifest_hash})`);
  console.log(JSON.stringify(summary.counts));
}

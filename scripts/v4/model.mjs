/**
 * V4 armour overhaul — frozen delta model.
 *
 * V4 is additive: it copies the live V3 runtime manifest and applies only the
 * armour deltas below. Every number here is frozen output of the authoritative
 * balance solve documented in docs/overhaul/v4/phase1-4-audit.md and captured
 * in docs/overhaul/v4/v4-balance-simulation.json, so the build is deterministic.
 */

export const V3_VERSION = "v3";
export const V4_VERSION = "v4";

/** Tier theme -> canonical armour id stems. Tier 1..16, index 0..15. */
export const TIER_THEME = Object.freeze([
  "copper", "bronze", "iron", "steel", "mithril", "sunsteel", "runite", "shadowsteel",
  "froststeel", "wyrmsteel", "glacial", "starsteel", "voidsteel", "wyrmforged", "ancient", "ascendant",
]);

/** Bar smelted at each tier, used by every heavy recipe. */
export const TIER_BAR = Object.freeze(TIER_THEME.map((theme) => `${theme}_bar`));

/** Highest leather available at or below each tier. */
export const TIER_LEATHER = Object.freeze([
  "light_leather", "light_leather", "thick_leather", "thick_leather",
  "scaled_leather", "scaled_leather", "scaled_leather",
  "shadow_leather", "shadow_leather", "shadow_leather",
  "frost_leather", "frost_leather", "frost_leather",
  "wyrm_leather", "wyrm_leather", "wyrm_leather",
]);

/** Highest cloth available at or below each tier. */
export const TIER_CLOTH = Object.freeze([
  "linen_cloth", "linen_cloth", "herb_weave", "herb_weave", "herb_weave",
  "mystic_cloth", "mystic_cloth",
  "shadowweave", "shadowweave", "shadowweave",
  "frostweave", "frostweave", "frostweave",
  "ascendant_weave", "ascendant_weave", "ascendant_weave",
]);

/**
 * Tier-matched trophy: a drop from a monster inside the same tier band, so the
 * craft gate is always meaningful. Three tiers had no charm/trophy drop at all
 * in V3 and gain one here (see NEW_TROPHIES).
 */
export const TIER_TROPHY = Object.freeze([
  "boar_tusk", "brute_fang", "ironback_tusk", "reaper_bone", "shadow_claw",
  "raider_fang", "devourer_mandible", "cursed_rune", "troll_fang", "revenant_essence",
  "frost_giant_heart", "glacial_core", "wyrm_knight_fang", "void_essence", "wyrm_scale",
  "ascendant_core",
]);

/** Trophies V4 introduces so tiers 5, 7 and 12 have a real craft gate. */
export const NEW_TROPHIES = Object.freeze([
  { id: "shadow_claw", name: "Shadow Claw", tier_index: 5, level_requirement: 41, value: 78, colour: "#ffd074", monster: "shadow_beast", chance: 0.45 },
  { id: "devourer_mandible", name: "Devourer Mandible", tier_index: 7, level_requirement: 60, value: 105, colour: "#ef6970", monster: "dune_devourer", chance: 0.45 },
  { id: "glacial_core", name: "Glacial Core", tier_index: 12, level_requirement: 110, value: 205, colour: "#81a6ff", monster: "glacial_guardian", chance: 0.4 },
]);

/**
 * Off-theme V3 armour ids that V4 retires outright. Owners receive captured
 * cutover value through the existing compensation ledger; the replacement id
 * is the canonical tier-themed one.
 */
export const RETIRED_ARMOUR = Object.freeze({
  cloth_tunic: "copper_light_armor",
  leather_vest: "bronze_light_armor",
  linen_robe: "iron_light_armor",
  iron_mail: "steel_heavy_armor",
  mithril_plate: "sunsteel_heavy_armor",
  mystic_robe: "shadowsteel_light_armor",
  runite_plate: "froststeel_heavy_armor",
  frostguard_plate: "starsteel_heavy_armor",
  wyrmscale_plate: "voidsteel_heavy_armor",
});

/**
 * Frozen balance solve. Columns:
 *   [tier, heavy_defense, heavy_attack, light_defense, light_attack, light_speed]
 * Heavy speed is 0 at every tier (0.85 s swing); light speed is the V3 curve
 * (0.81 s down to 0.60 s). Targets: heavy survives ~5.5-8.5 kills at its own
 * level, light ~1.6-2.1, light earns ~25 % more XP per minute.
 */
export const ARMOUR_BALANCE = Object.freeze([
  [1, 42.5, 1, 37.5, 1, 0.04],
  [2, 82.5, 2, 71.5, 3, 0.07],
  [3, 93.5, 3, 72.5, 6, 0.1],
  [4, 134.5, 5, 105.6, 8, 0.13],
  [5, 139.5, 9, 106.6, 10, 0.16],
  [6, 179.5, 15, 136.5, 12, 0.19],
  [7, 180.5, 23, 137.5, 14, 0.22],
  [8, 214.5, 31, 158.5, 15, 0.25],
  [9, 242.5, 35, 182.5, 17, 0.25],
  [10, 243.5, 38, 183.5, 18, 0.25],
  [11, 264.5, 40, 193.5, 18, 0.25],
  [12, 265.5, 46, 194.5, 20, 0.25],
  [13, 274.5, 49, 195.5, 21, 0.25],
  [14, 288.5, 54, 197.3, 23, 0.25],
  [15, 322.4, 58, 225.5, 24, 0.25],
  [16, 323.4, 60, 226.5, 25, 0.25],
]);

/** Ingredient quantities. Heavy is bar-led, light is cloth-led; both use leather. */
export const HEAVY_QTY = Object.freeze({ bar: 4, leather: 2, trophy: 1 });
export const LIGHT_QTY = Object.freeze({ cloth: 3, leather: 1, trophy: 1 });

export const THEME_TITLE = Object.freeze({
  copper: "Copper", bronze: "Bronze", iron: "Iron", steel: "Steel",
  mithril: "Mithril", sunsteel: "Sunsteel", runite: "Runite", shadowsteel: "Shadowsteel",
  froststeel: "Froststeel", wyrmsteel: "Wyrmsteel", glacial: "Glacial", starsteel: "Starsteel",
  voidsteel: "Voidsteel", wyrmforged: "Wyrmforged", ancient: "Ancient", ascendant: "Ascendant",
});

/**
 * V5 sword release — frozen delta model.
 *
 * V5 is additive on top of the live V4 release. It changes exactly two things:
 *
 *   1. the 16 target swords get normalised display names (one sword per tier,
 *      stable ids, unchanged attack values, unchanged recipes);
 *   2. four tester-era weapons are deleted outright — no compensation, no
 *      conversion, no replacement, no preserved plus level.
 *
 * Every value below is frozen input, so the generator is deterministic.
 */

export const V4_VERSION = "v4";
export const V5_VERSION = "v5";

/** Base swing cadence in seconds. Armour speed modifies the cadence. */
export const BASE_ATTACK_INTERVAL_S = 0.85;

/** Upgrade curve enforced by the server (game_apply_plus). */
export const PLUS_CURVE = Object.freeze({
  per_level_to_50: 0.02,
  per_level_after_50: 0.005,
  breakpoint: 50,
});

/**
 * Stable target ids, tier 1..16, with their normalised display names.
 * Ids are NOT renamed: renaming an id would orphan every held sword.
 */
export const SWORDS = Object.freeze([
  { tier: 1, id: "copper_sword", name: "Copper Sword" },
  { tier: 2, id: "bronze_sword", name: "Bronze Sword" },
  { tier: 3, id: "iron_sword", name: "Iron Sword" },
  { tier: 4, id: "steel_sword", name: "Steel Sword" },
  { tier: 5, id: "mithril_blade", name: "Mithril Sword" },
  { tier: 6, id: "sunsteel_blade", name: "Sunsteel Sword" },
  { tier: 7, id: "runite_greatsword", name: "Runite Sword" },
  { tier: 8, id: "shadow_blade", name: "Shadowsteel Sword" },
  { tier: 9, id: "frost_greatblade", name: "Froststeel Sword" },
  { tier: 10, id: "wyrmsteel_blade", name: "Wyrmsteel Sword" },
  { tier: 11, id: "glacial_greatblade", name: "Glacial Sword" },
  { tier: 12, id: "starsteel_blade", name: "Starsteel Sword" },
  { tier: 13, id: "voidsteel_greatblade", name: "Voidsteel Sword" },
  { tier: 14, id: "wyrmforged_blade", name: "Wyrmforged Sword" },
  { tier: 15, id: "ancient_greatblade", name: "Ancient Sword" },
  { tier: 16, id: "ascendant_blade", name: "Ascendant Sword" },
]);

export const SWORD_IDS = Object.freeze(SWORDS.map((sword) => sword.id));

/**
 * Explicit deletion allowlist: tester-era weapons V5 removes outright.
 * Owner decision (2026-09-01): no compensation, conversion, replacement,
 * item migration or plus-level preservation.
 */
export const DELETED_ITEMS = Object.freeze(
  ["wooden_club", "bronze_dagger", "sunspire_wand", "tungsten_maul"].sort(),
);

/** Fallback weapon used wherever a deleted tester id used to be named. */
export const FALLBACK_WEAPON_ID = "copper_sword";

export const PLAYER_NOTICE = Object.freeze({
  title: "Tomlandia sword release",
  summary:
    "All 16 swords are now listed on one Weaponsmith ladder with normalised names; four test-era weapons are removed.",
  details: [
    "Every tier from level 1 to level 150 offers exactly one sword, named after its tier.",
    "Sword attack values, recipes, Smithing requirements, crafting experience and crafting durations are unchanged.",
    "The Weaponsmith now shows the whole ladder, including tiers you have not unlocked yet.",
    "Base swing cadence is 0.85 seconds; armour still modifies how fast you swing.",
    "Upgrades add 2% attack per level up to +50, then 0.5% attack per level.",
    "Wooden Club, Bronze Dagger, Sunspire Wand and Tungsten Maul were test-era definitions and are deleted outright, along with any remaining copies of them.",
    "Market listings and price history for the deleted definitions are removed at activation.",
  ],
});

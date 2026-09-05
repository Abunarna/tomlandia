/**
 * Frozen V6 strength-potion model.
 *
 * V6 is an additive release derived from canonical production V5. It keeps all
 * 16 potion ids stable, normalises the player-facing names, and replaces the
 * flat `dmg_boost` attack bonus with an explicit percentage strength effect
 * carried in a dedicated `strength_pct` field.
 *
 * Everything in this file is enumerated on purpose: the generators may read
 * values from V5 or from this table and from nowhere else, so re-running the
 * pipeline reproduces byte-identical artifacts.
 */

export const V5_VERSION = "v5";
export const V6_VERSION = "v6";
export const RUN_ID = "v6-strength-potion-release-20260903";
export const BASE_ATTACK_INTERVAL_S = 0.85;

/**
 * tier          — content tier index (1..16)
 * id            — stable V5 item id (never re-issued, never deleted)
 * name          — normalised player-facing name
 * strength_pct  — percentage added to post-equipment base attack
 *
 * boost_hits, value, level_requirement, colour, rarity, icon and every other
 * field are inherited from V5 unchanged.
 */
export const POTIONS = Object.freeze([
  { tier: 1, id: "minor_venom_draught", name: "Copper Strength Potion", strength_pct: 12 },
  { tier: 2, id: "bronze_damage_potion", name: "Bronze Strength Potion", strength_pct: 12 },
  { tier: 3, id: "goblins_fury_tonic", name: "Iron Strength Potion", strength_pct: 12 },
  { tier: 4, id: "steel_damage_potion", name: "Steel Strength Potion", strength_pct: 12 },
  { tier: 5, id: "serpents_bite_elixir", name: "Mithril Strength Potion", strength_pct: 12 },
  { tier: 6, id: "sunsteel_damage_potion", name: "Sunsteel Strength Potion", strength_pct: 12 },
  { tier: 7, id: "runite_damage_potion", name: "Runite Strength Potion", strength_pct: 12 },
  { tier: 8, id: "shadow_venom", name: "Shadowsteel Strength Potion", strength_pct: 13 },
  { tier: 9, id: "froststeel_damage_potion", name: "Froststeel Strength Potion", strength_pct: 13 },
  { tier: 10, id: "wyrmsteel_damage_potion", name: "Wyrmsteel Strength Potion", strength_pct: 14 },
  { tier: 11, id: "frostfire_brew", name: "Glacial Strength Potion", strength_pct: 15 },
  { tier: 12, id: "starsteel_damage_potion", name: "Starsteel Strength Potion", strength_pct: 16 },
  { tier: 13, id: "voidsteel_damage_potion", name: "Voidsteel Strength Potion", strength_pct: 16 },
  { tier: 14, id: "wyrmforged_damage_potion", name: "Wyrmforged Strength Potion", strength_pct: 17 },
  { tier: 15, id: "ancient_damage_potion", name: "Ancient Strength Potion", strength_pct: 17 },
  { tier: 16, id: "ascendant_damage_potion", name: "Ascendant Strength Potion", strength_pct: 18 },
]);

export const POTION_IDS = Object.freeze(POTIONS.map((potion) => potion.id));

/** No item is deleted, compensated, converted or re-identified by V6. */
export const DELETED_ITEMS = Object.freeze([]);

/**
 * Provisional owner threshold for the post-defense mean-damage uplift of an
 * ordinary same-tier kill. The simulation is release-blocking against it.
 */
export const MAX_SAME_TIER_UPLIFT_PCT = 22;

/**
 * Owner-approved exceptions to MAX_SAME_TIER_UPLIFT_PCT (2026-09-03).
 *
 * Narrowly scoped: an isolated integer-rounding artifact in an unrealistic
 * progression state. The general 22% gate is unchanged for every other case,
 * and lowering tier 1 to 11% would not remove it — round(14 * 0.11) is still 2.
 */
export const APPROVED_UPLIFT_EXCEPTIONS = Object.freeze([
  Object.freeze({
    tier: 1,
    potion_id: "minor_venom_draught",
    combat_level: 1,
    plus: 20,
    strength_pct: 12,
    base_attack: 14,
    strength_bonus: 2,
    modeled_uplift_pct: 22.24,
    reason:
      "isolated integer-rounding artifact: a level-1 character with +20 weapon and +20 armour is not a reachable progression state",
  }),
]);

export const PLAYER_NOTICE = Object.freeze({
  details: [
    "Every tier from level 1 to level 150 offers exactly one strength potion, named after its tier.",
    "Strength potions now grant a percentage strength boost instead of a flat damage bonus.",
    "The boost applies to your attack after weapon and armour upgrades, before the target's defence.",
    "Potion recipes, ingredients, Alchemy requirements, crafting experience, crafting durations and boosted-hit counts are unchanged.",
    "Drinking a potion replaces any active potion; boosts never stack and never add together.",
    "An active potion carries over at activation and keeps its remaining hits.",
    "No potion is deleted, converted or re-identified, and every holding, listing and price is preserved.",
    "Healing food is untouched by this release.",
  ],
  summary:
    "All 16 strength potions are now listed on one Alchemist ladder with normalised names and an explicit percentage strength boost.",
  title: "Tomlandia strength potion release",
});

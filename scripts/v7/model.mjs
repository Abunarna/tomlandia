/**
 * Frozen V7 healing-food model.
 *
 * V7 is an additive release derived from canonical production V6. It keeps all
 * 16 food ids, names, recipes, ingredients, quantities, Cooking requirements,
 * XP, craft durations, output quantities and intrinsic values stable, and
 * changes exactly one field per food: the amount it heals.
 *
 * Everything the generators need is enumerated here on purpose, so re-running
 * the pipeline reproduces byte-identical artifacts.
 */

export const V6_VERSION = "v6";
export const V7_VERSION = "v7";
export const RUN_ID = "v7-healing-food-release-20260905";

/**
 * tier — content tier index (1..16)
 * id   — stable V6 item id (never re-issued, never deleted)
 * heal — owner-frozen healing amount (2026-09-05)
 *
 * Intrinsic value, name, recipe, ingredients, level requirement, XP, craft
 * duration, stackability, tradability, icon, colour and rarity are inherited
 * from V6 unchanged. The 1.25x ingredient-value revaluation studied during the
 * audit is explicitly NOT part of this release.
 */
export const FOODS = Object.freeze([
  { tier: 1, id: "honey_bun", heal: 15 },
  { tier: 2, id: "berry_pie", heal: 45 },
  { tier: 3, id: "hearty_stew", heal: 120 },
  { tier: 4, id: "fishermans_stew", heal: 135 },
  { tier: 5, id: "golden_koi_feast", heal: 155 },
  { tier: 6, id: "sunspiced_eel", heal: 180 },
  { tier: 7, id: "runic_fish_stew", heal: 210 },
  { tier: 8, id: "shadow_stew", heal: 245 },
  { tier: 9, id: "frost_tonic", heal: 300 },
  { tier: 10, id: "wyrm_feast", heal: 340 },
  { tier: 11, id: "phoenix_fillet", heal: 375 },
  { tier: 12, id: "starsteel_feast", heal: 445 },
  { tier: 13, id: "void_feast", heal: 485 },
  { tier: 14, id: "wyrmforged_feast", heal: 525 },
  { tier: 15, id: "ancient_feast", heal: 605 },
  { tier: 16, id: "ascendant_feast", heal: 645 },
]);

export const FOOD_IDS = Object.freeze(FOODS.map((food) => food.id));

/** The approved curve, in tier order, as a plain array for assertions. */
export const HEAL_CURVE = Object.freeze(FOODS.map((food) => food.heal));

/** No item is deleted, converted, compensated or re-identified by V7. */
export const DELETED_ITEMS = Object.freeze([]);

/** Food values are frozen at their V6 amounts; the study stays unapproved. */
export const VALUES_UNCHANGED = true;

export const PLAYER_NOTICE = Object.freeze({
  details: [
    "Every tier from level 1 to level 150 still offers exactly one dish, with the same recipe and ingredients.",
    "Healing amounts are rebalanced for the top six dishes so far less healing is wasted on overheal.",
    "Food prices, recipes, ingredients, Cooking requirements, experience and cooking times are unchanged.",
    "Eating from your bag now uses the same authoritative food data as auto-snacking, so every dish works.",
    "Auto-snacking behaviour is unchanged: it still fires before a killing blow is settled and can save you.",
    "No dish is deleted, converted or re-identified, and every holding, listing and price is preserved.",
  ],
  summary:
    "All 16 dishes keep their recipes and prices; the highest tiers heal a more useful amount and manual eating works for every dish.",
  title: "Tomlandia healing food release",
});

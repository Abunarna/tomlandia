import { ITEMS, RECIPES, type CraftStation, type Recipe } from "./data";
import {
  BASE_ATTACK_INTERVAL_S,
  RELEASE_ARMOUR,
  RELEASE_CONTENT_VERSION,
  RELEASE_ITEMS,
  RELEASE_POTION_BY_ID,
  RELEASE_POTIONS,
  RELEASE_RECIPES,
  RELEASE_TIERS,
  RELEASE_WEAPONS,
} from "../generated/release-catalog";
import type { ItemDef, ItemFamily, ItemId, SkillId } from "./types";

/**
 * Registers the authoritative release catalog in the renderer's registries.
 *
 * src/game/data.ts still carries the original hand-written V1 tables. They are
 * kept for the world model (spawn geometry, NPC placement, quests), but their
 * item and recipe lists drifted badly from the released content: they expose
 * only 9 of the 32 armour sets and still list ids the server retired. Every
 * craft the client offers is validated server-side against the active release,
 * so the client must offer exactly the release's recipes and no others.
 */

type ReleaseItem = (typeof RELEASE_ITEMS)[number];

/** Real content families the icon set has no dedicated shape for. */
const ICON_FAMILY: Record<string, ItemFamily> = {
  heavy_armor: "armor",
  light_armor: "armor",
};

const iconFamily = (family: string): ItemFamily => ICON_FAMILY[family] ?? (family as ItemFamily);

const RARITY = new Set(["common", "uncommon", "rare", "epic", "legendary"]);

function toItemDef(entry: ReleaseItem): ItemDef {
  return {
    id: entry.id as ItemId,
    name: entry.name,
    stackable: entry.stackable,
    value: entry.value,
    color: entry.colour,
    kind: entry.kind as ItemDef["kind"],
    family: iconFamily(entry.family),
    rarity: (RARITY.has(entry.rarity) ? entry.rarity : "common") as NonNullable<ItemDef["rarity"]>,
    level: entry.level_requirement,
    untradable: !entry.tradable,
    attack: entry.stats.attack,
    defense: entry.stats.defense,
    heal: entry.stats.heal,
    speed: entry.stats.speed,
    dmgBoost: entry.stats.dmg_boost,
    boostHits: entry.stats.boost_hits,
    strengthPct: RELEASE_POTION_BY_ID[entry.id]?.strength_pct ?? 0,
  };
}

function toRecipe(entry: (typeof RELEASE_RECIPES)[number]): Recipe {
  return {
    id: entry.id,
    skill: entry.skill as Recipe["skill"],
    station: entry.station as CraftStation,
    out: entry.out as ItemId,
    outQty: entry.outQty,
    inputs: entry.inputs.map((input) => ({ id: input.id as ItemId, qty: input.qty })),
    req: entry.req,
    xp: entry.xp,
    time: entry.time,
  };
}

/** The true content family, which ItemDef.family flattens for icon purposes. */
export const RELEASE_ITEM_FAMILY: Record<string, string> = Object.fromEntries(
  RELEASE_ITEMS.map((entry) => [entry.id, entry.family]),
);

export interface ArmourTierRow {
  tier: number;
  theme: string;
  levelRequirement: number;
  heavy: { item: ItemDef; recipe: Recipe } | null;
  light: { item: ItemDef; recipe: Recipe } | null;
}

export interface PotionTierRow {
  tier: number;
  theme: string;
  levelRequirement: number;
  item: ItemDef;
  recipe: Recipe;
  /** Authoritative percentage strength boost for this tier. */
  strengthPct: number;
  /** Accepted attacks the boost lasts for. */
  boostHits: number;
}

export interface WeaponTierRow {
  tier: number;
  theme: string;
  levelRequirement: number;
  item: ItemDef;
  recipe: Recipe;
}

let armourTiers: ArmourTierRow[] = [];
let weaponTiers: WeaponTierRow[] = [];
let potionTiers: PotionTierRow[] = [];
let initialized = false;

/** Idempotent, explicit registration (the package is declared side-effect free). */
export function ensureReleaseContent() {
  if (initialized) return;

  for (const entry of RELEASE_ITEMS) {
    ITEMS[entry.id as ItemId] = toItemDef(entry);
  }

  // The release recipe list replaces the legacy one wholesale: anything the
  // release does not define would be rejected by the server anyway.
  const released = RELEASE_RECIPES.map(toRecipe);
  RECIPES.length = 0;
  RECIPES.push(...released);

  const byOutput = new Map(released.map((recipe) => [recipe.out, recipe]));
  armourTiers = RELEASE_TIERS.map((tier) => {
    const forTier = (family: string) => {
      const found = RELEASE_ARMOUR.find(
        (entry) => entry.tier_index === tier.tier_index && entry.family === family,
      );
      if (!found) return null;
      const recipe = byOutput.get(found.id as ItemId);
      const def = ITEMS[found.id as ItemId];
      if (!recipe || !def) return null;
      return { item: def, recipe };
    };
    return {
      tier: tier.tier_index,
      theme: tier.theme,
      levelRequirement: tier.level_requirement,
      heavy: forTier("heavy_armor"),
      light: forTier("light_armor"),
    };
  });

  // The 16-tier sword ladder the Weaponsmith renders, low tier to high.
  weaponTiers = RELEASE_WEAPONS.map((entry) => {
    const tier = RELEASE_TIERS.find((row) => row.tier_index === entry.tier_index);
    const recipe = byOutput.get(entry.id as ItemId);
    const def = ITEMS[entry.id as ItemId];
    if (!tier || !recipe || !def)
      throw new Error(`Release sword catalog incomplete for ${entry.id}`);
    return {
      tier: entry.tier_index,
      theme: tier.theme,
      levelRequirement: tier.level_requirement,
      item: def,
      recipe,
    };
  }).sort((left, right) => left.tier - right.tier);
  if (weaponTiers.length !== 16) {
    throw new Error(`Release sword catalog must hold 16 tiers, found ${weaponTiers.length}`);
  }

  // The 16-tier strength potion ladder the Alchemist renders, low tier to high.
  potionTiers = RELEASE_POTIONS.map((entry) => {
    const tier = RELEASE_TIERS.find((row) => row.tier_index === entry.tier_index);
    const recipe = byOutput.get(entry.id as ItemId);
    const def = ITEMS[entry.id as ItemId];
    if (!tier || !recipe || !def)
      throw new Error(`Release potion catalog incomplete for ${entry.id}`);
    return {
      tier: entry.tier_index,
      theme: tier.theme,
      levelRequirement: tier.level_requirement,
      item: def,
      recipe,
      strengthPct: entry.strength_pct,
      boostHits: entry.boost_hits,
    };
  }).sort((left, right) => left.tier - right.tier);
  if (potionTiers.length !== 16) {
    throw new Error(`Release potion catalog must hold 16 tiers, found ${potionTiers.length}`);
  }

  const missing = armourTiers.filter((row) => !row.heavy || !row.light);
  if (missing.length) {
    throw new Error(
      `Release armour catalog incomplete for tier(s) ${missing.map((row) => row.tier).join(", ")}`,
    );
  }

  initialized = true;
}

/** All 16 tiers, each with its Heavy and Light set, ordered low to high. */
export function releaseArmourTiers(): ArmourTierRow[] {
  ensureReleaseContent();
  return armourTiers;
}

/** All 16 sword tiers, ordered low to high. */
export function releaseWeaponTiers(): WeaponTierRow[] {
  ensureReleaseContent();
  return weaponTiers;
}

/** All 16 strength potion tiers, ordered low to high. */
export function releasePotionTiers(): PotionTierRow[] {
  ensureReleaseContent();
  return potionTiers;
}

export function releaseSkillFor(recipeId: string): SkillId | null {
  const recipe = RECIPES.find((entry) => entry.id === recipeId);
  return recipe ? recipe.skill : null;
}

export { BASE_ATTACK_INTERVAL_S, RELEASE_CONTENT_VERSION };

ensureReleaseContent();

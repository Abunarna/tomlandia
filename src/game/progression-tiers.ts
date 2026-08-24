/**
 * Canonical progression ladder for the Tomlandia progression overhaul.
 *
 * This is intentionally data-only. Later phases resolve the nullable ID fields
 * using immutable game item IDs; tier index and level requirement must never be
 * inferred from names or list positions elsewhere in the codebase.
 */
export interface ProgressionTier {
  /** Ordinal ladder position: 1 through 16. */
  readonly tier_index: number;
  /** Actual player level required: 1, 10, 20 … 150. */
  readonly level_requirement: number;
  readonly theme_name: string;
  readonly palette: string;
  readonly weapon_id: string | null;
  readonly bar_id: string | null;
  readonly log_id: string | null;
  readonly trophy_id: string | null;
  readonly heavy_armor_id: string | null;
  readonly light_armor_id: string | null;
  readonly cloth_id: string | null;
  readonly leather_id: string | null;
  readonly food_id: string | null;
  readonly potion_id: string | null;
}

const unresolved = {
  weapon_id: null,
  bar_id: null,
  log_id: null,
  trophy_id: null,
  heavy_armor_id: null,
  light_armor_id: null,
  cloth_id: null,
  leather_id: null,
  food_id: null,
  potion_id: null,
} as const;

/** The only source of truth for tier index ↔ level requirement pairs. */
export const PROGRESSION_TIERS: readonly ProgressionTier[] = [
  { tier_index: 1, level_requirement: 1, theme_name: "Copper", palette: "dull brown-orange", ...unresolved },
  { tier_index: 2, level_requirement: 10, theme_name: "Bronze", palette: "muted bronze", ...unresolved },
  { tier_index: 3, level_requirement: 20, theme_name: "Iron", palette: "dark grey", ...unresolved },
  { tier_index: 4, level_requirement: 30, theme_name: "Steel", palette: "cool grey", ...unresolved },
  { tier_index: 5, level_requirement: 40, theme_name: "Mithril", palette: "muted blue", ...unresolved },
  { tier_index: 6, level_requirement: 50, theme_name: "Sunsteel", palette: "warm gold/orange", ...unresolved },
  { tier_index: 7, level_requirement: 60, theme_name: "Runite", palette: "deep red", ...unresolved },
  { tier_index: 8, level_requirement: 70, theme_name: "Shadowsteel", palette: "dark violet", ...unresolved },
  { tier_index: 9, level_requirement: 80, theme_name: "Froststeel", palette: "cold blue", ...unresolved },
  { tier_index: 10, level_requirement: 90, theme_name: "Wyrmsteel", palette: "blue-white", ...unresolved },
  { tier_index: 11, level_requirement: 100, theme_name: "Glacial", palette: "icy cyan", ...unresolved },
  { tier_index: 12, level_requirement: 110, theme_name: "Starsteel", palette: "dark celestial blue", ...unresolved },
  { tier_index: 13, level_requirement: 120, theme_name: "Voidsteel", palette: "deep purple/black", ...unresolved },
  { tier_index: 14, level_requirement: 130, theme_name: "Wyrmforged", palette: "crimson/black", ...unresolved },
  { tier_index: 15, level_requirement: 140, theme_name: "Ancient", palette: "aged pale gold", ...unresolved },
  { tier_index: 16, level_requirement: 150, theme_name: "Ascendant", palette: "bright controlled white-gold", ...unresolved },
] as const;

export function progressionTierForLevel(levelRequirement: number): ProgressionTier | undefined {
  return PROGRESSION_TIERS.find((tier) => tier.level_requirement === levelRequirement);
}

export function progressionTierByIndex(tierIndex: number): ProgressionTier | undefined {
  return PROGRESSION_TIERS.find((tier) => tier.tier_index === tierIndex);
}

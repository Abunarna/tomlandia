export type AvatarTierArtDirection = {
  tier: number;
  material: string;
  materialKeywords: readonly [string, string];
  heavyArmourKeywords: readonly [string, string];
  lightArmourKeywords: readonly [string, string];
  swordKeywords: readonly [string, string];
};

const direction = (
  tier: number,
  material: string,
  materialKeywords: readonly [string, string],
  heavyArmourKeywords: readonly [string, string],
  lightArmourKeywords: readonly [string, string],
  swordKeywords: readonly [string, string],
): AvatarTierArtDirection => ({
  tier,
  material,
  materialKeywords,
  heavyArmourKeywords,
  lightArmourKeywords,
  swordKeywords,
});

/** Concise prompts fixed before generation; gameplay catalogue names remain authoritative. */
const definitions = [
  [
    1,
    "Copper",
    ["hammered", "workmanlike"],
    ["riveted", "broad"],
    ["patched", "studded"],
    ["plain", "leaf-bladed"],
  ],
  [
    2,
    "Bronze",
    ["warm", "classical"],
    ["banded", "scaled"],
    ["strapped", "hide-bound"],
    ["leaf-shaped", "disc-pommelled"],
  ],
  [
    3,
    "Iron",
    ["dark", "utilitarian"],
    ["slabbed", "rugged"],
    ["chain-linked", "weathered"],
    ["straight", "functional"],
  ],
  [
    4,
    "Steel",
    ["polished", "disciplined"],
    ["articulated", "knightly"],
    ["fitted", "brigandine"],
    ["balanced", "cross-guarded"],
  ],
  [
    5,
    "Mithril",
    ["pale", "elegant"],
    ["fluted", "refined"],
    ["filigreed", "supple"],
    ["slender", "luminous"],
  ],
  [
    6,
    "Sunsteel",
    ["golden", "radiant"],
    ["sunburst", "ceremonial"],
    ["ivory-trimmed", "bright"],
    ["ray-guarded", "gleaming"],
  ],
  [
    7,
    "Runite",
    ["teal", "runic"],
    ["angular", "inscribed"],
    ["rune-strapped", "layered"],
    ["broad", "glyph-cut"],
  ],
  [
    8,
    "Shadowsteel",
    ["violet-black", "sinister"],
    ["jagged", "imposing"],
    ["hooded", "stealthy"],
    ["hooked", "shadow-edged"],
  ],
  [
    9,
    "Froststeel",
    ["blue-white", "rimed"],
    ["frost-rimmed", "stout"],
    ["fur-lined", "winterised"],
    ["icicle-edged", "cold"],
  ],
  [
    10,
    "Wyrmsteel",
    ["embered", "scaled"],
    ["dragon-scaled", "horned"],
    ["hide-scaled", "agile"],
    ["fang-shaped", "serrated"],
  ],
  [
    11,
    "Glacial",
    ["crystalline", "massive"],
    ["faceted", "monumental"],
    ["snow-mantled", "prismatic"],
    ["crystal-cleaving", "frozen"],
  ],
  [
    12,
    "Starsteel",
    ["cosmic", "silvered"],
    ["constellated", "regal"],
    ["astral-mailled", "sleek"],
    ["star-pointed", "celestial"],
  ],
  [
    13,
    "Voidsteel",
    ["obsidian", "uncanny"],
    ["hollowed", "ominous"],
    ["shadow-torn", "weightless"],
    ["negative-spaced", "void-edged"],
  ],
  [
    14,
    "Wyrmforged",
    ["volcanic", "draconic"],
    ["furnace-horned", "sovereign"],
    ["char-scaled", "predatory"],
    ["molten-spined", "colossal"],
  ],
  [
    15,
    "Ancient",
    ["weathered", "sacred"],
    ["monumental", "engraved"],
    ["ritual-wrapped", "relic-like"],
    ["rune-relic", "timeworn"],
  ],
  [
    16,
    "Ascendant",
    ["white-gold", "transcendent"],
    ["cathedral-like", "haloed"],
    ["luminous", "mantled"],
    ["oversized", "heavenly"],
  ],
] as const;

export const AVATAR_TIER_ART_DIRECTION: readonly AvatarTierArtDirection[] = definitions.map(
  (entry) => direction(entry[0], entry[1], entry[2], entry[3], entry[4], entry[5]),
);

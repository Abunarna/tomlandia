/**
 * 16x16 pixel-art ore rock — shared source of truth for the CSS component
 * (src/components/game/OreRock.tsx + .fantasy-ore in styles.css) and the
 * canvas renderer, so world nodes and inventory icons match exactly.
 */
export type OrePalette = "copper" | "gold" | "iron" | "emerald" | "amethyst" | "mithril";

export type OreVein = "light" | "mid" | "dark" | "deep";

export const ORE_PALETTES: Record<OrePalette, Record<OreVein, string>> = {
  copper: { light: "#ffe2b3", mid: "#ff9e43", dark: "#d65c18", deep: "#803008" },
  gold: { light: "#fff3a3", mid: "#ffd700", dark: "#c59b27", deep: "#785a00" },
  iron: { light: "#f1f5f9", mid: "#94a3b8", dark: "#475569", deep: "#1e293b" },
  emerald: { light: "#a7f3d0", mid: "#10b981", dark: "#047857", deep: "#064e3b" },
  amethyst: { light: "#f0abfc", mid: "#c084fc", dark: "#7e22ce", deep: "#4c1d95" },
  mithril: { light: "#e0f2fe", mid: "#38bdf8", dark: "#0284c7", deep: "#075985" },
};

/** [x, y, colour] where colour is a literal hex or a vein token. */
export const ORE_PIXELS: readonly [number, number, string][] = [
  [6,1,"#1d1c24"],
  [7,1,"#1d1c24"],
  [8,1,"#1d1c24"],
  [5,2,"#1d1c24"],
  [6,2,"#87889c"],
  [7,2,"#b0b2c9"],
  [8,2,"#68697a"],
  [9,2,"#1d1c24"],
  [4,3,"#1d1c24"],
  [5,3,"#b0b2c9"],
  [6,3,"light"],
  [7,3,"mid"],
  [8,3,"dark"],
  [9,3,"#484954"],
  [10,3,"#1d1c24"],
  [3,4,"#1d1c24"],
  [4,4,"#87889c"],
  [5,4,"mid"],
  [6,4,"light"],
  [7,4,"dark"],
  [8,4,"#68697a"],
  [9,4,"#484954"],
  [10,4,"#33343d"],
  [11,4,"#1d1c24"],
  [3,5,"#1d1c24"],
  [4,5,"#68697a"],
  [5,5,"dark"],
  [6,5,"deep"],
  [7,5,"#484954"],
  [8,5,"#33343d"],
  [9,5,"light"],
  [10,5,"mid"],
  [11,5,"#1d1c24"],
  [2,6,"#1d1c24"],
  [3,6,"#87889c"],
  [4,6,"#484954"],
  [5,6,"#484954"],
  [6,6,"light"],
  [7,6,"mid"],
  [8,6,"dark"],
  [9,6,"dark"],
  [10,6,"deep"],
  [11,6,"#1d1c24"],
  [2,7,"#1d1c24"],
  [3,7,"#b0b2c9"],
  [4,7,"#68697a"],
  [5,7,"mid"],
  [6,7,"mid"],
  [7,7,"dark"],
  [8,7,"#33343d"],
  [9,7,"#33343d"],
  [10,7,"#1d1c24"],
  [11,7,"#1d1c24"],
  [2,8,"#1d1c24"],
  [3,8,"#68697a"],
  [4,8,"light"],
  [5,8,"dark"],
  [6,8,"deep"],
  [7,8,"#33343d"],
  [8,8,"light"],
  [9,8,"mid"],
  [10,8,"dark"],
  [11,8,"#1d1c24"],
  [2,9,"#1d1c24"],
  [3,9,"#484954"],
  [4,9,"dark"],
  [5,9,"deep"],
  [6,9,"#484954"],
  [7,9,"mid"],
  [8,9,"mid"],
  [9,9,"deep"],
  [10,9,"#33343d"],
  [11,9,"#1d1c24"],
  [3,10,"#1d1c24"],
  [4,10,"#484954"],
  [5,10,"#33343d"],
  [6,10,"light"],
  [7,10,"dark"],
  [8,10,"deep"],
  [9,10,"#33343d"],
  [10,10,"#1d1c24"],
  [3,11,"#1d1c24"],
  [4,11,"#33343d"],
  [5,11,"dark"],
  [6,11,"dark"],
  [7,11,"deep"],
  [8,11,"#33343d"],
  [9,11,"#1d1c24"],
  [4,12,"#1d1c24"],
  [5,12,"#33343d"],
  [6,12,"#33343d"],
  [7,12,"#1d1c24"],
  [8,12,"#1d1c24"],
  [5,13,"#1d1c24"],
  [6,13,"#1d1c24"],
];

/** Palette used by each mining node kind. */
export const ORE_PALETTE_BY_NODE: Record<string, OrePalette> = {
  copper: "copper",
  iron: "iron",
  sandstone: "gold",
  mithril: "mithril",
  cursed_rock: "amethyst",
  runite: "emerald",
  tungsten: "iron",
};

/** Palette used by each ore item id (inventory, market, crafting). */
export function orePaletteFor(id: string): OrePalette {
  const s = id.toLowerCase();
  if (s.includes("copper")) return "copper";
  if (s.includes("gold") || s.includes("sandstone")) return "gold";
  if (s.includes("mithril")) return "mithril";
  if (s.includes("runite") || s.includes("rune") || s.includes("emerald")) return "emerald";
  if (s.includes("cursed") || s.includes("shard") || s.includes("amethyst")) return "amethyst";
  return "iron";
}

const CACHE = new Map<OrePalette, HTMLCanvasElement>();

/** 16x16 offscreen canvas of the rock for a palette (cached). */
export function oreSprite(palette: OrePalette): HTMLCanvasElement | null {
  const hit = CACHE.get(palette);
  if (hit) return hit;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 16;
  cv.height = 16;
  const c = cv.getContext("2d");
  if (!c) return null;
  const pal = ORE_PALETTES[palette];
  for (const [x, y, col] of ORE_PIXELS) {
    c.fillStyle = col.startsWith("#") ? col : pal[col as OreVein];
    c.fillRect(x, y, 1, 1);
  }
  CACHE.set(palette, cv);
  return cv;
}

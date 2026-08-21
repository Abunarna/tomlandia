/**
 * 16x20 pixel-art tree — shared source of truth for the CSS component
 * (src/components/game/PixelTree.tsx + .fantasy-tree in styles.css) and the
 * canvas renderer, so woodcutting nodes and log icons match exactly.
 */
export type TreePalette = "oak" | "birch" | "autumn" | "cherry" | "magic" | "frost";

export type TreeShade =
  | "leafLight"
  | "leafMid"
  | "leafDark"
  | "leafDeep"
  | "barkLight"
  | "barkMid"
  | "barkDark";

export const TREE_PALETTES: Record<TreePalette, Record<TreeShade, string>> = {
  oak: {
    leafLight: "#85e05d", leafMid: "#2e9e42", leafDark: "#145a2d", leafDeep: "#093318",
    barkLight: "#a06535", barkMid: "#6d3d16", barkDark: "#3a1f09",
  },
  birch: {
    leafLight: "#facc15", leafMid: "#eab308", leafDark: "#ca8a04", leafDeep: "#854d0e",
    barkLight: "#f8fafc", barkMid: "#cbd5e1", barkDark: "#475569",
  },
  autumn: {
    leafLight: "#ffb703", leafMid: "#fb8500", leafDark: "#d62828", leafDeep: "#780000",
    barkLight: "#8d5b4c", barkMid: "#5a3a31", barkDark: "#2d1b16",
  },
  cherry: {
    leafLight: "#fbcfe8", leafMid: "#f472b6", leafDark: "#db2777", leafDeep: "#831843",
    barkLight: "#7c2d12", barkMid: "#451a03", barkDark: "#1c0a00",
  },
  magic: {
    leafLight: "#c084fc", leafMid: "#a855f7", leafDark: "#7e22ce", leafDeep: "#3b0764",
    barkLight: "#64748b", barkMid: "#334155", barkDark: "#0f172a",
  },
  frost: {
    leafLight: "#bae6fd", leafMid: "#38bdf8", leafDark: "#0284c7", leafDeep: "#0c4a6e",
    barkLight: "#94a3b8", barkMid: "#475569", barkDark: "#1e293b",
  },
};

export const TREE_W = 16;
export const TREE_H = 20;

/** L/M/D/P = leaf light..deep, b/r/k = bark light/mid/dark, '.' = transparent. */
export const TREE_ROWS: readonly string[] = [
  "................",
  "......LLMD......",
  "....LLLMMDDP....",
  "...LLMMMDDDPP...",
  "..LLMMMDDDPPPP..",
  "..LMMLMDDDDPPP..",
  ".LMMMMDDDDPPPPP.",
  ".MMMDDDDDPPPPPP.",
  ".MMDDDDPPPPPPPP.",
  ".DDDDDPPPPPPPPP.",
  "..DDDDPPPPPPPP..",
  "..DDDPPPPPPPPP..",
  "...DDPPPPPPPP...",
  "....PPPPPPPP....",
  ".......brk......",
  ".......brk......",
  ".......brk......",
  ".......brk......",
  "......brrkk.....",
  ".....rrrkk.k....",
];

export const TREE_SHADE_BY_CHAR: Record<string, TreeShade> = {
  L: "leafLight",
  M: "leafMid",
  D: "leafDark",
  P: "leafDeep",
  b: "barkLight",
  r: "barkMid",
  k: "barkDark",
};

/** [x, y, shade] pixel list. */
export const TREE_PIXELS: readonly [number, number, TreeShade][] = TREE_ROWS.flatMap((row, y) =>
  row.split("").flatMap((ch, x) => {
    const shade = TREE_SHADE_BY_CHAR[ch];
    return shade ? ([[x, y, shade]] as [number, number, TreeShade][]) : [];
  }),
);

/** Palette used by each woodcutting node kind. */
export const TREE_PALETTE_BY_NODE: Record<string, TreePalette> = {
  oak: "oak",
  willow: "oak",
  maple: "autumn",
  palm: "birch",
  cursed_tree: "magic",
  frostpine: "frost",
};

/** Palette used by each log/bark item id. */
export function treePaletteFor(id: string): TreePalette {
  const s = id.toLowerCase();
  if (s.includes("maple")) return "autumn";
  if (s.includes("palm")) return "birch";
  if (s.includes("cursed")) return "magic";
  if (s.includes("frost")) return "frost";
  if (s.includes("cherry")) return "cherry";
  return "oak";
}

const CACHE = new Map<TreePalette, HTMLCanvasElement>();

/** 16x20 offscreen canvas of the tree for a palette (cached). */
export function treeSprite(palette: TreePalette): HTMLCanvasElement | null {
  const hit = CACHE.get(palette);
  if (hit) return hit;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = TREE_W;
  cv.height = TREE_H;
  const c = cv.getContext("2d");
  if (!c) return null;
  const pal = TREE_PALETTES[palette];
  for (const [x, y, shade] of TREE_PIXELS) {
    c.fillStyle = pal[shade];
    c.fillRect(x, y, 1, 1);
  }
  CACHE.set(palette, cv);
  return cv;
}

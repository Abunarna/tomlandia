/**
 * 10x8 pixel-art bush — shared source of truth for the CSS component
 * (src/components/game/PixelBush.tsx + .fantasy-bush in styles.css) and the
 * canvas renderer, so gathering nodes and herb/berry icons match exactly.
 */
export type BushPalette = "berry" | "blueberry" | "golden" | "frost" | "toxic";

export type BushShade =
  | "leafHighlight"
  | "leafLight"
  | "leafMid"
  | "leafDark"
  | "berryLight"
  | "berryMid"
  | "berryDark";

export const BUSH_PALETTES: Record<BushPalette, Record<BushShade, string>> = {
  berry: {
    leafHighlight: "#82e091", leafLight: "#5cc46c", leafMid: "#2d7238", leafDark: "#1b4320",
    berryLight: "#ff80df", berryMid: "#e036a6", berryDark: "#7a1555",
  },
  blueberry: {
    leafHighlight: "#86efac", leafLight: "#4ade80", leafMid: "#166534", leafDark: "#052e16",
    berryLight: "#93c5fd", berryMid: "#3b82f6", berryDark: "#1e3a8a",
  },
  golden: {
    leafHighlight: "#fef08a", leafLight: "#fde047", leafMid: "#ca8a04", leafDark: "#713f12",
    berryLight: "#fed7aa", berryMid: "#f97316", berryDark: "#9a3412",
  },
  frost: {
    leafHighlight: "#e0f2fe", leafLight: "#7dd3fc", leafMid: "#0284c7", leafDark: "#0369a1",
    berryLight: "#ffffff", berryMid: "#a5f3fc", berryDark: "#155e75",
  },
  toxic: {
    leafHighlight: "#f0abfc", leafLight: "#d8b4fe", leafMid: "#7e22ce", leafDark: "#3b0764",
    berryLight: "#bef264", berryMid: "#84cc16", berryDark: "#365314",
  },
};

export const BUSH_W = 10;
export const BUSH_H = 8;

/** H/L/M/D = leaf highlight..dark, B/R/K = berry light/mid/dark, '.' = transparent. */
export const BUSH_ROWS: readonly string[] = [
  "...DMMD...",
  "..DLHLMD..",
  ".DLBRMBRD.",
  ".DMRKLRKD.",
  "DBRMBRMBRD",
  "DRKLRKDRKD",
  ".DMDMDMDD.",
  "..DDDDDD..",
];

export const BUSH_SHADE_BY_CHAR: Record<string, BushShade> = {
  H: "leafHighlight",
  L: "leafLight",
  M: "leafMid",
  D: "leafDark",
  B: "berryLight",
  R: "berryMid",
  K: "berryDark",
};

/** [x, y, shade] pixel list. */
export const BUSH_PIXELS: readonly [number, number, BushShade][] = BUSH_ROWS.flatMap((row, y) =>
  row.split("").flatMap((ch, x) => {
    const shade = BUSH_SHADE_BY_CHAR[ch];
    return shade ? ([[x, y, shade]] as [number, number, BushShade][]) : [];
  }),
);

/** Palette used by each gathering node kind. */
export const BUSH_PALETTE_BY_NODE: Record<string, BushPalette> = {
  flax: "golden",
  berries: "berry",
  herbs: "blueberry",
  bloom: "golden",
  gloomcap: "toxic",
  lichen: "frost",
};

/** Palette used by each herb/berry item id. */
export function bushPaletteFor(id: string): BushPalette {
  const s = id.toLowerCase();
  if (s.includes("flax") || s.includes("bloom")) return "golden";
  if (s.includes("gloom")) return "toxic";
  if (s.includes("frost") || s.includes("lichen")) return "frost";
  if (s.includes("herb")) return "blueberry";
  return "berry";
}

const CACHE = new Map<BushPalette, HTMLCanvasElement>();

/** 10x8 offscreen canvas of the bush for a palette (cached). */
export function bushSprite(palette: BushPalette): HTMLCanvasElement | null {
  const hit = CACHE.get(palette);
  if (hit) return hit;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = BUSH_W;
  cv.height = BUSH_H;
  const c = cv.getContext("2d");
  if (!c) return null;
  const pal = BUSH_PALETTES[palette];
  for (const [x, y, shade] of BUSH_PIXELS) {
    c.fillStyle = pal[shade];
    c.fillRect(x, y, 1, 1);
  }
  CACHE.set(palette, cv);
  return cv;
}

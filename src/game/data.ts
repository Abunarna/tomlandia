import type { ItemDef, ItemId, QuestDef, SkillId } from "./types";

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

const def = (
  id: string,
  name: string,
  value: number,
  color: string,
  kind: ItemDef["kind"],
  extra: Partial<ItemDef> = {},
): ItemDef => ({ id, name, value, color, kind, stackable: kind !== "weapon" && kind !== "armor", ...extra });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [
    // ores & stone
    def("copper_ore", "Copper Ore", 6, "#e0955f", "resource"),
    def("iron_ore", "Iron Ore", 14, "#b0a49b", "resource"),
    def("sandstone", "Sandstone", 22, "#e6cf9a", "resource"),
    def("mithril_ore", "Mithril Ore", 40, "#9fc4e8", "resource"),
    def("cursed_shard", "Cursed Shard", 70, "#b58ce0", "resource"),
    def("runite_ore", "Runite Ore", 110, "#8fe0d0", "resource"),
    def("tungsten_ore", "Tungsten Ore", 150, "#c8cfe0", "resource"),
    // logs
    def("oak_logs", "Oak Logs", 5, "#b98a5c", "resource"),
    def("willow_logs", "Willow Logs", 12, "#a8b87a", "resource"),
    def("maple_logs", "Maple Logs", 20, "#d59470", "resource"),
    def("palm_logs", "Palm Logs", 34, "#d8bb7c", "resource"),
    def("cursed_bark", "Cursed Bark", 62, "#8f7bb0", "resource"),
    def("frostpine_logs", "Frostpine Logs", 100, "#a9d8e6", "resource"),
    // gathering
    def("flax", "Flax", 4, "#e6e0a6", "resource"),
    def("meadow_berries", "Meadow Berries", 7, "#f19bb0", "resource"),
    def("forest_herbs", "Forest Herbs", 16, "#8fd6a0", "resource"),
    def("desert_bloom", "Desert Bloom", 30, "#f4c66b", "resource"),
    def("gloomcap", "Gloomcap", 58, "#c39ae8", "resource"),
    def("frost_lichen", "Frost Lichen", 95, "#cfeaf5", "resource"),
    // monster drops
    def("feather", "Feather", 2, "#fdf3d8", "resource"),
    def("goblin_charm", "Goblin Charm", 14, "#a7d97f", "resource"),
    def("raw_hide", "Raw Hide", 10, "#d9b189", "resource"),
    def("thick_hide", "Thick Hide", 28, "#bb8b60", "resource"),
    def("scale_hide", "Scaled Hide", 55, "#d9c07a", "resource"),
    def("shadow_pelt", "Shadow Pelt", 90, "#9b86bd", "resource"),
    def("frost_pelt", "Frost Pelt", 140, "#dcecf7", "resource"),
    // materials
    def("copper_bar", "Copper Bar", 18, "#e0a070", "material"),
    def("iron_bar", "Iron Bar", 40, "#b9b2ab", "material"),
    def("mithril_bar", "Mithril Bar", 100, "#a8cdee", "material"),
    def("runite_bar", "Runite Bar", 260, "#95e6d6", "material"),
    def("tungsten_bar", "Tungsten Bar", 380, "#d3d9e8", "material"),
    def("light_leather", "Light Leather", 30, "#d6a877", "material"),
    def("thick_leather", "Thick Leather", 78, "#b17f52", "material"),
    def("shadow_leather", "Shadow Leather", 210, "#8f7aa8", "material"),
    def("linen_cloth", "Linen Cloth", 22, "#f0e6c8", "material"),
    def("herb_weave", "Herb Weave", 70, "#a7dcb4", "material"),
    def("mystic_cloth", "Mystic Cloth", 200, "#d5b7f0", "material"),
    // weapons
    def("wooden_club", "Wooden Club", 15, "#b98a5c", "weapon", { attack: 2 }),
    def("bronze_dagger", "Bronze Dagger", 40, "#d9a066", "weapon", { attack: 4 }),
    def("copper_sword", "Copper Sword", 70, "#e0a070", "weapon", { attack: 6 }),
    def("steel_sword", "Steel Sword", 150, "#cdd8e6", "weapon", { attack: 9 }),
    def("mithril_blade", "Mithril Blade", 380, "#a8cdee", "weapon", { attack: 16 }),
    def("runite_greatsword", "Runite Greatsword", 900, "#95e6d6", "weapon", { attack: 26 }),
    def("tungsten_maul", "Tungsten Maul", 1500, "#d3d9e8", "weapon", { attack: 38 }),
    def("sunspire_wand", "Sunspire Wand", 700, "#f5d78a", "weapon", { attack: 22 }),
    // armor
    def("cloth_tunic", "Cloth Tunic", 18, "#f2c6d8", "armor", { defense: 2 }),
    def("leather_vest", "Leather Vest", 45, "#c98f5a", "armor", { defense: 4 }),
    def("linen_robe", "Linen Robe", 90, "#f0e6c8", "armor", { defense: 6 }),
    def("iron_mail", "Iron Mail", 170, "#9aa8bd", "armor", { defense: 9 }),
    def("mithril_plate", "Mithril Plate", 420, "#a8cdee", "armor", { defense: 16 }),
    def("mystic_robe", "Mystic Robe", 640, "#d5b7f0", "armor", { defense: 21 }),
    def("runite_plate", "Runite Plate", 980, "#95e6d6", "armor", { defense: 27 }),
    def("frostguard_plate", "Frostguard Plate", 1600, "#d3d9e8", "armor", { defense: 38 }),
    // food
    def("honey_bun", "Honey Bun", 12, "#f4c56b", "food", { heal: 14 }),
    def("berry_pie", "Berry Pie", 34, "#f19bb0", "food", { heal: 45 }),
    def("hearty_stew", "Hearty Stew", 90, "#e0a070", "food", { heal: 120 }),
    def("frost_tonic", "Frost Tonic", 180, "#a9d8e6", "food", { heal: 300 }),
  ].map((d) => [d.id, d]),
);

export function item(id: ItemId): ItemDef {
  return ITEMS[id] ?? ITEMS["oak_logs"]!;
}

/* ------------------------------------------------------------------ */
/* World & biomes                                                      */
/* ------------------------------------------------------------------ */

export const TILE_W = 1400;
export const TILE_H = 1000;
export const WORLD_W = TILE_W * 3;
export const WORLD_H = TILE_H * 2;

export type BiomeId = "fields" | "forest" | "desert" | "evil" | "winter";

export interface BiomeDef {
  id: BiomeId;
  /** unique key — a biome id can appear several times across the world */
  key: string;
  name: string;
  levels: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** jittered outline in world coordinates */
  poly: [number, number][];
  /** show the big name label in-world / on the map */
  label: boolean;
  /** optional town plaza (absolute world coords) */
  plaza?: { x: number; y: number; w: number; h: number };
  /** optional water feature (absolute world coords) */
  pond?: { x: number; y: number; rx: number; ry: number };
  /** ground gradient */
  top: string;
  bottom: string;
  grass: string;
  detail: string;
  tint: string;
}

type Palette = Omit<BiomeDef, "id" | "key" | "x" | "y" | "w" | "h" | "poly" | "label" | "plaza" | "pond">;

const PALETTES: Record<BiomeId, Palette> = {
  fields: {
    name: "Peaceful Fields",
    levels: "Lv 1–15",
    top: "#bfe8a0",
    bottom: "#a3dd8c",
    grass: "#95d283",
    detail: "#e8dcbb",
    tint: "rgba(255,255,235,0)",
  },
  forest: {
    name: "Lush Forest",
    levels: "Lv 15–40",
    top: "#79c39a",
    bottom: "#4e9e78",
    grass: "#3f8f6a",
    detail: "#cbb98f",
    tint: "rgba(30,90,60,0.10)",
  },
  desert: {
    name: "Sunscorch Desert",
    levels: "Lv 40–70",
    top: "#f6dfa6",
    bottom: "#e7c079",
    grass: "#dfb26a",
    detail: "#f3ecc7",
    tint: "rgba(240,190,90,0.10)",
  },
  evil: {
    name: "Evil Woods",
    levels: "Lv 70–100",
    top: "#6b5b93",
    bottom: "#4a3c6d",
    grass: "#3f3460",
    detail: "#7d6aa8",
    tint: "rgba(60,40,90,0.22)",
  },
  winter: {
    name: "Winter Mountain",
    levels: "Lv 100+",
    top: "#e6f3fb",
    bottom: "#bcd9ec",
    grass: "#a8cbe2",
    detail: "#ffffff",
    tint: "rgba(140,190,230,0.14)",
  },
};

/** deterministic pseudo-random in [0,1) */
function rand01(seed: number) {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

interface RegionSpec {
  id: BiomeId;
  /** seed centre in world coords — the region grows around this point */
  x: number;
  y: number;
  /** relative pull: bigger regions claim more ground */
  size: number;
  label?: boolean;
  plaza?: { x: number; y: number; w: number; h: number };
  pond?: { x: number; y: number; rx: number; ry: number };
}

/**
 * The world is partitioned: every point on the map belongs to exactly one
 * region, so biomes butt right up against each other and never overlap.
 * Each spec is a seed; ground is awarded to the nearest seed (weighted by
 * size, with a wobble so borders are organic rather than straight).
 */
const REGION_SPECS: RegionSpec[] = [
  // towns first — their seeds sit on the plaza so a town always owns its ground
  { id: "fields", x: 715, y: 310, size: 1.35, plaza: { x: 500, y: 110, w: 430, h: 400 }, pond: { x: 300, y: 700, rx: 120, ry: 64 } },
  { id: "forest", x: 2020, y: 530, size: 1.3, plaza: { x: 1800, y: 340, w: 440, h: 380 }, pond: { x: 1520, y: 250, rx: 130, ry: 70 } },
  { id: "desert", x: 3460, y: 325, size: 1.35, plaza: { x: 3230, y: 130, w: 460, h: 390 } },
  { id: "winter", x: 780, y: 1520, size: 1.3, plaza: { x: 560, y: 1330, w: 440, h: 380 }, pond: { x: 1150, y: 1720, rx: 140, ry: 70 } },
  // wilderness patches
  { id: "forest", x: 520, y: 1080, size: 0.85, label: true },
  { id: "desert", x: 1560, y: 1720, size: 1.0, label: true },
  { id: "evil", x: 2500, y: 1160, size: 1.15, label: true, pond: { x: 2480, y: 1180, rx: 160, ry: 80 } },
  { id: "evil", x: 3240, y: 1780, size: 0.95 },
  { id: "winter", x: 3900, y: 1700, size: 1.0, label: true },
  { id: "desert", x: 3820, y: 1040, size: 0.95 },
  { id: "forest", x: 2760, y: 200, size: 0.9 },
  { id: "winter", x: 220, y: 1840, size: 0.75 },
  { id: "fields", x: 1900, y: 1420, size: 0.9, label: true },
  { id: "fields", x: 1180, y: 760, size: 0.8 },
  { id: "evil", x: 2960, y: 780, size: 0.85 },
  { id: "forest", x: 1120, y: 1900, size: 0.7 },
  { id: "fields", x: 2280, y: 1900, size: 0.7 },
];

/* --- grid partition ------------------------------------------------- */

const CELL = 100;
const GX = Math.round(WORLD_W / CELL);
const GY = Math.round(WORLD_H / CELL);

/** which region owns each grid cell */
const CELL_OWNER: number[] = (() => {
  const out = new Array<number>(GX * GY);
  for (let gy = 0; gy < GY; gy++) {
    for (let gx = 0; gx < GX; gx++) {
      // wobble the sample point (shared by all seeds, so regions stay solid)
      const sx = (gx + 0.5) * CELL + (rand01(gx * 3.1 + gy * 7.7) - 0.5) * 150;
      const sy = (gy + 0.5) * CELL + (rand01(gx * 5.3 + gy * 2.9 + 11) - 0.5) * 150;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < REGION_SPECS.length; i++) {
        const r = REGION_SPECS[i]!;
        const d = Math.hypot(sx - r.x, sy - r.y) / r.size;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      out[gy * GX + gx] = best;
    }
  }
  return out;
})();

/** grid vertex -> world point, nudged so borders are jagged, edges pinned */
function vertex(gx: number, gy: number): [number, number] {
  const amp = 34;
  const x = gx === 0 ? 0 : gx === GX ? WORLD_W : gx * CELL + (rand01(gx * 12.9 + gy * 4.3) - 0.5) * 2 * amp;
  const y = gy === 0 ? 0 : gy === GY ? WORLD_H : gy * CELL + (rand01(gx * 6.7 + gy * 19.1 + 3) - 0.5) * 2 * amp;
  return [x, y];
}

const owner = (gx: number, gy: number) =>
  gx < 0 || gy < 0 || gx >= GX || gy >= GY ? -1 : CELL_OWNER[gy * GX + gx]!;

/** trace the outline of every cell belonging to one region into a loop */
function traceRegion(idx: number): [number, number][] {
  // directed boundary edges, clockwise around owned cells
  const edges = new Map<string, [number, number, number, number]>();
  const key = (a: number, b: number) => `${a},${b}`;
  const add = (ax: number, ay: number, bx: number, by: number) => {
    edges.set(key(ax, ay), [ax, ay, bx, by]);
  };
  for (let gy = 0; gy < GY; gy++) {
    for (let gx = 0; gx < GX; gx++) {
      if (owner(gx, gy) !== idx) continue;
      if (owner(gx, gy - 1) !== idx) add(gx, gy, gx + 1, gy);
      if (owner(gx + 1, gy) !== idx) add(gx + 1, gy, gx + 1, gy + 1);
      if (owner(gx, gy + 1) !== idx) add(gx + 1, gy + 1, gx, gy + 1);
      if (owner(gx - 1, gy) !== idx) add(gx, gy + 1, gx, gy);
    }
  }
  // walk the longest closed loop (ignores tiny detached specks)
  let best: [number, number][] = [];
  const used = new Set<string>();
  for (const [startKey, first] of edges) {
    if (used.has(startKey)) continue;
    const loop: [number, number][] = [];
    let cur = first;
    let k = startKey;
    while (cur && !used.has(k)) {
      used.add(k);
      loop.push(vertex(cur[0], cur[1]));
      k = key(cur[2], cur[3]);
      cur = edges.get(k)!;
    }
    if (loop.length > best.length) best = loop;
  }
  return best.length ? best : [[0, 0]];
}

export const BIOMES: BiomeDef[] = REGION_SPECS.map((r, i) => {
  const poly = traceRegion(i);
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    ...PALETTES[r.id],
    id: r.id,
    key: `${r.id}-${i}`,
    x: minX,
    y: minY,
    w: Math.max(...xs) - minX,
    h: Math.max(...ys) - minY,
    poly,
    label: r.label ?? Boolean(r.plaza),
    ...(r.plaza ? { plaza: r.plaza } : {}),
    ...(r.pond ? { pond: r.pond } : {}),
  };
});

export function biomeAt(x: number, y: number): BiomeDef {
  const gx = Math.max(0, Math.min(GX - 1, Math.floor(x / CELL)));
  const gy = Math.max(0, Math.min(GY - 1, Math.floor(y / CELL)));
  return BIOMES[CELL_OWNER[gy * GX + gx]!]!;
}



export const REGION_NAME = "Peaceful Fields";

/* ------------------------------------------------------------------ */
/* Resource nodes                                                      */
/* ------------------------------------------------------------------ */

export type NodeKind =
  | "copper"
  | "oak"
  | "flax"
  | "berries"
  | "iron"
  | "willow"
  | "maple"
  | "herbs"
  | "sandstone"
  | "mithril"
  | "palm"
  | "bloom"
  | "cursed_rock"
  | "cursed_tree"
  | "gloomcap"
  | "runite"
  | "tungsten"
  | "frostpine"
  | "lichen";

export interface NodeDefT {
  name: string;
  skill: Extract<SkillId, "mining" | "woodcutting" | "gathering">;
  shape: "rock" | "tree" | "bush";
  xp: number;
  item: ItemId;
  time: number;
  respawn: number;
  req: number;
  color: string;
  accent: string;
}

export const NODE_DEFS: Record<NodeKind, NodeDefT> = {
  copper: { name: "Copper Rock", skill: "mining", shape: "rock", xp: 18, item: "copper_ore", time: 3.2, respawn: 9, req: 1, color: "#b8a999", accent: "#e0955f" },
  oak: { name: "Oak Tree", skill: "woodcutting", shape: "tree", xp: 16, item: "oak_logs", time: 3.0, respawn: 8, req: 1, color: "#8a6a45", accent: "#79c46b" },
  flax: { name: "Flax Patch", skill: "gathering", shape: "bush", xp: 14, item: "flax", time: 2.4, respawn: 7, req: 1, color: "#9ec27a", accent: "#e6e0a6" },
  berries: { name: "Berry Bush", skill: "gathering", shape: "bush", xp: 20, item: "meadow_berries", time: 2.8, respawn: 8, req: 3, color: "#6fa85c", accent: "#f19bb0" },
  iron: { name: "Iron Rock", skill: "mining", shape: "rock", xp: 42, item: "iron_ore", time: 4.0, respawn: 11, req: 15, color: "#9c948c", accent: "#b0a49b" },
  willow: { name: "Willow Tree", skill: "woodcutting", shape: "tree", xp: 38, item: "willow_logs", time: 3.8, respawn: 10, req: 15, color: "#7b6a4a", accent: "#a8b87a" },
  maple: { name: "Maple Tree", skill: "woodcutting", shape: "tree", xp: 60, item: "maple_logs", time: 4.4, respawn: 12, req: 28, color: "#7a5236", accent: "#d59470" },
  herbs: { name: "Herb Cluster", skill: "gathering", shape: "bush", xp: 48, item: "forest_herbs", time: 3.4, respawn: 10, req: 18, color: "#3f8f6a", accent: "#8fd6a0" },
  sandstone: { name: "Sandstone Vein", skill: "mining", shape: "rock", xp: 90, item: "sandstone", time: 4.6, respawn: 12, req: 40, color: "#d3bb88", accent: "#e6cf9a" },
  mithril: { name: "Mithril Vein", skill: "mining", shape: "rock", xp: 140, item: "mithril_ore", time: 5.4, respawn: 15, req: 50, color: "#8fa6bb", accent: "#9fc4e8" },
  palm: { name: "Desert Palm", skill: "woodcutting", shape: "tree", xp: 120, item: "palm_logs", time: 5.0, respawn: 14, req: 45, color: "#a8834e", accent: "#d8bb7c" },
  bloom: { name: "Desert Bloom", skill: "gathering", shape: "bush", xp: 110, item: "desert_bloom", time: 4.0, respawn: 12, req: 42, color: "#c79b56", accent: "#f4c66b" },
  cursed_rock: { name: "Cursed Rock", skill: "mining", shape: "rock", xp: 240, item: "cursed_shard", time: 6.0, respawn: 17, req: 70, color: "#6b5b93", accent: "#b58ce0" },
  cursed_tree: { name: "Cursed Tree", skill: "woodcutting", shape: "tree", xp: 230, item: "cursed_bark", time: 6.0, respawn: 17, req: 70, color: "#4a3c6d", accent: "#8f7bb0" },
  gloomcap: { name: "Gloomcap", skill: "gathering", shape: "bush", xp: 210, item: "gloomcap", time: 4.8, respawn: 14, req: 68, color: "#3f3460", accent: "#c39ae8" },
  runite: { name: "Runite Vein", skill: "mining", shape: "rock", xp: 420, item: "runite_ore", time: 7.0, respawn: 20, req: 100, color: "#7d9fa8", accent: "#8fe0d0" },
  tungsten: { name: "Tungsten Vein", skill: "mining", shape: "rock", xp: 520, item: "tungsten_ore", time: 7.6, respawn: 22, req: 110, color: "#98a2b5", accent: "#c8cfe0" },
  frostpine: { name: "Frostpine", skill: "woodcutting", shape: "tree", xp: 400, item: "frostpine_logs", time: 6.8, respawn: 19, req: 100, color: "#6f8798", accent: "#a9d8e6" },
  lichen: { name: "Frost Lichen", skill: "gathering", shape: "bush", xp: 380, item: "frost_lichen", time: 5.4, respawn: 16, req: 98, color: "#8bb0c4", accent: "#cfeaf5" },
};

export interface NodeSpawn {
  kind: NodeKind;
  x: number;
  y: number;
}

function scatter(kind: NodeKind, bx: number, by: number, spots: [number, number][]): NodeSpawn[] {
  return spots.map(([x, y]) => ({ kind, x: bx + x, y: by + y }));
}

export const NODE_SPAWNS: NodeSpawn[] = [
  // Peaceful Fields
  ...scatter("copper", 0, 0, [[250, 210], [350, 320], [180, 400], [1180, 800]]),
  ...scatter("oak", 0, 0, [[980, 200], [1120, 330], [880, 380], [240, 830]]),
  ...scatter("flax", 0, 0, [[430, 620], [520, 560], [150, 250]]),
  ...scatter("berries", 0, 0, [[1000, 900], [880, 620]]),
  // Lush Forest
  ...scatter("iron", TILE_W, 0, [[220, 260], [320, 480], [180, 700], [900, 820]]),
  ...scatter("willow", TILE_W, 0, [[620, 200], [760, 300], [520, 420]]),
  ...scatter("maple", TILE_W, 0, [[1050, 240], [1180, 460], [980, 640]]),
  ...scatter("herbs", TILE_W, 0, [[420, 780], [640, 860], [1200, 800]]),
  // Sunscorch Desert
  ...scatter("sandstone", TILE_W * 2, 0, [[240, 240], [400, 420], [200, 700]]),
  ...scatter("mithril", TILE_W * 2, 0, [[1080, 300], [1180, 620], [900, 820]]),
  ...scatter("palm", TILE_W * 2, 0, [[620, 780], [780, 860]]),
  ...scatter("bloom", TILE_W * 2, 0, [[520, 200], [340, 880]]),
  // Winter Mountain
  ...scatter("runite", 0, TILE_H, [[260, 260], [420, 420], [220, 720]]),
  ...scatter("tungsten", 0, TILE_H, [[1080, 300], [1160, 700]]),
  ...scatter("frostpine", 0, TILE_H, [[640, 220], [780, 380], [560, 700]]),
  ...scatter("lichen", 0, TILE_H, [[900, 860], [340, 900]]),
  // Evil Woods (wide: 2 tiles)
  ...scatter("cursed_rock", TILE_W, TILE_H, [[300, 300], [520, 620], [1500, 400]]),
  ...scatter("cursed_tree", TILE_W, TILE_H, [[820, 240], [1080, 520], [1900, 700]]),
  ...scatter("gloomcap", TILE_W, TILE_H, [[640, 840], [1700, 240], [2200, 600]]),
];

/* ------------------------------------------------------------------ */
/* Monsters                                                            */
/* ------------------------------------------------------------------ */

export type MonsterKind =
  | "chicken"
  | "goblin"
  | "wolf"
  | "bear"
  | "serpent"
  | "bandit"
  | "wraith"
  | "shadow_beast"
  | "yeti"
  | "frost_giant";

export interface MonsterDefT {
  name: string;
  hp: number;
  attack: number;
  defense: number;
  xp: number;
  gold: readonly [number, number];
  drop: ItemId;
  dropChance: number;
  hide: ItemId | null;
  hideXp: number;
  body: string;
  accent: string;
  size: number;
  ears: "none" | "horns" | "beak" | "spikes";
}

export const MONSTER_DEFS: Record<MonsterKind, MonsterDefT> = {
  chicken: { name: "Chicken", hp: 8, attack: 2, defense: 0, xp: 12, gold: [1, 4], drop: "feather", dropChance: 0.7, hide: null, hideXp: 0, body: "#fff6e0", accent: "#f2a154", size: 1, ears: "beak" },
  goblin: { name: "Goblin", hp: 22, attack: 5, defense: 2, xp: 34, gold: [4, 12], drop: "goblin_charm", dropChance: 0.35, hide: "raw_hide", hideXp: 16, body: "#a7d97f", accent: "#6fae52", size: 1, ears: "horns" },
  wolf: { name: "Meadow Wolf", hp: 60, attack: 11, defense: 5, xp: 95, gold: [10, 24], drop: "raw_hide", dropChance: 0.6, hide: "raw_hide", hideXp: 40, body: "#c9c2bb", accent: "#8e857c", size: 1.1, ears: "horns" },
  bear: { name: "Honey Bear", hp: 130, attack: 20, defense: 10, xp: 210, gold: [22, 48], drop: "thick_hide", dropChance: 0.5, hide: "thick_hide", hideXp: 85, body: "#c08a5c", accent: "#8a5f3b", size: 1.35, ears: "none" },
  serpent: { name: "Sand Serpent", hp: 260, attack: 34, defense: 18, xp: 430, gold: [45, 95], drop: "scale_hide", dropChance: 0.5, hide: "scale_hide", hideXp: 170, body: "#e0c078", accent: "#b8934c", size: 1.2, ears: "spikes" },
  bandit: { name: "Dune Bandit", hp: 320, attack: 42, defense: 22, xp: 520, gold: [70, 160], drop: "desert_bloom", dropChance: 0.4, hide: "scale_hide", hideXp: 190, body: "#e8b98a", accent: "#a86f45", size: 1.1, ears: "none" },
  wraith: { name: "Pale Wraith", hp: 620, attack: 68, defense: 34, xp: 980, gold: [120, 250], drop: "gloomcap", dropChance: 0.45, hide: "shadow_pelt", hideXp: 330, body: "#cbb8e8", accent: "#8f7bb0", size: 1.2, ears: "spikes" },
  shadow_beast: { name: "Shadow Beast", hp: 820, attack: 84, defense: 42, xp: 1300, gold: [160, 320], drop: "shadow_pelt", dropChance: 0.55, hide: "shadow_pelt", hideXp: 400, body: "#7b6a9c", accent: "#4a3c6d", size: 1.45, ears: "horns" },
  yeti: { name: "Fluffy Yeti", hp: 1500, attack: 130, defense: 62, xp: 2400, gold: [280, 520], drop: "frost_pelt", dropChance: 0.55, hide: "frost_pelt", hideXp: 720, body: "#eef7fd", accent: "#a9d8e6", size: 1.5, ears: "horns" },
  frost_giant: { name: "Frost Giant", hp: 2200, attack: 165, defense: 80, xp: 3400, gold: [400, 780], drop: "tungsten_ore", dropChance: 0.4, hide: "frost_pelt", hideXp: 900, body: "#bcd9ec", accent: "#7fa8c4", size: 1.7, ears: "spikes" },
};

export interface MonsterSpawn {
  kind: MonsterKind;
  x: number;
  y: number;
}

function mob(kind: MonsterKind, bx: number, by: number, spots: [number, number][]): MonsterSpawn[] {
  return spots.map(([x, y]) => ({ kind, x: bx + x, y: by + y }));
}

export const MONSTER_SPAWNS: MonsterSpawn[] = [
  ...mob("chicken", 0, 0, [[560, 780], [660, 850], [470, 880], [760, 720]]),
  ...mob("goblin", 0, 0, [[980, 700], [1120, 620], [1050, 860]]),
  ...mob("wolf", TILE_W, 0, [[380, 180], [520, 300], [260, 560], [700, 620]]),
  ...mob("bear", TILE_W, 0, [[900, 400], [1100, 700], [820, 900]]),
  ...mob("serpent", TILE_W * 2, 0, [[400, 560], [560, 400], [300, 860]]),
  ...mob("bandit", TILE_W * 2, 0, [[880, 200], [1020, 500], [760, 640]]),
  ...mob("wraith", TILE_W, TILE_H, [[420, 460], [900, 700], [1400, 200]]),
  ...mob("shadow_beast", TILE_W, TILE_H, [[1200, 820], [1800, 460], [2400, 300]]),
  ...mob("yeti", 0, TILE_H, [[520, 500], [820, 620], [640, 880]]),
  ...mob("frost_giant", 0, TILE_H, [[1000, 480], [1240, 880]]),
];

/* ------------------------------------------------------------------ */
/* Towns & buildings                                                   */
/* ------------------------------------------------------------------ */

export type BuildingKind = "house" | "inn" | "forge" | "tower" | "stall" | "chapel" | "barn";

export interface BuildingDef {
  name: string;
  kind: BuildingKind;
  x: number;
  y: number;
  w: number;
  h: number;
  roof: string;
  wall: string;
  /** timber-frame beam colour */
  beam: string;
}

/** dirt roads laid between the building blocks of a town */
export interface StreetDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

const LOT_W = 118;
const LOT_H = 92;
/** left edges of the four building columns, relative to the town crossroads */
const COL_X = [-330, -196, 70, 204];
/** top edges of the four building rows */
const ROW_Y = [-278, -168, 58, 168];

interface TownSpec {
  cx: number;
  cy: number;
  count: number;
  wall: string;
  beam: string;
  roofs: string[];
  anchors: { role: string; name: string; kind: BuildingKind }[];
  fill: { name: string; kind: BuildingKind }[];
}

const TOWN_SPECS: TownSpec[] = [
  {
    cx: 715,
    cy: 310,
    count: 10,
    wall: "#fdf1dd",
    beam: "#8b6b52",
    roofs: ["#d98b6a", "#c9a7e0", "#8fbfd9", "#c08d68", "#b7906d"],
    anchors: [
      { role: "smith", name: "Haven Forge", kind: "forge" },
      { role: "merchant", name: "Market Stall", kind: "stall" },
      { role: "elder", name: "Moot Hall", kind: "chapel" },
    ],
    fill: [
      { name: "Grand Haven Inn", kind: "inn" },
      { name: "Watchtower", kind: "tower" },
      { name: "Bakehouse", kind: "house" },
      { name: "Cooper's Cottage", kind: "house" },
      { name: "Granary", kind: "barn" },
      { name: "Stables", kind: "barn" },
      { name: "Chandler's House", kind: "house" },
    ],
  },
  {
    cx: TILE_W * 2 + 660,
    cy: 325,
    count: 10,
    wall: "#fdf0d4",
    beam: "#a8834e",
    roofs: ["#f0c268", "#e8b3d8", "#d9a95f", "#e0b070", "#caa063"],
    anchors: [
      { role: "sun_smith", name: "Sunspire Forge", kind: "forge" },
      { role: "weaver", name: "Arcane Loom", kind: "tower" },
      { role: "banker", name: "Golden Bank", kind: "chapel" },
    ],
    fill: [
      { name: "Sunspire Spire", kind: "tower" },
      { name: "Caravan Inn", kind: "inn" },
      { name: "Spice Stall", kind: "stall" },
      { name: "Sun Temple", kind: "chapel" },
      { name: "Dune Stables", kind: "barn" },
      { name: "Potter's House", kind: "house" },
      { name: "Water House", kind: "house" },
    ],
  },
  {
    cx: TILE_W + 620,
    cy: 500,
    count: 5,
    wall: "#f5f0da",
    beam: "#6f5636",
    roofs: ["#7fbd93", "#b98a5c", "#95c9a4", "#8aa86d"],
    anchors: [
      { role: "innkeeper", name: "Willowbrook Inn", kind: "inn" },
      { role: "trapper", name: "Trapper's Hut", kind: "house" },
    ],
    fill: [
      { name: "Woodcutter's Lodge", kind: "barn" },
      { name: "Herb Stall", kind: "stall" },
      { name: "Willow Shrine", kind: "chapel" },
    ],
  },
  {
    cx: 800,
    cy: TILE_H + 500,
    count: 5,
    wall: "#f2f7fd",
    beam: "#6d7f92",
    roofs: ["#8fb6d9", "#a9c6e6", "#9fb6cc", "#87a7c4"],
    anchors: [{ role: "frost_smith", name: "Frostforge", kind: "forge" }],
    fill: [
      { name: "Hearthspur Lodge", kind: "inn" },
      { name: "Ice Cellar", kind: "barn" },
      { name: "Furrier's Stall", kind: "stall" },
      { name: "Snow Chapel", kind: "chapel" },
    ],
  },
];

/** a lot is only usable when it does not swallow a resource node or spawn */
function lotFree(x: number, y: number) {
  const pad = 34;
  const hit = (px: number, py: number) =>
    px > x - pad && px < x + LOT_W + pad && py > y - pad && py < y + LOT_H + pad;
  return (
    !NODE_SPAWNS.some((n) => hit(n.x, n.y)) && !MONSTER_SPAWNS.some((m) => hit(m.x, m.y))
  );
}

const buildings: BuildingDef[] = [];
const streets: StreetDef[] = [];
const npcSpots: Record<string, { x: number; y: number }> = {};

for (const t of TOWN_SPECS) {
  streets.push({ x: t.cx - 360, y: t.cy - 76, w: 720, h: 140 });
  streets.push({ x: t.cx - 80, y: t.cy - 300, w: 152, h: 580 });

  const lots: { x: number; y: number }[] = [];
  for (const ox of COL_X) for (const oy of ROW_Y) lots.push({ x: t.cx + ox, y: t.cy + oy });
  // build outwards from the crossroads so the traders sit on the main street
  lots.sort(
    (a, b) =>
      Math.hypot(a.x + LOT_W / 2 - t.cx, a.y + LOT_H / 2 - t.cy) -
      Math.hypot(b.x + LOT_W / 2 - t.cx, b.y + LOT_H / 2 - t.cy),
  );
  const chosen = lots.filter((l) => lotFree(l.x, l.y)).slice(0, t.count);
  const plan = [...t.anchors, ...t.fill];

  chosen.forEach((lot, i) => {
    const p = plan[i];
    if (!p) return;
    const kind = p.kind;
    const w = kind === "tower" ? 96 : kind === "stall" ? 104 : LOT_W;
    const h = kind === "tower" ? 118 : kind === "stall" ? 74 : LOT_H;
    const x = lot.x + (LOT_W - w) / 2;
    const y = lot.y + (LOT_H - h) / 2;
    buildings.push({
      name: p.name,
      kind,
      x,
      y,
      w,
      h,
      roof: t.roofs[i % t.roofs.length]!,
      wall: t.wall,
      beam: t.beam,
    });
    const role = (p as { role?: string }).role;
    if (role) {
      // traders stand out on the main street, in front of their building
      const above = y + h / 2 < t.cy;
      let sx = x + w / 2;
      const sy = above ? t.cy - 44 : t.cy + 36;
      while (Object.values(npcSpots).some((s) => Math.abs(s.x - sx) < 52 && Math.abs(s.y - sy) < 40)) {
        sx += 56;
      }
      npcSpots[role] = { x: sx, y: sy };
    }



  });
}

export const BUILDINGS: BuildingDef[] = buildings;
export const STREETS: StreetDef[] = streets;
const NPC_SPOTS: Record<string, { x: number; y: number }> = npcSpots;
const spot = (role: string, fx: number, fy: number) => NPC_SPOTS[role] ?? { x: fx, y: fy };


export type NpcRole =
  | "smith"
  | "merchant"
  | "elder"
  | "sun_smith"
  | "weaver"
  | "banker"
  | "trapper"
  | "innkeeper"
  | "frost_smith";

export interface NpcDef {
  id: NpcRole;
  name: string;
  title: string;
  x: number;
  y: number;
  robe: string;
  hair: string;
  greeting: string;
  /** which service panes this npc offers */
  services: ("shop" | "sell" | "quests" | "smith" | "tailor" | "skin" | "upgrade")[];
}

export const NPCS: NpcDef[] = [
  { id: "smith", name: "Bruna", title: "Blacksmith", ...spot("smith", 625, 420), robe: "#d98b6a", hair: "#5c3a2e", greeting: "Fresh off the anvil. Gold first, hero.", services: ["shop", "smith", "upgrade"] },
  { id: "merchant", name: "Pip", title: "Market Trader", ...spot("merchant", 782, 442), robe: "#8fbfd9", hair: "#3f5f78", greeting: "Ore, logs, feathers — I'll take the lot.", services: ["sell", "shop"] },
  { id: "elder", name: "Elder Maren", title: "Village Elder", ...spot("elder", 712, 300), robe: "#c9a7e0", hair: "#e6e0ef", greeting: "Grand Haven could use a hand today.", services: ["quests"] },
  { id: "sun_smith", name: "Master Alric", title: "Sunspire Smith", ...spot("sun_smith", TILE_W * 2 + 735, 350), robe: "#f0c268", hair: "#8a6a45", greeting: "Mithril sings when it's shaped right.", services: ["smith", "upgrade"] },
  { id: "weaver", name: "Lira", title: "Arcane Weaver", ...spot("weaver", TILE_W * 2 + 905, 420), robe: "#e8b3d8", hair: "#6b4f7a", greeting: "Bring me fibre and I'll bring you silk.", services: ["tailor"] },
  { id: "banker", name: "Coinmaster Odo", title: "Golden Bank", ...spot("banker", TILE_W * 2 + 565, 440), robe: "#d9a95f", hair: "#4a3b2e", greeting: "Every scrap has a price, friend.", services: ["sell"] },
  { id: "trapper", name: "Rook", title: "Trapper", ...spot("trapper", TILE_W + 728, 590), robe: "#b98a5c", hair: "#3f2f22", greeting: "Hides into leather — that's my trade.", services: ["skin", "sell"] },
  { id: "innkeeper", name: "Mabel", title: "Willowbrook Inn", ...spot("innkeeper", TILE_W + 560, 540), robe: "#7fbd93", hair: "#a86f45", greeting: "A warm meal keeps a hero standing.", services: ["shop"] },
  { id: "frost_smith", name: "Sigrid", title: "Frostforge Smith", ...spot("frost_smith", 882, TILE_H + 560), robe: "#a9c6e6", hair: "#e6eef7", greeting: "Only runite holds an edge up here.", services: ["smith", "upgrade", "shop"] },
];


export const SHOP_STOCK: Record<NpcRole, { id: ItemId; price: number }[]> = {
  // Gear is never sold by NPCs — weapons and armour must be crafted by players
  // (or traded between players on the marketplace).
  smith: [{ id: "honey_bun", price: 18 }],
  merchant: [
    { id: "honey_bun", price: 20 },
    { id: "berry_pie", price: 55 },
  ],
  elder: [],
  sun_smith: [],
  weaver: [],
  banker: [],
  trapper: [{ id: "hearty_stew", price: 150 }],
  innkeeper: [
    { id: "berry_pie", price: 50 },
    { id: "hearty_stew", price: 140 },
  ],
  frost_smith: [{ id: "frost_tonic", price: 280 }],
};


/* ------------------------------------------------------------------ */
/* Crafting                                                            */
/* ------------------------------------------------------------------ */

export interface Recipe {
  id: string;
  skill: Extract<SkillId, "smithing" | "tailoring" | "skinning">;
  out: ItemId;
  outQty: number;
  inputs: { id: ItemId; qty: number }[];
  req: number;
  xp: number;
  time: number;
}

export const RECIPES: Recipe[] = [
  // Smithing — ore to bar
  { id: "copper_bar", skill: "smithing", out: "copper_bar", outQty: 1, inputs: [{ id: "copper_ore", qty: 2 }], req: 1, xp: 22, time: 1.6 },
  { id: "iron_bar", skill: "smithing", out: "iron_bar", outQty: 1, inputs: [{ id: "iron_ore", qty: 2 }], req: 15, xp: 55, time: 1.8 },
  { id: "mithril_bar", skill: "smithing", out: "mithril_bar", outQty: 1, inputs: [{ id: "mithril_ore", qty: 2 }, { id: "sandstone", qty: 1 }], req: 40, xp: 150, time: 2.2 },
  { id: "runite_bar", skill: "smithing", out: "runite_bar", outQty: 1, inputs: [{ id: "runite_ore", qty: 2 }, { id: "cursed_shard", qty: 1 }], req: 70, xp: 420, time: 2.6 },
  { id: "tungsten_bar", skill: "smithing", out: "tungsten_bar", outQty: 1, inputs: [{ id: "tungsten_ore", qty: 2 }, { id: "runite_bar", qty: 1 }], req: 100, xp: 620, time: 3 },
  // Smithing — bar to gear
  { id: "copper_sword", skill: "smithing", out: "copper_sword", outQty: 1, inputs: [{ id: "copper_bar", qty: 3 }], req: 5, xp: 90, time: 2.4 },
  { id: "steel_sword", skill: "smithing", out: "steel_sword", outQty: 1, inputs: [{ id: "iron_bar", qty: 3 }, { id: "oak_logs", qty: 1 }], req: 20, xp: 220, time: 2.6 },
  { id: "iron_mail", skill: "smithing", out: "iron_mail", outQty: 1, inputs: [{ id: "iron_bar", qty: 4 }], req: 24, xp: 260, time: 2.8 },
  { id: "mithril_blade", skill: "smithing", out: "mithril_blade", outQty: 1, inputs: [{ id: "mithril_bar", qty: 3 }, { id: "palm_logs", qty: 1 }], req: 45, xp: 620, time: 3 },
  { id: "mithril_plate", skill: "smithing", out: "mithril_plate", outQty: 1, inputs: [{ id: "mithril_bar", qty: 4 }], req: 50, xp: 700, time: 3.2 },
  { id: "runite_greatsword", skill: "smithing", out: "runite_greatsword", outQty: 1, inputs: [{ id: "runite_bar", qty: 4 }, { id: "frostpine_logs", qty: 1 }], req: 75, xp: 1500, time: 3.4 },
  { id: "runite_plate", skill: "smithing", out: "runite_plate", outQty: 1, inputs: [{ id: "runite_bar", qty: 5 }], req: 80, xp: 1700, time: 3.6 },
  { id: "tungsten_maul", skill: "smithing", out: "tungsten_maul", outQty: 1, inputs: [{ id: "tungsten_bar", qty: 4 }], req: 105, xp: 2600, time: 3.8 },
  { id: "frostguard_plate", skill: "smithing", out: "frostguard_plate", outQty: 1, inputs: [{ id: "tungsten_bar", qty: 5 }, { id: "frost_pelt", qty: 2 }], req: 110, xp: 3000, time: 4 },
  // Skinning — hides to leather
  { id: "light_leather", skill: "skinning", out: "light_leather", outQty: 1, inputs: [{ id: "raw_hide", qty: 3 }], req: 1, xp: 30, time: 1.6 },
  { id: "thick_leather", skill: "skinning", out: "thick_leather", outQty: 1, inputs: [{ id: "thick_hide", qty: 3 }], req: 25, xp: 110, time: 2 },
  { id: "shadow_leather", skill: "skinning", out: "shadow_leather", outQty: 1, inputs: [{ id: "shadow_pelt", qty: 3 }, { id: "scale_hide", qty: 1 }], req: 65, xp: 460, time: 2.4 },
  // Tailoring
  { id: "linen_cloth", skill: "tailoring", out: "linen_cloth", outQty: 1, inputs: [{ id: "flax", qty: 3 }], req: 1, xp: 26, time: 1.6 },
  { id: "herb_weave", skill: "tailoring", out: "herb_weave", outQty: 1, inputs: [{ id: "forest_herbs", qty: 3 }, { id: "linen_cloth", qty: 1 }], req: 22, xp: 120, time: 2 },
  { id: "mystic_cloth", skill: "tailoring", out: "mystic_cloth", outQty: 1, inputs: [{ id: "gloomcap", qty: 2 }, { id: "herb_weave", qty: 2 }], req: 60, xp: 520, time: 2.4 },
  { id: "leather_vest", skill: "tailoring", out: "leather_vest", outQty: 1, inputs: [{ id: "light_leather", qty: 3 }], req: 6, xp: 90, time: 2.2 },
  { id: "linen_robe", skill: "tailoring", out: "linen_robe", outQty: 1, inputs: [{ id: "linen_cloth", qty: 3 }, { id: "light_leather", qty: 1 }], req: 14, xp: 180, time: 2.4 },
  { id: "mystic_robe", skill: "tailoring", out: "mystic_robe", outQty: 1, inputs: [{ id: "mystic_cloth", qty: 3 }, { id: "shadow_leather", qty: 1 }], req: 66, xp: 900, time: 3 },
];

/* ------------------------------------------------------------------ */
/* Equipment upgrading (+1 .. +25)                                     */
/* ------------------------------------------------------------------ */

export const MAX_PLUS = 25;
/** each upgrade level grants +5% of base stat */
export const PLUS_STEP = 0.05;

export function upgradeCost(base: number, plus: number): number {
  const tier = Math.floor(plus / 5);
  return Math.round((25 + base * 0.6) * Math.pow(2, tier) * (1 + (plus % 5) * 0.25));
}

export function statWithPlus(base: number, plus: number): number {
  return Math.round(base * (1 + plus * PLUS_STEP) * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Quests                                                              */
/* ------------------------------------------------------------------ */

export const QUESTS: QuestDef[] = [
  { id: "feather_duster", name: "Feather Duster", desc: "Chickens have run wild. Defeat 5 of them.", kind: "kill", key: "chicken", count: 5, gold: 45, xpSkill: "combat", xp: 45 },
  { id: "copper_run", name: "Copper Run", desc: "The forge is cold. Mine 6 Copper Ore.", kind: "gather", key: "copper_ore", count: 6, gold: 60, xpSkill: "mining", xp: 70 },
  { id: "log_delivery", name: "Firewood Duty", desc: "The inn needs warmth. Chop 6 Oak Logs.", kind: "gather", key: "oak_logs", count: 6, gold: 55, xpSkill: "woodcutting", xp: 65 },
  { id: "goblin_trouble", name: "Goblin Trouble", desc: "Goblins raid the east fields. Defeat 3.", kind: "kill", key: "goblin", count: 3, gold: 120, xpSkill: "combat", xp: 130, reward: "bronze_dagger" },
  { id: "flax_bundle", name: "Bundle of Flax", desc: "Gather 8 Flax for the weavers.", kind: "gather", key: "flax", count: 8, gold: 90, xpSkill: "gathering", xp: 120 },
  { id: "wolf_watch", name: "Wolf Watch", desc: "Thin the forest pack. Defeat 4 Meadow Wolves.", kind: "kill", key: "wolf", count: 4, gold: 260, xpSkill: "combat", xp: 380, reward: "steel_sword" },
  { id: "dune_patrol", name: "Dune Patrol", desc: "Bandits harass the caravans. Defeat 3.", kind: "kill", key: "bandit", count: 3, gold: 700, xpSkill: "combat", xp: 1200 },
  { id: "gloom_harvest", name: "Gloom Harvest", desc: "Pick 5 Gloomcaps from the Evil Woods.", kind: "gather", key: "gloomcap", count: 5, gold: 1100, xpSkill: "gathering", xp: 1600 },
];

/* ------------------------------------------------------------------ */
/* Merchant icons — shown above heads in-world and on the world map    */
/* ------------------------------------------------------------------ */

export interface NpcIcon {
  /** glyph drawn inside the badge */
  glyph: string;
  /** badge fill */
  color: string;
  /** short label for the map legend */
  label: string;
}

export const NPC_ICONS: Record<NpcRole, NpcIcon> = {
  smith: { glyph: "\u2692\uFE0E", color: "#d98b6a", label: "Blacksmith" },
  merchant: { glyph: "$", color: "#8fbfd9", label: "Market Trader" },
  elder: { glyph: "?", color: "#c9a7e0", label: "Quest Giver" },
  sun_smith: { glyph: "\u2694\uFE0E", color: "#f0c268", label: "Sunspire Smith" },
  weaver: { glyph: "\u2702\uFE0E", color: "#e8b3d8", label: "Arcane Weaver" },
  banker: { glyph: "\u2605", color: "#d9a95f", label: "Banker" },
  trapper: { glyph: "\u2691", color: "#b98a5c", label: "Trapper" },
  innkeeper: { glyph: "\u2302", color: "#7fbd93", label: "Innkeeper" },
  frost_smith: { glyph: "\u2744\uFE0E", color: "#a9c6e6", label: "Frostforge Smith" },
};

/* ------------------------------------------------------------------ */
/* Border barriers — impassable rivers, rocky ridges & woodland strips */
/* ------------------------------------------------------------------ */

export type BarrierKind = "river" | "rocks" | "woodland";

export interface Barrier {
  id: string;
  kind: BarrierKind;
  /** polyline running along a stretch of biome border */
  pts: [number, number][];
  /** total blocked width in world px */
  width: number;
  /** bounding box for cheap culling */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const BARRIER_WIDTH: Record<BarrierKind, number> = { river: 54, rocks: 46, woodland: 58 };

/** keep-clear zones so towns and traders are never walled off */
const CLEAR_ZONES: { x: number; y: number; r: number }[] = [
  ...BIOMES.filter((b) => b.plaza).map((b) => ({
    x: b.plaza!.x + b.plaza!.w / 2,
    y: b.plaza!.y + b.plaza!.h / 2,
    r: Math.max(b.plaza!.w, b.plaza!.h) * 0.9,
  })),
  ...NPCS.map((n) => ({ x: n.x, y: n.y, r: 150 })),
  ...BUILDINGS.map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2, r: 140 })),
  ...NODE_SPAWNS.map((n) => ({ x: n.x, y: n.y, r: 95 })),
  ...MONSTER_SPAWNS.map((m) => ({ x: m.x, y: m.y, r: 62 })),
];

function nearClearZone(x: number, y: number) {
  for (const z of CLEAR_ZONES) if (Math.hypot(x - z.x, y - z.y) < z.r) return true;
  return false;
}

/**
 * Barriers run along the shared borders between two regions, so rivers, rocky
 * ridges and treelines sit exactly on the seam where the biomes meet.
 */
function buildBarriers(): Barrier[] {
  const out: Barrier[] = [];
  // group border segments by the pair of regions they separate
  const groups = new Map<string, { a: number; b: number; segs: [number, number, number, number][] }>();
  const push = (a: number, b: number, seg: [number, number, number, number]) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const k = `${lo}|${hi}`;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { a: lo, b: hi, segs: [] }));
    g.segs.push(seg);
  };
  for (let gy = 0; gy < GY; gy++) {
    for (let gx = 0; gx < GX; gx++) {
      const me = owner(gx, gy);
      const right = owner(gx + 1, gy);
      if (right >= 0 && right !== me) push(me, right, [gx + 1, gy, gx + 1, gy + 1]);
      const below = owner(gx, gy + 1);
      if (below >= 0 && below !== me) push(me, below, [gx, gy + 1, gx + 1, gy + 1]);
    }
  }

  let n = 0;
  for (const g of groups.values()) {
    // chain the segments of this border into continuous polylines
    const adj = new Map<string, string[]>();
    const k = (x: number, y: number) => `${x},${y}`;
    const remaining = new Set<string>();
    for (const [ax, ay, bx, by] of g.segs) {
      const ka = k(ax, ay);
      const kb = k(bx, by);
      remaining.add(`${ka}>${kb}`);
      (adj.get(ka) ?? adj.set(ka, []).get(ka)!).push(kb);
      (adj.get(kb) ?? adj.set(kb, []).get(kb)!).push(ka);
    }
    const chains: string[][] = [];
    const starts = [...adj.keys()].sort();
    for (const s of starts) {
      let cur = s;
      let chain: string[] = [];
      // walk as far as possible from this vertex through unused segments
      for (;;) {
        const next = (adj.get(cur) ?? []).find(
          (v) => remaining.has(`${cur}>${v}`) || remaining.has(`${v}>${cur}`),
        );
        if (!next) break;
        remaining.delete(`${cur}>${next}`);
        remaining.delete(`${next}>${cur}`);
        if (!chain.length) chain.push(cur);
        chain.push(next);
        cur = next;
      }
      if (chain.length > 2) chains.push(chain);
      chain = [];
    }

    const idA = REGION_SPECS[g.a]!.id;
    const idB = REGION_SPECS[g.b]!.id;
    for (const chain of chains) {
      const arcLen = 3;
      for (let a = 0; a * arcLen < chain.length - 2; a++) {
        // roughly 40% of each border is walled off
        if (rand01(g.a * 91.3 + g.b * 31.7 + a * 13.7) > 0.55) continue;
        const slice = chain.slice(a * arcLen, a * arcLen + arcLen + 1);
        if (slice.length < 3) continue;
        const pts = slice.map((s) => {
          const [vx, vy] = s.split(",").map(Number) as [number, number];
          return vertex(vx, vy);
        });
        if (pts.some(([x, y]) => nearClearZone(x, y))) continue;
        const roll = rand01(g.a * 7.1 + g.b * 3.3 + a);
        const kind: BarrierKind =
          idA === "winter" || idB === "winter"
            ? roll > 0.35
              ? "rocks"
              : "river"
            : idA === "desert" || idB === "desert"
              ? roll > 0.45
                ? "rocks"
                : "woodland"
              : roll > 0.6
                ? "river"
                : roll > 0.3
                  ? "woodland"
                  : "rocks";
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        out.push({
          id: `bar-${n++}`,
          kind,
          pts,
          width: BARRIER_WIDTH[kind],
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys),
        });
      }
    }
  }
  return out;
}


export const BARRIERS: Barrier[] = buildBarriers();

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** solid footprints: building walls (the lower part, so roofs overlap freely) */
const SOLID_RECTS = BUILDINGS.map((b) => ({
  x: b.x + 2,
  y: b.y + b.h * 0.32,
  w: b.w - 4,
  h: b.h * 0.68 + 6,
}));

/** solid trunks / boulders / bushes — small enough to still harvest from any side */
const SOLID_DISCS = NODE_SPAWNS.map((n) => ({
  x: n.x,
  y: n.y + (NODE_DEFS[n.kind].shape === "tree" ? 8 : 2),
  r: NODE_DEFS[n.kind].shape === "bush" ? 11 : 14,
}));

/** true when the world point is inside a barrier, a building or a resource node */
export function blockedAt(x: number, y: number, pad = 10): boolean {
  for (const bar of BARRIERS) {
    const r = bar.width / 2 + pad;
    if (x < bar.minX - r || x > bar.maxX + r || y < bar.minY - r || y > bar.maxY + r) continue;
    for (let i = 0; i < bar.pts.length - 1; i++) {
      const a = bar.pts[i]!;
      const b = bar.pts[i + 1]!;
      if (distToSeg(x, y, a[0], a[1], b[0], b[1]) < r) return true;
    }
  }
  for (const s of SOLID_RECTS) {
    if (x > s.x - pad && x < s.x + s.w + pad && y > s.y - pad && y < s.y + s.h + pad) return true;
  }
  for (const d of SOLID_DISCS) {
    const r = d.r + pad;
    if (Math.abs(x - d.x) < r && Math.abs(y - d.y) < r && Math.hypot(x - d.x, y - d.y) < r) return true;
  }
  return false;
}


export const BARRIER_LABEL: Record<BarrierKind, string> = {
  river: "River",
  rocks: "Rocky Ridge",
  woodland: "Dense Woodland",
};

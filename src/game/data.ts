import type { ItemDef, ItemFamily, ItemId, QuestDef, SkillId } from "./types";
import {
  CITIES,
  CITY,
  CITY_OUTER_R,
  SUNSPIRE,
  WILLOWBROOK,
  FROSTFORGE,
  DUSKMERE,
  onMonument,
  cityBlocked,
  cityGateAt,
  cityKeepOut,
  cityOuterR,
  cityWallR,
  inCityOasis,
  pushOutsideCity,
  type CityDef,
} from "./city";

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

/** Icon shape family per item — weapons/armour fall back to their kind. */
const FAMILY_GROUPS: Record<string, string[]> = {
  ore: ["copper_ore", "iron_ore", "sandstone", "mithril_ore", "cursed_shard", "runite_ore", "tungsten_ore"],
  log: ["oak_logs", "willow_logs", "maple_logs", "palm_logs", "cursed_bark", "frostpine_logs"],
  herb: ["flax", "forest_herbs", "desert_bloom", "gloomcap", "frost_lichen"],
  berries: ["meadow_berries"],
  hide: ["raw_hide", "thick_hide", "scale_hide", "shadow_pelt", "frost_pelt"],
  feather: ["feather"],
  charm: [
    "goblin_charm",
    "ram_horn",
    "boar_tusk",
    "lynx_claw",
    "jackal_fang",
    "scorpion_stinger",
    "ghoul_essence",
    "reaper_bone",
    "frost_fang",
    "wraith_ice_core",
    "wyrm_scale",
  ],
  bar: ["copper_bar", "iron_bar", "mithril_bar", "runite_bar", "tungsten_bar"],
  leather: ["light_leather", "thick_leather", "shadow_leather"],
  cloth: ["linen_cloth", "herb_weave", "mystic_cloth"],
  bun: ["honey_bun"],
  pie: ["berry_pie"],
  stew: ["hearty_stew"],
  tonic: ["frost_tonic"],
  fish: ["river_minnow", "silver_trout", "golden_koi", "deepwater_eel", "starlight_salmon"],
  potion: [
    "minor_venom_draught",
    "goblins_fury_tonic",
    "serpents_bite_elixir",
    "shadow_venom",
    "frostfire_brew",
  ],
};

const FAMILY_BY_ID: Record<string, ItemFamily> = Object.fromEntries(
  Object.entries(FAMILY_GROUPS).flatMap(([fam, ids]) => ids.map((id) => [id, fam as ItemFamily])),
);

const familyFor = (id: string, kind: ItemDef["kind"]): ItemFamily =>
  kind === "weapon" ? "weapon" : kind === "armor" ? "armor" : (FAMILY_BY_ID[id] ?? "ore");

const def = (
  id: string,
  name: string,
  value: number,
  color: string,
  kind: ItemDef["kind"],
  extra: Partial<ItemDef> = {},
): ItemDef => ({
  id,
  name,
  value,
  color,
  kind,
  family: familyFor(id, kind),
  stackable: kind !== "weapon" && kind !== "armor",
  ...extra,
});

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
    // monster trophies (charm family)
    def("ram_horn", "Ram Horn", 5, "#c9a876", "resource"),
    def("boar_tusk", "Boar Tusk", 12, "#e6ddc8", "resource"),
    def("lynx_claw", "Lynx Claw", 24, "#6b5a42", "resource"),
    def("jackal_fang", "Jackal Fang", 45, "#7a5c3a", "resource"),
    def("scorpion_stinger", "Scorpion Stinger", 65, "#5a4020", "resource"),
    def("ghoul_essence", "Ghoul Essence", 95, "#3f4a38", "resource"),
    def("reaper_bone", "Reaper Bone", 130, "#e8e0d0", "resource"),
    def("frost_fang", "Frost Fang", 175, "#8fb8d4", "resource"),
    def("wraith_ice_core", "Wraith Ice Core", 220, "#5f9ec4", "resource"),
    def("wyrm_scale", "Wyrm Scale", 300, "#a8d4e8", "resource"),
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
    def("cloth_tunic", "Cloth Tunic", 18, "#f2c6d8", "armor", { defense: 2, attack: 1, speed: 0.04 }),
    def("leather_vest", "Leather Vest", 45, "#c98f5a", "armor", { defense: 4, attack: 1, speed: 0.07 }),
    def("linen_robe", "Linen Robe", 90, "#f0e6c8", "armor", { defense: 6, attack: 2, speed: 0.1 }),
    def("iron_mail", "Iron Mail", 170, "#9aa8bd", "armor", { defense: 9 }),
    def("mithril_plate", "Mithril Plate", 420, "#a8cdee", "armor", { defense: 16 }),
    def("mystic_robe", "Mystic Robe", 640, "#d5b7f0", "armor", { defense: 21, attack: 7, speed: 0.16 }),
    def("runite_plate", "Runite Plate", 980, "#95e6d6", "armor", { defense: 27 }),
    def("frostguard_plate", "Frostguard Plate", 1600, "#d3d9e8", "armor", { defense: 38 }),
    def("wyrmscale_plate", "Wyrmscale Plate", 2200, "#a8d4e8", "armor", { defense: 50 }),
    // food
    def("honey_bun", "Honey Bun", 12, "#f4c56b", "food", { heal: 14 }),
    def("berry_pie", "Berry Pie", 34, "#f19bb0", "food", { heal: 45 }),
    def("hearty_stew", "Hearty Stew", 90, "#e0a070", "food", { heal: 120 }),
    def("frost_tonic", "Frost Tonic", 180, "#a9d8e6", "food", { heal: 300 }),
    def("phoenix_fillet", "Phoenix Fillet", 700, "#f59a5c", "food", { heal: 650 }),
    // fish
    def("river_minnow", "River Minnow", 8, "#9fc9d8", "resource"),
    def("silver_trout", "Silver Trout", 24, "#c8d6e0", "resource"),
    def("golden_koi", "Golden Koi", 65, "#f4c05e", "resource"),
    def("deepwater_eel", "Deepwater Eel", 150, "#7b8fb0", "resource"),
    def("starlight_salmon", "Starlight Salmon", 320, "#f0a3b6", "resource"),
    // potions
    def("minor_venom_draught", "Minor Venom Draught", 35, "#a7d97f", "potion", { dmgBoost: 2, boostHits: 5 }),
    def("goblins_fury_tonic", "Goblin's Fury Tonic", 90, "#e08a5c", "potion", { dmgBoost: 5, boostHits: 8 }),
    def("serpents_bite_elixir", "Serpent's Bite Elixir", 220, "#6fc8a0", "potion", { dmgBoost: 10, boostHits: 10 }),
    def("shadow_venom", "Shadow Venom", 480, "#9b7ac0", "potion", { dmgBoost: 18, boostHits: 12 }),
    def("frostfire_brew", "Frostfire Brew", 900, "#8fd6ee", "potion", { dmgBoost: 30, boostHits: 15 }),
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
/** V2 world: exactly double the old area (4x3 tiles instead of 3x2). */
export const WORLD_W = TILE_W * 4;
/** V2.1 — the map was extended ~25% south so it reads less like a strip. */
export const CORE_H = TILE_H * 3;
export const WORLD_H = 3750;

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
  // V2 — exactly one contiguous territory per biome, laid out as a gentle arc
  // running south-west to north-east and back down to the south-east.
  { id: "fields", x: 700, y: 2400, size: 1.2, label: true, plaza: { x: 485, y: 2200, w: 430, h: 400 }, pond: { x: 330, y: 2780, rx: 168, ry: 104 } },
  { id: "forest", x: 1900, y: 1650, size: 0.95, label: true, plaza: { x: 1685, y: 1460, w: 440, h: 380 }, pond: { x: 1540, y: 1180, rx: 210, ry: 78 } },
  { id: "desert", x: 3100, y: 900, size: 1.1, label: true, plaza: { x: 2870, y: 705, w: 460, h: 390 } },
  { id: "evil", x: 4300, y: 1500, size: 1.0, label: true, pond: { x: 4420, y: 1830, rx: 186, ry: 108 } },
  { id: "winter", x: 5000, y: 2500, size: 1.3, label: true, plaza: { x: 4785, y: 2310, w: 440, h: 380 }, pond: { x: 5210, y: 2760, rx: 168, ry: 96 } },
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
      // very light wobble: borders drift gently instead of zig-zagging
      const sx = (gx + 0.5) * CELL + (rand01(gx * 3.1 + gy * 7.7) - 0.5) * 30;
      const sy = (gy + 0.5) * CELL + (rand01(gx * 5.3 + gy * 2.9 + 11) - 0.5) * 30;
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

  // Heavy border smoothing without ever leaving a gap: blur each region's
  // membership into a soft field, then hand every cell to the strongest
  // field. The partition stays exact while the seams become long arcs.
  {
    const R = REGION_SPECS.length;
    let fields = Array.from({ length: R }, (_, i) =>
      Float32Array.from(out, (o) => (o === i ? 1 : 0)),
    );
    const blur = (src: Float32Array, radius: number) => {
      const tmp = new Float32Array(GX * GY);
      const dst = new Float32Array(GX * GY);
      for (let gy = 0; gy < GY; gy++) {
        for (let gx = 0; gx < GX; gx++) {
          let s = 0;
          let w = 0;
          for (let d = -radius; d <= radius; d++) {
            const nx = Math.max(0, Math.min(GX - 1, gx + d));
            s += src[gy * GX + nx]!;
            w++;
          }
          tmp[gy * GX + gx] = s / w;
        }
      }
      for (let gy = 0; gy < GY; gy++) {
        for (let gx = 0; gx < GX; gx++) {
          let s = 0;
          let w = 0;
          for (let d = -radius; d <= radius; d++) {
            const ny = Math.max(0, Math.min(GY - 1, gy + d));
            s += tmp[ny * GX + gx]!;
            w++;
          }
          dst[gy * GX + gx] = s / w;
        }
      }
      return dst;
    };
    // three box passes ~= a wide Gaussian (roughly 500 world px)
    for (let pass = 0; pass < 3; pass++) fields = fields.map((f) => blur(f, 4));
    for (let c = 0; c < out.length; c++) {
      let win = out[c]!;
      let bestV = -Infinity;
      for (let i = 0; i < R; i++) {
        const v = fields[i]![c]!;
        if (v > bestV) {
          bestV = v;
          win = i;
        }
      }
      out[c] = win;
    }
  }



  // Keep every region a single solid blob: any island of cells that isn't
  // connected to its own seed is handed to the neighbouring region, so no
  // patch of ground is ever left unpainted.
  const seedCell = REGION_SPECS.map((r) => {
    const gx = Math.max(0, Math.min(GX - 1, Math.floor(r.x / CELL)));
    const gy = Math.max(0, Math.min(GY - 1, Math.floor(r.y / CELL)));
    return gy * GX + gx;
  });
  for (let pass = 0; pass < 4; pass++) {
    const seen = new Uint8Array(GX * GY);
    let changed = false;
    for (let start = 0; start < out.length; start++) {
      if (seen[start]) continue;
      const id = out[start]!;
      const comp: number[] = [start];
      const queue = [start];
      seen[start] = 1;
      let hasSeed = seedCell[id] === start;
      while (queue.length) {
        const c = queue.pop()!;
        const cx = c % GX;
        const cy = (c - cx) / GX;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= GX || ny >= GY) continue;
          const ni = ny * GX + nx;
          if (seen[ni] || out[ni] !== id) continue;
          seen[ni] = 1;
          if (seedCell[id] === ni) hasSeed = true;
          comp.push(ni);
          queue.push(ni);
        }
      }
      if (hasSeed) continue;
      // orphan island: give it to whichever region surrounds it most
      const votes = new Map<number, number>();
      for (const c of comp) {
        const cx = c % GX;
        const cy = (c - cx) / GX;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= GX || ny >= GY) continue;
          const o = out[ny * GX + nx]!;
          if (o !== id) votes.set(o, (votes.get(o) ?? 0) + 1);
        }
      }
      let win = id;
      let bestVotes = 0;
      for (const [o, v] of votes) if (v > bestVotes) [win, bestVotes] = [o, v];
      if (win !== id) {
        for (const c of comp) out[c] = win;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
})();


/** grid vertex -> world point, barely nudged, world edges pinned */
function vertex(gx: number, gy: number): [number, number] {
  const amp = 4;
  const x = gx === 0 ? 0 : gx === GX ? WORLD_W : gx * CELL + (rand01(gx * 12.9 + gy * 4.3) - 0.5) * 2 * amp;
  const y = gy === 0 ? 0 : gy === GY ? WORLD_H : gy * CELL + (rand01(gx * 6.7 + gy * 19.1 + 3) - 0.5) * 2 * amp;
  return [x, y];
}

/** snap points that sit on a world edge back onto it exactly */
function pinEdges(pts: [number, number][]): [number, number][] {
  // Wide snap: smoothing rounds off the world corners, which would leave the
  // backdrop showing through. Anything close to an edge is pulled onto it.
  const T = 70;
  return pts.map(([x, y]) => [
    x < T ? 0 : x > WORLD_W - T ? WORLD_W : x,
    y < T ? 0 : y > WORLD_H - T ? WORLD_H : y,
  ] as [number, number]);
}


/** Chaikin corner cutting on a closed loop: staircase -> sweeping curve */
function chaikin(pts: [number, number][], iterations: number): [number, number][] {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    if (cur.length < 4) break;
    const next: [number, number][] = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i]!;
      const b = cur[(i + 1) % cur.length]!;
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    cur = pinEdges(next);
  }
  return cur;
}

/**
 * Windowed averaging along a closed loop. This is what turns the remaining
 * cell-scale kinks into long sweeping arcs. Points that started on a world
 * edge are kept on that edge so regions still reach the map border.
 */
/**
 * Push a closed loop outward along its normals. Wide averaging shrinks a
 * region slightly, which would leave hairline gaps between neighbours; a
 * small outward offset makes them overlap instead.
 */
function inflateLoop(pts: [number, number][], d: number): [number, number][] {
  const n = pts.length;
  if (n < 4) return pts;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n]!;
    const b = pts[(i + 1) % n]!;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    const nx = (ty / len) * sign;
    const ny = (-tx / len) * sign;
    return [
      Math.max(0, Math.min(WORLD_W, p[0] + nx * d)),
      Math.max(0, Math.min(WORLD_H, p[1] + ny * d)),
    ] as [number, number];
  });
}

function smoothLoop(pts: [number, number][], radius: number, passes: number): [number, number][] {
  if (pts.length < radius * 2 + 3) return pts;
  const onLeft = pts.map((p) => p[0] <= 0.5);
  const onRight = pts.map((p) => p[0] >= WORLD_W - 0.5);
  const onTop = pts.map((p) => p[1] <= 0.5);
  const onBottom = pts.map((p) => p[1] >= WORLD_H - 0.5);
  let cur = pts;
  for (let pass = 0; pass < passes; pass++) {
    const n = cur.length;
    const next: [number, number][] = new Array(n);
    for (let i = 0; i < n; i++) {
      let sx = 0;
      let sy = 0;
      let w = 0;
      for (let d = -radius; d <= radius; d++) {
        const p = cur[(i + d + n) % n]!;
        const k = 1 - Math.abs(d) / (radius + 1);
        sx += p[0] * k;
        sy += p[1] * k;
        w += k;
      }
      let x = sx / w;
      let y = sy / w;
      if (onLeft[i]) x = 0;
      if (onRight[i]) x = WORLD_W;
      if (onTop[i]) y = 0;
      if (onBottom[i]) y = WORLD_H;
      next[i] = [x, y];
    }
    cur = next;
  }
  return cur;
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
  if (!best.length) return [[0, 0]];
  // densify with corner cutting, then average over a wide window so the
  // outline becomes long sweeping arcs instead of angled runs
  const cut = chaikin(pinEdges(best), 2);
  return pinEdges(inflateLoop(smoothLoop(cut, 8, 2), 28));
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




/* ------------------------------------------------------------------ */
/* Lakes, jetties & fishing spots                                      */
/* ------------------------------------------------------------------ */

export type LakeStyle = "fields" | "forest" | "winter" | "evil";

export interface JettyDef {
  /** fishing spot id — matches the seeded server-side spot table */
  id: number;
  /** plank walkway from the shore anchor out to the deck end */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** walkway half-width */
  hw: number;
}

export interface LakeDef {
  key: string;
  style: LakeStyle;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** irregular jittered shoreline, world coords */
  poly: [number, number][];
  /** decorative shoreline props (reeds, ice shards, dead trees…) */
  props: { x: number; y: number; t: number }[];
  jetties: JettyDef[];
}

interface LakeSpec {
  key: string;
  style: LakeStyle;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** shoreline roughness 0..1 */
  jitter: number;
  /** outline resolution — fewer points reads as jagged/angular */
  points: number;
  /** whole-lake rotation, radians */
  rot: number;
  /** angles (radians) the jetties reach out from */
  jettyAngles: number[];
}

const LAKE_SPECS: LakeSpec[] = [
  // Peaceful Fields — soft and rounded, bright and open
  { key: "fields", style: "fields", cx: 330, cy: 2780, rx: 168, ry: 104, jitter: 0.1, points: 26, rot: 0.15, jettyAngles: [-0.55, 2.5] },
  // Lush Forest — narrow and elongated, shaded by the canopy
  { key: "forest", style: "forest", cx: 1540, cy: 1180, rx: 210, ry: 78, jitter: 0.16, points: 22, rot: -0.42, jettyAngles: [1.25, 4.3] },
  // Winter Mountain — angular, ice-rimmed
  { key: "winter", style: "winter", cx: 5210, cy: 2760, rx: 168, ry: 96, jitter: 0.26, points: 13, rot: 0.3, jettyAngles: [-1.05] },
  // Evil Woods — murky and misshapen
  { key: "evil", style: "evil", cx: 4420, cy: 1830, rx: 186, ry: 108, jitter: 0.22, points: 17, rot: -0.2, jettyAngles: [2.15] },
];

/** the same jittered-outline trick the biome patches use, applied to water */
function lakeOutline(s: LakeSpec, seed: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < s.points; i++) {
    const a = (i / s.points) * Math.PI * 2;
    const wob = 1 + (rand01(seed + i * 7.13) - 0.5) * 2 * s.jitter + Math.sin(a * 3 + seed) * s.jitter * 0.4;
    const lx = Math.cos(a) * s.rx * wob;
    const ly = Math.sin(a) * s.ry * wob;
    pts.push([
      s.cx + lx * Math.cos(s.rot) - ly * Math.sin(s.rot),
      s.cy + lx * Math.sin(s.rot) + ly * Math.cos(s.rot),
    ]);
  }
  return pts;
}

/** point on the lake edge at an angle, scaled outward/inward by `k` */
function lakePoint(s: LakeSpec, a: number, k: number): [number, number] {
  const lx = Math.cos(a) * s.rx * k;
  const ly = Math.sin(a) * s.ry * k;
  return [
    s.cx + lx * Math.cos(s.rot) - ly * Math.sin(s.rot),
    s.cy + lx * Math.sin(s.rot) + ly * Math.cos(s.rot),
  ];
}

let spotId = 0;
export const LAKES: LakeDef[] = LAKE_SPECS.map((s, si) => {
  const seed = 41 + si * 17;
  const props: { x: number; y: number; t: number }[] = [];
  const propCount = s.style === "winter" ? 10 : s.style === "evil" ? 7 : 12;
  for (let i = 0; i < propCount; i++) {
    const a = (i / propCount) * Math.PI * 2 + rand01(seed + i) * 0.3;
    const [x, y] = lakePoint(s, a, 0.94 + rand01(seed + i * 3.1) * 0.16);
    props.push({ x, y, t: rand01(seed + i * 5.7) });
  }
  const jetties = s.jettyAngles.map((a) => {
    const [x1, y1] = lakePoint(s, a, 1.16);
    const [x2, y2] = lakePoint(s, a, 0.42);
    return { id: ++spotId, x1, y1, x2, y2, hw: 20 };
  });
  return { key: s.key, style: s.style, cx: s.cx, cy: s.cy, rx: s.rx, ry: s.ry, poly: lakeOutline(s, seed), props, jetties };
});

export interface FishingSpot {
  id: number;
  /** deck end of the jetty — where the player stands to cast */
  x: number;
  y: number;
  lake: string;
}

export const FISHING_SPOTS: FishingSpot[] = LAKES.flatMap((l) =>
  l.jetties.map((j) => ({ id: j.id, x: j.x2, y: j.y2, lake: l.key })),
);

/** seconds a cast takes before the catch is rolled */
export const FISH_CAST_TIME = 3.5;

export interface FishTier {
  id: ItemId;
  xp: number;
  /** rarity rank, 1 = most common … 5 = rarest (mirrors the cooking recipe tiers) */
  rank: 1 | 2 | 3 | 4 | 5;
}

/**
 * Rarity order comes straight from the cooking ladder:
 * Honey Bun (lv1) ← minnow, Berry Pie (lv15) ← trout, Hearty Stew (lv40) ← koi,
 * Frost Tonic (lv70) ← eel, Phoenix Fillet (lv100) ← starlight salmon.
 */
export const FISH_TABLE: FishTier[] = [
  { id: "river_minnow", xp: 15, rank: 1 },
  { id: "silver_trout", xp: 45, rank: 2 },
  { id: "golden_koi", xp: 140, rank: 3 },
  { id: "deepwater_eel", xp: 380, rank: 4 },
  { id: "starlight_salmon", xp: 900, rank: 5 },
];

/** drop chance in % at level 1, ordered by rarity rank */
const FISH_START_PCT = [90, 4, 3, 2, 1];
/** drop chance in % at level 100+ — flat across all five fish */
const FISH_END_PCT = [20, 20, 20, 20, 20];

/** Percentage chance of catching each fish at a given fishing level (uncapped input). */
export function fishChances(level: number): { id: ItemId; pct: number }[] {
  const t = (Math.min(Math.max(Math.floor(level), 1), 100) - 1) / 99;
  return FISH_TABLE.map((f, i) => ({
    id: f.id,
    pct: FISH_START_PCT[i]! + t * (FISH_END_PCT[i]! - FISH_START_PCT[i]!),
  }));
}

/** Roll a weighted catch for the given fishing level. */
export function rollFish(level: number): FishTier {
  const chances = fishChances(level);
  const total = chances.reduce((s, c) => s + c.pct, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < chances.length; i++) {
    roll -= chances[i]!.pct;
    if (roll <= 0) return FISH_TABLE[i]!;
  }
  return FISH_TABLE[0]!;
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
  copper: { name: "Copper Rock", skill: "mining", shape: "rock", xp: 18, item: "copper_ore", time: 3.2, respawn: 36, req: 1, color: "#b8a999", accent: "#e0955f" },
  oak: { name: "Oak Tree", skill: "woodcutting", shape: "tree", xp: 16, item: "oak_logs", time: 3.0, respawn: 32, req: 1, color: "#8a6a45", accent: "#79c46b" },
  flax: { name: "Flax Patch", skill: "gathering", shape: "bush", xp: 14, item: "flax", time: 2.4, respawn: 28, req: 1, color: "#9ec27a", accent: "#e6e0a6" },
  berries: { name: "Berry Bush", skill: "gathering", shape: "bush", xp: 20, item: "meadow_berries", time: 2.8, respawn: 32, req: 3, color: "#6fa85c", accent: "#f19bb0" },
  iron: { name: "Iron Rock", skill: "mining", shape: "rock", xp: 42, item: "iron_ore", time: 4.0, respawn: 44, req: 15, color: "#9c948c", accent: "#b0a49b" },
  willow: { name: "Willow Tree", skill: "woodcutting", shape: "tree", xp: 38, item: "willow_logs", time: 3.8, respawn: 40, req: 15, color: "#7b6a4a", accent: "#a8b87a" },
  maple: { name: "Maple Tree", skill: "woodcutting", shape: "tree", xp: 60, item: "maple_logs", time: 4.4, respawn: 48, req: 28, color: "#7a5236", accent: "#d59470" },
  herbs: { name: "Herb Cluster", skill: "gathering", shape: "bush", xp: 48, item: "forest_herbs", time: 3.4, respawn: 40, req: 18, color: "#3f8f6a", accent: "#8fd6a0" },
  sandstone: { name: "Sandstone Vein", skill: "mining", shape: "rock", xp: 90, item: "sandstone", time: 4.6, respawn: 48, req: 40, color: "#d3bb88", accent: "#e6cf9a" },
  mithril: { name: "Mithril Vein", skill: "mining", shape: "rock", xp: 140, item: "mithril_ore", time: 5.4, respawn: 60, req: 50, color: "#8fa6bb", accent: "#9fc4e8" },
  palm: { name: "Desert Palm", skill: "woodcutting", shape: "tree", xp: 120, item: "palm_logs", time: 5.0, respawn: 56, req: 45, color: "#a8834e", accent: "#d8bb7c" },
  bloom: { name: "Desert Bloom", skill: "gathering", shape: "bush", xp: 110, item: "desert_bloom", time: 4.0, respawn: 48, req: 42, color: "#c79b56", accent: "#f4c66b" },
  cursed_rock: { name: "Cursed Rock", skill: "mining", shape: "rock", xp: 240, item: "cursed_shard", time: 6.0, respawn: 68, req: 70, color: "#6b5b93", accent: "#b58ce0" },
  cursed_tree: { name: "Cursed Tree", skill: "woodcutting", shape: "tree", xp: 230, item: "cursed_bark", time: 6.0, respawn: 68, req: 70, color: "#4a3c6d", accent: "#8f7bb0" },
  gloomcap: { name: "Gloomcap", skill: "gathering", shape: "bush", xp: 210, item: "gloomcap", time: 4.8, respawn: 56, req: 68, color: "#3f3460", accent: "#c39ae8" },
  runite: { name: "Runite Vein", skill: "mining", shape: "rock", xp: 420, item: "runite_ore", time: 7.0, respawn: 80, req: 100, color: "#7d9fa8", accent: "#8fe0d0" },
  tungsten: { name: "Tungsten Vein", skill: "mining", shape: "rock", xp: 520, item: "tungsten_ore", time: 7.6, respawn: 88, req: 110, color: "#98a2b5", accent: "#c8cfe0" },
  frostpine: { name: "Frostpine", skill: "woodcutting", shape: "tree", xp: 400, item: "frostpine_logs", time: 6.8, respawn: 76, req: 100, color: "#6f8798", accent: "#a9d8e6" },
  lichen: { name: "Frost Lichen", skill: "gathering", shape: "bush", xp: 380, item: "frost_lichen", time: 5.4, respawn: 64, req: 98, color: "#8bb0c4", accent: "#cfeaf5" },
};

export interface NodeSpawn {
  kind: NodeKind;
  x: number;
  y: number;
}

/**
 * Spawns are generated at the bottom of this file, once the world geometry
 * (biomes, lakes, barriers, buildings and roads) is known — every node is
 * placed inside the biome it belongs to and clear of anything solid.
 */
export const NODE_SPAWNS: NodeSpawn[] = [];


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
  | "frost_giant"
  | "disgruntled_ram"
  | "forest_boar"
  | "forest_lynx"
  | "dust_jackal"
  | "scorpion_stalker"
  | "withered_ghoul"
  | "bone_reaper"
  | "frost_wolf"
  | "ice_wraith"
  | "ancient_frost_wyrm";

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
  // Phase 2 additions — fill the difficulty-curve gaps between neighbours.
  disgruntled_ram: { name: "Disgruntled Ram", hp: 13, attack: 3, defense: 1, xp: 20, gold: [2, 7], drop: "ram_horn", dropChance: 0.45, hide: "raw_hide", hideXp: 20, body: "#f0ead6", accent: "#c9a876", size: 1.05, ears: "horns" },
  forest_boar: { name: "Forest Boar", hp: 36, attack: 7, defense: 3, xp: 57, gold: [6, 17], drop: "boar_tusk", dropChance: 0.45, hide: "raw_hide", hideXp: 28, body: "#8a6a45", accent: "#e6ddc8", size: 1.15, ears: "spikes" },
  forest_lynx: { name: "Forest Lynx", hp: 88, attack: 15, defense: 7, xp: 141, gold: [15, 34], drop: "lynx_claw", dropChance: 0.45, hide: "thick_hide", hideXp: 65, body: "#b8a888", accent: "#6b5a42", size: 1.15, ears: "horns" },
  dust_jackal: { name: "Dust Jackal", hp: 184, attack: 26, defense: 13, xp: 300, gold: [31, 68], drop: "jackal_fang", dropChance: 0.45, hide: "thick_hide", hideXp: 130, body: "#d4b382", accent: "#7a5c3a", size: 1.1, ears: "horns" },
  scorpion_stalker: { name: "Scorpion Stalker", hp: 288, attack: 38, defense: 20, xp: 473, gold: [56, 123], drop: "scorpion_stinger", dropChance: 0.45, hide: "scale_hide", hideXp: 180, body: "#c9963f", accent: "#5a4020", size: 1.25, ears: "spikes" },
  withered_ghoul: { name: "Withered Ghoul", hp: 445, attack: 53, defense: 27, xp: 714, gold: [92, 200], drop: "ghoul_essence", dropChance: 0.45, hide: "shadow_pelt", hideXp: 250, body: "#7a8a6e", accent: "#3f4a38", size: 1.2, ears: "none" },
  bone_reaper: { name: "Bone Reaper", hp: 713, attack: 76, defense: 38, xp: 1129, gold: [139, 283], drop: "reaper_bone", dropChance: 0.45, hide: "shadow_pelt", hideXp: 400, body: "#e8e0d0", accent: "#2b2b35", size: 1.3, ears: "spikes" },
  frost_wolf: { name: "Frost Wolf", hp: 1109, attack: 105, defense: 51, xp: 1766, gold: [212, 408], drop: "frost_fang", dropChance: 0.45, hide: "frost_pelt", hideXp: 600, body: "#dceaf5", accent: "#8fb8d4", size: 1.2, ears: "horns" },
  ice_wraith: { name: "Ice Wraith", hp: 1817, attack: 146, defense: 70, xp: 2857, gold: [335, 637], drop: "wraith_ice_core", dropChance: 0.45, hide: "frost_pelt", hideXp: 800, body: "#cfe8f5", accent: "#5f9ec4", size: 1.35, ears: "spikes" },
  ancient_frost_wyrm: { name: "Ancient Frost Wyrm", hp: 3080, attack: 210, defense: 95, xp: 4760, gold: [560, 1092], drop: "wyrm_scale", dropChance: 0.45, hide: "frost_pelt", hideXp: 1000, body: "#a8d4e8", accent: "#5a6fa0", size: 1.9, ears: "spikes" },
};

/** Approximate combat level derived from a monster's HP and attack. */
export function monsterLevel(md: MonsterDefT): number {
  return Math.max(1, Math.round((md.hp + md.attack * 2) / 24));
}

export interface MonsterSpawn {
  kind: MonsterKind;
  x: number;
  y: number;
}

/** Filled in by the spawn generator at the bottom of this file. */
export const MONSTER_SPAWNS: MonsterSpawn[] = [];

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
  /** crooked towns lean their houses; radians, 0 for every orderly city */
  rot?: number;
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
  /** walled cities use an organic ring plan instead of the crossroads grid */
  rings?: number[];
  /** the walled-city geometry this town is laid out inside */
  city?: CityDef;
  /** lay the houses out crookedly, at odd angles, with maze-like alleys */
  crooked?: boolean;
  count: number;
  wall: string;
  beam: string;
  roofs: string[];
  anchors: { role: string; name: string; kind: BuildingKind }[];
  fill: { name: string; kind: BuildingKind }[];
}

const TOWN_SPECS: TownSpec[] = [
  {
    cx: CITY.cx,
    cy: CITY.cy,
    rings: CITY.ringR,
    city: CITY,
    count: 14,
    wall: "#fdf1dd",
    beam: "#8b6b52",
    roofs: ["#d98b6a", "#c9a7e0", "#8fbfd9", "#c08d68", "#b7906d"],
    anchors: [
      { role: "smith", name: "Haven Smeltery", kind: "forge" },
      { role: "merchant", name: "Market Stall", kind: "stall" },
      { role: "elder", name: "Moot Hall", kind: "chapel" },
      { role: "haven_weaponsmith", name: "Haven Forge", kind: "forge" },
      { role: "haven_armourer", name: "Shieldwright's Hall", kind: "forge" },
      { role: "haven_upgrader", name: "Whetstone Tower", kind: "tower" },
      { role: "haven_exchange", name: "Grand Market", kind: "stall" },
      { role: "haven_banker", name: "Haven Vault", kind: "chapel" },
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
    cx: SUNSPIRE.cx,
    cy: SUNSPIRE.cy,
    rings: SUNSPIRE.ringR,
    city: SUNSPIRE,
    count: 13,
    wall: "#fdf0d4",
    beam: "#a8834e",
    roofs: ["#f0c268", "#e8b3d8", "#d9a95f", "#e0b070", "#caa063"],
    anchors: [
      { role: "sun_smith", name: "Sunspire Smeltery", kind: "forge" },
      { role: "weaver", name: "Arcane Loom", kind: "tower" },
      { role: "banker", name: "Golden Bank", kind: "chapel" },
      { role: "sun_weaponsmith", name: "Sunspire Forge", kind: "forge" },
      { role: "sun_alchemist", name: "Amber Apothecary", kind: "tower" },
      { role: "sun_exchange", name: "Sunspire Grand Market", kind: "stall" },
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
    cx: WILLOWBROOK.cx,
    cy: WILLOWBROOK.cy,
    rings: WILLOWBROOK.ringR,
    city: WILLOWBROOK,
    count: 12,
    wall: "#f5f0da",
    beam: "#6f5636",
    roofs: ["#7fbd93", "#b98a5c", "#95c9a4", "#8aa86d", "#6fae86"],
    anchors: [
      { role: "trapper", name: "Trapper's Hut", kind: "house" },
      { role: "brook_chef", name: "Willow Kitchen", kind: "house" },
      { role: "brook_exchange", name: "Brookside Grand Market", kind: "stall" },
      { role: "brook_banker", name: "Brookside Vault", kind: "chapel" },
    ],
    fill: [
      { name: "Woodcutter's Lodge", kind: "barn" },
      { name: "Herb Stall", kind: "stall" },
      { name: "Willow Shrine", kind: "chapel" },
      { name: "Canopy Roost", kind: "tower" },
      { name: "Bowyer's Perch", kind: "house" },
      { name: "Ranger's Watch", kind: "tower" },
      { name: "Mossbarn", kind: "barn" },
      { name: "Fletcher's Stall", kind: "stall" },
    ],
  },
  {
    cx: FROSTFORGE.cx,
    cy: FROSTFORGE.cy,
    rings: FROSTFORGE.ringR,
    city: FROSTFORGE,
    count: 12,
    wall: "#f2f7fd",
    beam: "#6d7f92",
    roofs: ["#8fb6d9", "#a9c6e6", "#9fb6cc", "#87a7c4", "#b9d4ea"],
    anchors: [
      { role: "frost_smith", name: "Frostforge Smeltery", kind: "forge" },
      { role: "frost_weaponsmith", name: "Frostforge", kind: "forge" },
      { role: "frost_exchange", name: "Frostmarket Hall", kind: "stall" },
      { role: "frost_banker", name: "Frostforge Vault", kind: "chapel" },
    ],
    fill: [
      { name: "Hearthspur Lodge", kind: "inn" },
      { name: "Ice Cellar", kind: "barn" },
      { name: "Furrier's Stall", kind: "stall" },
      { name: "Snow Chapel", kind: "chapel" },
      { name: "Rimewatch Tower", kind: "tower" },
      { name: "Glacier Granary", kind: "barn" },
      { name: "Icecutter's House", kind: "house" },
      { name: "Skald's Rest", kind: "house" },
      { name: "Frostwatch Spire", kind: "tower" },
    ],
  },
  {
    cx: DUSKMERE.cx,
    cy: DUSKMERE.cy,
    rings: DUSKMERE.ringR,
    city: DUSKMERE,
    crooked: true,
    count: 14,
    wall: "#4a4453",
    beam: "#241f2c",
    roofs: ["#2e2836", "#3a3143", "#26222f", "#453a4e", "#332b3d"],
    anchors: [
      { role: "dusk_exchange", name: "Gravehollow Exchange", kind: "stall" },
      { role: "dusk_banker", name: "Gravehollow Vault", kind: "chapel" },
    ],
    fill: [
      { name: "The Hollow Bell", kind: "inn" },
      { name: "Gravedigger's Shed", kind: "barn" },
      { name: "Ossuary", kind: "chapel" },
      { name: "Bell Tower", kind: "tower" },
      { name: "Crooked House", kind: "house" },
      { name: "Leaning House", kind: "house" },
      { name: "The Shuttered Shop", kind: "stall" },
      { name: "Candlemaker's", kind: "house" },
      { name: "Mourner's Rest", kind: "house" },
      { name: "Charnel Store", kind: "barn" },
      { name: "Watch of Crows", kind: "tower" },
      { name: "Sagging Almshouse", kind: "house" },
      { name: "Rotten Stall", kind: "stall" },
      { name: "The Last House", kind: "house" },
    ],
  },
];


const buildings: BuildingDef[] = [];
const streets: StreetDef[] = [];
const npcSpots: Record<string, { x: number; y: number }> = {};

/** true when a bearing sits in a gate's approach corridor — kept build-free */
function inGateCorridor(a: number, c: CityDef) {
  return cityGateAt(a, c) !== null || cityGateAt(a + 0.2, c) !== null || cityGateAt(a - 0.2, c) !== null;
}

for (const t of TOWN_SPECS) {
  if (t.crooked && t.city) {
    // ---- the Gravehollow: no ring plan at all. Houses are dropped wherever
    // they fit at whatever angle they've settled to, leaving the crooked,
    // deliberately confusing alleys Duskmere is known for.
    const city = t.city;
    const plan = [...t.anchors, ...t.fill].slice(0, t.count);
    const gy = city.graveyard;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    // walk the ring in slots so every house gets a plot, then jitter each one
    // hard enough that no two lanes between them ever line up
    const slots = plan.length;
    plan.forEach((p, i) => {
      const kind = p.kind;
      const w = kind === "tower" ? 76 : kind === "stall" ? 84 : 88 + ((i * 13) % 22);
      const h = kind === "tower" ? 108 : kind === "stall" ? 62 : 70 + ((i * 7) % 18);
      let spot: { x: number; y: number } | null = null;
      const baseA = (i / slots) * Math.PI * 2 + 0.35;
      for (let tryI = 0; tryI < 1400 && !spot; tryI++) {
        const s = i * 17.3 + tryI * 1.7;
        // search outward from this house's own slot, drifting as tries mount
        const a = baseA + (rand01(s) - 0.5) * ((Math.PI * 2) / slots) * (1 + tryI * 0.06);
        const r = city.plazaR + 44 + rand01(s + 91) * (city.wallR - city.plazaR - 96);
        const x = city.cx + Math.cos(a) * r;
        const y = city.cy + Math.sin(a) * r;
        if (inGateCorridor(a, city) || cityGateAt(a + 0.18, city) || cityGateAt(a - 0.18, city)) continue;
        if (onMonument(x, y, Math.max(w, h) / 2 + 26)) continue;
        if (gy) {
          const gx = city.cx + gy.dx;
          const gyy = city.cy + gy.dy;
          if (Math.abs(x - gx) < gy.rx + w / 2 + 16 && Math.abs(y - gyy) < gy.ry + h / 2 + 16) continue;
        }
        // narrow alleys: neighbours may crowd in, but never overlap
        const alley = 12 + rand01(s + 33) * 14;
        const clash = placed.some(
          (b) =>
            Math.abs(b.x - x) < (b.w + w) / 2 + alley && Math.abs(b.y - y) < (b.h + h) / 2 + alley,
        );
        if (clash) continue;
        spot = { x, y };
      }
      if (!spot) return;

      placed.push({ x: spot.x, y: spot.y, w, h });
      const pRole = (p as { role?: string }).role;
      if (pRole) npcSpots[pRole] = { x: spot.x, y: spot.y + h / 2 + 26 };
      buildings.push({
        name: p.name,
        kind,
        x: spot.x - w / 2,
        y: spot.y - h / 2,
        w,
        h,
        roof: t.roofs[i % t.roofs.length]!,
        wall: t.wall,
        beam: t.beam,
        rot: (rand01(i * 5.9 + 2) - 0.5) * 0.42,
      });
    });
    continue;
  }
  if (t.rings && t.city) {
    const city = t.city;
    // ---- walled city: buildings ring an open plaza, gate corridors left clear
    const plan = [...t.anchors, ...t.fill].slice(0, t.count);
    const perRing = [Math.ceil(plan.length * 0.42), plan.length - Math.ceil(plan.length * 0.42)];
    let idx = 0;
    t.rings.forEach((ringR, ri) => {
      const n = perRing[ri] ?? 0;
      for (let k = 0; k < n; k++) {
        const p = plan[idx];
        if (!p) break;
        let a = (k / n) * Math.PI * 2 + (ri === 0 ? 0.35 : 0.16) + rand01(idx * 3.7 + ri) * 0.12;
        for (let guard = 0; guard < 24 && inGateCorridor(a, city); guard++) a += 0.09;
        const kind = p.kind;
        const w = kind === "tower" ? 96 : kind === "stall" ? 104 : LOT_W;
        const h = kind === "tower" ? 118 : kind === "stall" ? 74 : LOT_H;
        // stagger neighbours in and out so houses never sit shoulder to shoulder
        let r = ringR + (k % 2 ? 15 : -15) + (rand01(idx * 5.1 + 3) - 0.5) * 18;
        // and always leave a clear lane between the houses and the city wall
        const maxR = cityWallR(a, city) - city.wallT / 2 - Math.max(w, h) / 2 - 26;
        if (r > maxR) r = maxR;
        const bx = t.cx + Math.cos(a) * r - w / 2;
        const by = t.cy + Math.sin(a) * r - h / 2;
        buildings.push({
          name: p.name,
          kind,
          x: bx,
          y: by,
          w,
          h,
          roof: t.roofs[idx % t.roofs.length]!,
          wall: t.wall,
          beam: t.beam,
        });
        const role = (p as { role?: string }).role;
        if (role) {
          // traders stand on the plaza side of their own building
          let sr = Math.max(city.plazaR + 54, r - h / 2 - 46);
          let sa = a;
          for (let guard = 0; guard < 30; guard++) {
            const sx = t.cx + Math.cos(sa) * sr;
            const sy = t.cy + Math.sin(sa) * sr;
            const clash = Object.values(npcSpots).some((s) => Math.hypot(s.x - sx, s.y - sy) < 120);
            if (!clash) break;
            sa += 0.13;
          }
          npcSpots[role] = { x: t.cx + Math.cos(sa) * sr, y: t.cy + Math.sin(sa) * sr };
        }
        idx++;
      }
    });
    continue;
  }

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
  const chosen = lots.slice(0, t.count);
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

// Grand Haven is being rebuilt from external pixel-art assets: clear every
// procedurally drawn structure inside its walls. Traders keep their plaza
// spots (re-seated just below).
{
  const gh = GRAND_HAVEN;
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i]!;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (Math.hypot(cx - gh.cx, cy - gh.cy) <= cityOuterR(gh)) buildings.splice(i, 1);
  }
}

// A trader may end up standing where a later building landed; seat every city

// trader evenly around its plaza on clear cobbles.
{
  const onBuilding = (x: number, y: number) =>
    buildings.some(
      (b) => x > b.x - 18 && x < b.x + b.w + 18 && y > b.y - 18 && y < b.y + b.h + 18,
    );
  for (const city of CITIES) {
    const inCity = Object.entries(npcSpots).filter(
      ([, s]) => Math.hypot(s.x - city.cx, s.y - city.cy) <= cityOuterR(city),
    );
    if (!inCity.length) continue;
    inCity.sort(
      (p, q) =>
        Math.atan2(p[1].y - city.cy, p[1].x - city.cx) - Math.atan2(q[1].y - city.cy, q[1].x - city.cx),
    );
    // the oasis (Sunspire) and the Great Oak Hall (Willowbrook) eat the middle
    // of the plaza, so traders ring them a little wider
    const centreFilled =
      !!city.oasis || city.monument?.kind === "oakhall" || city.monument?.kind === "frozenhall";
    const r0 = city.plazaR + (centreFilled ? 34 : 58);
    const taken: { x: number; y: number }[] = [];
    inCity.forEach(([role], i) => {
      const base = (i / inCity.length) * Math.PI * 2 + 0.25;
      let best = { x: city.cx + Math.cos(base) * r0, y: city.cy + Math.sin(base) * r0, score: -1e9 };
      for (let da = -0.55; da <= 0.55; da += 0.05) {
        for (const dr of [0, 26, -22, 48]) {
          const a = base + da;
          const r = r0 + dr;
          const x = city.cx + Math.cos(a) * r;
          const y = city.cy + Math.sin(a) * r;
          if (onBuilding(x, y) || inCityOasis(x, y, 18) || onMonument(x, y, 18)) continue;
          const gap = taken.length ? Math.min(...taken.map((t) => Math.hypot(t.x - x, t.y - y))) : 400;
          const score = Math.min(gap, 150) - Math.abs(da) * 40 - Math.abs(dr) * 0.2;
          if (score > best.score) best = { x, y, score };
        }
      }
      taken.push({ x: best.x, y: best.y });
      npcSpots[role] = { x: best.x, y: best.y };
    });
  }
}

export const BUILDINGS: BuildingDef[] = buildings;
export const STREETS: StreetDef[] = streets;

/**
 * Standalone landmark structures drawn from a pixel-art sprite. `x`/`y` is the
 * centre of the image; the solid footprint is the lower stonework only, so the
 * roof and spire overlap freely.
 */
export interface LandmarkDef {
  id: string;
  /** centre of the sprite, world coords */
  x: number;
  y: number;
  w: number;
  h: number;
  /** solid box, relative to the sprite centre */
  solid: { dx: number; dy: number; w: number; h: number };
}

export const LANDMARKS: LandmarkDef[] = [
  {
    id: "monastery",
    x: 2605,
    y: 3012,
    w: 192,
    h: 320,
    solid: { dx: 0, dy: 78, w: 160, h: 150 },
  },
];

/** true when the point sits inside a landmark's solid footprint */
export function onLandmark(x: number, y: number, pad = 0): boolean {
  for (const l of LANDMARKS) {
    const cx = l.x + l.solid.dx;
    const cy = l.y + l.solid.dy;
    if (Math.abs(x - cx) < l.solid.w / 2 + pad && Math.abs(y - cy) < l.solid.h / 2 + pad) return true;
  }
  return false;
}

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
  | "frost_smith"
  | "haven_weaponsmith"
  | "haven_armourer"
  | "haven_upgrader"
  | "sun_weaponsmith"
  | "sun_alchemist"
  | "brook_chef"
  | "frost_weaponsmith"
  | "haven_exchange"
  | "sun_exchange"
  | "brook_exchange"
  | "frost_exchange"
  | "dusk_exchange"
  | "haven_banker"
  | "brook_banker"
  | "frost_banker"
  | "dusk_banker";

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
  services: (
    | "shop"
    | "sell"
    | "bank"
    | "exchange"
    | "quests"
    | "smelt"
    | "forge"
    | "weave"
    | "armor"
    | "skin"
    | "cook"
    | "alchemy"
    | "upgrade"
  )[];
}

export const NPCS: NpcDef[] = [
  { id: "smith", name: "Bruna", title: "Haven Smelter", ...spot("smith", 625, 420), robe: "#d98b6a", hair: "#5c3a2e", greeting: "Ore in, bars out. That's the whole of it.", services: ["smelt"] },
  { id: "merchant", name: "Pip", title: "Market Trader", ...spot("merchant", 782, 442), robe: "#8fbfd9", hair: "#3f5f78", greeting: "Ore, logs, feathers — I'll take the lot.", services: ["sell"] },
  { id: "elder", name: "Elder Maren", title: "Village Elder", ...spot("elder", 712, 300), robe: "#c9a7e0", hair: "#e6e0ef", greeting: "Grand Haven could use a hand today.", services: ["quests"] },
  { id: "sun_smith", name: "Master Alric", title: "Sunspire Smelter", ...spot("sun_smith", TILE_W * 2 + 735, 350), robe: "#f0c268", hair: "#8a6a45", greeting: "Mithril sings once the dross burns away.", services: ["smelt"] },
  { id: "weaver", name: "Lira", title: "Arcane Weaver", ...spot("weaver", TILE_W * 2 + 905, 420), robe: "#e8b3d8", hair: "#6b4f7a", greeting: "Bring me fibre and I'll bring you silk.", services: ["weave"] },
  { id: "banker", name: "Coinmaster Odo", title: "Golden Bank", ...spot("banker", TILE_W * 2 + 565, 440), robe: "#d9a95f", hair: "#4a3b2e", greeting: "Every scrap has a price, friend.", services: ["bank"] },
  { id: "trapper", name: "Rook", title: "Trapper", ...spot("trapper", TILE_W + 728, 590), robe: "#b98a5c", hair: "#3f2f22", greeting: "Hides into leather — that's my trade.", services: ["skin"] },
  { id: "frost_smith", name: "Sigrid", title: "Frostforge Smelter", ...spot("frost_smith", 882, TILE_H + 560), robe: "#a9c6e6", hair: "#e6eef7", greeting: "The furnace never sleeps in the cold.", services: ["smelt"] },
  { id: "haven_weaponsmith", name: "Garrick", title: "Weaponsmith", ...spot("haven_weaponsmith", 560, 300), robe: "#c2765a", hair: "#402a20", greeting: "Give me bars and I'll give you an edge.", services: ["forge"] },
  { id: "haven_armourer", name: "Dame Ysolde", title: "Armourer", ...spot("haven_armourer", 870, 300), robe: "#9aa7b8", hair: "#6b5540", greeting: "Plate, mail or robe — I'll fit you proper.", services: ["armor"] },
  { id: "haven_upgrader", name: "Old Whetstone Tam", title: "Gear Upgrader", ...spot("haven_upgrader", 640, 210), robe: "#b7a06d", hair: "#d8d2c4", greeting: "Every notch I grind makes you harder to kill.", services: ["upgrade"] },
  { id: "sun_weaponsmith", name: "Zafira", title: "Weaponsmith", ...spot("sun_weaponsmith", TILE_W * 2 + 600, 300), robe: "#e09a4f", hair: "#4a3324", greeting: "Sun-tempered steel, hammered to sing.", services: ["forge"] },
  { id: "sun_alchemist", name: "Nasrin", title: "Alchemist", ...spot("sun_alchemist", TILE_W * 2 + 790, 300), robe: "#a7d9c2", hair: "#5a4470", greeting: "One drop of this and your blade bites twice.", services: ["alchemy"] },
  { id: "brook_chef", name: "Chef Bramble", title: "Willowbrook Chef", ...spot("brook_chef", TILE_W + 650, 540), robe: "#c9d97f", hair: "#7a5a34", greeting: "Fresh catch? I'll turn it into something warm.", services: ["cook"] },
  { id: "frost_weaponsmith", name: "Halvar", title: "Weaponsmith", ...spot("frost_weaponsmith", 720, TILE_H + 560), robe: "#7f9cbd", hair: "#c9d8e6", greeting: "Cold iron, hot hammer. Stand back.", services: ["forge"] },
  { id: "haven_exchange", name: "Clerk Tobin", title: "Grand Market", ...spot("haven_exchange", 800, 300), robe: "#cbb98f", hair: "#5a4a35", greeting: "Ledgers open, offers posted. What'll it be?", services: ["exchange"] },
  { id: "sun_exchange", name: "Clerk Amara", title: "Grand Market", ...spot("sun_exchange", TILE_W * 2 + 680, 300), robe: "#e8c98d", hair: "#4d3a26", greeting: "Every caravan's price, all in one book.", services: ["exchange"] },
  { id: "brook_exchange", name: "Clerk Nessa", title: "Grand Market", ...spot("brook_exchange", TILE_W + 700, 540), robe: "#a8cf9b", hair: "#6b5233", greeting: "Small village, big ledger. Trade away.", services: ["exchange"] },
  { id: "frost_exchange", name: "Clerk Bjorn", title: "Grand Market", ...spot("frost_exchange", 640, TILE_H + 560), robe: "#b6cbe0", hair: "#dfe8f2", greeting: "Frost keeps the coin cold and the deals honest.", services: ["exchange"] },
  { id: "dusk_exchange", name: "Clerk Mordrey", title: "Grand Market", ...spot("dusk_exchange", 4400, 1400), robe: "#9a86b3", hair: "#2b2533", greeting: "The dead keep no ledgers. The living pay up front.", services: ["exchange"] },
  { id: "haven_banker", name: "Coinmaster Bell", title: "Banker", ...spot("haven_banker", 900, 400), robe: "#d9c07a", hair: "#4a3b2e", greeting: "Your vault travels with you — same coin, any town.", services: ["bank"] },
  { id: "brook_banker", name: "Coinmaster Wisp", title: "Banker", ...spot("brook_banker", TILE_W + 610, 620), robe: "#bfd9a0", hair: "#6b5233", greeting: "One vault, every branch. Deposit away.", services: ["bank"] },
  { id: "frost_banker", name: "Coinmaster Hilda", title: "Banker", ...spot("frost_banker", 800, TILE_H + 620), robe: "#c6dcef", hair: "#e6eef7", greeting: "The ice keeps your coin safe wherever you wander.", services: ["bank"] },
  { id: "dusk_banker", name: "Coinmaster Vex", title: "Banker", ...spot("dusk_banker", 4460, 1300), robe: "#a08cb8", hair: "#2b2533", greeting: "Same vault, darker vault-keeper. Deposit if you dare.", services: ["bank"] },
];



export const SHOP_STOCK: Record<NpcRole, { id: ItemId; price: number }[]> = {
  // NPCs sell nothing at all — gear, food and potions must be player-crafted
  // (or traded between players on the marketplace).
  smith: [],
  merchant: [],
  elder: [],
  sun_smith: [],
  weaver: [],
  banker: [],
  haven_banker: [],
  brook_banker: [],
  frost_banker: [],
  dusk_banker: [],
  haven_exchange: [],
  sun_exchange: [],
  brook_exchange: [],
  frost_exchange: [],
  dusk_exchange: [],
  trapper: [],
  frost_smith: [],
  haven_weaponsmith: [],
  haven_armourer: [],
  haven_upgrader: [],
  sun_weaponsmith: [],
  sun_alchemist: [],
  brook_chef: [],
  frost_weaponsmith: [],
};



/* ------------------------------------------------------------------ */
/* Crafting                                                            */
/* ------------------------------------------------------------------ */

/** which specialist NPC exposes a recipe (independent of the skill it trains) */
export type CraftStation = "smelt" | "forge" | "weave" | "armor" | "skin" | "cook" | "alchemy";

export interface Recipe {
  id: string;
  skill: Extract<SkillId, "smithing" | "tailoring" | "skinning" | "cooking" | "alchemy">;
  /** the specialist NPC service that offers this recipe */
  station: CraftStation;
  out: ItemId;
  outQty: number;
  inputs: { id: ItemId; qty: number }[];
  req: number;
  xp: number;
  time: number;
}

export const RECIPES: Recipe[] = [
  // Smithing — ore to bar
  { id: "copper_bar", station: "smelt", skill: "smithing", out: "copper_bar", outQty: 1, inputs: [{ id: "copper_ore", qty: 2 }], req: 1, xp: 22, time: 1.6 },
  { id: "iron_bar", station: "smelt", skill: "smithing", out: "iron_bar", outQty: 1, inputs: [{ id: "iron_ore", qty: 2 }], req: 15, xp: 55, time: 1.8 },
  { id: "mithril_bar", station: "smelt", skill: "smithing", out: "mithril_bar", outQty: 1, inputs: [{ id: "mithril_ore", qty: 2 }, { id: "sandstone", qty: 1 }], req: 40, xp: 150, time: 2.2 },
  { id: "runite_bar", station: "smelt", skill: "smithing", out: "runite_bar", outQty: 1, inputs: [{ id: "runite_ore", qty: 2 }, { id: "cursed_shard", qty: 1 }], req: 70, xp: 420, time: 2.6 },
  { id: "tungsten_bar", station: "smelt", skill: "smithing", out: "tungsten_bar", outQty: 1, inputs: [{ id: "tungsten_ore", qty: 2 }, { id: "runite_bar", qty: 1 }], req: 100, xp: 620, time: 3 },
  // Smithing — bar to gear
  { id: "copper_sword", station: "forge", skill: "smithing", out: "copper_sword", outQty: 1, inputs: [{ id: "copper_bar", qty: 3 }], req: 5, xp: 90, time: 2.4 },
  { id: "bronze_dagger", station: "forge", skill: "smithing", out: "bronze_dagger", outQty: 1, inputs: [{ id: "copper_bar", qty: 2 }, { id: "willow_logs", qty: 1 }, { id: "goblin_charm", qty: 1 }, { id: "ram_horn", qty: 1 }], req: 3, xp: 60, time: 2.2 },
  { id: "sunspire_wand", station: "forge", skill: "smithing", out: "sunspire_wand", outQty: 1, inputs: [{ id: "mithril_bar", qty: 2 }, { id: "willow_logs", qty: 2 }, { id: "feather", qty: 2 }], req: 45, xp: 640, time: 3 },
  { id: "steel_sword", station: "forge", skill: "smithing", out: "steel_sword", outQty: 1, inputs: [{ id: "iron_bar", qty: 3 }, { id: "oak_logs", qty: 1 }, { id: "boar_tusk", qty: 1 }], req: 20, xp: 220, time: 2.6 },
  { id: "iron_mail", station: "armor", skill: "smithing", out: "iron_mail", outQty: 1, inputs: [{ id: "iron_bar", qty: 4 }, { id: "lynx_claw", qty: 1 }], req: 24, xp: 260, time: 2.8 },
  { id: "mithril_blade", station: "forge", skill: "smithing", out: "mithril_blade", outQty: 1, inputs: [{ id: "mithril_bar", qty: 3 }, { id: "palm_logs", qty: 1 }, { id: "maple_logs", qty: 1 }, { id: "jackal_fang", qty: 1 }], req: 45, xp: 620, time: 3 },
  { id: "mithril_plate", station: "armor", skill: "smithing", out: "mithril_plate", outQty: 1, inputs: [{ id: "mithril_bar", qty: 4 }, { id: "scorpion_stinger", qty: 1 }], req: 50, xp: 700, time: 3.2 },
  { id: "runite_greatsword", station: "forge", skill: "smithing", out: "runite_greatsword", outQty: 1, inputs: [{ id: "runite_bar", qty: 4 }, { id: "frostpine_logs", qty: 1 }, { id: "ghoul_essence", qty: 1 }], req: 75, xp: 1500, time: 3.4 },
  { id: "runite_plate", station: "armor", skill: "smithing", out: "runite_plate", outQty: 1, inputs: [{ id: "runite_bar", qty: 5 }, { id: "reaper_bone", qty: 1 }], req: 80, xp: 1700, time: 3.6 },
  { id: "tungsten_maul", station: "forge", skill: "smithing", out: "tungsten_maul", outQty: 1, inputs: [{ id: "tungsten_bar", qty: 4 }, { id: "cursed_bark", qty: 1 }, { id: "frost_fang", qty: 1 }], req: 105, xp: 2600, time: 3.8 },
  { id: "frostguard_plate", station: "armor", skill: "smithing", out: "frostguard_plate", outQty: 1, inputs: [{ id: "tungsten_bar", qty: 5 }, { id: "frost_pelt", qty: 2 }, { id: "wraith_ice_core", qty: 1 }], req: 110, xp: 3000, time: 4 },
  { id: "wyrmscale_plate", station: "armor", skill: "smithing", out: "wyrmscale_plate", outQty: 1, inputs: [{ id: "tungsten_bar", qty: 6 }, { id: "wyrm_scale", qty: 3 }], req: 120, xp: 3600, time: 4.2 },
  // Skinning — hides to leather
  { id: "light_leather", station: "skin", skill: "skinning", out: "light_leather", outQty: 1, inputs: [{ id: "raw_hide", qty: 3 }], req: 1, xp: 30, time: 1.6 },
  { id: "thick_leather", station: "skin", skill: "skinning", out: "thick_leather", outQty: 1, inputs: [{ id: "thick_hide", qty: 3 }], req: 25, xp: 110, time: 2 },
  { id: "shadow_leather", station: "skin", skill: "skinning", out: "shadow_leather", outQty: 1, inputs: [{ id: "shadow_pelt", qty: 3 }, { id: "scale_hide", qty: 1 }], req: 65, xp: 460, time: 2.4 },
  // Tailoring
  { id: "linen_cloth", station: "weave", skill: "tailoring", out: "linen_cloth", outQty: 1, inputs: [{ id: "flax", qty: 3 }, { id: "meadow_berries", qty: 1 }], req: 1, xp: 26, time: 1.6 },
  { id: "herb_weave", station: "weave", skill: "tailoring", out: "herb_weave", outQty: 1, inputs: [{ id: "forest_herbs", qty: 3 }, { id: "linen_cloth", qty: 1 }], req: 22, xp: 120, time: 2 },
  { id: "mystic_cloth", station: "weave", skill: "tailoring", out: "mystic_cloth", outQty: 1, inputs: [{ id: "gloomcap", qty: 2 }, { id: "herb_weave", qty: 2 }, { id: "desert_bloom", qty: 1 }], req: 60, xp: 520, time: 2.4 },
  { id: "leather_vest", station: "armor", skill: "tailoring", out: "leather_vest", outQty: 1, inputs: [{ id: "light_leather", qty: 3 }], req: 6, xp: 90, time: 2.2 },
  { id: "linen_robe", station: "armor", skill: "tailoring", out: "linen_robe", outQty: 1, inputs: [{ id: "linen_cloth", qty: 3 }, { id: "light_leather", qty: 1 }], req: 14, xp: 180, time: 2.4 },
  { id: "mystic_robe", station: "armor", skill: "tailoring", out: "mystic_robe", outQty: 1, inputs: [{ id: "mystic_cloth", qty: 3 }, { id: "shadow_leather", qty: 1 }, { id: "frost_lichen", qty: 1 }], req: 66, xp: 900, time: 3 },
  // Cooking
  { id: "honey_bun", station: "cook", skill: "cooking", out: "honey_bun", outQty: 1, inputs: [{ id: "river_minnow", qty: 2 }], req: 1, xp: 30, time: 1.6 },
  { id: "berry_pie", station: "cook", skill: "cooking", out: "berry_pie", outQty: 1, inputs: [{ id: "silver_trout", qty: 2 }, { id: "feather", qty: 1 }], req: 15, xp: 110, time: 2 },
  { id: "hearty_stew", station: "cook", skill: "cooking", out: "hearty_stew", outQty: 1, inputs: [{ id: "golden_koi", qty: 2 }, { id: "goblin_charm", qty: 1 }], req: 40, xp: 340, time: 2.4 },
  { id: "frost_tonic", station: "cook", skill: "cooking", out: "frost_tonic", outQty: 1, inputs: [{ id: "deepwater_eel", qty: 2 }, { id: "thick_leather", qty: 1 }], req: 70, xp: 900, time: 2.8 },
  { id: "phoenix_fillet", station: "cook", skill: "cooking", out: "phoenix_fillet", outQty: 1, inputs: [{ id: "starlight_salmon", qty: 3 }, { id: "frost_pelt", qty: 1 }], req: 100, xp: 2200, time: 3.2 },
  // Alchemy
  { id: "minor_venom_draught", station: "alchemy", skill: "alchemy", out: "minor_venom_draught", outQty: 1, inputs: [{ id: "raw_hide", qty: 2 }], req: 1, xp: 40, time: 1.8 },
  { id: "goblins_fury_tonic", station: "alchemy", skill: "alchemy", out: "goblins_fury_tonic", outQty: 1, inputs: [{ id: "goblin_charm", qty: 2 }, { id: "thick_hide", qty: 1 }], req: 20, xp: 180, time: 2.2 },
  { id: "serpents_bite_elixir", station: "alchemy", skill: "alchemy", out: "serpents_bite_elixir", outQty: 1, inputs: [{ id: "scale_hide", qty: 2 }], req: 45, xp: 520, time: 2.6 },
  { id: "shadow_venom", station: "alchemy", skill: "alchemy", out: "shadow_venom", outQty: 1, inputs: [{ id: "shadow_pelt", qty: 2 }, { id: "feather", qty: 1 }], req: 75, xp: 1400, time: 3 },
  { id: "frostfire_brew", station: "alchemy", skill: "alchemy", out: "frostfire_brew", outQty: 1, inputs: [{ id: "frost_pelt", qty: 2 }, { id: "goblin_charm", qty: 1 }], req: 105, xp: 3000, time: 3.4 },
];

/* ------------------------------------------------------------------ */
/* Equipment upgrading (+1 .. +1000)                                   */
/* ------------------------------------------------------------------ */

export const MAX_PLUS = 1000;
/** each upgrade level grants +5% of base stat */
export const PLUS_STEP = 0.05;

export function upgradeCost(base: number, plus: number): number {
  // cost doubles every 5 upgrade levels, forever
  const tier = Math.floor(plus / 5);
  const cost = (25 + base * 0.6) * Math.pow(2, tier) * (1 + (plus % 5) * 0.25);
  return Math.round(cost);
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
  smith: { glyph: "\u2692\uFE0E", color: "#d98b6a", label: "Smelter" },
  merchant: { glyph: "$", color: "#8fbfd9", label: "Market Trader" },
  elder: { glyph: "?", color: "#c9a7e0", label: "Quest Giver" },
  sun_smith: { glyph: "\u2692\uFE0E", color: "#f0c268", label: "Smelter" },
  weaver: { glyph: "\u2702\uFE0E", color: "#e8b3d8", label: "Arcane Weaver" },
  banker: { glyph: "\u2605", color: "#d9a95f", label: "Banker" },
  haven_banker: { glyph: "\u2605", color: "#d9c07a", label: "Banker" },
  brook_banker: { glyph: "\u2605", color: "#bfd9a0", label: "Banker" },
  frost_banker: { glyph: "\u2605", color: "#c6dcef", label: "Banker" },
  dusk_banker: { glyph: "\u2605", color: "#a08cb8", label: "Banker" },
  trapper: { glyph: "\u2691", color: "#b98a5c", label: "Trapper" },
  frost_smith: { glyph: "\u2744\uFE0E", color: "#a9c6e6", label: "Frostforge Smelter" },
  haven_weaponsmith: { glyph: "\u2694\uFE0E", color: "#c2765a", label: "Weaponsmith" },
  haven_armourer: { glyph: "\u26E8\uFE0E", color: "#9aa7b8", label: "Armourer" },
  haven_upgrader: { glyph: "\u2191", color: "#b7a06d", label: "Gear Upgrader" },
  sun_weaponsmith: { glyph: "\u2694\uFE0E", color: "#e09a4f", label: "Weaponsmith" },
  sun_alchemist: { glyph: "\u2697\uFE0E", color: "#a7d9c2", label: "Alchemist" },
  brook_chef: { glyph: "\u2668\uFE0E", color: "#c9d97f", label: "Chef" },
  frost_weaponsmith: { glyph: "\u2694\uFE0E", color: "#7f9cbd", label: "Weaponsmith" },
  haven_exchange: { glyph: "\u2696\uFE0E", color: "#cbb98f", label: "Grand Market" },
  sun_exchange: { glyph: "\u2696\uFE0E", color: "#e8c98d", label: "Grand Market" },
  brook_exchange: { glyph: "\u2696\uFE0E", color: "#a8cf9b", label: "Grand Market" },
  frost_exchange: { glyph: "\u2696\uFE0E", color: "#b6cbe0", label: "Grand Market" },
  dusk_exchange: { glyph: "\u2696\uFE0E", color: "#9a86b3", label: "Grand Market" },
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


/* ------------------------------------------------------------------ */
/* The Great River — one continuous waterway from the far west to the  */
/* far east, threaded through the old river stretches. Rock ridges and */
/* treelines that stand in its way are washed out and replaced.        */
/* ------------------------------------------------------------------ */

export interface BridgeDef {
  id: string;
  /** deck centre in world coords */
  x: number;
  y: number;
  /** rotation of the deck, radians (perpendicular to the river) */
  angle: number;
  /** deck length (across the river) and width (walkable strip) */
  len: number;
  width: number;
}

const RIVER_WIDTH = BARRIER_WIDTH.river;

/** true when the river must steer clear of this spot (towns, nodes, NPCs...) */
function riverBlockedAt(x: number, y: number) {
  if (nearClearZone(x, y)) return true;
  for (const b of BUILDINGS) {
    if (x > b.x - 70 && x < b.x + b.w + 70 && y > b.y - 70 && y < b.y + b.h + 70) return true;
  }
  return false;
}

function buildGreatRiver(raw: Barrier[]): { pts: [number, number][]; bridges: BridgeDef[] } {
  // 1. chain the existing river stretches west -> east by their centres
  const centres = raw
    .filter((b) => b.kind === "river")
    .map((b) => [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2] as [number, number]);

  const used = new Set<number>();
  const chain: [number, number][] = [];
  let cur: [number, number] | null = null;
  for (;;) {
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < centres.length; i++) {
      if (used.has(i)) continue;
      const c = centres[i]!;
      if (cur && c[0] <= cur[0] + 40) continue;
      const score = cur ? c[0] - cur[0] + Math.abs(c[1] - cur[1]) * 0.7 : c[0];
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) break;
    used.add(best);
    cur = centres[best]!;
    chain.push(cur);
  }

  const startY = chain[0]?.[1] ?? WORLD_H * 0.45;
  const endY = chain[chain.length - 1]?.[1] ?? WORLD_H * 0.55;
  const waypoints: [number, number][] = [[-30, startY], ...chain, [WORLD_W + 30, endY]];

  // 2. resample into a smooth meander
  const SAMPLES = 90;
  const sampled: [number, number][] = [];
  for (let s = 0; s <= SAMPLES; s++) {
    const t = (s / SAMPLES) * (waypoints.length - 1);
    const i = Math.min(waypoints.length - 2, Math.floor(t));
    const f = t - i;
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    const e = f * f * (3 - 2 * f); // smoothstep between waypoints
    sampled.push([a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e]);
  }
  // gentle extra wobble so it reads as a natural river
  for (let i = 1; i < sampled.length - 1; i++) {
    sampled[i]![1] += Math.sin(i * 0.55) * 26 + Math.sin(i * 0.21 + 1.7) * 34;
  }

  // 3. nudge each sample off towns, buildings, nodes and NPCs
  const pts: [number, number][] = sampled.map(([x, y], i) => {
    if (i === 0 || i === sampled.length - 1) return [x, clamp01px(y)];
    let ny = y;
    if (riverBlockedAt(x, ny)) {
      for (let d = 30; d <= 420; d += 30) {
        if (!riverBlockedAt(x, y - d)) {
          ny = y - d;
          break;
        }
        if (!riverBlockedAt(x, y + d)) {
          ny = y + d;
          break;
        }
      }
    }
    return [x, clamp01px(ny)];
  });
  // smooth the nudges back out
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < pts.length - 1; i++) {
      const y = (pts[i - 1]![1] + pts[i]![1] * 2 + pts[i + 1]![1]) / 4;
      if (!riverBlockedAt(pts[i]![0], y)) pts[i]![1] = y;
    }
  }

  // 4. six bridges, roughly equidistant along the river, on clear banks.
  // The V2 world is twice the area, so crossings were increased from four to
  // six to keep the worst-case detour to a bridge about the same as before.
  const bridges: BridgeDef[] = [];
  const targets = [0.1, 0.26, 0.42, 0.58, 0.74, 0.9];
  targets.forEach((t, n) => {
    const wantX = WORLD_W * t;
    let idx = 0;
    let bestDx = Infinity;
    pts.forEach((p, i) => {
      const dx = Math.abs(p[0] - wantX);
      if (dx < bestDx) {
        bestDx = dx;
        idx = i;
      }
    });
    for (let step = 0; step < 12; step++) {
      for (const cand of [idx - step, idx + step]) {
        if (cand < 3 || cand > pts.length - 4) continue;
        const [x, y] = pts[cand]!;
        if (!riverBlockedAt(x, y - 90) && !riverBlockedAt(x, y + 90)) {
          idx = cand;
          step = 99;
          break;
        }
      }
    }
    const a = pts[idx - 1]!;
    const b = pts[idx + 1]!;
    const [x, y] = pts[idx]!;
    bridges.push({
      id: `bridge-${n + 1}`,
      x,
      y,
      angle: Math.atan2(b[1] - a[1], b[0] - a[0]),
      // the sprite is drawn whole at 52:90, so the walkable deck follows that
      // ratio: length across the water, width along the bank.
      len: RIVER_WIDTH + 56,
      width: Math.round((RIVER_WIDTH + 56 + 28) * (52 / 90)),
    });
  });

  return { pts, bridges };
}

function clamp01px(y: number) {
  return Math.max(60, Math.min(WORLD_H - 60, y));
}

const RAW_BARRIERS = buildBarriers();
const GREAT = buildGreatRiver(RAW_BARRIERS);

/** wooden bridges crossing the Great River */
export const BRIDGES: BridgeDef[] = GREAT.bridges;

const riverXs = GREAT.pts.map((p) => p[0]);
const riverYs = GREAT.pts.map((p) => p[1]);

const GREAT_RIVER: Barrier = {
  id: "great-river",
  kind: "river",
  pts: GREAT.pts,
  width: RIVER_WIDTH,
  minX: Math.min(...riverXs),
  minY: Math.min(...riverYs),
  maxX: Math.max(...riverXs),
  maxY: Math.max(...riverYs),
};


/**
 * Grand Haven's moat feeds the Great River: a short channel leaves the moat on
 * the south-east side and runs east into the river, staying well south of the
 * Willowbrook road and its bridge.
 */
const MOAT_CHANNEL_PTS: [number, number][] = [
  [1225, 2405],
  [1310, 2438],
  [1420, 2444],
  [1520, 2416],
  [1600, 2372],
  [1668, 2336],
];

const MOAT_CHANNEL: Barrier = {
  id: "grand-haven-channel",
  kind: "river",
  pts: MOAT_CHANNEL_PTS,
  width: 52,
  minX: Math.min(...MOAT_CHANNEL_PTS.map((p) => p[0])),
  minY: Math.min(...MOAT_CHANNEL_PTS.map((p) => p[1])),
  maxX: Math.max(...MOAT_CHANNEL_PTS.map((p) => p[0])),
  maxY: Math.max(...MOAT_CHANNEL_PTS.map((p) => p[1])),
};

// Only water blocks movement now: the old rocky ridges and treelines that
// walled off biome borders are gone (they rendered poorly and served no purpose).
export const BARRIERS: Barrier[] = [GREAT_RIVER, MOAT_CHANNEL];


/** true when the point stands on a bridge deck (so the river is crossable there) */
export function onBridge(x: number, y: number, pad = 0): boolean {
  for (const br of BRIDGES) {
    const dx = x - br.x;
    const dy = y - br.y;
    const c = Math.cos(-br.angle);
    const s = Math.sin(-br.angle);
    const lx = dx * c - dy * s; // along the river
    const ly = dx * s + dy * c; // across the river
    if (Math.abs(lx) < br.width / 2 - pad && Math.abs(ly) < br.len / 2 + 16) return true;
  }
  return false;
}

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
const SOLID_DISCS: { x: number; y: number; r: number }[] = [];

/** true when the world point is inside a barrier, a building or a resource node */
export function blockedAt(x: number, y: number, pad = 10, wadesRivers = false): boolean {
  for (const bar of BARRIERS) {
    const r = bar.width / 2 + pad;
    if (x < bar.minX - r || x > bar.maxX + r || y < bar.minY - r || y > bar.maxY + r) continue;
    for (let i = 0; i < bar.pts.length - 1; i++) {
      const a = bar.pts[i]!;
      const b = bar.pts[i + 1]!;
      if (distToSeg(x, y, a[0], a[1], b[0], b[1]) < r) {
        // the world boss wades straight through the river instead of hunting
        // for a bridge, so he never gets stuck on a bank
        if (bar.kind === "river" && (wadesRivers || (bar.id === "great-river" && onBridge(x, y, pad)))) break;
        return true;
      }
    }
  }
  for (const s of SOLID_RECTS) {
    if (x > s.x - pad && x < s.x + s.w + pad && y > s.y - pad && y < s.y + s.h + pad) return true;
  }
  for (const d of SOLID_DISCS) {
    const r = d.r + pad;
    if (Math.abs(x - d.x) < r && Math.abs(y - d.y) < r && Math.hypot(x - d.x, y - d.y) < r) return true;
  }
  // lakes are water — you can fish from the shore but not walk on them,
  // except along the planked jetties that reach out to the fishing decks
  if (inLake(x, y, 0) && !onJetty(x, y, pad)) return true;
  // Grand Haven's stone wall and moat — solid except at the four gates
  if (cityBlocked(x, y, pad)) return true;
  if (onLandmark(x, y, pad)) return true;
  return false;

}

/** true when the point stands on a jetty deck (so it is walkable over water) */
export function onJetty(x: number, y: number, pad = 0): boolean {
  for (const l of LAKES) {
    for (const j of l.jetties) {
      if (distToSeg(x, y, j.x1, j.y1, j.x2, j.y2) < j.hw + pad) return true;
    }
  }
  return false;
}


export const BARRIER_LABEL: Record<BarrierKind, string> = {
  river: "River",
  rocks: "Rocky Ridge",
  woodland: "Dense Woodland",
};

// ---------------------------------------------------------------------------
// Trade roads: gray cobble paths linking every town to every other town.
// ---------------------------------------------------------------------------

/** the crossroads at the heart of each town */
export const TOWN_CENTERS: { x: number; y: number }[] = TOWN_SPECS.map((t) => ({ x: t.cx, y: t.cy }));

function inLake(x: number, y: number, pad = 18): boolean {
  for (const l of LAKES) {
    if (Math.abs(x - l.cx) > l.rx + pad || Math.abs(y - l.cy) > l.ry + pad) continue;
    const p = l.poly;
    let inside = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i]!;
      const [xj, yj] = p[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

/** a road may not run through obstacles, nodes or water (bridges are fine) */
function roadBlocked(x: number, y: number): boolean {
  if (x < 30 || y < 30 || x > WORLD_W - 30 || y > WORLD_H - 30) return true;
  if (onBridge(x, y)) return false;
  return blockedAt(x, y, 16) || inLake(x, y);
}

const ROAD_CELL = 40;
const ROAD_COLS = Math.ceil(WORLD_W / ROAD_CELL);
const ROAD_ROWS = Math.ceil(WORLD_H / ROAD_CELL);

/** pre-computed passability grid so every route shares one pass over the world */
const ROAD_GRID: Uint8Array = (() => {
  const g = new Uint8Array(ROAD_COLS * ROAD_ROWS);
  for (let cy = 0; cy < ROAD_ROWS; cy++) {
    for (let cx = 0; cx < ROAD_COLS; cx++) {
      const x = cx * ROAD_CELL + ROAD_CELL / 2;
      const y = cy * ROAD_CELL + ROAD_CELL / 2;
      g[cy * ROAD_COLS + cx] = roadBlocked(x, y) ? 1 : 0;
    }
  }
  return g;
})();

function nearestOpenCell(cx: number, cy: number): number {
  for (let r = 0; r < 14; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= ROAD_COLS || y >= ROAD_ROWS) continue;
        if (!ROAD_GRID[y * ROAD_COLS + x]) return y * ROAD_COLS + x;
      }
    }
  }
  return cy * ROAD_COLS + cx;
}

/** plain A* over the coarse grid; returns world-space points */
function routeBetween(a: { x: number; y: number }, b: { x: number; y: number }): [number, number][] {
  const start = nearestOpenCell(Math.floor(a.x / ROAD_CELL), Math.floor(a.y / ROAD_CELL));
  const goal = nearestOpenCell(Math.floor(b.x / ROAD_CELL), Math.floor(b.y / ROAD_CELL));
  const total = ROAD_COLS * ROAD_ROWS;
  const g = new Float64Array(total).fill(Infinity);
  const from = new Int32Array(total).fill(-1);
  const seen = new Uint8Array(total);
  const gx = goal % ROAD_COLS;
  const gy = (goal / ROAD_COLS) | 0;
  const h = (i: number) => Math.hypot((i % ROAD_COLS) - gx, ((i / ROAD_COLS) | 0) - gy);
  const open: { i: number; f: number }[] = [{ i: start, f: h(start) }];
  g[start] = 0;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bi]!.f) bi = i;
    const cur = open.splice(bi, 1)[0]!.i;
    if (cur === goal) break;
    if (seen[cur]) continue;
    seen[cur] = 1;
    const cx = cur % ROAD_COLS;
    const cy = (cur / ROAD_COLS) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= ROAD_COLS || ny >= ROAD_ROWS) continue;
        const ni = ny * ROAD_COLS + nx;
        if (ROAD_GRID[ni]) continue;
        if (dx && dy && (ROAD_GRID[cy * ROAD_COLS + nx] || ROAD_GRID[ny * ROAD_COLS + cx])) continue;
        const step = dx && dy ? 1.414 : 1;
        const ng = g[cur]! + step;
        if (ng < g[ni]!) {
          g[ni] = ng;
          from[ni] = cur;
          open.push({ i: ni, f: ng + h(ni) });
        }
      }
    }
  }
  if (from[goal]! < 0 && goal !== start) return [];
  const cells: number[] = [];
  for (let i = goal; i >= 0; i = from[i]!) {
    cells.push(i);
    if (i === start) break;
  }
  cells.reverse();
  const raw: [number, number][] = cells.map((i) => [
    (i % ROAD_COLS) * ROAD_CELL + ROAD_CELL / 2,
    ((i / ROAD_COLS) | 0) * ROAD_CELL + ROAD_CELL / 2,
  ]);
  raw[0] = [a.x, a.y];
  raw[raw.length - 1] = [b.x, b.y];
  // soften the grid staircase without pushing the road into obstacles
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < raw.length - 1; i++) {
      const nx = (raw[i - 1]![0] + raw[i]![0] * 2 + raw[i + 1]![0]) / 4;
      const ny = (raw[i - 1]![1] + raw[i]![1] * 2 + raw[i + 1]![1]) / 4;
      if (!roadBlocked(nx, ny)) raw[i] = [nx, ny];
    }
  }
  return raw;
}

export interface RoadDef {
  id: string;
  pts: [number, number][];
  width: number;
  /** unmaintained dirt trail rather than a cobbled trade road */
  trail?: boolean;
}

/** the mouth of a named gate, just outside the city's outer bank */
function gateMouth(c: CityDef, label: string): { x: number; y: number } {
  const g = c.gates.find((gg) => gg.label === label) ?? c.gates[0]!;
  const r = cityOuterR(c) + 34;
  return { x: c.cx + Math.cos(g.angle) * r, y: c.cy + Math.sin(g.angle) * r };
}

function chain(...stops: { x: number; y: number }[]): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const leg = routeBetween(stops[i]!, stops[i + 1]!);
    if (!leg.length) return [];
    pts.push(...(i ? leg.slice(1) : leg));
  }
  return pts;
}

/**
 * The spine: one maintained cobble road per leg, in city order, plus the
 * unmarked dust trail that cuts the desert corner between Grand Haven and
 * Sunspire. Decoration and navigation only — roads carry no mechanics.
 */
export const ROADS: RoadDef[] = (() => {
  const out: RoadDef[] = [];
  const spine: [CityDef, CityDef][] = [
    [CITY, WILLOWBROOK],
    [WILLOWBROOK, SUNSPIRE],
    [SUNSPIRE, DUSKMERE],
    [DUSKMERE, FROSTFORGE],
  ];
  for (const [a, b] of spine) {
    const pts = routeBetween({ x: a.cx, y: a.cy }, { x: b.cx, y: b.cy });
    if (pts.length > 1) out.push({ id: `road-${a.key}-${b.key}`, pts, width: 26 });
  }
  // the risky shortcut: postern to gate, straight across open wilderness
  const trail = chain(
    { x: CITY.cx, y: CITY.cy },
    gateMouth(CITY, "Dust Trail Postern"),
    gateMouth(SUNSPIRE, "Dust Trail Gate"),
    { x: SUNSPIRE.cx, y: SUNSPIRE.cy },
  );
  if (trail.length > 1)
    out.push({ id: "trail-grand-haven-sunspire", pts: trail, width: 11, trail: true });
  return out;
})();

/**
 * Road polylines split so no piece runs across a bridge deck — the bridges
 * draw themselves on top. Each run is extended a little way onto the deck so
 * the cobbles visually meet (and tuck under) the bridge instead of stopping
 * short of it.
 */
const DECK_OVERLAP = 26;

/** point `d` px from `from` toward `to` */
const towards = (
  from: [number, number],
  to: [number, number],
  d: number,
): [number, number] => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(1, d / len);
  return [from[0] + dx * t, from[1] + dy * t];
};

export const ROAD_RUNS: { pts: [number, number][]; width: number; trail?: boolean }[] = ROADS.flatMap(
  (r) => {
    const runs: { pts: [number, number][]; width: number; trail?: boolean }[] = [];
    let cur: [number, number][] = [];
    let pendingHead: [number, number] | null = null;
    for (let i = 0; i < r.pts.length; i++) {
      const p = r.pts[i]!;
      if (onBridge(p[0], p[1], -30)) {
        if (cur.length) {
          // run the cobbles up to (and slightly under) the bridge deck
          const tail = cur[cur.length - 1]!;
          cur.push(towards(tail, p, Math.hypot(p[0] - tail[0], p[1] - tail[1]) + DECK_OVERLAP));
        }
        if (cur.length > 1) runs.push({ pts: cur, width: r.width, trail: !!r.trail });
        cur = [];
        pendingHead = p;
      } else {
        if (pendingHead) {
          // start the next run back under the deck we just left
          cur.push(
            towards(p, pendingHead, Math.hypot(p[0] - pendingHead[0], p[1] - pendingHead[1]) + DECK_OVERLAP),
          );
          pendingHead = null;
        }
        cur.push(p);
      }
    }
    if (cur.length > 1) runs.push({ pts: cur, width: r.width, trail: !!r.trail });
    return runs;
  },
);




/* ------------------------------------------------------------------ */
/* Spawn generation — biome aware, obstacle aware                      */
/* ------------------------------------------------------------------ */

interface BiomePlan {
  nodes: [NodeKind, number][];
  mobs: [MonsterKind, number][];
}

/** what belongs where, and roughly how much of it across the whole world */
const SPAWN_PLAN: Record<BiomeId, BiomePlan> = {
  // V2 — counts doubled alongside the doubled world area so density per
  // square of ground stays the same as the old, smaller map.
  fields: {
    nodes: [["copper", 17], ["oak", 17], ["flax", 14], ["berries", 14]],
    mobs: [["chicken", 17], ["goblin", 14], ["disgruntled_ram", 10]],
  },
  forest: {
    nodes: [["iron", 14], ["willow", 14], ["maple", 12], ["herbs", 14]],
    mobs: [["forest_boar", 10], ["wolf", 14], ["forest_lynx", 10], ["bear", 12]],
  },
  desert: {
    nodes: [["sandstone", 13], ["mithril", 11], ["palm", 11], ["bloom", 11]],
    mobs: [["dust_jackal", 10], ["serpent", 12], ["scorpion_stalker", 10], ["bandit", 11]],
  },
  evil: {
    nodes: [["cursed_rock", 11], ["cursed_tree", 11], ["gloomcap", 11]],
    mobs: [["withered_ghoul", 10], ["wraith", 11], ["bone_reaper", 8], ["shadow_beast", 10]],
  },
  winter: {
    nodes: [["runite", 11], ["tungsten", 8], ["frostpine", 11], ["lichen", 10]],
    mobs: [["frost_wolf", 10], ["yeti", 10], ["ice_wraith", 8], ["frost_giant", 7], ["ancient_frost_wyrm", 6]],
  },
};

const placed: { x: number; y: number }[] = [];

function nearRoad(x: number, y: number, pad: number) {
  for (const r of ROADS) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i]!;
      const b = r.pts[i + 1]!;
      if (Math.abs(x - a[0]) > 260 && Math.abs(x - b[0]) > 260) continue;
      if (distToSeg(x, y, a[0], a[1], b[0], b[1]) < r.width / 2 + pad) return true;
    }
  }
  return false;
}

function nearTown(x: number, y: number) {
  for (const c of TOWN_CENTERS) if (Math.hypot(x - c.x, y - c.y) < 330) return true;
  for (const s of STREETS) {
    if (x > s.x - 60 && x < s.x + s.w + 60 && y > s.y - 60 && y < s.y + s.h + 60) return true;
  }
  for (const b of BIOMES) {
    const p = b.plaza;
    if (p && x > p.x - 50 && x < p.x + p.w + 50 && y > p.y - 50 && y < p.y + p.h + 50) return true;
  }
  for (const n of NPCS) if (Math.hypot(x - n.x, y - n.y) < 150) return true;
  for (const b of BUILDINGS) {
    if (x > b.x - 60 && x < b.x + b.w + 60 && y > b.y - 60 && y < b.y + b.h + 60) return true;
  }
  return false;
}

/** a spot must be walkable, dry, off the roads and clear of anything built */
function spawnable(x: number, y: number) {
  if (x < 90 || y < 90 || x > WORLD_W - 90 || y > WORLD_H - 90) return false;
  if (blockedAt(x, y, 34)) return false;
  if (inLake(x, y, 50)) return false;
  if (onJetty(x, y, 40) || onBridge(x, y, -60)) return false;
  if (nearRoad(x, y, 40)) return false;
  if (nearTown(x, y)) return false;
  for (const p of placed) if (Math.hypot(x - p.x, y - p.y) < 92) return false;
  // never seal a walkable pocket: keep a little breathing room around the spot
  return true;
}

(() => {
  // deterministic, well-spread candidate list over the whole world
  const step = 64;
  const cands: { x: number; y: number; k: number }[] = [];
  let i = 0;
  for (let y = 120; y < CORE_H - 120; y += step) {
    for (let x = 120; x < WORLD_W - 120; x += step) {
      i++;
      cands.push({
        x: x + (rand01(i * 1.7) - 0.5) * step * 0.8,
        y: y + (rand01(i * 3.1 + 11) - 0.5) * step * 0.8,
        k: rand01(i * 7.3 + 5),
      });
    }
  }
  cands.sort((a, b) => a.k - b.k);

  // remaining quota per biome
  const want = new Map<string, { node: Map<NodeKind, number>; mob: Map<MonsterKind, number> }>();
  for (const [bid, plan] of Object.entries(SPAWN_PLAN)) {
    want.set(bid, {
      node: new Map(plan.nodes as [NodeKind, number][]),
      mob: new Map(plan.mobs as [MonsterKind, number][]),
    });
  }

  const pickMost = <K extends string>(m: Map<K, number>): K | null => {
    let best: K | null = null;
    let n = 0;
    for (const [k, v] of m) if (v > n) ((best = k), (n = v));
    return best;
  };

  /** stable numeric seed from a kind name */
  const strSeed = (s: string) => {
    let h = 0;
    for (let j = 0; j < s.length; j++) h = (h * 31 + s.charCodeAt(j)) % 100003;
    return h + 7;
  };

  // cluster centres: same-kind spawns gravitate toward a few patches per biome
  const centers = new Map<string, { x: number; y: number }[]>();
  const addCenters = (bid: string, kind: string, quota: number) => {
    const count = Math.max(1, Math.round(quota / 6));
    const seed = strSeed(`${bid}:${kind}`);
    const pts: { x: number; y: number }[] = [];
    let t = 0;
    while (pts.length < count && t < count * 200) {
      t++;
      const x = rand01(seed * 1.31 + t * 2.17) * WORLD_W;
      const y = rand01(seed * 2.71 + t * 3.53 + 19) * CORE_H;
      if (biomeAt(x, y).id !== bid) continue;
      pts.push({ x, y });
    }
    if (!pts.length) pts.push({ x: WORLD_W / 2, y: CORE_H / 2 });
    centers.set(`${bid}:${kind}`, pts);
  };
  for (const [bid, plan] of Object.entries(SPAWN_PLAN)) {
    for (const [k, q] of plan.nodes) addCenters(bid, k as string, q as number);
    for (const [k, q] of plan.mobs) addCenters(bid, k as string, q as number);
  }

  /** nearest-cluster pick among kinds that still have quota */
  const pickNear = <K extends string>(m: Map<K, number>, bid: string, x: number, y: number): K | null => {
    let best: K | null = null;
    let bestD = Infinity;
    for (const [k, v] of m) {
      if (v <= 0) continue;
      const pts = centers.get(`${bid}:${k}`) ?? [];
      let d = Infinity;
      for (const p of pts) d = Math.min(d, Math.hypot(x - p.x, y - p.y));
      if (d < bestD) ((bestD = d), (best = k));
    }
    return best;
  };


  for (const c of cands) {
    // a spawn that would land in the new walls or moat is nudged out past the
    // far bank instead of being dropped
    if (cityKeepOut(c.x, c.y)) {
      const p = pushOutsideCity(c.x, c.y);
      c.x = p.x;
      c.y = p.y;
    }
    const bid = biomeAt(c.x, c.y).id;
    const w = want.get(bid);
    if (!w) continue;
    const nodesLeft = [...w.node.values()].reduce((a, b) => a + b, 0);
    const mobsLeft = [...w.mob.values()].reduce((a, b) => a + b, 0);
    if (!nodesLeft && !mobsLeft) continue;
    if (!spawnable(c.x, c.y)) continue;

    // alternate between nodes and monsters, weighted by what is still missing
    const takeNode = nodesLeft > 0 && (mobsLeft === 0 || c.k * (nodesLeft + mobsLeft) < nodesLeft);
    // mostly cluster by nearest same-kind patch; sometimes fall back to quota
    const cluster = rand01(c.x * 0.013 + c.y * 0.029 + 3.7) < 0.8;
    if (takeNode) {
      const kind = (cluster ? pickNear(w.node, bid, c.x, c.y) : null) ?? pickMost(w.node);
      if (!kind) continue;
      w.node.set(kind, w.node.get(kind)! - 1);
      NODE_SPAWNS.push({ kind, x: Math.round(c.x), y: Math.round(c.y) });
      SOLID_DISCS.push({
        x: Math.round(c.x),
        y: Math.round(c.y) + (NODE_DEFS[kind].shape === "tree" ? 8 : 2),
        r: NODE_DEFS[kind].shape === "bush" ? 11 : 14,
      });
    } else {
      const kind = (cluster ? pickNear(w.mob, bid, c.x, c.y) : null) ?? pickMost(w.mob);
      if (!kind) continue;
      w.mob.set(kind, w.mob.get(kind)! - 1);
      MONSTER_SPAWNS.push({ kind, x: Math.round(c.x), y: Math.round(c.y) });
    }
    placed.push({ x: c.x, y: c.y });
  }
})();

/**
 * Southern extension — the map grew ~25% downward, so scatter a simple,
 * deterministic mix of that biome's own nodes and monsters across the new
 * ground. Kept intentionally rough: these systems are due for a rework.
 */
(() => {
  const step = 70;
  const cands: { x: number; y: number; k: number }[] = [];
  let i = 0;
  for (let y = CORE_H - 40; y < WORLD_H - 120; y += step) {
    for (let x = 120; x < WORLD_W - 120; x += step) {
      i++;
      cands.push({
        x: x + (rand01(i * 2.3 + 41) - 0.5) * step * 0.8,
        y: y + (rand01(i * 4.7 + 71) - 0.5) * step * 0.8,
        k: rand01(i * 9.1 + 13),
      });
    }
  }
  cands.sort((a, b) => a.k - b.k);

  for (const c of cands) {
    if (cityKeepOut(c.x, c.y)) continue;
    if (c.y < CORE_H - 30) continue;
    if (!spawnable(c.x, c.y)) continue;
    // thin the field out so density roughly matches the rest of the world
    if (rand01(c.x * 0.011 + c.y * 0.043 + 9) > 0.45) continue;
    const bid = biomeAt(c.x, c.y).id;
    const plan = SPAWN_PLAN[bid];
    if (!plan) continue;
    // roughly 55% nodes / 45% monsters, kind picked deterministically
    if (c.k * 1000 - Math.floor(c.k * 1000) < 0.55) {
      const list = plan.nodes;
      const kind = list[Math.floor(rand01(c.x * 0.017 + c.y * 0.031) * list.length) % list.length]![0] as NodeKind;
      NODE_SPAWNS.push({ kind, x: Math.round(c.x), y: Math.round(c.y) });
      SOLID_DISCS.push({
        x: Math.round(c.x),
        y: Math.round(c.y) + (NODE_DEFS[kind].shape === "tree" ? 8 : 2),
        r: NODE_DEFS[kind].shape === "bush" ? 11 : 14,
      });
    } else {
      const list = plan.mobs;
      const kind = list[Math.floor(rand01(c.x * 0.023 + c.y * 0.019 + 5) * list.length) % list.length]![0] as MonsterKind;
      MONSTER_SPAWNS.push({ kind, x: Math.round(c.x), y: Math.round(c.y) });
    }
    placed.push({ x: c.x, y: c.y });
  }
})();

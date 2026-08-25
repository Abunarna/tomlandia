import { createHash } from "node:crypto";

import {
  biomeAt,
  WORLD_H,
  WORLD_W,
} from "../../src/game/data.ts";
import { terrainBlockedAt } from "./terrain-collision.mjs";

export const WORLD_MODEL_VERSION = "tomlandia-gate7-world-model/v1";
export const CLUSTER_SELECTION_RATE = 0.9;
export const MOVEMENT_SPEED = 130;
export const PATH_CELL = 40;
export const BIOME_CELL = 100;
export const SUBSCRIPTION_CELL = Object.freeze({ width: 700, height: 500 });
export const SOUTHERN_EXTENSION_Y = 3000;

export const WINTER_BANDS = Object.freeze([
  Object.freeze({ id: "lower_slopes", minLevel: 55, maxLevel: 79, minY: 0, maxY: 2000 }),
  Object.freeze({ id: "mid_mountain", minLevel: 80, maxLevel: 99, minY: 2000, maxY: 2400 }),
  Object.freeze({ id: "upper_peaks", minLevel: 100, maxLevel: 119, minY: 2400, maxY: 2800 }),
  Object.freeze({ id: "high_peaks", minLevel: 120, maxLevel: 139, minY: 2800, maxY: 3300 }),
  Object.freeze({ id: "deepest_frontier", minLevel: 140, maxLevel: 150, minY: 3300, maxY: WORLD_H }),
]);

const DEFAULT_SUBZONE = Object.freeze({
  fields: "grand_haven_outskirts",
  forest: "willowbrook_wilds",
  desert: "sunscorch_reaches",
  evil: "duskmere_wilds",
});

// Only rows listed here are re-generated. All other non-Winter v1 rows retain
// their exact coordinates. Every Winter row is listed so its level band is
// real, while Runite is corrected to the documented Desert/Evil boundary.
export const GENERATION_PLANS = Object.freeze({
  node: Object.freeze({
    coal_seam: Object.freeze({ biome: "forest", subzone: "willowbrook_wilds", anchor: [1700, 1000] }),
    sunstone_vein: Object.freeze({ biome: "desert", subzone: "sunscorch_reaches", anchor: [3000, 1000] }),
    runite: Object.freeze({ biome: "desert", subzone: "desert_evil_boundary", anchor: [3800, 900], boundaryBiome: "evil" }),
    frost_crystal_vein: Object.freeze({ biome: "winter", anchor: [5000, 1750] }),
    lichen: Object.freeze({ biome: "winter", anchor: [4500, 2150] }),
    frostpine: Object.freeze({ biome: "winter", anchor: [4800, 2500] }),
    glacial_vein: Object.freeze({ biome: "winter", anchor: [4300, 2450] }),
    starsteel_vein: Object.freeze({ biome: "winter", anchor: [3900, 2700] }),
    voidsteel_vein: Object.freeze({ biome: "winter", anchor: [4100, 2950] }),
    wyrmforged_vein: Object.freeze({ biome: "winter", anchor: [3500, 3200] }),
    ancient_vein: Object.freeze({ biome: "winter", anchor: [3800, 3450] }),
    ascendant_vein: Object.freeze({ biome: "winter", anchor: [5000, 3500] }),
  }),
  monster: Object.freeze({
    goblin_brute: Object.freeze({ biome: "forest", subzone: "willowbrook_wilds", anchor: [1450, 900] }),
    ironback_boar: Object.freeze({ biome: "forest", subzone: "willowbrook_wilds", anchor: [1800, 1300] }),
    mithril_stalker: Object.freeze({ biome: "forest", subzone: "willowbrook_wilds", anchor: [2100, 1700] }),
    desert_raider: Object.freeze({ biome: "desert", subzone: "sunscorch_reaches", anchor: [3000, 700] }),
    dune_devourer: Object.freeze({ biome: "desert", subzone: "sunscorch_reaches", anchor: [3300, 1000] }),
    cursed_knight: Object.freeze({ biome: "evil", subzone: "desert_evil_boundary", anchor: [3950, 900], boundaryBiome: "desert" }),
    frost_wolf: Object.freeze({ biome: "winter", anchor: [5200, 1400] }),
    yeti: Object.freeze({ biome: "winter", anchor: [5000, 1700] }),
    frost_troll: Object.freeze({ biome: "winter", anchor: [5000, 2050] }),
    ice_wraith: Object.freeze({ biome: "winter", anchor: [4700, 2150] }),
    frost_revenant: Object.freeze({ biome: "winter", anchor: [4400, 2200] }),
    frost_giant: Object.freeze({ biome: "winter", anchor: [4500, 2500] }),
    glacial_guardian: Object.freeze({ biome: "winter", anchor: [3900, 2700] }),
    wyrm_knight: Object.freeze({ biome: "winter", anchor: [4200, 3000] }),
    void_wraith: Object.freeze({ biome: "winter", anchor: [3600, 3200] }),
    ancient_frost_wyrm: Object.freeze({ biome: "winter", anchor: [4100, 3450] }),
    ascendant_wyrm: Object.freeze({ biome: "winter", anchor: [4900, 3500] }),
  }),
});

export function stableUnit(key) {
  return createHash("sha256").update(key).digest().readUInt32BE(0) / 0x1_0000_0000;
}

export function biomeIdAt(x, y) {
  return biomeAt(x, y).key.split("-")[0];
}

export function winterBandForLevel(level) {
  const band = WINTER_BANDS.find((candidate) => level >= candidate.minLevel && level <= candidate.maxLevel);
  if (!band) throw new Error(`Level ${level} is outside the Winter Mountain 55-150 bands`);
  return band;
}

export function winterSubzoneAt(x, y) {
  if (biomeIdAt(x, y) !== "winter") return null;
  return WINTER_BANDS.find((band) => y >= band.minY && y < band.maxY)?.id ?? null;
}

export function subzoneAt(biome, x, y) {
  if (biome === "winter") return winterSubzoneAt(x, y);
  return DEFAULT_SUBZONE[biome] ?? null;
}

export function subscriptionCellAt(x, y) {
  return `${Math.floor(x / SUBSCRIPTION_CELL.width)}:${Math.floor(y / SUBSCRIPTION_CELL.height)}`;
}

export function hasTerrainClearance(x, y, radius = 14, margin = 10) {
  const clearance = radius + margin;
  if (terrainBlockedAt(x, y, clearance)) return false;
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    if (terrainBlockedAt(x + Math.cos(angle) * clearance, y + Math.sin(angle) * clearance, 1)) return false;
  }
  return true;
}

export function nearBiome(x, y, targetBiome, distance = 180) {
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    if (biomeIdAt(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance) === targetBiome) return true;
  }
  return false;
}

export function planAllows(plan, level, x, y) {
  if (x < 90 || y < 90 || x > WORLD_W - 90 || y > WORLD_H - 90) return false;
  if (biomeIdAt(x, y) !== plan.biome || !hasTerrainClearance(x, y)) return false;
  if (plan.boundaryBiome && !nearBiome(x, y, plan.boundaryBiome)) return false;
  if (plan.biome === "winter") return winterSubzoneAt(x, y) === winterBandForLevel(level).id;
  return true;
}

export function exactWinterGeometry() {
  const bands = WINTER_BANDS.map((band) => ({
    id: band.id,
    min_level: band.minLevel,
    max_level: band.maxLevel,
    min_y: band.minY,
    max_y: band.maxY,
    polygons: [],
    area: 0,
    southern_extension_area: 0,
  }));
  const byId = new Map(bands.map((band) => [band.id, band]));

  for (let y0 = 0; y0 < WORLD_H; y0 += BIOME_CELL) {
    const y1 = Math.min(WORLD_H, y0 + BIOME_CELL);
    const sampleY = Math.min(WORLD_H - 1, y0 + BIOME_CELL / 2);
    const bandId = WINTER_BANDS.find((band) => sampleY >= band.minY && sampleY < band.maxY)?.id;
    if (!bandId) continue;
    let runStart = null;
    const flush = (x1) => {
      if (runStart === null) return;
      const polygon = [[runStart, y0], [x1, y0], [x1, y1], [runStart, y1]];
      const area = (x1 - runStart) * (y1 - y0);
      const band = byId.get(bandId);
      band.polygons.push(polygon);
      band.area += area;
      if (y1 > SOUTHERN_EXTENSION_Y) {
        band.southern_extension_area += (x1 - runStart) * (y1 - Math.max(y0, SOUTHERN_EXTENSION_Y));
      }
      runStart = null;
    };

    for (let x0 = 0; x0 < WORLD_W; x0 += BIOME_CELL) {
      const x1 = Math.min(WORLD_W, x0 + BIOME_CELL);
      const owned = biomeIdAt(Math.min(WORLD_W - 1, x0 + BIOME_CELL / 2), sampleY) === "winter";
      if (owned && runStart === null) runStart = x0;
      if (!owned) flush(x0);
      if (x1 === WORLD_W) flush(x1);
    }
  }

  const totalArea = bands.reduce((sum, band) => sum + band.area, 0);
  const southernArea = bands.reduce((sum, band) => sum + band.southern_extension_area, 0);
  return {
    ownership_rule: "biomeAt(x,y).id = winter",
    depth_function: "southward world-y bands after exact Winter biome ownership",
    biome_cell_size: BIOME_CELL,
    bands,
    total_area: totalArea,
    southern_extension: {
      min_y: SOUTHERN_EXTENSION_Y,
      area: southernArea,
      share_of_winter: Number((southernArea / totalArea).toFixed(6)),
    },
  };
}

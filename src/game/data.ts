import type { ItemDef, ItemId } from "./types";

export const ITEMS: Record<ItemId, ItemDef> = {
  copper_ore: { id: "copper_ore", name: "Copper Ore", stackable: true, value: 6, color: "#e0955f", kind: "resource" },
  oak_logs: { id: "oak_logs", name: "Oak Logs", stackable: true, value: 5, color: "#b98a5c", kind: "resource" },
  feather: { id: "feather", name: "Feather", stackable: true, value: 2, color: "#fdf3d8", kind: "resource" },
  goblin_charm: { id: "goblin_charm", name: "Goblin Charm", stackable: true, value: 14, color: "#a7d97f", kind: "resource" },
  bronze_dagger: { id: "bronze_dagger", name: "Bronze Dagger", stackable: false, value: 40, color: "#d9a066", kind: "weapon", attack: 4 },
  wooden_club: { id: "wooden_club", name: "Wooden Club", stackable: false, value: 15, color: "#b98a5c", kind: "weapon", attack: 2 },
  cloth_tunic: { id: "cloth_tunic", name: "Cloth Tunic", stackable: false, value: 18, color: "#f2c6d8", kind: "armor", defense: 2 },
  leather_vest: { id: "leather_vest", name: "Leather Vest", stackable: false, value: 45, color: "#c98f5a", kind: "armor", defense: 4 },
};

export const WORLD_W = 1400;
export const WORLD_H = 1000;
export const REGION_NAME = "Peaceful Fields";

export interface NodeSpawn {
  kind: "copper" | "oak";
  x: number;
  y: number;
}

export const NODE_SPAWNS: NodeSpawn[] = [
  { kind: "copper", x: 250, y: 210 },
  { kind: "copper", x: 350, y: 320 },
  { kind: "copper", x: 180, y: 400 },
  { kind: "copper", x: 1180, y: 800 },
  { kind: "oak", x: 980, y: 200 },
  { kind: "oak", x: 1120, y: 330 },
  { kind: "oak", x: 880, y: 380 },
  { kind: "oak", x: 240, y: 830 },
];

export interface MonsterSpawn {
  kind: "chicken" | "goblin";
  x: number;
  y: number;
}

export const MONSTER_SPAWNS: MonsterSpawn[] = [
  { kind: "chicken", x: 560, y: 780 },
  { kind: "chicken", x: 660, y: 850 },
  { kind: "chicken", x: 470, y: 880 },
  { kind: "chicken", x: 760, y: 720 },
  { kind: "goblin", x: 980, y: 700 },
  { kind: "goblin", x: 1120, y: 620 },
  { kind: "goblin", x: 1050, y: 860 },
];

export const MONSTER_DEFS = {
  chicken: { name: "Chicken", hp: 8, attack: 2, defense: 0, xp: 12, gold: [1, 4] as const, drop: "feather" as ItemId, dropChance: 0.7, body: "#fff6e0", accent: "#f2a154" },
  goblin: { name: "Goblin", hp: 22, attack: 5, defense: 2, xp: 34, gold: [4, 12] as const, drop: "goblin_charm" as ItemId, dropChance: 0.35, body: "#a7d97f", accent: "#6fae52" },
};

export const NODE_DEFS = {
  copper: { name: "Copper Rock", skill: "mining" as const, xp: 18, item: "copper_ore" as ItemId, time: 3.2, respawn: 9, color: "#b8a999", accent: "#e0955f" },
  oak: { name: "Oak Tree", skill: "woodcutting" as const, xp: 16, item: "oak_logs" as ItemId, time: 3.0, respawn: 8, color: "#8a6a45", accent: "#79c46b" },
};

export const BUILDINGS = [
  { name: "Forge", x: 560, y: 300, w: 130, h: 100, roof: "#d98b6a", wall: "#f0d9c0" },
  { name: "Market Stall", x: 720, y: 330, w: 120, h: 90, roof: "#8fbfd9", wall: "#fdf1dd" },
  { name: "Grand Haven Inn", x: 640, y: 170, w: 150, h: 110, roof: "#c9a7e0", wall: "#fdf1dd" },
];

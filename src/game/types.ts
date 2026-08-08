export type SkillId =
  | "combat"
  | "mining"
  | "woodcutting"
  | "gathering"
  | "smithing"
  | "skinning"
  | "tailoring";

export const SKILL_IDS: SkillId[] = [
  "combat",
  "mining",
  "woodcutting",
  "gathering",
  "smithing",
  "skinning",
  "tailoring",
];

export type ItemId = string;

export type ItemFamily =
  | "ore"
  | "log"
  | "herb"
  | "berries"
  | "hide"
  | "leather"
  | "feather"
  | "charm"
  | "bar"
  | "cloth"
  | "bun"
  | "pie"
  | "stew"
  | "tonic"
  | "weapon"
  | "armor";

export interface ItemDef {
  id: ItemId;
  name: string;
  stackable: boolean;
  value: number;
  color: string;
  kind: "resource" | "weapon" | "armor" | "food" | "material";
  /** icon shape family */
  family?: ItemFamily;
  attack?: number;
  defense?: number;
  heal?: number;
}

export interface InvSlot {
  id: ItemId;
  qty: number;
  /** upgrade level 0..25, gear only */
  plus?: number;
}

export interface Skill {
  xp: number;
}

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  kind: "kill" | "gather";
  /** monster kind for kill quests, item id for gather quests */
  key: string;
  count: number;
  gold: number;
  xpSkill: SkillId;
  xp: number;
  reward?: ItemId;
}

export interface QuestState {
  id: string;
  progress: number;
}

export interface EquipState {
  id: ItemId;
  plus: number;
}

export interface SaveState {
  v: number;
  px: number;
  py: number;
  hp: number;
  gold: number;
  inv: (InvSlot | null)[];
  skills: Record<string, Skill>;
  weapon: EquipState | ItemId | null;
  armor: EquipState | ItemId | null;
  food?: ItemId | null;
  quest?: QuestState | null;
  completed?: string[];
  discovered?: string[];
  listings?: unknown[];
  clock?: number;
}


export interface HudQuest {
  id: string;
  name: string;
  desc: string;
  progress: number;
  count: number;
  ready: boolean;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  gold: number;
  level: number;
  region: string;
  regionLevel: string;
  skills: Record<SkillId, { level: number; xp: number; progress: number; into: number; need: number }>;
  inv: (InvSlot | null)[];
  weapon: EquipState | null;
  armor: EquipState | null;
  food: ItemId | null;
  activity: string;
  activityProgress: number;
  quest: HudQuest | null;
  completed: string[];
  discovered: string[];
  attack: number;
  defense: number;
  /** 0..1 through the in-game day */
  timeOfDay: number;
  phase: "Dawn" | "Day" | "Dusk" | "Night";
  market: {
    listings: import("./market").Listing[];
    log: import("./market").TradeLog[];
    fee: number;
  };
  soundOn: boolean;
  /** Phase 7 — your display name and how many real players are nearby. */
  name: string;
  nearby: number;
}


export type SkillId = "mining" | "woodcutting" | "combat";

export type ItemId =
  | "copper_ore"
  | "oak_logs"
  | "feather"
  | "goblin_charm"
  | "bronze_dagger"
  | "wooden_club"
  | "cloth_tunic"
  | "leather_vest"
  | "steel_sword"
  | "iron_mail"
  | "honey_bun";

export interface ItemDef {
  id: ItemId;
  name: string;
  stackable: boolean;
  value: number;
  color: string;
  kind: "resource" | "weapon" | "armor" | "food";
  attack?: number;
  defense?: number;
  heal?: number;
}

export interface InvSlot {
  id: ItemId;
  qty: number;
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

export interface SaveState {
  v: number;
  px: number;
  py: number;
  hp: number;
  gold: number;
  inv: (InvSlot | null)[];
  skills: Record<SkillId, Skill>;
  weapon: ItemId | null;
  armor: ItemId | null;
  quest?: QuestState | null;
  completed?: string[];
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
  skills: Record<SkillId, { level: number; xp: number; progress: number; into: number; need: number }>;
  inv: (InvSlot | null)[];
  weapon: ItemId | null;
  armor: ItemId | null;
  activity: string;
  activityProgress: number;
  quest: HudQuest | null;
  completed: string[];
  attack: number;
  defense: number;
}

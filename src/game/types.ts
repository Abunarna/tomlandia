export type SkillId = "mining" | "woodcutting" | "combat";

export type ItemId =
  | "copper_ore"
  | "oak_logs"
  | "feather"
  | "goblin_charm"
  | "bronze_dagger"
  | "wooden_club"
  | "cloth_tunic"
  | "leather_vest";

export interface ItemDef {
  id: ItemId;
  name: string;
  stackable: boolean;
  value: number;
  color: string;
  kind: "resource" | "weapon" | "armor";
  attack?: number;
  defense?: number;
}

export interface InvSlot {
  id: ItemId;
  qty: number;
}

export interface Skill {
  xp: number;
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
}

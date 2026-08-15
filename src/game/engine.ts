import {
  BARRIERS,
  BRIDGES,
  BIOMES,
  BUILDINGS,
  STREETS,
  ROAD_RUNS,
  MAX_PLUS,
  MONSTER_DEFS,
  MONSTER_SPAWNS,
  NODE_DEFS,
  NODE_SPAWNS,
  NPCS,
  QUESTS,
  RECIPES,
  SHOP_STOCK,
  WORLD_H,
  WORLD_W,
  biomeAt,
  blockedAt,
  ITEMS,
  item,
  statWithPlus,
  upgradeCost,
  monsterLevel,
  type BiomeDef,
  type MonsterKind,
  type NodeKind,
  NPC_ICONS,
  type NpcDef,
  type NpcRole,
  LAKES,
  FISHING_SPOTS,
  FISH_CAST_TIME,
  type LakeDef,
} from "./data";
import { TILE_H, TILE_W } from "./data";
import { levelFromXp } from "./progression";
import { sfx } from "./audio";
import {
  MARKET_FEE,
  feeFor,
  priceKey,
  suggestedPrice,
  tradeText,
  type BrowseRes,
  type Listing,
  type MarketRes,
  type TradeLog,
} from "./market";
import { STALE_MS, type PresencePacket } from "./presence";
import { SKILL_IDS, type EquipState, type HudSnapshot, type InvSlot, type ItemId, type QuestState, type SaveState, type SkillId } from "./types";

/**
 * Phase 9 — the server owns progression. Every action routine returns the
 * player's authoritative inventory / gold / skill XP, which replaces whatever
 * the client thought it had.
 */
export interface ServerState {
  inv?: InvSlot[] | null;
  gold?: number | null;
  skills?: Partial<Record<SkillId, { xp: number }>> | null;
  /** Gear, snack and bank are server-owned too, so they can never be lost. */
  weapon?: EquipState | ItemId | null;
  armor?: EquipState | ItemId | null;
  food?: ItemId | null;
  bank?: { gold?: number; items?: (InvSlot | null)[] } | null;
}

/** Generic reply from the small bag/gear/bank routines. */
export interface GearRes {
  ok: boolean;
  reason?: string;
  cost?: number;
  plus?: number;
  state?: ServerState;
}


/** Reply from the row-locking cloud save routine. */
export interface SyncAck {
  ok?: boolean;
  rev?: number;
  conflict?: boolean;
  data?: SaveState;
}


/** Authoritative reply from the shared-world harvest routine. */
export interface HarvestRes {
  ok: boolean;
  reason?: string;
  charges?: number;
  respawn_at?: string | null;
  item?: ItemId;
  qty?: number;
  skill?: SkillId;
  xp?: number;
  leveled?: boolean;
  req?: number;
  state?: ServerState;
}

/** Authoritative reply from the shared-world combat routine. */
export interface DamageRes {
  ok: boolean;
  reason?: string;
  /** Damage the server decided we dealt. */
  dmg?: number;
  /** Damage the server decided the monster dealt back. */
  taken?: number;
  hp?: number;
  max_hp?: number;
  killed?: boolean;
  credited?: boolean;
  kind?: string;
  gold?: number;
  loot?: { item?: ItemId; id?: ItemId; qty: number }[];
  xp?: number;
  leveled?: boolean;
  tagged_by?: string | null;
  respawn_at?: string | null;
  buff?: { dmg: number; hits: number };
  state?: ServerState;
}

/** Authoritative reply from the fishing routine. */
export interface FishRes {
  ok: boolean;
  reason?: string;
  item?: ItemId;
  qty?: number;
  skill?: SkillId;
  xp?: number;
  leveled?: boolean;
  state?: ServerState;
}

/** Authoritative reply from drinking a potion. */
export interface PotionRes {
  ok: boolean;
  reason?: string;
  buff?: { dmg: number; hits: number; item?: string };
  state?: ServerState;
}

/** Authoritative reply from the crafting routine. */
export interface CraftRes {
  ok: boolean;
  reason?: string;
  out?: ItemId;
  out_qty?: number;
  skill?: SkillId;
  xp?: number;
  leveled?: boolean;
  req?: number;
  item?: ItemId;
  state?: ServerState;
}

/** Another real player, mirrored from realtime presence broadcasts. */
export interface RemotePlayer {
  id: string;
  name: string;
  level: number;
  /** Rendered (interpolated) position. */
  x: number;
  y: number;
  /** Latest received position, interpolated toward. */
  tx: number;
  ty: number;
  f: number;
  act: string;
  seen: number;
  bob: number;
}

/** Legacy pre-accounts local save. Read once so old progress can be claimed. */
export const LEGACY_SAVE_KEY = "tomlandia.save.v1";

export function readLegacySave(): SaveState | null {
  try {
    const raw = localStorage.getItem(LEGACY_SAVE_KEY);
    return raw ? (JSON.parse(raw) as SaveState) : null;
  } catch {
    return null;
  }
}

export function clearLegacySave() {
  try {
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    /* ignore */
  }
}
const INV_SIZE = 20;
const BANK_SIZE = 60;
const AUTO_EAT_AT = 0.3;
/** length of one in-game day, in seconds */
const DAY_LEN = 480;

interface Villager {
  x: number;
  y: number;
  hx: number;
  hy: number;
  tx: number;
  ty: number;
  wait: number;
  robe: string;
  hair: string;
}

interface LiveNpc {
  role: NpcRole;
  x: number;
  y: number;
  hx: number;
  hy: number;
  tx: number;
  ty: number;
  wait: number;
}

interface Leaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  life: number;
  color: string;
}


interface ResNode {
  id: number;
  kind: NodeKind;
  x: number;
  y: number;
  depleted: boolean;
  /** Shared charges left before the node depletes for everyone. */
  charges: number;
  /** Epoch ms; authoritative respawn time from the server. */
  respawnAt: number;
  /** A harvest request is in flight. */
  pending: boolean;
  sway: number;
}

interface Monster {
  id: number;
  kind: MonsterKind;
  x: number;
  y: number;
  hx: number;
  hy: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  /** Epoch ms; authoritative respawn time from the server. */
  respawnAt: number;
  /** First player to hit it — they own the kill credit and loot. */
  taggedBy: string | null;
  /** A damage request is in flight. */
  pending: boolean;
  wanderAt: number;
  hitFlash: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface Orb {
  x: number;
  y: number;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

type Target =
  | { type: "none" }
  | { type: "point"; x: number; y: number }
  | { type: "node"; id: number }
  | { type: "monster"; id: number }
  | { type: "npc"; id: NpcRole }
  | { type: "fish"; id: number };

const emptySkills = (): Record<SkillId, { xp: number }> =>
  SKILL_IDS.reduce((acc, id) => ({ ...acc, [id]: { xp: 0 } }), {} as Record<SkillId, { xp: number }>);

export class GameEngine {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private last = 0;
  private time = 0;
  private cam = { x: 0, y: 0 };
  private dpr = 1;

  // player
  px = WORLD_W / 6;
  py = 620;
  hp = 30;
  gold = 0;
  facing = 1;
  private moveT = 0;

  skills = emptySkills();
  inv: (InvSlot | null)[] = new Array(INV_SIZE).fill(null);
  bank: { gold: number; items: (InvSlot | null)[] } = {
    gold: 0,
    items: new Array(BANK_SIZE).fill(null),
  };
  weapon: EquipState | null = { id: "wooden_club", plus: 0 };
  armor: EquipState | null = { id: "cloth_tunic", plus: 0 };
  food: ItemId | null = null;

  private nodes: ResNode[] = [];
  private monsters: Monster[] = [];
  private texts: FloatText[] = [];
  private orbs: Orb[] = [];
  private parts: Particle[] = [];
  private butterflies: { x: number; y: number; p: number; s: number }[] = [];
  private villagers: Villager[] = [];
  private npcState: LiveNpc[] = [];
  /** Phase 7 — nearby real players from the presence shards. */
  remotes = new Map<string, RemotePlayer>();
  playerName = "Adventurer";
  private leaves: Leaf[] = [];

  private target: Target = { type: "none" };
  private gatherProgress = 0;
  private combatCd = 0;
  private regenCd = 0;
  private activity = "Wandering";
  private activityProgress = 0;
  private biome: BiomeDef = BIOMES[0]!;
  private blockedFor = 0;

  quest: QuestState | null = null;
  completed: string[] = [];
  discovered: string[] = ["fields"];
  onInteract: ((id: NpcRole) => void) | null = null;

  /** Phase 3 — marketplace + world clock */
  listings: Listing[] = [];
  tradeLog: TradeLog[] = [];
  private marketCd = 3;
  /** True while the Market panel is open — gates periodic market polling. */
  marketVisible = false;

  private clock = DAY_LEN * 0.35;

  joystick = { active: false, dx: 0, dy: 0 };
  private onHud: (s: HudSnapshot) => void;
  private hudCd = 0;
  private fishCd = 0;
  private fishPending = false;
  private potionPending = false;
  private saveCd = 30;


  /**
   * Progress is persisted to the cloud by the host app, never to localStorage.
   * The host resolves to the authoritative row so a stale client copy can never
   * overwrite rewards the server already committed.
   */
  private persist: ((s: SaveState, rev: number | null) => PromiseLike<SyncAck | null>) | null = null;

  /** Row version we last saw; `null` means "unknown, treat my copy as stale". */
  private rev: number | null = null;
  private syncing = false;
  private syncQueued = false;

  constructor(
    canvas: HTMLCanvasElement,
    onHud: (s: HudSnapshot) => void,
    opts?: {
      initialSave?: SaveState | null;
      initialRev?: number | null;
      onPersist?: (s: SaveState, rev: number | null) => PromiseLike<SyncAck | null>;
    },
  ) {
    this.persist = opts?.onPersist ?? null;
    this.rev = opts?.initialRev ?? null;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onHud = onHud;

    this.nodes = NODE_SPAWNS.map((n, i) => ({
      id: i,
      kind: n.kind,
      x: n.x,
      y: n.y,
      depleted: false,
      charges: 4,
      respawnAt: 0,
      pending: false,
      sway: Math.random() * 6,
    }));
    this.monsters = MONSTER_SPAWNS.map((m, i) => {
      const d = MONSTER_DEFS[m.kind];
      return {
        id: i,
        kind: m.kind,
        x: m.x,
        y: m.y,
        hx: m.x,
        hy: m.y,
        hp: d.hp,
        maxHp: d.hp,
        dead: false,
        respawnAt: 0,
        taggedBy: null,
        pending: false,
        wanderAt: 0,
        hitFlash: 0,
      };
    });
    for (let i = 0; i < 20; i++) {
      this.butterflies.push({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, p: Math.random() * 10, s: 0.4 + Math.random() * 0.6 });
    }
    this.spawnVillagers();
    this.spawnNpcs();

    this.load(opts?.initialSave ?? null);
    this.biome = biomeAt(this.px, this.py);
    this.resize();
  }

  /* ---------- phase 8: shared world state ---------- */

  /** Our own user id, so we can tell whether we own a monster's kill credit. */
  userId = "";
  /** Server-side harvest. Position is sent so the server can verify range. */
  onHarvest: ((id: number, x: number, y: number) => Promise<HarvestRes>) | null = null;
  /** Server-side attack. The server decides the damage — we never send it. */
  onAttack: ((id: number, x: number, y: number) => Promise<DamageRes>) | null = null;
  /** Server-side crafting. The server checks materials and grants the result. */
  onCraft: ((recipe: string) => Promise<CraftRes>) | null = null;
  /** Server-side fishing cast. The server rolls the catch from the shared table. */
  onFish: ((id: number, x: number, y: number) => Promise<FishRes>) | null = null;
  /** Server-side potion use. The server stores the damage buff on our save. */
  onPotion: ((itemId: string) => Promise<PotionRes>) | null = null;
  /** Server-side equip/unequip (or set snack) — keeps bag and gear in one row lock. */
  onEquip: ((index: number) => Promise<GearRes>) | null = null;
  /** Server-side gear upgrade (+1), paying gold under the same row lock. */
  onUpgrade: ((which: "weapon" | "armor") => Promise<GearRes>) | null = null;
  /** Server-side drop of a bag stack. */
  onDrop: ((index: number) => Promise<GearRes>) | null = null;
  /** Server-side sale of a bag stack to an NPC merchant. */
  onSell: ((index: number) => Promise<GearRes>) | null = null;
  /** Server-side bank gold move. */
  onBankGold: ((dir: "in" | "out", amount: number) => Promise<GearRes>) | null = null;
  /** Server-side bank item move. */
  onBankItem: ((dir: "in" | "out", index: number, qty: number) => Promise<GearRes>) | null = null;


  /** Active damage buff from a potion — mirrored from the server. */
  buff: { dmg: number; hits: number } | null = null;

  /** Most recent death event shown as a fullscreen red overlay. */
  death: { at: number; reason: string } | null = null;

  /** Mirror authoritative node rows (snapshot or realtime) into the world. */
  applyNodeRows(rows: { id: number; charges: number; respawn_at: string | null }[]) {
    for (const row of rows) {
      const n = this.nodes[row.id];
      if (!n) continue;
      n.charges = row.charges;
      n.respawnAt = row.respawn_at ? Date.parse(row.respawn_at) : 0;
      n.depleted = n.respawnAt > Date.now();
      if (n.depleted && this.target.type === "node" && this.target.id === n.id) {
        this.target = { type: "none" };
        this.gatherProgress = 0;
      }
    }
  }

  /** Mirror authoritative monster rows (snapshot or realtime) into the world. */
  applyMonsterRows(rows: { id: number; hp: number; tagged_by: string | null; respawn_at: string | null }[]) {
    for (const row of rows) {
      const m = this.monsters[row.id];
      if (!m) continue;
      const prevHp = m.hp;
      m.hp = row.hp;
      m.taggedBy = row.tagged_by;
      m.respawnAt = row.respawn_at ? Date.parse(row.respawn_at) : 0;
      const dead = m.respawnAt > Date.now();
      if (dead && !m.dead) m.dead = true;
      if (!dead && m.dead) {
        m.dead = false;
        m.hp = row.hp;
        m.x = m.hx;
        m.y = m.hy;
      }
      if (row.hp < prevHp) m.hitFlash = 0.2;
      if (m.dead && this.target.type === "monster" && this.target.id === m.id) {
        this.target = { type: "none" };
      }
    }
  }

  /* ---------- phase 7: shared presence ---------- */

  /** What we broadcast to our cell's neighbours. */
  presenceState() {
    return {
      name: this.playerName,
      level: this.lvl("combat"),
      x: Math.round(this.px),
      y: Math.round(this.py),
      f: this.facing,
      act: this.activity,
    };
  }

  applyPresence(p: PresencePacket) {
    const cur = this.remotes.get(p.id);
    if (cur) {
      cur.tx = p.x;
      cur.ty = p.y;
      cur.f = p.f;
      cur.act = p.act;
      cur.name = p.name;
      cur.level = p.level;
      cur.seen = Date.now();
    } else {
      this.remotes.set(p.id, {
        id: p.id,
        name: p.name,
        level: p.level,
        x: p.x,
        y: p.y,
        tx: p.x,
        ty: p.y,
        f: p.f,
        act: p.act,
        seen: Date.now(),
        bob: Math.random() * 6,
      });
    }
  }

  removeRemote(id: string) {
    this.remotes.delete(id);
  }

  /** Smoothly ease remote avatars toward their last reported position. */
  private tickRemotes(dt: number) {
    const now = Date.now();
    for (const [id, r] of this.remotes) {
      if (now - r.seen > STALE_MS) {
        this.remotes.delete(id);
        continue;
      }
      const k = Math.min(1, dt * 7);
      const dx = r.tx - r.x;
      const dy = r.ty - r.y;
      // Teleport on huge jumps (respawn / fast travel) instead of sliding.
      if (Math.abs(dx) > 600 || Math.abs(dy) > 600) {
        r.x = r.tx;
        r.y = r.ty;
      } else {
        r.x += dx * k;
        r.y += dy * k;
      }
      if (Math.abs(dx) + Math.abs(dy) > 1.5) r.bob += dt * 9;
    }
  }

  private spawnNpcs() {
    this.npcState = NPCS.map((n) => ({
      role: n.id,
      x: n.x,
      y: n.y,
      hx: n.x,
      hy: n.y,
      tx: n.x,
      ty: n.y,
      wait: Math.random() * 4,
    }));
  }

  private npcPos(role: NpcRole): LiveNpc | undefined {
    return this.npcState.find((n) => n.role === role);
  }

  /** Pick a wander destination near home that is walkable and not on top of another NPC. */
  private pickNpcTarget(n: LiveNpc) {
    for (let i = 0; i < 8; i++) {
      const x = n.hx + (Math.random() - 0.5) * 80;
      const y = n.hy + (Math.random() - 0.5) * 80;
      if (blockedAt(x, y, 10)) continue;
      let clash = false;
      for (const o of this.npcState) {
        if (o === n) continue;
        if (Math.hypot(o.x - x, o.y - y) < 36) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      n.tx = x;
      n.ty = y;
      return;
    }
    n.tx = n.x;
    n.ty = n.y;
  }

  private spawnVillagers() {
    const towns: [number, number][] = [
      [700, 300],
      [TILE_W * 2 + 690, 320],
      [TILE_W + 740, 570],
      [740, TILE_H + 330],
    ];
    const robes = ["#f2c6d8", "#9fd6b8", "#f5d78a", "#bcd9ec", "#e0bff0", "#f6c9a8"];
    const hairs = ["#5c3a2e", "#3f5f78", "#8a6a45", "#e6e0ef", "#6b4f7a"];
    for (const [tx, ty] of towns) {
      for (let i = 0; i < 4; i++) {
        const x = tx + (Math.random() - 0.5) * 220;
        const y = ty + (Math.random() - 0.5) * 160;
        this.villagers.push({
          x,
          y,
          hx: tx,
          hy: ty,
          tx: x,
          ty: y,
          wait: Math.random() * 3,
          robe: robes[Math.floor(Math.random() * robes.length)]!,
          hair: hairs[Math.floor(Math.random() * hairs.length)]!,
        });
      }
    }
  }


  /* ---------- persistence ---------- */

  get maxHp() {
    return 30 + (this.lvl("combat") - 1) * 6;
  }

  private lvl(skill: SkillId) {
    return levelFromXp(this.skills[skill]?.xp ?? 0).level;
  }

  private toSave(): SaveState {
    return {
      v: 3,
      px: this.px,
      py: this.py,
      hp: this.hp,
      gold: this.gold,
      inv: this.inv,
      bank: this.bank,
      skills: this.skills,
      weapon: this.weapon,
      armor: this.armor,
      food: this.food,
      quest: this.quest,
      completed: this.completed,
      discovered: this.discovered,
      clock: this.clock,
    };
  }


  /**
   * Single writer for the cloud save. The row is merged server-side under a
   * row lock, so a stale local copy can never clobber server-granted rewards.
   */
  private pushSave(toast: boolean) {
    if (!this.persist) return;
    if (this.syncing) {
      this.syncQueued = true;
      return;
    }
    this.syncing = true;
    try {
      const p = this.persist(this.toSave(), this.rev);
      void Promise.resolve(p)
        .then((ack) => {
          if (ack && typeof ack.rev === "number") this.rev = ack.rev;
          if (ack?.conflict && ack.data) {
            // The server had newer economy state than we did — take theirs.
            this.applyAuthoritative(ack.data);
            this.emitHud(true);
          }
        })
        .catch(() => {
          this.rev = null;
        })
        .then(() => {
          this.syncing = false;
          if (this.syncQueued) {
            this.syncQueued = false;
            this.pushSave(false);
          }
        });
    } catch {
      this.syncing = false;
    }
    if (toast) this.pushText(this.px, this.py - 40, "Saved", "#9fd6f5");
  }

  /** Persist without the "Saved" toast — used after local gold changes. */
  private syncNow() {
    this.pushSave(false);
  }

  save() {
    this.pushSave(true);
  }

  /** Adopt the server-owned economy fields from an authoritative row. */
  private applyAuthoritative(s: SaveState) {
    if (Array.isArray(s.inv)) {
      this.inv = s.inv.slice(0, INV_SIZE).map((x) => (x ? { ...x } : null));
      while (this.inv.length < INV_SIZE) this.inv.push(null);
    }
    if (typeof s.gold === "number") this.gold = s.gold;
    if (s.skills) {
      for (const id of SKILL_IDS) {
        const xp = s.skills[id]?.xp;
        if (typeof xp === "number") this.skills[id] = { xp };
      }
      this.hp = Math.min(this.hp, this.maxHp);
    }
    this.applyGearState(s);
  }

  /** Gear, snack and bank now live server-side — mirror them verbatim. */
  private applyGearState(s: {
    weapon?: EquipState | ItemId | null;
    armor?: EquipState | ItemId | null;
    food?: ItemId | null;
    bank?: { gold?: number; items?: (InvSlot | null)[] } | null;
  }) {
    if ("weapon" in s) this.weapon = GameEngine.toEquip(s.weapon);
    if ("armor" in s) this.armor = GameEngine.toEquip(s.armor);
    if ("food" in s) this.food = s.food ?? null;
    if (s.bank) {
      const items = Array.isArray(s.bank.items) ? s.bank.items.slice(0, BANK_SIZE) : [];
      while (items.length < BANK_SIZE) items.push(null);
      this.bank = {
        gold: typeof s.bank.gold === "number" ? s.bank.gold : this.bank.gold,
        items: items.map((x) => (x ? { ...x } : null)),
      };
    }
  }



  /** Replace the live state with a save (used for claiming old local progress). */
  applySave(s: SaveState) {
    this.load(s);
    this.emitHud(true);
    this.save();
  }

  private static toEquip(v: EquipState | ItemId | null | undefined): EquipState | null {
    if (!v) return null;
    if (typeof v === "string") return { id: v, plus: 0 };
    return { id: v.id, plus: v.plus ?? 0 };
  }

  /** nudge the hero out of a barrier (old saves, or a ridge grown over them) */
  private unstick() {
    if (!blockedAt(this.px, this.py, 12)) return;
    for (let r = 24; r <= 400; r += 24) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const x = this.px + Math.cos(ang) * r;
        const y = this.py + Math.sin(ang) * r;
        if (x < 20 || y < 20 || x > WORLD_W - 20 || y > WORLD_H - 20) continue;
        if (!blockedAt(x, y, 12)) {
          this.px = x;
          this.py = y;
          return;
        }
      }
    }
  }

  private load(s: SaveState | null) {
    if (!s) {
      this.unstick();
      return;
    }
    try {
      this.px = s.px ?? this.px;
      this.py = s.py ?? this.py;
      this.gold = s.gold ?? 0;
      this.inv = Array.isArray(s.inv) ? s.inv.slice(0, INV_SIZE) : this.inv;
      while (this.inv.length < INV_SIZE) this.inv.push(null);
      const bankItems = Array.isArray(s.bank?.items) ? s.bank!.items.slice(0, BANK_SIZE) : [];
      while (bankItems.length < BANK_SIZE) bankItems.push(null);
      this.bank = { gold: Math.max(0, Math.floor(s.bank?.gold ?? 0)), items: bankItems };
      if (s.skills) {
        for (const id of SKILL_IDS) {
          const xp = s.skills[id]?.xp;
          if (typeof xp === "number") this.skills[id] = { xp };
        }
      }
      this.weapon = GameEngine.toEquip(s.weapon);
      this.armor = GameEngine.toEquip(s.armor);
      this.food = s.food ?? null;
      this.quest = s.quest ?? null;
      this.completed = Array.isArray(s.completed) ? s.completed : [];
      this.discovered = Array.isArray(s.discovered) && s.discovered.length ? s.discovered : ["fields"];
      if (typeof s.clock === "number") this.clock = s.clock;

      this.hp = Math.min(s.hp ?? this.maxHp, this.maxHp);
    } catch {
      /* ignore */
    }
    this.unstick();
  }


  reset() {
    this.persist = null;
  }

  /* ---------- inventory ---------- */

  countItem(id: ItemId): number {
    return this.inv.reduce((n, s) => (s && s.id === id ? n + s.qty : n), 0);
  }

  private removeItem(id: ItemId, qty: number): boolean {
    if (this.countItem(id) < qty) return false;
    let left = qty;
    for (let i = 0; i < this.inv.length && left > 0; i++) {
      const s = this.inv[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(left, s.qty);
      s.qty -= take;
      left -= take;
      if (s.qty <= 0) this.inv[i] = null;
    }
    return true;
  }

  addItem(id: ItemId, qty = 1, plus = 0): boolean {
    const def = item(id);
    if (def.stackable) {
      const slot = this.inv.find((s) => s && s.id === id);
      if (slot) {
        slot.qty += qty;
        return true;
      }
    }
    const idx = this.inv.findIndex((s) => s === null);
    if (idx === -1) {
      this.pushText(this.px, this.py - 50, "Bag full!", "#f2a1a1");
      return false;
    }
    this.inv[idx] = { id, qty, plus };
    return true;
  }

  /** Merchant price for a bag stack — upgraded gear is worth more. */
  sellValue(slot: InvSlot | null): number {
    if (!slot) return 0;
    return Math.max(0, Math.floor(item(slot.id).value * slot.qty * (1 + 0.1 * (slot.plus ?? 0))));
  }

  /** Sell a bag slot (weapons and armour included) to an NPC merchant. */
  sellSlot(index: number) {
    const slot = this.inv[index];
    if (!slot) return;
    const earned = this.sellValue(slot);
    this.gold += earned;
    this.inv[index] = null;
    this.pushText(this.px, this.py - 50, `+${earned}g`, "#ffe08a");
    this.emitHud(true);
    this.runGear(this.onSell ? this.onSell(index) : null);
  }

  /**
   * Bag / gear / bank changes are resolved server-side under the same row lock
   * the world actions use, so an in-flight reward can never wipe them (and a
   * stale client can never resurrect an item it no longer owns). We apply the
   * change locally first for instant feedback, then adopt the server's answer.
   */
  private runGear(p: Promise<GearRes> | null) {
    if (!p) {
      // No server binding (tests/offline): fall back to a plain cloud save.
      this.syncNow();
      this.emitHud(true);
      return;
    }
    void p
      .then((res) => {
        if (res?.state) this.applyServerState(res.state);
        else {
          // Rejected: re-read the authoritative row instead of trusting our copy.
          this.rev = null;
          this.syncNow();
        }
        this.emitHud(true);
      })
      .catch(() => {
        this.rev = null;
        this.syncNow();
      });
  }

  /** Discard a stack outright. */
  dropSlot(index: number) {
    const slot = this.inv[index];
    if (!slot) return;
    const def = item(slot.id);
    this.inv[index] = null;
    this.pushText(this.px, this.py - 40, `Dropped ${def.name}`, "#cbb9a4");
    this.emitHud(true);
    this.runGear(this.onDrop ? this.onDrop(index) : null);
  }


  /* ---------- bank ---------- */

  depositGold(amount: number) {
    const amt = Math.min(Math.max(0, Math.floor(amount)), this.gold);
    if (amt <= 0) return;
    this.gold -= amt;
    this.bank.gold += amt;
    this.emitHud(true);
    this.runGear(this.onBankGold ? this.onBankGold("in", amt) : null);
  }

  withdrawGold(amount: number) {
    const amt = Math.min(Math.max(0, Math.floor(amount)), this.bank.gold);
    if (amt <= 0) return;
    this.bank.gold -= amt;
    this.gold += amt;
    this.emitHud(true);
    this.runGear(this.onBankGold ? this.onBankGold("out", amt) : null);
  }

  private bankAdd(slot: InvSlot, qty: number): boolean {
    const def = item(slot.id);
    if (def.stackable) {
      const existing = this.bank.items.find((s) => s && s.id === slot.id);
      if (existing) {
        existing.qty += qty;
        return true;
      }
    }
    const idx = this.bank.items.findIndex((s) => s === null);
    if (idx === -1) {
      this.pushText(this.px, this.py - 50, "Bank full!", "#f2a1a1");
      return false;
    }
    this.bank.items[idx] = { id: slot.id, qty, plus: slot.plus ?? 0 };
    return true;
  }

  depositItem(bagIndex: number, qty = 1) {
    const slot = this.inv[bagIndex];
    if (!slot) return;
    const take = Math.min(Math.max(1, Math.floor(qty)), slot.qty);
    if (!this.bankAdd(slot, take)) return;
    slot.qty -= take;
    if (slot.qty <= 0) this.inv[bagIndex] = null;
    this.emitHud(true);
    this.runGear(this.onBankItem ? this.onBankItem("in", bagIndex, take) : null);
  }

  withdrawItem(bankIndex: number, qty = 1) {
    const slot = this.bank.items[bankIndex];
    if (!slot) return;
    const take = Math.min(Math.max(1, Math.floor(qty)), slot.qty);
    if (!this.addItem(slot.id, take, slot.plus ?? 0)) return;
    slot.qty -= take;
    if (slot.qty <= 0) this.bank.items[bankIndex] = null;
    this.emitHud(true);
    this.runGear(this.onBankItem ? this.onBankItem("out", bankIndex, take) : null);
  }

  equipSlot(index: number) {
    const slot = this.inv[index];
    if (!slot) return;
    const def = item(slot.id);
    if (def.kind === "food") {
      this.food = slot.id;
      this.pushText(this.px, this.py - 40, `${def.name} set as snack`, "#ffe0a8");
      this.emitHud(true);
      this.runGear(this.onEquip ? this.onEquip(index) : null);
      return;
    }
    if (def.kind !== "weapon" && def.kind !== "armor") return;
    const prev = def.kind === "weapon" ? this.weapon : this.armor;
    const next: EquipState = { id: slot.id, plus: slot.plus ?? 0 };
    if (def.kind === "weapon") this.weapon = next;
    else this.armor = next;
    this.inv[index] = prev ? { id: prev.id, qty: 1, plus: prev.plus } : null;
    this.emitHud(true);
    this.runGear(this.onEquip ? this.onEquip(index) : null);
  }


  /* ---------- combat stats ---------- */

  get attack() {
    const lvl = this.lvl("combat");
    const w = this.weapon;
    const base = w ? (item(w.id).attack ?? 0) : 0;
    const a = this.armor;
    const armorAtk = a ? (item(a.id).attack ?? 0) : 0;
    return Math.round(
      3 + lvl + statWithPlus(base, w?.plus ?? 0) + statWithPlus(armorAtk, a?.plus ?? 0),
    );
  }

  get defense() {
    const lvl = this.lvl("combat");
    const a = this.armor;
    const base = a ? (item(a.id).defense ?? 0) : 0;
    return Math.round(Math.floor(lvl / 2) + statWithPlus(base, a?.plus ?? 0));
  }

  /** Seconds between swings — cloth/leather armor trades defense for speed. */
  get attackInterval() {
    const a = this.armor;
    const bonus = a ? (item(a.id).speed ?? 0) : 0;
    return Math.max(0.5, 1 * (1 - bonus));
  }

  private grantXp(skill: SkillId, amount: number) {
    const before = this.lvl(skill);
    this.skills[skill].xp += amount;
    const after = this.lvl(skill);
    this.orbs.push({ x: this.px + (Math.random() - 0.5) * 30, y: this.py - 20, life: 0.9 });
    if (after > before) {
      sfx.play("level");
      this.pushText(this.px, this.py - 70, `${skill.toUpperCase()} LV ${after}!`, "#ffd98e");

      for (let i = 0; i < 18; i++) {
        this.parts.push({
          x: this.px,
          y: this.py - 10,
          vx: (Math.random() - 0.5) * 120,
          vy: -Math.random() * 130,
          life: 1,
          color: "#ffe6a7",
          size: 2 + Math.random() * 2,
        });
      }
      if (skill === "combat") this.hp = this.maxHp;
    }
  }

  private pushText(x: number, y: number, text: string, color: string) {
    this.texts.push({ x, y, text, color, life: 2.2 });
  }

  /* ---------- input ---------- */

  tapWorld(sx: number, sy: number) {
    const rect = this.canvas.getBoundingClientRect();
    const wx = sx - rect.left + this.cam.x;
    const wy = sy - rect.top + this.cam.y;

    let best: { d: number; t: Target } | null = null;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - wx, m.y - wy);
      if (d < 40 && (!best || d < best.d)) best = { d, t: { type: "monster", id: m.id } };
    }
    for (const n of this.nodes) {
      if (n.depleted) continue;
      const d = Math.hypot(n.x - wx, n.y - wy - 10);
      if (d < 40 && (!best || d < best.d)) best = { d, t: { type: "node", id: n.id } };
    }
    for (const sp of FISHING_SPOTS) {
      const d = Math.hypot(sp.x - wx, sp.y - wy);
      if (d < 42 && (!best || d < best.d)) best = { d, t: { type: "fish", id: sp.id } };
    }
    for (const npc of this.npcState) {
      const d = Math.hypot(npc.x - wx, npc.y - wy - 8);
      if (d < 44 && (!best || d < best.d)) best = { d, t: { type: "npc", id: npc.role } };
    }
    if (best) {
      this.target = best.t;
    } else {
      this.target = { type: "point", x: Math.max(20, Math.min(WORLD_W - 20, wx)), y: Math.max(20, Math.min(WORLD_H - 20, wy)) };
    }
    this.gatherProgress = 0;
  }

  /* ---------- loop ---------- */

  start() {
    this.last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.time += dt;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.save();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  /** move, but never walk into a river, rocky ridge or dense woodland */
  private tryStep(nx: number, ny: number) {
    if (!blockedAt(nx, ny, 12)) {
      this.px = nx;
      this.py = ny;
      return true;
    }
    if (!blockedAt(nx, this.py, 12)) {
      this.px = nx;
      return true;
    }
    if (!blockedAt(this.px, ny, 12)) {
      this.py = ny;
      return true;
    }
    return false;
  }

  private moveToward(tx: number, ty: number, dt: number, speed = 130): number {
    const dx = tx - this.px;
    const dy = ty - this.py;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      const step = Math.min(d, speed * dt);
      const moved = this.tryStep(this.px + (dx / d) * step, this.py + (dy / d) * step);
      if (!moved) {
        this.blockedFor += dt;
        if (this.blockedFor > 0.6 && this.target.type === "point") {
          this.target = { type: "none" };
          this.blockedFor = 0;
          this.pushText(this.px, this.py - 40, "Blocked!", "#e0a5a5");
        }
        return d;
      }
      this.blockedFor = 0;
      if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
      this.moveT += dt * 10;
    }
    return d;
  }


  /**
   * Phase 9 — adopt the server's view of our progression. The action routines
   * return the whole inventory / gold / skill block after they applied the
   * reward, so the client never invents a number.
   */
  applyServerState(state: ServerState | undefined | null) {
    if (!state) return;
    if (Array.isArray(state.inv)) {
      this.inv = state.inv.slice(0, INV_SIZE).map((s) => (s ? { ...s } : null));
      while (this.inv.length < INV_SIZE) this.inv.push(null);
    }
    if (typeof state.gold === "number") this.gold = state.gold;
    if (state.skills) {
      for (const id of SKILL_IDS) {
        const xp = state.skills[id]?.xp;
        if (typeof xp === "number") this.skills[id] = { xp };
      }
      this.hp = Math.min(this.hp, this.maxHp);
    }
    this.applyGearState(state);
    // The server just wrote the row, so our version marker is stale. Push a
    // sync to pick the new one up before any local bag/bank change is saved.
    this.rev = null;
    this.syncNow();

  }

  /** Level-up fanfare, fired when the server reports a new level. */
  private celebrateLevel(skill: SkillId) {
    sfx.play("level");
    this.pushText(this.px, this.py - 70, `${skill.toUpperCase()} LV ${this.lvl(skill)}!`, "#ffd98e");
    for (let i = 0; i < 18; i++) {
      this.parts.push({
        x: this.px,
        y: this.py - 10,
        vx: (Math.random() - 0.5) * 120,
        vy: -Math.random() * 130,
        life: 1,
        color: "#ffe6a7",
        size: 2 + Math.random() * 2,
      });
    }
  }

  /** Kill feedback for a kill the server credited to us. */
  private rewardKill(m: Monster, md: (typeof MONSTER_DEFS)[MonsterKind], res: DamageRes) {
    if (res.gold) {
      sfx.play("coin");
      this.pushText(m.x, m.y - 40, `+${res.gold}g`, "#ffe08a");
    }
    (res.loot ?? []).forEach((l, i) => {
      const id = l.item ?? l.id;
      if (!id || !ITEMS[id]) return;
      this.pushText(m.x + (i % 2 ? 16 : -16), m.y - 56 - i * 12, `+${l.qty} ${ITEMS[id]!.name}`, "#dff6c9");
    });
    this.questTick("kill", m.kind);
    this.orbs.push({ x: this.px + (Math.random() - 0.5) * 30, y: this.py - 20, life: 0.9 });
    if (res.leveled) this.celebrateLevel("combat");
    for (let i = 0; i < 12; i++) {
      this.parts.push({
        x: m.x,
        y: m.y,
        vx: (Math.random() - 0.5) * 100,
        vy: -Math.random() * 90,
        life: 0.7,
        color: md.body,
        size: 2 + Math.random() * 2,
      });
    }
  }

  private autoEat() {
    if (this.hp / this.maxHp >= AUTO_EAT_AT) return;
    const id = this.food;
    if (!id) return;
    const def = item(id);
    if (def.kind !== "food" || !def.heal) return;
    if (!this.removeItem(id, 1)) return;
    this.hp = Math.min(this.maxHp, this.hp + def.heal);
    this.pushText(this.px, this.py - 46, `+${def.heal} hp`, "#9fe6a0");
  }

  private update(dt: number) {
    const now = this.time;
    this.tickRemotes(dt);

    // joystick overrides target
    if (this.joystick.active && (this.joystick.dx || this.joystick.dy)) {
      this.target = { type: "none" };
      this.tryStep(
        Math.max(20, Math.min(WORLD_W - 20, this.px + this.joystick.dx * 160 * dt)),
        Math.max(20, Math.min(WORLD_H - 20, this.py + this.joystick.dy * 160 * dt)),
      );
      if (Math.abs(this.joystick.dx) > 0.05) this.facing = this.joystick.dx > 0 ? 1 : -1;
      this.moveT += dt * 10;
      this.activity = "Wandering";
      this.activityProgress = 0;
      this.gatherProgress = 0;
    } else if (this.target.type === "point") {
      const d = this.moveToward(this.target.x, this.target.y, dt);
      this.activity = "Walking";
      this.activityProgress = 0;
      if (d <= 2) this.target = { type: "none" };
    } else if (this.target.type === "node") {
      const n = this.nodes[this.target.id];
      if (!n || n.depleted) {
        this.target = { type: "none" };
      } else {
        const d = this.moveToward(n.x, n.y, dt);
        const def = NODE_DEFS[n.kind];
        if (d <= 34) {
          if (this.lvl(def.skill) < def.req) {
            this.pushText(n.x, n.y - 26, `Needs ${def.skill} ${def.req}`, "#f4b0b0");
            this.target = { type: "none" };
            return;
          }
          this.activity = `Harvesting ${def.name}`;
          this.gatherProgress += dt / def.time;
          this.activityProgress = this.gatherProgress;
          if (Math.random() < dt * 12) {
            this.parts.push({
              x: n.x + (Math.random() - 0.5) * 20,
              y: n.y + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 60,
              vy: -30 - Math.random() * 40,
              life: 0.6,
              color: def.accent,
              size: 2,
            });
          }
          if (this.gatherProgress >= 1 && !n.pending) {
            this.gatherProgress = 0;
            // Phase 9 — the server checks range, level, cooldown and node
            // charges, then writes the yield and XP straight into our save.
            n.pending = true;
            const claim: Promise<HarvestRes> = this.onHarvest
              ? this.onHarvest(n.id, this.px, this.py)
              : Promise.resolve({ ok: false, reason: "offline" });
            void claim
              .then((res) => {
                n.pending = false;
                if (typeof res.charges === "number") n.charges = res.charges;
                if (res.respawn_at !== undefined) {
                  n.respawnAt = res.respawn_at ? Date.parse(res.respawn_at) : 0;
                  n.depleted = n.respawnAt > Date.now();
                }
                if (res.ok) {
                  this.applyServerState(res.state);
                  if (res.item) {
                    this.questTick("gather", res.item);
                    this.pushText(n.x, n.y - 20, `+${res.qty ?? 1} ${item(res.item).name}`, "#dff6c9");
                  }
                  this.orbs.push({ x: this.px + (Math.random() - 0.5) * 30, y: this.py - 20, life: 0.9 });
                  if (res.leveled && res.skill) this.celebrateLevel(res.skill);
                  sfx.play("gather");
                } else if (res.reason === "depleted") {
                  this.pushText(n.x, n.y - 20, "Depleted", "#cbb9a4");
                } else if (res.reason === "bag_full") {
                  this.pushText(n.x, n.y - 20, "Bag is full", "#f4b0b0");
                } else if (res.reason === "low_level") {
                  this.pushText(n.x, n.y - 20, `Needs ${res.skill} ${res.req}`, "#f4b0b0");
                  this.target = { type: "none" };
                }
                this.emitHud(true);
                if (n.depleted && this.target.type === "node" && this.target.id === n.id) {
                  this.target = { type: "none" };
                }
              })
              .catch(() => {
                n.pending = false;
              });
          }
        } else {
          this.activity = "Walking";
          this.activityProgress = 0;
        }
      }
    } else if (this.target.type === "fish") {
      const sp = FISHING_SPOTS.find((f) => f.id === (this.target as { id: number }).id);
      if (!sp) {
        this.target = { type: "none" };
      } else {
        const d = this.moveToward(sp.x, sp.y, dt);
        if (d <= 26) {
          if (this.fishCd > 0) {
            this.fishCd -= dt;
            this.activity = "Waiting for a bite";
            this.activityProgress = 0;
          } else {
            this.activity = "Fishing";
            this.gatherProgress += dt / FISH_CAST_TIME;
            this.activityProgress = this.gatherProgress;
            if (Math.random() < dt * 4) {
              this.parts.push({
                x: sp.x + (Math.random() - 0.5) * 16,
                y: sp.y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.5) * 20,
                vy: -14 - Math.random() * 12,
                life: 0.5,
                color: "#dff4ff",
                size: 2,
              });
            }
            if (this.gatherProgress >= 1 && !this.fishPending) {
              this.gatherProgress = 0;
              this.fishPending = true;
              const cast: Promise<FishRes> = this.onFish
                ? this.onFish(sp.id, this.px, this.py)
                : Promise.resolve({ ok: false, reason: "offline" });
              void cast
                .then((res) => {
                  this.fishPending = false;
                  // same short breather between catches that nodes use
                  this.fishCd = 1.2;
                  if (res.ok && res.item) {
                    this.applyServerState(res.state);
                    this.questTick("gather", res.item);
                    this.pushText(sp.x, sp.y - 24, `+${res.qty ?? 1} ${item(res.item).name}`, "#dff6c9");
                    this.orbs.push({ x: this.px, y: this.py - 20, life: 0.9 });
                    if (res.leveled) this.celebrateLevel("fishing");
                    sfx.play("gather");
                  } else if (res.reason === "bag_full") {
                    this.pushText(sp.x, sp.y - 24, "Bag is full", "#f4b0b0");
                  } else if (res.reason === "too_far") {
                    this.pushText(sp.x, sp.y - 24, "Stand on the jetty", "#f4b0b0");
                  }
                  this.emitHud(true);
                })
                .catch(() => {
                  this.fishPending = false;
                });
            }
          }
        } else {
          this.activity = "Walking";
          this.activityProgress = 0;
        }
      }
    } else if (this.target.type === "monster") {
      const m = this.monsters[this.target.id];
      if (!m || m.dead) {
        this.target = { type: "none" };
      } else {
        const d = this.moveToward(m.x, m.y, dt, 140);
        if (d <= 34) {
          const md = MONSTER_DEFS[m.kind];
          this.activity = `Fighting ${md.name}`;
          this.combatCd -= dt;
          this.activityProgress = 1 - Math.max(0, this.combatCd) / this.attackInterval;
          if (this.combatCd <= 0) {
            this.combatCd = this.attackInterval;

            // Phase 9 — the server resolves the swing: it reads our stats from
            // the stored save, decides damage both ways, and awards the kill.
            if (!m.pending) {
              m.pending = true;
              const swing: Promise<DamageRes> = this.onAttack
                ? this.onAttack(m.id, this.px, this.py)
                : Promise.resolve({ ok: false, reason: "offline" });
              void swing
                .then((res) => {
                  m.pending = false;
                  if (!res.ok) {
                    if (res.reason === "dead") {
                      m.dead = true;
                      if (this.target.type === "monster" && this.target.id === m.id) this.target = { type: "none" };
                    }
                    return;
                  }

                  m.hitFlash = 0.2;
                  sfx.play("hit");
                  this.pushText(m.x, m.y - 24, `${res.dmg ?? 0}`, "#fff0c9");
                  if (typeof res.hp === "number") m.hp = res.hp;
                  if (res.tagged_by !== undefined) m.taggedBy = res.tagged_by ?? null;
                  if (res.buff) {
                    const hits = Number(res.buff.hits) || 0;
                    this.buff = hits > 0 ? { dmg: Number(res.buff.dmg) || 0, hits } : null;
                  }
                  this.applyServerState(res.state);

                  if (res.killed) {
                    m.dead = true;
                    m.respawnAt = res.respawn_at ? Date.parse(res.respawn_at) : Date.now() + 12000;
                    if (res.credited) this.rewardKill(m, md, res);
                    else this.pushText(m.x, m.y - 40, "Tagged by another player", "#cbb9a4");
                    if (this.target.type === "monster" && this.target.id === m.id) this.target = { type: "none" };
                  } else {
                    // Damage taken is the server's number too.
                    this.hp -= Math.max(0, res.taken ?? 0);
                    if (res.taken) this.pushText(this.px, this.py - 34, `-${res.taken}`, "#f4b0b0");
                    this.autoEat();
                    if (this.hp <= 0) {
                      const lostGold = Math.floor(this.gold * 0.1);
                      this.hp = Math.ceil(this.maxHp * 0.5);
                      this.px = 700;
                      this.py = 620;
                      this.gold = Math.max(0, this.gold - lostGold);
                      this.death = {
                        at: Date.now(),
                        reason: `A villager dragged you back to Grand Haven at half health. You lost ${lostGold} gold (10%) in the chaos.`,
                      };
                      this.pushText(this.px, this.py - 60, "Whew! Rescued by a villager", "#c9d8f5");
                      this.target = { type: "none" };
                    }
                  }
                  this.emitHud(true);
                })
                .catch(() => {
                  m.pending = false;
                });
            }
          }
        } else {
          this.activity = "Approaching";
          this.activityProgress = 0;
        }
      }
    } else if (this.target.type === "npc") {
      const id = this.target.id;
      const npc = NPCS.find((n) => n.id === id);
      const live = this.npcPos(id);
      if (!npc || !live) {
        this.target = { type: "none" };
      } else {
        const d = this.moveToward(live.x, live.y + 16, dt);
        this.activity = `Visiting ${npc.name}`;
        this.activityProgress = 0;
        if (d <= 46) {
          this.target = { type: "none" };
          this.onInteract?.(npc.id);
        }
      }
    } else {
      this.activity = "Wandering";
      this.activityProgress = 0;
    }

    // biome discovery
    const b = biomeAt(this.px, this.py);
    if (b.id !== this.biome.id) {
      this.biome = b;
      if (!this.discovered.includes(b.id)) {
        this.discovered.push(b.id);
        this.pushText(this.px, this.py - 76, `Discovered ${b.name}!`, "#ffd98e");
      }
      this.emitHud(true);
    }

    // regen + auto-eat out of combat
    if (this.target.type !== "monster") {
      this.regenCd -= dt;
      if (this.regenCd <= 0) {
        this.regenCd = 2.5;
        if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 1 + Math.floor(this.maxHp * 0.01));
        this.autoEat();
      }
    }

    // respawns
    const wall = Date.now();
    for (const n of this.nodes) {
      if (n.depleted && n.respawnAt && wall >= n.respawnAt) {
        n.depleted = false;
        n.charges = 4;
        n.respawnAt = 0;
      }
    }
    for (const m of this.monsters) {
      if (m.dead) {
        if (m.respawnAt && wall >= m.respawnAt) {
          m.dead = false;
          m.hp = m.maxHp;
          m.taggedBy = null;
          m.respawnAt = 0;
          m.x = m.hx;
          m.y = m.hy;
        }
        continue;
      }
      m.hitFlash = Math.max(0, m.hitFlash - dt);
      const wobble = Math.sin(now * 1.2 + m.id) * 18;
      m.x += (m.hx + wobble - m.x) * dt * 0.8;
      m.y += (m.hy + Math.cos(now * 0.9 + m.id) * 14 - m.y) * dt * 0.8;
    }

    // fx
    for (const t of this.texts) {
      t.y -= dt * 26;
      t.life -= dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const o of this.orbs) {
      o.x += (this.px - o.x) * dt * 5;
      o.y += (this.py - 16 - o.y) * dt * 5;
      o.life -= dt;
    }
    this.orbs = this.orbs.filter((o) => o.life > 0);
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const bf of this.butterflies) {
      bf.p += dt;
      bf.x += Math.cos(bf.p * 0.8 + bf.s) * 22 * dt;
      bf.y += Math.sin(bf.p * 1.3) * 18 * dt;
    }

    // ambient town life
    for (const v of this.villagers) {
      if (v.wait > 0) {
        v.wait -= dt;
        continue;
      }
      const dx = v.tx - v.x;
      const dy = v.ty - v.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) {
        v.wait = 1 + Math.random() * 4;
        v.tx = v.hx + (Math.random() - 0.5) * 240;
        v.ty = v.hy + (Math.random() - 0.5) * 170;
      } else {
        const step = Math.min(d, 34 * dt);
        v.x += (dx / d) * step;
        v.y += (dy / d) * step;
      }
    }

    // functional NPCs drift gently around their post
    for (const n of this.npcState) {
      if (n.wait > 0) {
        n.wait -= dt;
      } else {
        const dx = n.tx - n.x;
        const dy = n.ty - n.y;
        const d = Math.hypot(dx, dy);
        if (d < 3) {
          n.wait = 2 + Math.random() * 5;
          this.pickNpcTarget(n);
        } else {
          const step = Math.min(d, 20 * dt);
          const nx = n.x + (dx / d) * step;
          const ny = n.y + (dy / d) * step;
          if (blockedAt(nx, ny, 10)) {
            n.wait = 1 + Math.random() * 2;
            this.pickNpcTarget(n);
          } else {
            n.x = nx;
            n.y = ny;
          }
        }
      }
    }
    // light separation so two NPCs never visually stack (keeps each tappable)
    for (let i = 0; i < this.npcState.length; i++) {
      const a = this.npcState[i]!;
      for (let j = i + 1; j < this.npcState.length; j++) {
        const b = this.npcState[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001 && d < 36) {
          const push = ((36 - d) / 2) * Math.min(1, dt * 4);
          const ux = dx / d;
          const uy = dy / d;
          if (!blockedAt(a.x - ux * push, a.y - uy * push, 10)) {
            a.x -= ux * push;
            a.y -= uy * push;
          }
          if (!blockedAt(b.x + ux * push, b.y + uy * push, 10)) {
            b.x += ux * push;
            b.y += uy * push;
          }
        }
      }
    }

    // drifting leaves / motes
    if (this.leaves.length < 30 && Math.random() < dt * 16) {
      this.leaves.push({
        x: this.px + (Math.random() - 0.5) * 900,
        y: this.py - 420 - Math.random() * 120,
        vx: -20 - Math.random() * 40,
        vy: 24 + Math.random() * 34,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 3,
        life: 8 + Math.random() * 6,
        color: Math.random() < 0.5 ? this.biome.detail : this.biome.grass,
      });
    }
    for (const lf of this.leaves) {
      lf.x += (lf.vx + Math.sin(now * 1.6 + lf.rot) * 22) * dt;
      lf.y += lf.vy * dt;
      lf.rot += lf.spin * dt;
      lf.life -= dt;
    }
    this.leaves = this.leaves.filter((l) => l.life > 0);

    // world clock
    this.clock += dt;

    // shared marketplace — only poll while the Market panel is actually open
    if (this.marketVisible) {
      this.marketCd -= dt;
      if (this.marketCd <= 0) {
        this.marketCd = 12;
        void this.refreshMarket();
      }
    } else {
      this.marketCd = 0;
    }



    // camera
    const rect = this.canvas.getBoundingClientRect();
    const tx = Math.max(0, Math.min(WORLD_W - rect.width, this.px - rect.width / 2));
    const ty = Math.max(0, Math.min(WORLD_H - rect.height, this.py - rect.height / 2));
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 6);

    // hud + autosave
    this.hudCd -= dt;
    if (this.hudCd <= 0) {
      this.hudCd = 0.12;
      this.emitHud();
    }
    this.saveCd -= dt;
    if (this.saveCd <= 0) {
      this.saveCd = 30;
      this.save();
    }
  }

  /* ---------- quests, shop, crafting & food ---------- */

  private questTick(kind: "kill" | "gather", key: string) {
    if (!this.quest) return;
    const def = QUESTS.find((q) => q.id === this.quest!.id);
    if (!def || def.kind !== kind || def.key !== key) return;
    if (this.quest.progress >= def.count) return;
    this.quest.progress += 1;
    if (this.quest.progress >= def.count) {
      this.pushText(this.px, this.py - 60, "Quest ready!", "#ffd98e");
    }
    this.emitHud(true);
  }

  acceptQuest(id: string) {
    if (this.quest) return;
    if (!QUESTS.some((q) => q.id === id) || this.completed.includes(id)) return;
    this.quest = { id, progress: 0 };
    this.emitHud(true);
  }

  abandonQuest() {
    this.quest = null;
    this.emitHud(true);
  }

  claimQuest() {
    if (!this.quest) return;
    const def = QUESTS.find((q) => q.id === this.quest!.id);
    if (!def || this.quest.progress < def.count) return;
    this.gold += def.gold;
    this.grantXp(def.xpSkill, def.xp);
    if (def.reward) this.addItem(def.reward, 1);
    this.completed.push(def.id);
    this.quest = null;
    this.pushText(this.px, this.py - 70, `+${def.gold}g quest reward`, "#ffe08a");
    this.save();
    this.emitHud(true);
  }

  buyItem(npc: NpcRole, id: ItemId): boolean {
    const entry = (SHOP_STOCK[npc] ?? []).find((s) => s.id === id);
    if (!entry || this.gold < entry.price) return false;
    if (!this.addItem(id, 1)) return false;
    this.gold -= entry.price;
    this.pushText(this.px, this.py - 50, `-${entry.price}g`, "#ffd0a8");
    this.syncNow();
    this.emitHud(true);
    return true;
  }

  sellAllResources(): number {
    let earned = 0;
    this.inv.forEach((slot, i) => {
      if (!slot) return;
      if (item(slot.id).kind !== "resource") return;
      earned += item(slot.id).value * slot.qty;
      this.inv[i] = null;
    });
    this.gold += earned;
    if (earned > 0) this.pushText(this.px, this.py - 50, `+${earned}g`, "#ffe08a");
    this.syncNow();
    this.emitHud(true);
    return earned;
  }

  canCraft(recipeId: string): boolean {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r) return false;
    if (this.lvl(r.skill) < r.req) return false;
    return r.inputs.every((i) => this.countItem(i.id) >= i.qty);
  }

  /** Phase 9 — the server consumes the materials and grants the result. */
  craft(recipeId: string): boolean {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r || !this.onCraft) return false;
    if (this.craftPending) return false;
    this.craftPending = true;
    void this.onCraft(r.id)
      .then((res) => {
        this.craftPending = false;
        if (!res.ok) {
          const why =
            res.reason === "bag_full"
              ? "Bag is full"
              : res.reason === "low_level"
                ? `Needs ${res.skill} ${res.req}`
                : res.reason === "missing_materials"
                  ? "Missing materials"
                  : "Not right now";
          this.pushText(this.px, this.py - 56, why, "#f4b0b0");
          this.emitHud(true);
          return;
        }
        this.applyServerState(res.state);
        sfx.play("craft");
        this.pushText(this.px, this.py - 56, `+${res.out_qty ?? 1} ${item(r.out).name}`, "#dff6c9");
        this.orbs.push({ x: this.px + (Math.random() - 0.5) * 30, y: this.py - 20, life: 0.9 });
        if (res.leveled) this.celebrateLevel(r.skill);
        this.emitHud(true);
      })
      .catch(() => {
        this.craftPending = false;
      });
    return true;
  }

  private craftPending = false;

  upgradeCostFor(which: "weapon" | "armor"): number | null {
    const eq = which === "weapon" ? this.weapon : this.armor;
    if (!eq || eq.plus >= MAX_PLUS) return null;
    const base = item(eq.id).attack ?? item(eq.id).defense ?? 1;
    return upgradeCost(base, eq.plus);
  }

  upgradeEquipped(which: "weapon" | "armor"): boolean {
    const eq = which === "weapon" ? this.weapon : this.armor;
    const cost = this.upgradeCostFor(which);
    if (!eq || cost === null || this.gold < cost) return false;
    // Bump the level first, then let the server settle gold + plus atomically.
    this.gold -= cost;
    eq.plus += 1;
    this.runGear(this.onUpgrade ? this.onUpgrade(which) : null);

    this.pushText(this.px, this.py - 60, `${item(eq.id).name} +${eq.plus}!`, "#ffd98e");
    for (let i = 0; i < 16; i++) {
      this.parts.push({
        x: this.px,
        y: this.py - 10,
        vx: (Math.random() - 0.5) * 110,
        vy: -Math.random() * 120,
        life: 0.9,
        color: "#ffe6a7",
        size: 2 + Math.random() * 2,
      });
    }
    this.emitHud(true);
    return true;
  }

  setFood(id: ItemId | null) {
    this.food = id;
    this.emitHud(true);
  }

  useSlot(index: number) {
    const slot = this.inv[index];
    if (!slot) return;
    const def = item(slot.id);
    if (def.kind === "potion") {
      if (this.potionPending) return;
      this.potionPending = true;
      const use: Promise<PotionRes> = this.onPotion
        ? this.onPotion(slot.id)
        : Promise.resolve({ ok: false, reason: "offline" });
      void use
        .then((res) => {
          this.potionPending = false;
          if (!res.ok) return;
          this.applyServerState(res.state);
          if (res.buff) this.buff = { dmg: Number(res.buff.dmg) || 0, hits: Number(res.buff.hits) || 0 };
          this.pushText(this.px, this.py - 46, `+${this.buff?.dmg ?? 0} dmg`, "#e7c7ff");
          sfx.play("gather");
          this.emitHud(true);
        })
        .catch(() => {
          this.potionPending = false;
        });
      return;
    }
    if (def.kind !== "food" || !def.heal) return;
    if (this.hp >= this.maxHp) {
      this.food = slot.id;
      this.emitHud(true);
      return;
    }
    this.hp = Math.min(this.maxHp, this.hp + def.heal);
    slot.qty -= 1;
    if (slot.qty <= 0) this.inv[index] = null;
    this.pushText(this.px, this.py - 40, `+${def.heal} hp`, "#9fe6a0");
    this.emitHud(true);
  }

  /* ---------- marketplace (Phase 3) ---------- */

  get timeOfDay() {
    return (this.clock % DAY_LEN) / DAY_LEN;
  }

  get dayPhase(): HudSnapshot["phase"] {
    const t = this.timeOfDay;
    if (t < 0.2 || t >= 0.85) return "Night";
    if (t < 0.3) return "Dawn";
    if (t < 0.72) return "Day";
    return "Dusk";
  }

  suggestPrice(id: ItemId, plus = 0) {
    return suggestedPrice(id, plus);
  }

  /* ---------- global player exchange ---------- */

  /** Last completed player sale per item configuration, keyed `${item}:${plus}`. */
  lastSold: Record<string, number> = {};

  /** Server hooks — the client only ever asks; the server moves items and gold. */
  onMarketBrowse: (() => Promise<BrowseRes>) | null = null;
  onMarketList:
    | ((item: ItemId, qty: number, price: number, plus: number) => Promise<MarketRes>)
    | null = null;
  onMarketBuy: ((id: string, qty: number) => Promise<MarketRes>) | null = null;
  onMarketCancel: ((id: string) => Promise<MarketRes>) | null = null;

  private marketBusy = false;

  /** Pull the live order book, recent sales and last-sold prices from the server. */
  async refreshMarket(): Promise<void> {
    if (!this.onMarketBrowse || this.marketBusy) return;
    this.marketBusy = true;
    try {
      const res = await this.onMarketBrowse();
      if (!res.ok) return;
      this.applyServerState(res.state);
      this.listings = (res.listings ?? []).map((l) => ({
        id: l.id,
        item: l.item,
        qty: l.qty,
        price: l.price,
        plus: l.plus ?? 0,
        seller: l.mine ? "You" : l.seller,
        mine: l.mine,
        createdAt: Date.parse(l.created_at) || Date.now(),
        expiresAt: Date.parse(l.expires_at) || Date.now(),
      }));
      this.tradeLog = (res.trades ?? []).map((t) => ({
        id: t.id,
        text: tradeText(t),
        at: Date.parse(t.at) || Date.now(),
      }));
      const prices: Record<string, number> = {};
      for (const p of res.prices ?? []) prices[priceKey(p.item, p.plus ?? 0)] = p.price;
      this.lastSold = prices;
      this.emitHud(true);
    } finally {
      this.marketBusy = false;
    }
  }

  /** List a stack (or part of it) from the bag on the global exchange. */
  async listSlot(index: number, qty: number, price: number): Promise<boolean> {
    const slot = this.inv[index];
    if (!slot || !this.onMarketList) return false;
    const amount = Math.max(1, Math.min(Math.round(qty), slot.qty));
    const unit = Math.max(1, Math.round(price));
    const res = await this.onMarketList(slot.id, amount, unit, slot.plus ?? 0);
    if (!res.ok) {
      sfx.play("error");
      this.pushText(this.px, this.py - 50, this.marketReason(res.reason), "#f4b0b0");
      return false;
    }
    this.applyServerState(res.state);
    sfx.play("craft");
    this.pushText(this.px, this.py - 56, `Listed ${amount}× ${item(slot.id).name}`, "#c9e8ff");
    this.emitHud(true);
    await this.refreshMarket();
    return true;
  }

  /** Buy all — or part — of another player's listing. */
  async buyListing(id: string, qty = 1): Promise<boolean> {
    const l = this.listings.find((x) => x.id === id);
    if (l?.mine) return false;
    if (!this.onMarketBuy) return false;
    const amount = Math.max(1, Math.min(Math.round(qty), l?.qty ?? qty));
    const res = await this.onMarketBuy(id, amount);
    if (!res.ok) {
      sfx.play("error");
      this.pushText(this.px, this.py - 50, this.marketReason(res.reason), "#f4b0b0");
      await this.refreshMarket();
      return false;
    }
    this.applyServerState(res.state);
    sfx.play("coin");
    this.pushText(this.px, this.py - 50, `-${res.spent ?? 0}g`, "#ffd0a8");
    this.emitHud(true);
    await this.refreshMarket();
    return true;
  }

  /** Pull your own listing back into the bag — always free. */
  async cancelListing(id: string): Promise<boolean> {
    if (!this.onMarketCancel) return false;
    const res = await this.onMarketCancel(id);
    if (!res.ok) {
      sfx.play("error");
      this.pushText(this.px, this.py - 50, this.marketReason(res.reason), "#f4b0b0");
      return false;
    }
    this.applyServerState(res.state);
    this.emitHud(true);
    await this.refreshMarket();
    return true;
  }


  private marketReason(reason?: string): string {
    switch (reason) {
      case "poor":
        return "Not enough gold";
      case "bag_full":
        return "Bag is full";
      case "gone":
        return "Already sold";
      case "own_listing":
        return "That's your listing";
      case "too_many_listings":
        return "Too many listings";
      case "missing_items":
        return "You don't have those";
      case "too_fast":
        return "Slow down";
      default:
        return "Trade failed";
    }
  }

  toggleSound(): boolean {
    sfx.unlock();
    sfx.enabled = !sfx.enabled;
    if (sfx.enabled) sfx.play("coin");
    this.emitHud(true);
    return sfx.enabled;
  }

  unlockAudio() {
    sfx.unlock();
  }

  /* ---------- ambient rendering helpers ---------- */

  private drawLeaves(ctx: CanvasRenderingContext2D) {
    for (const l of this.leaves) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.7, l.life / 3);
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.fillStyle = l.color;
      ctx.fillRect(-3, -2, 6, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawVillager(ctx: CanvasRenderingContext2D, v: Villager) {
    const bob = Math.sin(this.time * 5 + v.hx + v.x * 0.05) * 1.6;
    this.shadow(ctx, v.x, v.y + 13, 11);
    ctx.fillStyle = v.robe;
    ctx.beginPath();
    ctx.roundRect(v.x - 8, v.y - 5 - bob, 16, 17, 5);
    ctx.fill();
    ctx.fillStyle = "#ffe0c2";
    ctx.beginPath();
    ctx.arc(v.x, v.y - 14 - bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = v.hair;
    ctx.beginPath();
    ctx.arc(v.x, v.y - 17 - bob, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#4a3b52";
    ctx.fillRect(v.x - 4, v.y - 15 - bob, 2, 3);
    ctx.fillRect(v.x + 2, v.y - 15 - bob, 2, 3);
  }

  private drawDayNight(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const t = this.timeOfDay;
    const brightness = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
    const dark = (1 - brightness) * 0.42;
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(46,54,110,${dark.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
    const warm = Math.max(0, 1 - Math.abs(brightness - 0.5) * 5) * 0.18;
    if (warm > 0.01) {
      ctx.fillStyle = `rgba(255,150,90,${warm.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }


  emitHud(force = false) {
    if (force) this.hudCd = 0.12;
    const mk = (id: SkillId) => {
      const l = levelFromXp(this.skills[id]?.xp ?? 0);
      return { level: l.level, xp: this.skills[id]?.xp ?? 0, progress: l.progress, into: l.into, need: l.need };
    };
    const skills = SKILL_IDS.reduce(
      (acc, id) => ({ ...acc, [id]: mk(id) }),
      {} as HudSnapshot["skills"],
    );
    this.onHud({
      hp: Math.max(0, Math.round(this.hp)),
      maxHp: this.maxHp,
      gold: this.gold,
      level: this.lvl("combat"),
      region: this.biome.name,
      regionLevel: this.biome.levels,
      skills,
      inv: this.inv.map((s) => (s ? { ...s } : null)),
      bank: {
        gold: this.bank.gold,
        items: this.bank.items.map((s) => (s ? { ...s } : null)),
      },
      weapon: this.weapon ? { ...this.weapon } : null,
      armor: this.armor ? { ...this.armor } : null,
      food: this.food,
      activity: this.activity,
      activityProgress: this.activityProgress,
      quest: this.quest
        ? (() => {
            const d = QUESTS.find((q) => q.id === this.quest!.id);
            if (!d) return null;
            return {
              id: d.id,
              name: d.name,
              desc: d.desc,
              progress: Math.min(this.quest!.progress, d.count),
              count: d.count,
              ready: this.quest!.progress >= d.count,
            };
          })()
        : null,
      completed: [...this.completed],
      discovered: [...this.discovered],
      attack: this.attack,
      defense: this.defense,
      attackInterval: this.attackInterval,
      timeOfDay: this.timeOfDay,
      phase: this.dayPhase,
      market: {
        listings: this.listings.map((l) => ({ ...l })),
        log: this.tradeLog.map((l) => ({ ...l })),
        fee: MARKET_FEE,
        lastSold: { ...this.lastSold },
      },
      soundOn: sfx.enabled,
      name: this.playerName,
      nearby: this.remotes.size,
      buff: this.buff ? { ...this.buff } : null,
      death: this.death ? { ...this.death } : null,
    });
  }

  /* ---------- render ---------- */

  private render() {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));

    const view = { x: this.cam.x, y: this.cam.y, w, h };
    for (const b of BIOMES) {
      if (b.x > view.x + w || b.x + b.w < view.x || b.y > view.y + h || b.y + b.h < view.y) continue;
      this.drawBiome(ctx, b);
    }
    for (const l of LAKES) {
      if (l.cx - l.rx > view.x + w || l.cx + l.rx < view.x || l.cy - l.ry > view.y + h || l.cy + l.ry < view.y) continue;
      this.lake(ctx, l);
    }
    this.drawRoads(ctx, view);
    this.drawStreets(ctx, view);
    this.drawBarriers(ctx, view);

    this.drawButterflies(ctx);
    for (const v of this.villagers) {
      if (!this.inView(v.x, v.y, view)) continue;
      this.drawVillager(ctx, v);
    }


    const drawables: { y: number; fn: () => void }[] = [];
    for (const b of BUILDINGS) {
      if (b.x > view.x + w || b.x + b.w < view.x || b.y > view.y + h || b.y + b.h < view.y) continue;
      drawables.push({ y: b.y + b.h, fn: () => this.drawBuilding(ctx, b) });
    }

    for (const n of this.nodes) {
      if (!this.inView(n.x, n.y, view)) continue;
      drawables.push({ y: n.y, fn: () => this.drawNode(ctx, n) });
    }
    for (const m of this.monsters) {
      if (m.dead || !this.inView(m.x, m.y, view)) continue;
      drawables.push({ y: m.y, fn: () => this.drawMonster(ctx, m) });
    }
    for (const live of this.npcState) {
      if (!this.inView(live.x, live.y, view)) continue;
      const def = NPCS.find((n) => n.id === live.role);
      if (!def) continue;
      drawables.push({ y: live.y, fn: () => this.drawNpc(ctx, def, live) });
    }
    for (const r of this.remotes.values()) {
      if (!this.inView(r.x, r.y, view)) continue;
      drawables.push({ y: r.y, fn: () => this.drawRemote(ctx, r) });
    }
    drawables.push({ y: this.py, fn: () => this.drawPlayer(ctx) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (const o of this.orbs) {
      ctx.globalAlpha = Math.min(1, o.life);
      ctx.fillStyle = "#c9f28a";
      ctx.beginPath();
      ctx.arc(o.x, o.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.font = "bold 20px ui-rounded, 'Baloo 2', system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.fillStyle = "rgba(60,45,60,0.35)";
      ctx.fillText(t.text, t.x, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    this.drawLeaves(ctx);
    ctx.restore();

    // biome tint + day/night + soft vignette
    ctx.fillStyle = this.biome.tint;
    ctx.fillRect(0, 0, w, h);
    this.drawDayNight(ctx, w, h);
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
    v.addColorStop(0, "rgba(255,255,235,0)");
    v.addColorStop(1, "rgba(120,100,150,0.16)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);

  }

  private inView(x: number, y: number, view: { x: number; y: number; w: number; h: number }) {
    return x > view.x - 120 && x < view.x + view.w + 120 && y > view.y - 160 && y < view.y + view.h + 160;
  }

  private biomePath(b: BiomeDef) {
    // straight segments: regions tile the world exactly, so smoothing the
    // outline would make neighbouring biomes overlap or leave gaps
    const p = new Path2D();
    const pts = b.poly;
    p.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i]![0], pts[i]![1]);
    p.closePath();
    return p;
  }


  private drawBarriers(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }) {
    for (const bar of BARRIERS) {
      if (bar.minX > view.x + view.w + 80 || bar.maxX < view.x - 80) continue;
      if (bar.minY > view.y + view.h + 80 || bar.maxY < view.y - 80) continue;

      const path = new Path2D();
      path.moveTo(bar.pts[0]![0], bar.pts[0]![1]);
      for (let i = 1; i < bar.pts.length; i++) {
        const cur = bar.pts[i]!;
        const prev = bar.pts[i - 1]!;
        path.quadraticCurveTo(prev[0], prev[1], (prev[0] + cur[0]) / 2, (prev[1] + cur[1]) / 2);
      }

      if (bar.kind === "river") {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#6fa9c9";
        ctx.lineWidth = bar.width;
        ctx.stroke(path);
        ctx.strokeStyle = "#9fd8ee";
        ctx.lineWidth = bar.width * 0.66;
        ctx.stroke(path);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = bar.width * 0.16;
        ctx.stroke(path);
      } else if (bar.kind === "rocks") {
        // solid rubble band so the ridge reads as continuous
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#7e7974";
        ctx.lineWidth = bar.width * 0.9;
        ctx.stroke(path);
        const pts = densify(bar.pts, bar.width * 0.34);
        for (let i = 0; i < pts.length; i++) {
          const [x, y] = pts[i]!;
          const r = bar.width * (0.42 + ((i * 37) % 11) / 40);
          ctx.fillStyle = "#8f8a85";
          ctx.beginPath();
          ctx.ellipse(x, y + 6, r, r * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#b3ada6";
          ctx.beginPath();
          ctx.ellipse(x - r * 0.15, y - r * 0.15, r * 0.7, r * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.beginPath();
          ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.28, r * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // shaded undergrowth band beneath the trunks
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(52,86,62,0.55)";
        ctx.lineWidth = bar.width * 0.85;
        ctx.stroke(path);
        const pts = densify(bar.pts, bar.width * 0.32);
        for (let i = 0; i < pts.length; i++) {
          const [x, y] = pts[i]!;
          const r = bar.width * (0.4 + ((i * 53) % 9) / 36);
          ctx.fillStyle = "rgba(60,80,60,0.18)";
          ctx.beginPath();
          ctx.ellipse(x, y + r * 0.7, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#6b4a30";
          ctx.fillRect(x - 4, y, 8, r * 0.7);
          ctx.fillStyle = "#3f8f6a";
          ctx.beginPath();
          ctx.arc(x, y - r * 0.1, r * 0.72, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#54ab7f";
          ctx.beginPath();
          ctx.arc(x - r * 0.2, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.lineWidth = 1;
    this.drawBridges(ctx, view);
  }

  /** wooden plank bridges crossing the Great River */
  private drawBridges(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }) {
    for (const br of BRIDGES) {
      if (!this.inView(br.x, br.y, view)) continue;
      ctx.save();
      ctx.translate(br.x, br.y);
      ctx.rotate(br.angle);
      const halfLen = br.len / 2 + 14; // across the river (local Y)
      const halfW = br.width / 2; // along the river (local X)

      // shadow on the water
      ctx.fillStyle = "rgba(30,50,70,0.25)";
      ctx.fillRect(-halfW + 3, -halfLen + 4, br.width, halfLen * 2);
      // deck
      ctx.fillStyle = "#8b6239";
      ctx.fillRect(-halfW, -halfLen, br.width, halfLen * 2);
      // planks
      ctx.fillStyle = "#a9793f";
      for (let y = -halfLen + 3; y < halfLen - 3; y += 11) {
        ctx.fillRect(-halfW + 2, y, br.width - 4, 8);
      }
      // rails
      ctx.fillStyle = "#6f4a2a";
      ctx.fillRect(-halfW - 3, -halfLen, 5, halfLen * 2);
      ctx.fillRect(halfW - 2, -halfLen, 5, halfLen * 2);
      for (let y = -halfLen; y <= halfLen; y += 26) {
        ctx.fillRect(-halfW - 4, y, 7, 6);
        ctx.fillRect(halfW - 3, y, 7, 6);
      }
      ctx.restore();
    }
  }


  private drawBiome(ctx: CanvasRenderingContext2D, b: BiomeDef) {
    const path = this.biomePath(b);
    ctx.save();
    ctx.clip(path);

    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, b.top);
    g.addColorStop(1, b.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(b.x - 40, b.y - 40, b.w + 80, b.h + 80);

    // town plaza
    if (b.plaza) {
      ctx.fillStyle = b.detail;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.roundRect(b.plaza.x, b.plaza.y, b.plaza.w, b.plaza.h, 40);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // grass tufts / dunes / snow speckles
    ctx.fillStyle = b.grass;
    for (let i = 0; i < 120; i++) {
      const x = b.x + ((i * 271) % b.w);
      const y = b.y + ((i * 419) % b.h);
      ctx.fillRect(x, y, 3, 6);
      ctx.fillRect(x + 5, y + 2, 3, 5);
    }
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    for (let i = 0; i < 50; i++) {
      const x = b.x + ((i * 137) % b.w);
      const y = b.y + ((i * 233) % b.h);
      ctx.fillRect(x, y, 18, 4);
    }


    ctx.restore();

    // soft shoreline so edges read as organic, not cut out
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 6;
    ctx.stroke(path);
    ctx.restore();

    // biome label
    if (b.label) {
      ctx.font = "bold 26px ui-rounded, 'Baloo 2', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + 70);
    }
  }


  /** irregular lake body, shoreline dressing and its wooden jetties */
  private lake(ctx: CanvasRenderingContext2D, l: LakeDef) {
    const water =
      l.style === "winter" ? "#cfeaf5" : l.style === "evil" ? "#5b4a86" : l.style === "forest" ? "#3f8f86" : "#9fd8ee";
    const path = new Path2D();
    l.poly.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();

    // damp shoreline ring
    ctx.save();
    ctx.strokeStyle =
      l.style === "winter" ? "rgba(226,244,252,0.85)" : l.style === "evil" ? "rgba(66,48,92,0.6)" : "rgba(150,190,140,0.45)";
    ctx.lineWidth = l.style === "winter" ? 12 : 9;
    ctx.stroke(path);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = water;
    ctx.fill(path);
    ctx.clip(path);

    // depth shading toward the middle
    ctx.fillStyle = l.style === "evil" ? "rgba(28,18,48,0.45)" : "rgba(20,60,90,0.18)";
    ctx.beginPath();
    ctx.ellipse(l.cx, l.cy, l.rx * 0.62, l.ry * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // glints
    ctx.fillStyle = l.style === "evil" ? "rgba(190,170,230,0.18)" : "rgba(255,255,255,0.35)";
    for (let i = 0; i < 14; i++) {
      const x = l.cx - l.rx + ((i * 137) % (l.rx * 2));
      const y = l.cy - l.ry + ((i * 89) % (l.ry * 2));
      ctx.fillRect(x, y + Math.sin(this.time * 1.2 + i) * 2, 12, 3);
    }

    if (l.style === "evil") {
      ctx.fillStyle = "rgba(200,190,220,0.16)";
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.ellipse(l.cx - l.rx * 0.6 + i * l.rx * 0.25, l.cy + Math.sin(this.time * 0.4 + i) * 8, 52, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (l.style === "winter") {
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 14;
      ctx.stroke(path);
    }
    if (l.style === "forest") {
      // canopy shadow overhanging part of the shoreline
      ctx.fillStyle = "rgba(12,44,32,0.28)";
      ctx.beginPath();
      ctx.ellipse(l.cx - l.rx * 0.45, l.cy - l.ry * 0.3, l.rx * 0.55, l.ry * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    this.lakeProps(ctx, l);
    for (const j of l.jetties) this.jetty(ctx, j);
  }

  /** reeds, lily pads, ice shards or dead trees around the water's edge */
  private lakeProps(ctx: CanvasRenderingContext2D, l: LakeDef) {
    for (const p of l.props) {
      if (l.style === "fields" || l.style === "forest") {
        // reeds
        ctx.strokeStyle = l.style === "forest" ? "#3f6b3c" : "#6ea04d";
        ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(p.x + k * 3, p.y);
          ctx.lineTo(p.x + k * 3 + (p.t - 0.5) * 6, p.y - 12 - p.t * 8);
          ctx.stroke();
        }
        if (p.t > 0.6) {
          // lily pad
          ctx.fillStyle = l.style === "forest" ? "#2f7a58" : "#71b56a";
          ctx.beginPath();
          ctx.ellipse(p.x + 14, p.y + 8, 9, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (l.style === "winter") {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.beginPath();
        ctx.moveTo(p.x - 8, p.y + 4);
        ctx.lineTo(p.x + (p.t - 0.5) * 8, p.y - 12 - p.t * 6);
        ctx.lineTo(p.x + 8, p.y + 4);
        ctx.closePath();
        ctx.fill();
      } else {
        if (p.t > 0.5) {
          // dead tree
          ctx.strokeStyle = "#3a2d46";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + 4);
          ctx.lineTo(p.x, p.y - 26);
          ctx.moveTo(p.x, p.y - 16);
          ctx.lineTo(p.x - 10, p.y - 26);
          ctx.moveTo(p.x, p.y - 20);
          ctx.lineTo(p.x + 11, p.y - 30);
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(90,72,120,0.7)";
          ctx.fillRect(p.x - 4, p.y - 4, 8, 6);
        }
      }
    }
  }

  /** planked jetty out over the water, with the fishing spot at its end */
  private jetty(ctx: CanvasRenderingContext2D, j: { x1: number; y1: number; x2: number; y2: number; hw: number }) {
    const a = Math.atan2(j.y2 - j.y1, j.x2 - j.x1);
    const len = Math.hypot(j.x2 - j.x1, j.y2 - j.y1);
    ctx.save();
    ctx.translate(j.x1, j.y1);
    ctx.rotate(a);

    // shadow on the water
    ctx.fillStyle = "rgba(20,40,60,0.25)";
    ctx.fillRect(0, -j.hw + 4, len + 12, j.hw * 2);

    // support posts
    ctx.fillStyle = "#6b4a2e";
    for (let d = 18; d < len; d += 26) {
      ctx.fillRect(d, -j.hw - 2, 5, 4);
      ctx.fillRect(d, j.hw - 2, 5, 4);
    }

    // planks
    for (let d = 0; d < len; d += 8) {
      ctx.fillStyle = (d / 8) % 2 === 0 ? "#a97a4d" : "#96693f";
      ctx.fillRect(d, -j.hw, 7, j.hw * 2);
    }
    // deck platform at the end
    ctx.fillStyle = "#a97a4d";
    ctx.fillRect(len - 6, -j.hw - 6, 20, j.hw * 2 + 12);
    ctx.strokeStyle = "rgba(70,44,22,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(len - 6, -j.hw - 6, 20, j.hw * 2 + 12);
    ctx.restore();

    // fishing spot marker at the deck end
    const bob = Math.sin(this.time * 2) * 2;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(j.x2, j.y2 - 18 + bob, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b6f9c";
    ctx.font = "10px ui-rounded, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🎣", j.x2, j.y2 - 14 + bob);
  }

  /** gray cobble trade roads linking the towns */
  private drawRoads(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }) {
    for (const run of ROAD_RUNS) {
      const pts = run.pts;
      let visible = false;
      for (const [x, y] of pts) {
        if (x > view.x - 60 && x < view.x + view.w + 60 && y > view.y - 60 && y < view.y + view.h + 60) {
          visible = true;
          break;
        }
      }
      if (!visible) continue;

      const trace = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0]![0], pts[0]![1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
      };
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // packed earth shoulder
      trace();
      ctx.strokeStyle = "#8c8a86";
      ctx.lineWidth = run.width + 6;
      ctx.stroke();
      // gray cobble bed
      trace();
      ctx.strokeStyle = "#a8a5a0";
      ctx.lineWidth = run.width;
      ctx.stroke();

      // cobble stones speckled along the road bed
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const ux = (b[0] - a[0]) / len;
        const uy = (b[1] - a[1]) / len;
        for (let d = 0; d < len; d += 11) {
          const cxp = a[0] + ux * d;
          const cyp = a[1] + uy * d;
          for (const off of [-8, 0, 8]) {
            const jx = (((d * 13 + off * 7 + i * 5) % 7) - 3) * 0.5;
            ctx.fillStyle = ((d + off + i) | 0) % 2 === 0 ? "#9b9893" : "#b5b2ac";
            ctx.fillRect(cxp - uy * off + jx - 2.5, cyp + ux * off + jx - 2, 5, 4);
          }
        }
      }
    }
  }

  /** dirt roads and cobbled crossroads laid through each town */
  private drawStreets(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }) {
    for (const s of STREETS) {
      if (s.x > view.x + view.w || s.x + s.w < view.x || s.y > view.y + view.h || s.y + s.h < view.y) continue;
      ctx.fillStyle = "#c4a67c";
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = "#a88a62";
      ctx.fillRect(s.x, s.y, s.w, 5);
      ctx.fillRect(s.x, s.y + s.h - 5, s.w, 5);
      // cobbles
      ctx.fillStyle = "#b19470";
      const step = 22;
      for (let x = s.x + 8; x < s.x + s.w - 8; x += step) {
        for (let y = s.y + 8; y < s.y + s.h - 8; y += step) {
          const j = ((x * 13 + y * 7) % 9) - 4;
          ctx.fillRect(x + j, y + ((x % 3) - 1) * 2, 6, 4);
        }
      }
    }
  }


  private drawBuilding(ctx: CanvasRenderingContext2D, b: (typeof BUILDINGS)[number]) {
    const wallTop = b.y + b.h * 0.38;
    const wallH = b.h * 0.62;
    ctx.fillStyle = "rgba(90,70,110,0.16)";
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h + 4, b.w * 0.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    if (b.kind === "stall") {
      this.drawStall(ctx, b);
      this.buildingLabel(ctx, b);
      return;
    }
    if (b.kind === "tower") {
      this.drawTower(ctx, b);
      this.buildingLabel(ctx, b);
      return;
    }

    // ---- timber-framed body -------------------------------------------
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, wallTop, b.w, wallH);
    // corner posts + sill and head beams
    ctx.fillStyle = b.beam;
    ctx.fillRect(b.x, wallTop, 7, wallH);
    ctx.fillRect(b.x + b.w - 7, wallTop, 7, wallH);
    ctx.fillRect(b.x, wallTop, b.w, 6);
    ctx.fillRect(b.x, b.y + b.h - 7, b.w, 7);
    // cross braces
    ctx.strokeStyle = b.beam;
    ctx.lineWidth = 5;
    const bays = b.kind === "inn" || b.kind === "barn" ? 3 : 2;
    for (let i = 1; i < bays; i++) {
      const bx = b.x + (b.w / bays) * i;
      ctx.beginPath();
      ctx.moveTo(bx, wallTop + 6);
      ctx.lineTo(bx, b.y + b.h - 7);
      ctx.stroke();
    }
    for (let i = 0; i < bays; i++) {
      const x0 = b.x + (b.w / bays) * i + 8;
      const x1 = b.x + (b.w / bays) * (i + 1) - 8;
      ctx.beginPath();
      ctx.moveTo(x0, b.y + b.h - 10);
      ctx.lineTo((x0 + x1) / 2, wallTop + 10);
      ctx.lineTo(x1, b.y + b.h - 10);
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    // ---- roof ----------------------------------------------------------
    ctx.fillStyle = b.roof;
    if (b.kind === "barn") {
      // gambrel barn roof
      ctx.beginPath();
      ctx.moveTo(b.x - 9, wallTop + 2);
      ctx.lineTo(b.x + b.w * 0.16, b.y + b.h * 0.12);
      ctx.lineTo(b.x + b.w / 2, b.y - 4);
      ctx.lineTo(b.x + b.w * 0.84, b.y + b.h * 0.12);
      ctx.lineTo(b.x + b.w + 9, wallTop + 2);
      ctx.closePath();
      ctx.fill();
    } else if (b.kind === "chapel") {
      ctx.beginPath();
      ctx.moveTo(b.x - 8, wallTop + 2);
      ctx.lineTo(b.x + b.w / 2, b.y - 22);
      ctx.lineTo(b.x + b.w + 8, wallTop + 2);
      ctx.closePath();
      ctx.fill();
      // little belfry cross
      ctx.fillStyle = b.beam;
      ctx.fillRect(b.x + b.w / 2 - 2, b.y - 40, 4, 20);
      ctx.fillRect(b.x + b.w / 2 - 9, b.y - 34, 18, 4);
    } else {
      ctx.beginPath();
      ctx.moveTo(b.x - 9, wallTop + 2);
      ctx.lineTo(b.x + b.w / 2, b.y - 8);
      ctx.lineTo(b.x + b.w + 9, wallTop + 2);
      ctx.closePath();
      ctx.fill();
    }
    // thatch/tile shading lines
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      ctx.beginPath();
      ctx.moveTo(b.x - 9 + (b.w / 2 + 9) * t, wallTop + 2 - (wallTop + 10 - b.y) * t);
      ctx.lineTo(b.x + b.w + 9 - (b.w / 2 + 9) * t, wallTop + 2 - (wallTop + 10 - b.y) * t);
      ctx.stroke();
    }

    // ---- door, windows, chimney ---------------------------------------
    ctx.fillStyle = "#8b6b52";
    ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h - 38, 28, 31);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h - 38, 28, 5);
    ctx.fillStyle = "#f0c268";
    ctx.fillRect(b.x + b.w / 2 + 6, b.y + b.h - 24, 3, 3);

    ctx.fillStyle = "#bfe6f5";
    ctx.fillRect(b.x + 15, wallTop + 16, 18, 16);
    ctx.fillRect(b.x + b.w - 33, wallTop + 16, 18, 16);
    ctx.strokeStyle = b.beam;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 15, wallTop + 16, 18, 16);
    ctx.strokeRect(b.x + b.w - 33, wallTop + 16, 18, 16);
    ctx.beginPath();
    ctx.moveTo(b.x + 24, wallTop + 16);
    ctx.lineTo(b.x + 24, wallTop + 32);
    ctx.moveTo(b.x + b.w - 24, wallTop + 16);
    ctx.lineTo(b.x + b.w - 24, wallTop + 32);
    ctx.stroke();
    ctx.lineWidth = 1;

    if (b.kind === "forge" || b.kind === "inn") {
      ctx.fillStyle = "#9a8478";
      ctx.fillRect(b.x + b.w - 30, b.y - 24, 16, 34);
      ctx.fillStyle = "rgba(230,225,235,0.55)";
      const p = (Math.sin(this.time * 1.6) + 1) / 2;
      ctx.beginPath();
      ctx.arc(b.x + b.w - 22, b.y - 34 - p * 10, 6 + p * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.kind === "forge") {
      // glowing forge mouth
      const g = 0.5 + 0.5 * Math.sin(this.time * 3);
      ctx.fillStyle = `rgba(255,150,60,${0.45 + g * 0.4})`;
      ctx.fillRect(b.x + b.w / 2 - 10, b.y + b.h - 26, 20, 17);
    }
    if (b.kind === "inn") {
      // hanging sign
      ctx.fillStyle = b.beam;
      ctx.fillRect(b.x + b.w - 8, wallTop + 8, 22, 4);
      ctx.fillStyle = "#e8c98f";
      ctx.fillRect(b.x + b.w + 4, wallTop + 12, 16, 14);
    }
    this.buildingLabel(ctx, b);
  }

  private drawStall(ctx: CanvasRenderingContext2D, b: (typeof BUILDINGS)[number]) {
    // counter
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x + 6, b.y + b.h * 0.55, b.w - 12, b.h * 0.45);
    ctx.fillStyle = b.beam;
    ctx.fillRect(b.x + 6, b.y + b.h * 0.55, b.w - 12, 6);
    ctx.fillRect(b.x + 8, b.y + b.h * 0.55, 6, b.h * 0.45);
    ctx.fillRect(b.x + b.w - 14, b.y + b.h * 0.55, 6, b.h * 0.45);
    // striped awning
    const aw = b.w + 10;
    const ax = b.x - 5;
    const ay = b.y + b.h * 0.28;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? b.roof : "#fdf5e6";
      ctx.fillRect(ax + (aw / 6) * i, ay, aw / 6, 16);
    }
    ctx.fillStyle = b.beam;
    ctx.fillRect(ax + 2, ay, 5, b.h * 0.3);
    ctx.fillRect(ax + aw - 7, ay, 5, b.h * 0.3);
    // crates on the counter
    ctx.fillStyle = "#c79b64";
    ctx.fillRect(b.x + 20, b.y + b.h * 0.42, 16, 14);
    ctx.fillRect(b.x + b.w - 40, b.y + b.h * 0.44, 14, 12);
  }

  private drawTower(ctx: CanvasRenderingContext2D, b: (typeof BUILDINGS)[number]) {
    const cx = b.x + b.w / 2;
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x + 10, b.y + b.h * 0.2, b.w - 20, b.h * 0.8);
    // stone courses
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    for (let y = b.y + b.h * 0.3; y < b.y + b.h; y += 12) {
      ctx.beginPath();
      ctx.moveTo(b.x + 10, y);
      ctx.lineTo(b.x + b.w - 10, y);
      ctx.stroke();
    }
    // battlement
    ctx.fillStyle = b.beam;
    for (let i = 0; i < 4; i++) ctx.fillRect(b.x + 8 + i * ((b.w - 16) / 4), b.y + b.h * 0.14, (b.w - 16) / 8, 12);
    // conical roof
    ctx.fillStyle = b.roof;
    ctx.beginPath();
    ctx.moveTo(b.x + 4, b.y + b.h * 0.2);
    ctx.lineTo(cx, b.y - 26);
    ctx.lineTo(b.x + b.w - 4, b.y + b.h * 0.2);
    ctx.closePath();
    ctx.fill();
    // banner
    ctx.fillStyle = b.beam;
    ctx.fillRect(cx - 1, b.y - 44, 2, 20);
    ctx.fillStyle = b.roof;
    const wave = Math.sin(this.time * 3) * 2;
    ctx.beginPath();
    ctx.moveTo(cx + 1, b.y - 44);
    ctx.lineTo(cx + 18 + wave, b.y - 39);
    ctx.lineTo(cx + 1, b.y - 33);
    ctx.closePath();
    ctx.fill();
    // arched window + door
    ctx.fillStyle = "#3f3550";
    ctx.fillRect(cx - 7, b.y + b.h * 0.38, 14, 16);
    ctx.fillStyle = "#8b6b52";
    ctx.fillRect(cx - 12, b.y + b.h - 30, 24, 30);
  }

  private buildingLabel(_ctx: CanvasRenderingContext2D, _b: (typeof BUILDINGS)[number]) {
    // Building names are intentionally not rendered; only NPCs get labels.
  }



  private drawButterflies(ctx: CanvasRenderingContext2D) {
    for (const b of this.butterflies) {
      const flap = Math.abs(Math.sin(b.p * 8));
      ctx.fillStyle = "rgba(255,214,235,0.9)";
      ctx.fillRect(b.x, b.y, 3 + flap * 2, 3);
      ctx.fillRect(b.x - 3 - flap * 2, b.y, 3 + flap * 2, 3);
    }
  }

  private shadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.fillStyle = "rgba(80,60,100,0.18)";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawNode(ctx: CanvasRenderingContext2D, n: ResNode) {
    const def = NODE_DEFS[n.kind];
    if (n.depleted) ctx.globalAlpha = 0.35;
    this.shadow(ctx, n.x, n.y + 20, 22);
    if (def.shape === "rock") {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.moveTo(n.x - 24, n.y + 20);
      ctx.lineTo(n.x - 14, n.y - 14);
      ctx.lineTo(n.x + 10, n.y - 20);
      ctx.lineTo(n.x + 24, n.y + 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(n.x - 12, n.y - 10, 12, 8);
      if (!n.depleted) {
        ctx.fillStyle = def.accent;
        ctx.fillRect(n.x - 4, n.y + 2, 8, 8);
        ctx.fillRect(n.x + 8, n.y - 4, 6, 6);
      }
    } else if (def.shape === "tree") {
      ctx.fillStyle = def.color;
      ctx.fillRect(n.x - 7, n.y - 10, 14, 32);
      const sway = Math.sin(this.time * 1.4 + n.sway) * 3;
      ctx.fillStyle = n.depleted ? "#9ab389" : def.accent;
      ctx.beginPath();
      ctx.arc(n.x + sway, n.y - 30, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(n.x + sway - 16, n.y - 18, 18, 0, Math.PI * 2);
      ctx.arc(n.x + sway + 16, n.y - 18, 18, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const sway = Math.sin(this.time * 1.8 + n.sway) * 2;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(n.x + sway, n.y + 2, 20, 0, Math.PI * 2);
      ctx.fill();
      if (!n.depleted) {
        ctx.fillStyle = def.accent;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + n.sway;
          ctx.beginPath();
          ctx.arc(n.x + sway + Math.cos(a) * 11, n.y + 2 + Math.sin(a) * 8, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (!n.depleted) {
      const tw = (Math.sin(this.time * 3 + n.sway) + 1) / 2;
      ctx.globalAlpha = 0.35 + tw * 0.5;
      ctx.fillStyle = "#fff9c9";
      ctx.fillRect(n.x + 18, n.y - 34, 3, 3);
      ctx.fillRect(n.x - 22, n.y - 24, 2, 2);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  }

  private drawMonster(ctx: CanvasRenderingContext2D, m: Monster) {
    const d = MONSTER_DEFS[m.kind];
    const s = d.size;
    const bob = Math.sin(this.time * 4 + m.id) * 2;
    this.shadow(ctx, m.x, m.y + 14 * s, 14 * s);
    ctx.fillStyle = m.hitFlash > 0 ? "#ffffff" : d.body;
    ctx.beginPath();
    ctx.roundRect(m.x - 10 * s, m.y - 6 * s + bob, 20 * s, 18 * s, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(m.x, m.y - 16 * s + bob, 13 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.accent;
    if (d.ears === "beak") {
      ctx.beginPath();
      ctx.moveTo(m.x - 4, m.y - 27 * s + bob);
      ctx.lineTo(m.x, m.y - 34 * s + bob);
      ctx.lineTo(m.x + 4, m.y - 27 * s + bob);
      ctx.fill();
      ctx.fillRect(m.x + 10 * s, m.y - 17 * s + bob, 6, 4);
    } else if (d.ears === "horns") {
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(m.x + dir * 13 * s, m.y - 20 * s + bob);
        ctx.lineTo(m.x + dir * 20 * s, m.y - 27 * s + bob);
        ctx.lineTo(m.x + dir * 11 * s, m.y - 27 * s + bob);
        ctx.fill();
      }
    } else if (d.ears === "spikes") {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(m.x + i * 8 * s - 3, m.y - 26 * s + bob);
        ctx.lineTo(m.x + i * 8 * s, m.y - 36 * s + bob);
        ctx.lineTo(m.x + i * 8 * s + 3, m.y - 26 * s + bob);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#4a3b52";
    ctx.fillRect(m.x - 6 * s, m.y - 18 * s + bob, 3, 3);
    ctx.fillRect(m.x + 3 * s, m.y - 18 * s + bob, 3, 3);
    // Persistent nameplate: name + level, always shown above the head.
    const label = `${d.name} · Lv ${monsterLevel(d)}`;
    ctx.font = "bold 11px ui-rounded, 'Baloo 2', system-ui, sans-serif";
    ctx.textAlign = "center";
    const lw = ctx.measureText(label).width + 12;
    ctx.fillStyle = "rgba(52,40,64,0.55)";
    ctx.beginPath();
    ctx.roundRect(m.x - lw / 2, m.y - 54 * s + bob, lw, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#f6f2ff";
    ctx.fillText(label, m.x, m.y - 43 * s + bob);

    if (m.hp < m.maxHp) {
      // Shared health pool. Amber bar = another player tagged it first, so the
      // loot is theirs. Drawn below the nameplate.
      const mine = !m.taggedBy || m.taggedBy === this.userId;
      ctx.fillStyle = "rgba(70,55,70,0.3)";
      ctx.fillRect(m.x - 16, m.y - 34 * s, 32, 5);
      ctx.fillStyle = mine ? "#8fd98a" : "#e8b26a";
      ctx.fillRect(m.x - 16, m.y - 34 * s, 32 * (m.hp / m.maxHp), 5);
    }
  }

  private drawNpc(ctx: CanvasRenderingContext2D, npc: NpcDef, live: LiveNpc) {
    const bob = Math.sin(this.time * 2 + live.hx) * 1.6;
    const x = live.x;
    const y = live.y - bob;
    this.shadow(ctx, live.x, live.y + 16, 15);
    ctx.fillStyle = npc.robe;
    ctx.beginPath();
    ctx.roundRect(x - 11, y - 6, 22, 22, 7);
    ctx.fill();
    ctx.fillStyle = "#ffe0c2";
    ctx.beginPath();
    ctx.arc(x, y - 18, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = npc.hair;
    ctx.beginPath();
    ctx.arc(x, y - 22, 14, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#4a3b52";
    ctx.fillRect(x - 5, y - 19, 3, 4);
    ctx.fillRect(x + 3, y - 19, 3, 4);

    const marker =
      npc.services.includes("quests")
        ? this.quest
          ? this.quest.progress >= (QUESTS.find((q) => q.id === this.quest!.id)?.count ?? 99)
            ? "?"
            : ""
          : QUESTS.some((q) => !this.completed.includes(q.id))
            ? "!"
            : ""
        : "";
    if (marker) {
      const f = Math.sin(this.time * 4) * 3;
      ctx.font = "bold 20px ui-rounded, 'Baloo 2', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(70,55,70,0.3)";
      ctx.fillText(marker, x, y - 40 + f + 2);
      ctx.fillStyle = "#ffd764";
      ctx.fillText(marker, x, y - 40 + f);
    }
    // Merchant-type badge floating above the head.
    const icon = NPC_ICONS[npc.id];
    if (icon) {
      const iy = y - (marker ? 62 : 44) + Math.sin(this.time * 2 + live.hx) * 1.5;
      ctx.fillStyle = "rgba(70,55,70,0.22)";
      ctx.beginPath();
      ctx.roundRect(x - 13, iy - 12 + 2, 26, 24, 9);
      ctx.fill();
      ctx.fillStyle = icon.color;
      ctx.beginPath();
      ctx.roundRect(x - 13, iy - 12, 26, 24, 9);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = "14px ui-rounded, 'Baloo 2', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#3d2f45";
      ctx.fillText(icon.glyph, x, iy + 1);
      ctx.textBaseline = "alphabetic";
    }

    ctx.font = "bold 11px ui-rounded, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(70,55,70,0.7)";
    ctx.fillText(npc.name, x, y + 32);
    // Role / title under the name in bold.
    ctx.font = "bold 10px ui-rounded, system-ui, sans-serif";
    ctx.fillStyle = "rgba(95,74,92,0.92)";
    ctx.fillText(npc.title, x, y + 44);
  }

  private drawRemote(ctx: CanvasRenderingContext2D, r: RemotePlayer) {
    const moving = Math.abs(r.tx - r.x) + Math.abs(r.ty - r.y) > 1.5;
    const bob = moving ? Math.abs(Math.sin(r.bob)) * 3 : Math.sin(this.time * 2) * 1.2;
    const x = r.x;
    const y = r.y;
    this.shadow(ctx, x, y + 16, 15);
    ctx.globalAlpha = 0.96;
    // body — cool tone so other players read as distinct from you
    ctx.fillStyle = "#b7d4f5";
    ctx.beginPath();
    ctx.roundRect(x - 11, y - 8 - bob, 22, 24, 7);
    ctx.fill();
    ctx.fillStyle = "#ffe0c2";
    ctx.beginPath();
    ctx.arc(x, y - 20 - bob, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#43506b";
    ctx.beginPath();
    ctx.arc(x, y - 24 - bob, 15, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#4a3b52";
    ctx.fillRect(x - 6 * r.f, y - 21 - bob, 3, 4);
    ctx.fillRect(x + 2 * r.f, y - 21 - bob, 3, 4);
    ctx.globalAlpha = 1;

    // nameplate
    const label = `${r.name} · Lv ${r.level}`;
    ctx.font = "bold 11px ui-rounded, 'Baloo 2', system-ui, sans-serif";
    ctx.textAlign = "center";
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = "rgba(52,40,64,0.55)";
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 54 - bob, w, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#f6f2ff";
    ctx.fillText(label, x, y - 43 - bob);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const x = this.px;
    const y = this.py;
    const walking = this.activity === "Walking" || this.activity === "Wandering" || this.activity === "Approaching";
    const bob = walking ? Math.abs(Math.sin(this.moveT)) * 3 : Math.sin(this.time * 2) * 1.4;
    this.shadow(ctx, x, y + 16, 16);
    // body
    ctx.fillStyle = this.armor ? item(this.armor.id).color : "#f2c6d8";
    ctx.beginPath();
    ctx.roundRect(x - 11, y - 8 - bob, 22, 24, 7);
    ctx.fill();
    // head
    ctx.fillStyle = "#ffe0c2";
    ctx.beginPath();
    ctx.arc(x, y - 20 - bob, 15, 0, Math.PI * 2);
    ctx.fill();
    // hair
    ctx.fillStyle = "#6b4a35";
    ctx.beginPath();
    ctx.arc(x, y - 24 - bob, 15, Math.PI, 0);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#4a3b52";
    ctx.fillRect(x - 6 * this.facing, y - 21 - bob, 3, 4);
    ctx.fillRect(x + 2 * this.facing, y - 21 - bob, 3, 4);
    // weapon
    if (this.weapon) {
      ctx.fillStyle = item(this.weapon.id).color;
      ctx.save();
      ctx.translate(x + 14 * this.facing, y - 4 - bob);
      ctx.rotate(this.facing * (this.activity.startsWith("Fighting") ? Math.sin(this.time * 12) * 0.7 - 0.4 : -0.3));
      ctx.fillRect(-2, -18, 4, 22);
      ctx.restore();
    }
  }
}

/** Resample a polyline so consecutive points are at most `step` apart. */
function densify(pts: [number, number][], step: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  const last = pts[pts.length - 1];
  if (last) out.push([last[0], last[1]]);
  return out;
}

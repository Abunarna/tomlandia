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
import { CITIES, cityGateAt, cityOuterR, cityWallR, type CityDef } from "./city";
import {
  BOSS_ATTACK_RADIUS,
  BOSS_HP,
  BOSS_LEVEL,
  BOSS_MELEE_RADIUS,
  BOSS_NAME,
  BOSS_SIZE,
  BOSS_WARN_RADIUS,
  desolatusAt,
} from "./boss";
import { levelFromXp } from "./progression";
import { ambience, loops, music, sfx, type LoopId } from "./audio";
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
  /** emote shown above their head, with a local expiry */
  emote?: { e: string; until: number };
  /** last emote timestamp we processed from them */
  eat?: number;
}

/** The six quick-chat emotes in the radial menu, in clockwise order. */
export const EMOTES = ["❤️", "😠", "😄", "😛", "noob", "👋"];
/** Radius of the radial menu (world px) and of each option bubble. */
const EMOTE_RING = 66;
const EMOTE_R = 21;
/** How long the menu stays open, how long an emote shows, spam cooldown. */
const EMOTE_MENU_MS = 3000;
const EMOTE_SHOW_MS = 3000;
const EMOTE_CD_MS = 10000;


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
  | { type: "fish"; id: number }
  | { type: "boss" };

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
  /** default spawn: the Grand Haven crossroads in the Peaceful Fields */
  px = 700;
  py = 2400;
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
  /** player-chosen auto-eat threshold (fraction of max HP) */
  autoEatAt = 0.5;
  /** wall-clock ms when the 2s auto-eat cooldown ends */
  private autoEatCdUntil = 0;
  /** wall-clock ms of the last auto-eat trigger (drives the glow pulse) */
  private autoEatFiredAt = 0;

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

  /**
   * DESOLATUS — the shared world boss. Position comes from the deterministic
   * clock path (zero network cost); only the HP pool is synced.
   */
  boss = {
    x: WORLD_W / 2,
    y: WORLD_H / 2,
    facing: 1 as 1 | -1,
    hp: BOSS_HP,
    maxHp: BOSS_HP,
    respawnAt: 0,
    dist: 99999,
    pending: false,
    hitFlash: 0,
  };
  private bossAggroCd = 0;
  /** Server-side boss swing. Reports his computed position for verification. */
  onBossAttack:
    | ((x: number, y: number, bx: number, by: number, passive: boolean) => Promise<DamageRes>)
    | null = null;

  private target: Target = { type: "none" };
  private gatherProgress = 0;
  private combatCd = 0;
  private regenCd = 0;
  private activity = "Wandering";
  private activityProgress = 0;
  /** looping sound effect for the action in progress this frame */
  private actionLoop: LoopId | null = null;
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

  /** Acknowledge the current death event so HUD updates cannot reopen it. */
  acknowledgeDeath() {
    this.death = null;
    this.emitHud(true);
  }

  /** Mirror authoritative node rows (snapshot or realtime) into the world. */
  applyNodeRows(
    rows: { id: number; charges: number; respawn_at: string | null; kind?: string; x?: number; y?: number }[],
    full = false,
  ) {
    // The database is the source of truth for what exists and where it stands.
    // A full snapshot rebuilds any row the local spawn table disagrees with, so
    // regenerated worlds can never drift out of alignment with the server.
    if (full) {
      const known = new Set(rows.map((r) => r.id));
      this.nodes = this.nodes.filter((n) => known.has(n.id));
    }
    for (const row of rows) {
      let n = this.nodes.find((c) => c.id === row.id);
      if (!n) {
        if (!row.kind || row.x === undefined || row.y === undefined) continue;
        n = {
          id: row.id,
          kind: row.kind as ResNode["kind"],
          x: row.x,
          y: row.y,
          depleted: false,
          charges: row.charges,
          respawnAt: 0,
          pending: false,
          sway: Math.random() * 6,
        };
        this.nodes.push(n);
      }
      if (row.kind) n.kind = row.kind as ResNode["kind"];
      if (typeof row.x === "number") n.x = row.x;
      if (typeof row.y === "number") n.y = row.y;
      n.charges = row.charges;
      n.respawnAt = row.respawn_at ? Date.parse(row.respawn_at) : 0;
      n.depleted = n.respawnAt > Date.now();
      if (n.depleted && this.target.type === "node" && this.target.id === n.id) {
        this.target = { type: "none" };
        this.gatherProgress = 0;
      }
    }
    if (full) this.nodes.sort((a, b) => a.id - b.id);
  }

  /** Mirror authoritative monster rows (snapshot or realtime) into the world. */
  applyMonsterRows(
    rows: {
      id: number;
      hp: number;
      tagged_by: string | null;
      respawn_at: string | null;
      kind?: string;
      x?: number;
      y?: number;
    }[],
    full = false,
  ) {
    if (full) {
      const known = new Set(rows.map((r) => r.id));
      this.monsters = this.monsters.filter((m) => known.has(m.id));
    }
    for (const row of rows) {
      let m = this.monsters.find((c) => c.id === row.id);
      if (!m) {
        if (!row.kind || row.x === undefined || row.y === undefined) continue;
        const kind = row.kind as Monster["kind"];
        const def = MONSTER_DEFS[kind];
        if (!def) continue;
        m = {
          id: row.id,
          kind,
          x: row.x,
          y: row.y,
          hx: row.x,
          hy: row.y,
          hp: row.hp,
          maxHp: def.hp,
          dead: false,
          respawnAt: 0,
          taggedBy: null,
          pending: false,
          wanderAt: 0,
          hitFlash: 0,
        };
        this.monsters.push(m);
      }
      if (row.kind && MONSTER_DEFS[row.kind as Monster["kind"]]) {
        m.kind = row.kind as Monster["kind"];
        m.maxHp = MONSTER_DEFS[m.kind].hp;
      }
      // Keep the home anchor pinned to the server's spawn point; the live
      // position follows it whenever the drift would put us out of swing range.
      if (typeof row.x === "number" && typeof row.y === "number") {
        const moved = m.hx !== row.x || m.hy !== row.y;
        m.hx = row.x;
        m.hy = row.y;
        if (moved || Math.hypot(m.x - row.x, m.y - row.y) > 90) {
          m.x = row.x;
          m.y = row.y;
        }
      }
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
    if (full) this.monsters.sort((a, b) => a.id - b.id);
  }

  /* ---------- phase 7: shared presence ---------- */

  /** What we broadcast to our cell's neighbours. */
  presenceState() {
    const emo = this.myEmote && this.myEmote.until > Date.now() ? this.myEmote : null;
    return {
      name: this.playerName,
      level: this.lvl("combat"),
      x: Math.round(this.px),
      y: Math.round(this.py),
      f: this.facing,
      act: this.activity,
      ...(emo ? { emo: emo.e, eat: emo.at } : {}),
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
      if (p.emo && p.eat && p.eat !== cur.eat) {
        cur.eat = p.eat;
        cur.emote = { e: p.emo, until: Date.now() + EMOTE_SHOW_MS };
      }
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
        ...(p.emo && p.eat
          ? { eat: p.eat, emote: { e: p.emo, until: Date.now() + EMOTE_SHOW_MS } }
          : {}),
      });
    }
  }

  /* ---------- player-to-player emotes ---------- */

  /** Radial menu currently open around a nearby player, if any. */
  private emoteMenu: { id: string; until: number } | null = null;
  /** Our own emote (shown locally + broadcast to neighbours). */
  private myEmote: { e: string; at: number; until: number } | null = null;
  /** Silent anti-spam gate — deliberately never surfaced in the UI. */
  private emoteCdUntil = 0;

  /** World-space centres of the six option bubbles around a player. */
  private emoteSlots(x: number, y: number) {
    return EMOTES.map((e, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / EMOTES.length;
      return { e, x: x + Math.cos(a) * EMOTE_RING, y: y - 24 + Math.sin(a) * EMOTE_RING };
    });
  }

  private sendEmote(e: string) {
    const now = Date.now();
    if (now < this.emoteCdUntil) return;
    this.emoteCdUntil = now + EMOTE_CD_MS;
    this.myEmote = { e, at: now, until: now + EMOTE_SHOW_MS };
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

  /** a free-to-stand spot inside a town's plaza / ring road area */
  private villagerSpot(c: CityDef): { x: number; y: number } {
    const maxR = Math.max(c.plazaR + 30, c.ringR[0]! - 10);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 24 + Math.random() * (maxR - 24);
      const x = c.cx + Math.cos(a) * r;
      const y = c.cy + Math.sin(a) * r;
      if (!blockedAt(x, y, 12)) return { x, y };
    }
    return { x: c.cx, y: c.cy };
  }

  private spawnVillagers() {
    const robes = ["#f2c6d8", "#9fd6b8", "#f5d78a", "#bcd9ec", "#e0bff0", "#f6c9a8"];
    const hairs = ["#5c3a2e", "#3f5f78", "#8a6a45", "#e6e0ef", "#6b4f7a"];
    for (const c of CITIES) {
      for (let i = 0; i < 5; i++) {
        const s = this.villagerSpot(c);
        this.villagers.push({
          x: s.x,
          y: s.y,
          hx: c.cx,
          hy: c.cy,
          tx: s.x,
          ty: s.y,
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
      autoEatAt: this.autoEatAt,
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
  }

  /** Persist without the "Saved" toast — used after local gold changes. */
  private syncNow() {
    this.pushSave(false);
  }

  save() {
    this.pushSave(false);
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
      if (typeof s.autoEatAt === "number" && [0.25, 0.5, 0.75].includes(s.autoEatAt)) {
        this.autoEatAt = s.autoEatAt;
      }
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
    // Everything stacks — gear only merges with identical upgrade levels, so
    // a Steel Sword +14 stays a distinct stack from a plain Steel Sword.
    const slot = this.inv.find((s) => s && s.id === id && (s.plus ?? 0) === plus);
    if (slot) {
      slot.qty += qty;
      return true;
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
    const existing = this.bank.items.find(
      (s) => s && s.id === slot.id && (s.plus ?? 0) === (slot.plus ?? 0),
    );
    if (existing) {
      existing.qty += qty;
      return true;
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
    // Equipping from a stack only takes one piece; the swapped-out item goes
    // back into the bag (needs a free/matching slot when the stack survives).
    if (slot.qty > 1) {
      if (prev) {
        const room =
          this.inv.some((s, i) => i !== index && s === null) ||
          this.inv.some(
            (s, i) => i !== index && s && s.id === prev.id && (s.plus ?? 0) === (prev.plus ?? 0),
          );
        if (!room) {
          this.pushText(this.px, this.py - 50, "Bag full!", "#f2a1a1");
          return;
        }
      }
      slot.qty -= 1;
      if (prev) this.addItem(prev.id, 1, prev.plus);
    } else {
      this.inv[index] = prev ? { id: prev.id, qty: 1, plus: prev.plus } : null;
    }
    if (def.kind === "weapon") this.weapon = next;
    else this.armor = next;
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

    // An open emote radial swallows the tap: pick an option, or dismiss it.
    const menu = this.emoteMenu;
    if (menu && menu.until > Date.now()) {
      const who = this.remotes.get(menu.id);
      if (who) {
        for (const slot of this.emoteSlots(who.x, who.y)) {
          if (Math.hypot(slot.x - wx, slot.y - wy) < EMOTE_R + 6) {
            this.sendEmote(slot.e);
            this.emoteMenu = null;
            return;
          }
        }
      }
      this.emoteMenu = null;
      return;
    }
    this.emoteMenu = null;

    // Tapping another human opens the quick-emote radial around them.
    for (const r of this.remotes.values()) {
      if (Math.hypot(r.x - wx, r.y - 12 - wy) < 34) {
        this.emoteMenu = { id: r.id, until: Date.now() + EMOTE_MENU_MS };
        return;
      }
    }

    let best: { d: number; t: Target } | null = null;

    if (this.bossAlive) {
      const d = Math.hypot(this.boss.x - wx, this.boss.y - 30 - wy);
      if (d < 80) best = { d: 0, t: { type: "boss" } };
    }
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
    music.stop();
    loops.stop();
    this.save();
  }

  /** CSS-pixel size of the canvas, cached so the loop never forces a layout. */
  viewW = 0;
  viewH = 0;

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.viewW = rect.width;
    this.viewH = rect.height;
    // Cap the backing store: a wide desktop window at dpr 2 would otherwise
    // paint 6-10x the pixels of the portrait mobile target every frame.
    const MAX_PIXELS = 2_400_000;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    const area = Math.max(1, rect.width * rect.height);
    if (area * dpr * dpr > MAX_PIXELS) dpr = Math.max(1, Math.sqrt(MAX_PIXELS / area));
    this.dpr = dpr;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.terrainCache = null;
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

  /** Cycle the auto-eat threshold 75% -> 50% -> 25% -> 75%. */
  cycleAutoEat() {
    this.autoEatAt = this.autoEatAt === 0.75 ? 0.5 : this.autoEatAt === 0.5 ? 0.25 : 0.75;
    this.pushText(
      this.px,
      this.py - 40,
      `Auto-snack at ${Math.round(this.autoEatAt * 100)}% hp`,
      "#9fe6a0",
    );
    this.emitHud(true);
    this.pushSave(false);
  }

  /** Remove the equipped auto-snack food. */
  clearAutoSnack() {
    if (!this.food) return;
    this.food = null;
    this.pushText(this.px, this.py - 40, "Auto-snack cleared", "#ffe0a8");
    this.emitHud(true);
    this.runGear(this.onEquip ? this.onEquip(-1) : null);
    this.pushSave(false);
  }


  /* ---------- DESOLATUS ---------- */

  get bossAlive() {
    return this.boss.hp > 0 && (!this.boss.respawnAt || Date.now() >= this.boss.respawnAt);
  }

  /** Adopt the shared HP pool from the database / realtime feed. */
  applyBossRow(row: { hp: number; max_hp: number; respawn_at: string | null }) {
    this.boss.hp = row.hp;
    this.boss.maxHp = row.max_hp || BOSS_HP;
    this.boss.respawnAt = row.respawn_at ? Date.parse(row.respawn_at) : 0;
    this.emitHud(true);
  }

  /** Shared damage-taken handling (regular monsters and the boss both use it). */
  private takeHit(taken: number, killer: string) {
    if (taken > 0) {
      this.hp -= taken;
      this.pushText(this.px, this.py - 34, `-${taken}`, "#f4b0b0");
    }
    this.autoEat();
    if (this.hp <= 0) {
      const lostGold = Math.floor(this.gold * 0.1);
      this.hp = Math.ceil(this.maxHp * 0.5);
      this.px = 700;
      this.py = 2400;
      this.gold = Math.max(0, this.gold - lostGold);
      this.death = {
        at: Date.now(),
        reason: `${killer} struck you down. A villager dragged you back to Grand Haven at half health. You lost ${lostGold} gold (10%) in the chaos.`,
      };
      this.pushText(this.px, this.py - 60, "Whew! Rescued by a villager", "#c9d8f5");
      this.target = { type: "none" };
    }
  }

  /** One boss swing (ours, or his free hit when we simply stand too close). */
  private bossSwing(passive: boolean) {
    if (this.boss.pending || !this.onBossAttack) return;
    this.boss.pending = true;
    void this.onBossAttack(this.px, this.py, this.boss.x, this.boss.y, passive)
      .then((res) => {
        this.boss.pending = false;
        if (!res.ok) {
          if (res.reason === "dead") {
            this.boss.hp = 0;
            this.boss.respawnAt = res.respawn_at ? Date.parse(res.respawn_at) : Date.now() + 600000;
            if (this.target.type === "boss") this.target = { type: "none" };
          }
          if (typeof res.hp === "number") this.boss.hp = res.hp;
          return;
        }
        if (typeof res.hp === "number") this.boss.hp = res.hp;
        if (typeof res.max_hp === "number") this.boss.maxHp = res.max_hp;
        if (!passive) {
          this.boss.hitFlash = 0.2;
          sfx.play("hit");
          this.pushText(this.boss.x, this.boss.y - 70, `${res.dmg ?? 0}`, "#ffd3d3");
        }
        this.applyServerState(res.state);
        if (res.killed) {
          this.boss.respawnAt = res.respawn_at ? Date.parse(res.respawn_at) : Date.now() + 600000;
          this.pushText(this.boss.x, this.boss.y - 100, `${BOSS_NAME} FALLS!`, "#ffd98e");
          if (res.gold) this.pushText(this.px, this.py - 60, `+${res.gold}g`, "#ffe08a");
          (res.loot ?? []).forEach((l, i) => {
            const id = l.item ?? l.id;
            if (!id || !ITEMS[id]) return;
            this.pushText(this.px + (i % 2 ? 16 : -16), this.py - 76 - i * 12, `+${l.qty} ${ITEMS[id]!.name}`, "#dff6c9");
          });
          if (res.leveled) this.celebrateLevel("combat");
          if (this.target.type === "boss") this.target = { type: "none" };
        } else {
          this.takeHit(Math.max(0, res.taken ?? 0), BOSS_NAME);
        }
        this.emitHud(true);
      })
      .catch(() => {
        this.boss.pending = false;
      });
  }

  /** Roam by clock, and let him hit anyone loitering inside his reach. */
  private tickBoss(dt: number) {
    const pose = desolatusAt();
    this.boss.x = pose.x;
    this.boss.y = pose.y;
    this.boss.facing = pose.facing;
    if (this.boss.hitFlash > 0) this.boss.hitFlash -= dt;
    if (this.boss.respawnAt && Date.now() >= this.boss.respawnAt) {
      this.boss.respawnAt = 0;
      this.boss.hp = this.boss.maxHp;
    }
    this.boss.dist = Math.hypot(pose.x - this.px, pose.y - this.py);

    if (!this.bossAlive) return;
    if (this.boss.dist <= BOSS_ATTACK_RADIUS && this.target.type !== "boss") {
      this.bossAggroCd -= dt;
      if (this.bossAggroCd <= 0) {
        this.bossAggroCd = 1.6;
        this.bossSwing(true);
      }
    } else {
      this.bossAggroCd = 0;
    }
  }

  private autoEat() {
    if (this.hp / this.maxHp > this.autoEatAt) return;
    const now = Date.now();
    if (now < this.autoEatCdUntil) return;
    const id = this.food;
    if (!id) return;
    const def = item(id);
    if (def.kind !== "food" || !def.heal) return;
    if (!this.removeItem(id, 1)) return;
    this.autoEatFiredAt = now;
    this.autoEatCdUntil = now + 2000;
    this.hp = Math.min(this.maxHp, this.hp + def.heal);
    this.pushText(this.px, this.py - 46, `+${def.heal} hp`, "#9fe6a0");
  }

  private update(dt: number) {
    const now = this.time;
    this.tickRemotes(dt);
    this.tickBoss(dt);

    this.actionLoop = null;

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
      const tid = this.target.type === "node" ? this.target.id : -1;
      const n = this.nodes.find((c) => c.id === tid);
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
          this.actionLoop =
            def.skill === "mining" ? "mining" : def.skill === "woodcutting" ? "woodcutting" : "gathering";
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
          // Keep the ambient fishing loop running for the whole time the
          // player stands on the jetty — don't cut it during the short
          // "waiting for a bite" breather between catches.
          this.actionLoop = "fishing";
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
      const tid = this.target.type === "monster" ? this.target.id : -1;
      const m = this.monsters.find((c) => c.id === tid);
      if (!m || m.dead) {
        this.target = { type: "none" };
      } else {
        const d = this.moveToward(m.x, m.y, dt, 140);
        if (d <= 34) {
          const md = MONSTER_DEFS[m.kind];
          this.activity = `Fighting ${md.name}`;
          this.actionLoop = "combat";
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
                      this.py = 2400;
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
    } else if (this.target.type === "boss") {
      if (!this.bossAlive) {
        this.target = { type: "none" };
      } else {
        const d = this.moveToward(this.boss.x, this.boss.y + 20, dt, 140);
        if (d <= BOSS_MELEE_RADIUS) {
          this.activity = `Fighting ${BOSS_NAME}`;
          this.actionLoop = "combat";
          this.combatCd -= dt;
          this.activityProgress = 1 - Math.max(0, this.combatCd) / this.attackInterval;
          if (this.combatCd <= 0) {
            this.combatCd = this.attackInterval;
            this.bossSwing(false);
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
        this.activity = `Visiting ${npc.title}`;
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

    loops.set(this.actionLoop);

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
        const home = CITIES.find((c) => c.cx === v.hx && c.cy === v.hy);
        if (home) {
          const s = this.villagerSpot(home);
          v.tx = s.x;
          v.ty = s.y;
        } else {
          v.tx = v.hx + (Math.random() - 0.5) * 240;
          v.ty = v.hy + (Math.random() - 0.5) * 170;
        }

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
    const vw = this.viewW;
    const vh = this.viewH;
    const tx = Math.max(0, Math.min(WORLD_W - vw, this.px - vw / 2));
    const ty = Math.max(0, Math.min(WORLD_H - vh, this.py - vh / 2));

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
    void this.craftOnce(r.id);
    return true;
  }

  /** Craft repeatedly, one item per recipe-time, until materials run out. */
  craftAll(recipeId: string): boolean {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r || !this.onCraft) return false;
    if (this.craftPending || this.craftLoop) return false;
    this.craftLoop = true;
    void (async () => {
      try {
        // safety cap so a server bug can't spin forever
        for (let n = 0; n < 500; n++) {
          if (!this.craftLoop) break;
          if (!this.canCraft(r.id)) break;
          const ok = await this.craftOnce(r.id);
          if (!ok) break;
          if (!this.craftLoop) break;
          await new Promise((res) => setTimeout(res, Math.max(200, r.time * 1000)));
        }
      } finally {
        this.craftLoop = false;
      }
    })();
    return true;
  }

  /** Stop an in-flight "make all" run. */
  stopCraftAll() {
    this.craftLoop = false;
  }

  private async craftOnce(recipeId: string): Promise<boolean> {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r || !this.onCraft || this.craftPending) return false;
    this.craftPending = true;
    try {
      const res = await this.onCraft(r.id);
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
        return false;
      }
      this.applyServerState(res.state);
      sfx.play("craft");
      this.pushText(this.px, this.py - 56, `+${res.out_qty ?? 1} ${item(r.out).name}`, "#dff6c9");
      this.orbs.push({ x: this.px + (Math.random() - 0.5) * 30, y: this.py - 20, life: 0.9 });
      if (res.leveled) this.celebrateLevel(r.skill);
      this.emitHud(true);
      return true;
    } catch {
      this.craftPending = false;
      return false;
    }
  }

  private craftPending = false;
  private craftLoop = false;


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
    if (this.food && slot.id === this.food) {
      this.pushText(this.px, this.py - 50, "Unequip your snack first", "#ffb4b4");
      return false;
    }

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
    ambience.setEnabled(sfx.enabled);
    if (sfx.enabled) sfx.play("coin");
    this.emitHud(true);
    return sfx.enabled;
  }

  toggleMusic(): boolean {
    sfx.unlock();
    music.setEnabled(!music.enabled);
    this.emitHud(true);
    return music.enabled;
  }

  unlockAudio() {
    sfx.unlock();
    ambience.start();
    music.start();
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
      autoEat: {
        threshold: this.autoEatAt,
        qty: this.food ? this.countItem(this.food) : 0,
        firedAt: this.autoEatFiredAt,
        cooldownUntil: this.autoEatCdUntil,
      },
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
      musicOn: music.enabled,
      name: this.playerName,
      nearby: this.remotes.size,
      buff: this.buff ? { ...this.buff } : null,
      death: this.death ? { ...this.death } : null,
      boss: {
        name: BOSS_NAME,
        level: BOSS_LEVEL,
        alive: this.bossAlive,
        hp: Math.max(0, Math.round(this.boss.hp)),
        maxHp: this.boss.maxHp,
        dist: Math.round(this.boss.dist),
        // 0 at the edge of the warning ring, 1 once he is on top of you
        warn: this.bossAlive
          ? Math.max(
              0,
              Math.min(
                1,
                (BOSS_WARN_RADIUS - this.boss.dist) / (BOSS_WARN_RADIUS - BOSS_ATTACK_RADIUS),
              ),
            )
          : 0,
        engaged: this.target.type === "boss",
        respawnAt: this.boss.respawnAt,
      },
    });
  }

  /* ---------- render ---------- */

  /**
   * Static terrain (biomes, roads, streets, barriers) never moves, so it is
   * painted once into an offscreen canvas covering the view plus a margin and
   * blitted each frame. Animated water stays live, drawn between the layers.
   */
  private terrainCache: {
    base: HTMLCanvasElement;
    over: HTMLCanvasElement;
    x: number;
    y: number;
    w: number;
    h: number;
    scale: number;
  } | null = null;

  private ensureTerrain(view: { x: number; y: number; w: number; h: number }) {
    const M = 256;
    const c = this.terrainCache;
    if (
      c &&
      c.scale === this.dpr &&
      view.x >= c.x &&
      view.y >= c.y &&
      view.x + view.w <= c.x + c.w &&
      view.y + view.h <= c.y + c.h
    ) {
      return c;
    }
    const w = Math.ceil(view.w) + M * 2;
    const h = Math.ceil(view.h) + M * 2;
    const x = Math.floor(view.x) - M;
    const y = Math.floor(view.y) - M;
    const s = this.dpr;
    const reuse = c && c.w === w && c.h === h && c.scale === s;
    const make = (old: HTMLCanvasElement | null) => {
      const cv = reuse && old ? old : document.createElement("canvas");
      cv.width = Math.floor(w * s);
      cv.height = Math.floor(h * s);
      return cv;
    };
    const base = make(c?.base ?? null);
    const over = make(c?.over ?? null);

    const region = { x, y, w, h };
    const bctx = base.getContext("2d")!;
    bctx.setTransform(s, 0, 0, s, 0, 0);
    bctx.imageSmoothingEnabled = false;
    bctx.translate(-x, -y);
    for (const b of BIOMES) {
      if (b.x > region.x + w || b.x + b.w < region.x || b.y > region.y + h || b.y + b.h < region.y) continue;
      this.drawBiome(bctx, b);
    }
    const octx = over.getContext("2d")!;
    octx.setTransform(s, 0, 0, s, 0, 0);
    octx.imageSmoothingEnabled = false;
    octx.translate(-x, -y);
    this.drawRoads(octx, region);
    this.drawStreets(octx, region);
    this.drawCity(octx, region);
    this.drawBarriers(octx, region);

    const next = { base, over, x, y, w, h, scale: s };
    this.terrainCache = next;
    return next;
  }

  private render() {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));

    const view = { x: this.cam.x, y: this.cam.y, w, h };
    const terrain = this.ensureTerrain(view);
    ctx.drawImage(terrain.base, terrain.x, terrain.y, terrain.w, terrain.h);
    for (const l of LAKES) {
      if (l.cx - l.rx > view.x + w || l.cx + l.rx < view.x || l.cy - l.ry > view.y + h || l.cy + l.ry < view.y) continue;
      this.lake(ctx, l);
    }
    ctx.drawImage(terrain.over, terrain.x, terrain.y, terrain.w, terrain.h);
    this.drawRiverFlow(ctx, view);
    this.drawMoatFlow(ctx, view);

    // bridges are baked into the overlay, so redraw them live on top of the
    // animated water so the wave effects stay visible under, not over, them.
    this.drawBridges(ctx, view);



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
    if (this.bossAlive) drawables.push({ y: this.boss.y, fn: () => this.drawBoss(ctx) });
    drawables.push({ y: this.py, fn: () => this.drawPlayer(ctx) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
    this.drawEmoteMenu(ctx);



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


  /** Dense drifting crests + highlight streaks (cheap, cached geometry). */
  private drawRiverFlow(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }) {
    // 3x slower than before: every animated term reads this eased clock
    const t = this.clock / 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const bars: (typeof BARRIERS)[number][] = [];
    for (const bar of BARRIERS) {
      if (bar.kind !== "river") continue;
      if (bar.minX > view.x + view.w + 80 || bar.maxX < view.x - 80) continue;
      if (bar.minY > view.y + view.h + 80 || bar.maxY < view.y - 80) continue;
      bars.push(bar);
    }
    if (!bars.length) return;

    // --- soft colour movement riding the current ----------------------
    // No visible lines: stroke the meandering paths at very large widths
    // with extremely low opacity so only a diffuse wash of colour drifts
    // downstream. Multiple faint overlapping passes build up a soft bloom
    // without ever resolving into a crisp core.
    const laneColor = (lane: number) =>
      lane === 0 ? [255, 255, 255] : lane === 1 ? [220, 246, 255] : [255, 255, 255];
    const laneWidth = (lane: number) => (lane === 0 ? 2.6 : lane === 1 ? 1.9 : 1.3);

    /** Build one lane's streak path at an arbitrary time (used for ghosts). */
    const lanePath = (lane: number, tt: number) => {
      const path = new Path2D();
      for (const bar of bars) {
        const g = riverGeom(bar);
        const n = g.pts.length;
        const speed = 0.013 - lane * 0.003;
        for (let s = 0; s < 22; s++) {
          const seed = s * 0.0454 + lane * 0.061;
          const f = ((seed + tt * speed) % 1 + 1) % 1;
          const i0 = Math.min(n - 3, Math.floor(f * (n - 3)));
          const a0 = g.pts[i0]!;
          if (a0[0] < view.x - 60 || a0[0] > view.x + view.w + 60) continue;
          if (a0[1] < view.y - 60 || a0[1] > view.y + view.h + 60) continue;

          // pseudo-random per-streak character (stable while it travels)
          const r1 = ((s * 13 + lane * 7) % 17) / 16;
          const r2 = ((s * 29 + lane * 11) % 23) / 22;
          const r3 = ((s * 41 + lane * 5) % 19) / 18;

          const rush = g.maxW / g.hw[i0]!;
          const steps = 5 + Math.round(r1 * 4);
          const stride = Math.max(1, Math.round((1 + rush) * (0.5 + r2 * 0.6)));
          // lateral band this streak drifts around
          const band = (r3 - 0.5) * 1.5;
          // meander shape: two mismatched frequencies so it never repeats
          const w1 = 0.55 + r1 * 0.9;
          const w2 = 1.7 + r2 * 1.6;
          const amp = 0.14 + r3 * 0.22;
          const ph = s * 1.7 + lane * 2.3;

          let px = 0;
          let py = 0;
          for (let k = 0; k <= steps; k++) {
            const i = Math.min(n - 1, i0 + k * stride);
            const u = k;
            const off =
              (band +
                (Math.sin(u * w1 + tt * 1.9 + ph) * 0.6 + Math.sin(u * w2 - tt * 1.2 + ph * 1.7) * 0.4) * amp) *
              g.hw[i]!;
            const x = g.pts[i]![0] + g.nx[i]! * off;
            const y = g.pts[i]![1] + g.ny[i]! * off;
            if (k === 0) {
              path.moveTo(x, y);
            } else {
              // smooth the polyline into a flowing curve
              path.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
            }
            px = x;
            py = y;
          }
          path.lineTo(px, py);
        }
      }
      return path;
    };

    // ghost trail: two cheap echoes of where each streak just was, so the
    // wash smears behind itself instead of sliding as a hard shape.
    const GHOST = [
      { lag: 2.2, fade: 0.55 },
      { lag: 4.6, fade: 0.28 },
    ];

    for (let lane = 0; lane < 3; lane++) {
      // diffuse colour wash: wide, low-opacity passes stack into a soft
      // bloom. Halfway between crisp core and full wash — visible as gentle
      // colour movement without resolving into hard lines.
      const [cr, cg, cb] = laneColor(lane);
      const base = lane === 0 ? 0.34 : lane === 1 ? 0.24 : 0.16;
      const w = laneWidth(lane);
      // ghosts first (behind), then the live streaks on top
      for (const gh of GHOST) {
        const gpath = lanePath(lane, t - gh.lag);
        for (const p of [
          { wid: w * 3.2, op: base * 0.14 * gh.fade },
          { wid: w * 1.8, op: base * 0.32 * gh.fade },
        ]) {
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${p.op})`;
          ctx.lineWidth = p.wid;
          ctx.stroke(gpath);
        }
      }
      const path = lanePath(lane, t);
      const passes = [
        { wid: w * 4.0, op: base * 0.09 },
        { wid: w * 2.8, op: base * 0.16 },
        { wid: w * 2.0, op: base * 0.28 },
        { wid: w * 1.4, op: base * 0.45 },
      ];
      for (const p of passes) {
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${p.op})`;
        ctx.lineWidth = p.wid;
        ctx.stroke(path);
      }
    }


    // --- shimmering foam along both banks -------------------------------
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const bar of bars) {
      const g = riverGeom(bar);
      const n = g.pts.length;
      for (let s = 0; s < 30; s++) {
        const f = ((s / 30 + t * 0.006) % 1 + 1) % 1;
        const i = Math.min(n - 3, Math.floor(f * (n - 3)));
        const a = g.pts[i]!;
        if (a[0] < view.x - 40 || a[0] > view.x + view.w + 40) continue;
        if (a[1] < view.y - 40 || a[1] > view.y + view.h + 40) continue;
        const side = s % 2 === 0 ? 1 : -1;
        const hw = g.hw[i]! * (0.94 + Math.sin(t * 3 + s * 2.1) * 0.03);
        const j = Math.min(n - 1, i + 2);
        const b = g.pts[j]!;
        ctx.moveTo(a[0] + g.nx[i]! * hw * side, a[1] + g.ny[i]! * hw * side);
        ctx.lineTo(b[0] + g.nx[j]! * hw * side, b[1] + g.ny[j]! * hw * side);
      }
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  }


  /** the same drifting colour wash, wrapped around a city's moat ring */
  private drawMoatFlow(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }) {
    const t = this.clock / 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const CITY of CITIES) {
      if (CITY.moatW <= 0) continue;
      const R = cityOuterR(CITY) + 40;
      if (CITY.cx + R < view.x || CITY.cx - R > view.x + view.w) continue;
      if (CITY.cy + R < view.y || CITY.cy - R > view.y + view.h) continue;
      const hw = CITY.moatW / 2;
      const ringPath = (lane: number, tt: number) => {
        const path = new Path2D();
        const spin = 0.055 - lane * 0.014;
        for (let s = 0; s < 26; s++) {
          const r1 = ((s * 13 + lane * 7) % 17) / 16;
          const r2 = ((s * 29 + lane * 11) % 23) / 22;
          const r3 = ((s * 41 + lane * 5) % 19) / 18;
          const a0 = (s / 26) * Math.PI * 2 + tt * spin + lane * 0.4;
          // leave the drawbridge mouths clear so the decks read on top
          const gate = cityGateAt(a0, CITY);
          if (gate) continue;
          const span = 0.09 + r1 * 0.09;
          const steps = 6;
          const band = (r3 - 0.5) * 1.3;
          const w1 = 0.55 + r1 * 0.9;
          const w2 = 1.7 + r2 * 1.6;
          const amp = 0.16 + r3 * 0.22;
          const ph = s * 1.7 + lane * 2.3;
          let px = 0;
          let py = 0;
          for (let k = 0; k <= steps; k++) {
            const a = a0 + (k / steps) * span;
            const off =
              (band + (Math.sin(k * w1 + tt * 1.9 + ph) * 0.6 + Math.sin(k * w2 - tt * 1.2 + ph * 1.7) * 0.4) * amp) *
              hw;
            const r = cityWallR(a, CITY) + CITY.moatGap + hw + off;
            const x = CITY.cx + Math.cos(a) * r;
            const y = CITY.cy + Math.sin(a) * r;
            if (k === 0) path.moveTo(x, y);
            else path.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
            px = x;
            py = y;
          }
          path.lineTo(px, py);
        }
        return path;
      };
      for (let lane = 0; lane < 3; lane++) {
        const [cr, cg, cb] = lane === 1 ? [220, 246, 255] : [255, 255, 255];
        const base = lane === 0 ? 0.34 : lane === 1 ? 0.24 : 0.16;
        const w = lane === 0 ? 2.6 : lane === 1 ? 1.9 : 1.3;
        for (const gh of [
          { lag: 2.2, fade: 0.55 },
          { lag: 4.6, fade: 0.28 },
        ]) {
          const gpath = ringPath(lane, t - gh.lag);
          for (const p of [
            { wid: w * 3.2, op: base * 0.14 * gh.fade },
            { wid: w * 1.8, op: base * 0.32 * gh.fade },
          ]) {
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},${p.op})`;
            ctx.lineWidth = p.wid;
            ctx.stroke(gpath);
          }
        }
        const path = ringPath(lane, t);
        for (const p of [
          { wid: w * 4.0, op: base * 0.09 },
          { wid: w * 2.8, op: base * 0.16 },
          { wid: w * 2.0, op: base * 0.28 },
          { wid: w * 1.4, op: base * 0.45 },
        ]) {
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${p.op})`;
          ctx.lineWidth = p.wid;
          ctx.stroke(path);
        }
      }
    }

    ctx.lineWidth = 1;
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
        const g = riverGeom(bar);
        // outer bank (dark teal), water body, then a cached depth gradient
        ctx.fillStyle = "#3f6f83";
        ctx.fill(g.bank);
        ctx.fillStyle = "#6fa9c9";
        ctx.fill(g.water);
        ctx.fillStyle = riverGradient(ctx, g);
        ctx.fill(g.water);
        ctx.fillStyle = "rgba(159,216,238,0.55)";
        ctx.fill(g.core);
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

    // rolling wave crests across the surface
    const crest =
      l.style === "evil" ? "rgba(196,178,236,0.16)" : l.style === "winter" ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.22)";
    ctx.strokeStyle = crest;
    ctx.lineCap = "round";
    for (let row = 0; row < 9; row++) {
      const drift = (this.time * 6 + row * 37) % (l.ry * 2 + 40);
      const y = l.cy - l.ry - 20 + drift;
      ctx.lineWidth = 1.2 + (row % 3) * 0.6;
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const x = l.cx - l.rx + (k / 12) * l.rx * 2;
        const yy = y + Math.sin(this.time * 1.6 + k * 0.9 + row) * 3.2;
        if (k === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // glints
    ctx.fillStyle = l.style === "evil" ? "rgba(190,170,230,0.18)" : "rgba(255,255,255,0.35)";
    for (let i = 0; i < 22; i++) {
      const x = l.cx - l.rx + ((i * 137) % (l.rx * 2));
      const y = l.cy - l.ry + ((i * 89) % (l.ry * 2));
      const a = 0.5 + 0.5 * Math.sin(this.time * 2.2 + i);
      ctx.globalAlpha = 0.35 + a * 0.65;
      ctx.fillRect(x, y + Math.sin(this.time * 1.2 + i) * 3, 10 + a * 5, 3);
    }
    ctx.globalAlpha = 1;


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

      if (run.trail) {
        // the unmarked shortcut: a scuffed dirt track, no cobbles, no shoulder
        ctx.save();
        trace();
        ctx.strokeStyle = "rgba(120,102,74,0.35)";
        ctx.lineWidth = run.width + 5;
        ctx.stroke();
        trace();
        ctx.strokeStyle = "#93805d";
        ctx.lineWidth = run.width;
        ctx.setLineDash([16, 9]);
        ctx.stroke();
        // sparse boot-worn scuffs either side of the ruts
        ctx.setLineDash([]);
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i]!;
          const b = pts[i + 1]!;
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const ux = (b[0] - a[0]) / len;
          const uy = (b[1] - a[1]) / len;
          for (let d = 0; d < len; d += 19) {
            const off = ((i + d) | 0) % 2 === 0 ? 5 : -5;
            ctx.fillStyle = "rgba(112,96,68,0.55)";
            ctx.fillRect(a[0] + ux * d - uy * off - 1.5, a[1] + uy * d + ux * off - 1.5, 3, 3);
          }
        }
        ctx.restore();
        continue;
      }

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



  /** the walled cities — plaza, ring road, spokes, water, wall and gates */
  private drawCity(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }) {
    for (const city of CITIES) {
      const R = cityOuterR(city) + 60;
      if (
        city.cx - R > view.x + view.w ||
        city.cx + R < view.x ||
        city.cy - R > view.y + view.h ||
        city.cy + R < view.y
      ) {
        continue;
      }
      this.drawOneCity(ctx, city);
    }
  }

  private drawOneCity(ctx: CanvasRenderingContext2D, CITY: CityDef) {
    const sand = CITY.theme === "sand";
    const wood = CITY.theme === "wood";
    const ice = CITY.theme === "ice";
    const goth = CITY.theme === "gothic";
    const P = goth
      ? {
          plaza: "#544c5e",
          plazaEdge: "#3b3545",
          ring: "#4b4456",
          wallDark: "#2a2532",
          wallLight: "#5b5468",
          merlon: "#6b6379",
          towerDark: "#241f2c",
          towerLight: "#4d4658",
        }
      : sand
      ? {
          plaza: "#e6cd9a",
          plazaEdge: "#cfae79",
          ring: "#e0c48f",
          wallDark: "#a8823f",
          wallLight: "#e2c184",
          merlon: "#f0d5a0",
          towerDark: "#8f6d34",
          towerLight: "#dcbb7e",
        }
      : wood
        ? {
            plaza: "#bfa877",
            plazaEdge: "#8a7a4c",
            ring: "#b09a6c",
            wallDark: "#4a3a22",
            wallLight: "#7d6136",
            merlon: "#5f7c40",
            towerDark: "#43331e",
            towerLight: "#6f5530",
          }
      : ice
        ? {
            plaza: "#d8e9f6",
            plazaEdge: "#9fc0da",
            ring: "#cadff0",
            wallDark: "#7d93a8",
            wallLight: "#c3dced",
            merlon: "#eaf6ff",
            towerDark: "#6c8299",
            towerLight: "#bcd8ea",
          }
        : {
          plaza: "#c9ae86",
          plazaEdge: "#b1936c",
          ring: "#c4a67c",
          wallDark: "#6f6a63",
          wallLight: "#a8a298",
          merlon: "#cbc5b9",
          towerDark: "#5f5a54",
          towerLight: "#9d968c",
        };
    const { cx, cy } = CITY;
    const at = (a: number, r: number): [number, number] => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    /** deterministic per-city scatter for props and grime */
    const rand = (n: number) => {
      const s = Math.sin(n * 127.1 + CITY.phase * 31.7) * 43758.5453;
      return s - Math.floor(s);
    };

    // --- moat: styled exactly like the Great River (bank, water, bright core)
    if (CITY.moatW > 0) {
      const mid = new Path2D();
      for (let a = -Math.PI; a <= Math.PI + 0.03; a += 0.03) {
        const [x, y] = at(a, cityWallR(a, CITY) + CITY.moatGap + CITY.moatW / 2);
        if (a === -Math.PI) mid.moveTo(x, y);
        else mid.lineTo(x, y);
      }
      mid.closePath();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "#3f6f83";
      ctx.lineWidth = CITY.moatW + 12;
      ctx.stroke(mid);
      ctx.strokeStyle = "#6fa9c9";
      ctx.lineWidth = CITY.moatW;
      ctx.stroke(mid);
      ctx.strokeStyle = "rgba(159,216,238,0.5)";
      ctx.lineWidth = CITY.moatW * 0.42;
      ctx.stroke(mid);
      // grassy banks
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#6f9464";
      for (const k of [CITY.moatGap - 4, CITY.moatGap + CITY.moatW + 4]) {
        ctx.beginPath();
        for (let a = -Math.PI; a <= Math.PI; a += 0.03) {
          const [x, y] = at(a, cityWallR(a, CITY) + k);
          if (a === -Math.PI) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }


    // --- plaza + ring road + spokes to each gate
    ctx.fillStyle = P.plaza;
    ctx.beginPath();
    ctx.arc(cx, cy, CITY.plazaR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = P.plazaEdge;
    ctx.lineWidth = 6;
    ctx.stroke();

    const ringMid = (CITY.ringR[0]! + CITY.ringR[1]!) / 2;
    ctx.strokeStyle = P.ring;
    ctx.lineWidth = 46;
    ctx.beginPath();
    ctx.arc(cx, cy, ringMid, 0, Math.PI * 2);
    ctx.stroke();
    // every city keeps only the plaza and ring road — the bare radial spokes
    // read as ugly untextured smears over everything else

    // sandstone cities get narrow winding medina alleys between the rings
    if (sand) {
      ctx.strokeStyle = P.ring;
      ctx.lineWidth = 15;
      for (let k = 0; k < 11; k++) {
        const a0 = (k / 11) * Math.PI * 2 + 0.18;
        ctx.beginPath();
        for (let t = 0; t <= 1.001; t += 0.1) {
          const a = a0 + Math.sin(t * Math.PI * 2 + k) * 0.12;
          const r = CITY.plazaR + t * (cityWallR(a0, CITY) - 40 - CITY.plazaR);
          const [x, y] = at(a, r);
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // canopy cities: winding forest paths, elevated walkways and rope bridges
    if (wood) {
      ctx.lineCap = "round";
      for (let k = 0; k < 9; k++) {
        const a0 = (k / 9) * Math.PI * 2 + 0.31;
        ctx.strokeStyle = P.ring;
        ctx.lineWidth = 17;
        ctx.beginPath();
        for (let t = 0; t <= 1.001; t += 0.08) {
          const a = a0 + Math.sin(t * Math.PI * 2.4 + k * 1.7) * 0.16;
          const r = CITY.plazaR + t * (cityWallR(a0, CITY) - 46 - CITY.plazaR);
          const [x, y] = at(a, r);
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // planked walkways arcing between the two building rings
      const walkR = (CITY.ringR[0]! + CITY.ringR[1]!) / 2 + 26;
      for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * Math.PI * 2 + 0.6;
        const a1 = a0 + 0.42;
        ctx.strokeStyle = "#6a4f2c";
        ctx.lineWidth = 13;
        ctx.beginPath();
        for (let a = a0; a <= a1; a += 0.03) {
          const [x, y] = at(a, walkR);
          if (a === a0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = "#a07a45";
        ctx.lineWidth = 3;
        for (let a = a0; a <= a1; a += 0.035) {
          const [x1, y1] = at(a, walkR - 6);
          const [x2, y2] = at(a, walkR + 6);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        // rope handrails
        ctx.strokeStyle = "rgba(226,206,160,0.75)";
        ctx.lineWidth = 2;
        for (const off of [-8, 8]) {
          ctx.beginPath();
          for (let a = a0; a <= a1; a += 0.03) {
            const [x, y] = at(a, walkR + off);
            if (a === a0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        // support posts at each end
        ctx.fillStyle = "#4a3620";
        for (const a of [a0, a1]) {
          const [x, y] = at(a, walkR);
          ctx.fillRect(x - 4, y - 4, 8, 12);
        }
      }
      ctx.lineCap = "butt";
    }
    // the Gravehollow: no ring roads — crooked mud lanes that go nowhere
    if (goth) {
      ctx.strokeStyle = "#453e50";
      ctx.lineCap = "round";
      for (let i = 0; i < 14; i++) {
        const a0 = (i / 14) * Math.PI * 2 + 0.2;
        ctx.lineWidth = 12 + ((i * 5) % 9);
        ctx.beginPath();
        let a = a0;
        for (let r = CITY.plazaR + 10; r < CITY.wallR - 26; r += 22) {
          a += Math.sin(r * 0.031 + i * 2.1) * 0.075;
          const [x, y] = at(a, r);
          if (r === CITY.plazaR + 10) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // a couple of dead-end cross alleys, because of course
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.9;
        const r = CITY.plazaR + 70 + ((i * 47) % 130);
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a, a + 0.55 + (i % 3) * 0.18);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
      // dead grass and puddles on the plaza
      ctx.fillStyle = "rgba(30,26,38,0.35)";
      for (let i = 0; i < 26; i++) {
        const a = rand(i * 3.1) * Math.PI * 2;
        const r = rand(i * 7.7 + 1) * (CITY.plazaR - 12);
        const [x, y] = at(a, r);
        ctx.beginPath();
        ctx.ellipse(x, y, 6 + rand(i + 5) * 12, 4 + rand(i + 9) * 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- the graveyard quarter: iron railings, leaning stones, a crypt or two
    if (CITY.graveyard) {
      const G = CITY.graveyard;
      const gx = cx + G.dx;
      const gy = cy + G.dy;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(G.rot);
      // sour, trampled ground
      ctx.fillStyle = "#3f3a48";
      ctx.beginPath();
      ctx.ellipse(0, 0, G.rx, G.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(78,92,64,0.35)";
      for (let i = 0; i < 24; i++) {
        const a = rand(i * 2.7) * Math.PI * 2;
        const rr = Math.sqrt(rand(i * 5.3 + 2)) * 0.9;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * G.rx * rr, Math.sin(a) * G.ry * rr, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // tombstones in ragged rows, each leaning its own way
      for (let i = 0; i < 26; i++) {
        const col = i % 7;
        const row = (i / 7) | 0;
        const tx = -G.rx * 0.78 + col * (G.rx * 1.56 / 6) + (rand(i * 9.1) - 0.5) * 14;
        const ty = -G.ry * 0.55 + row * (G.ry * 1.1 / 3) + (rand(i * 4.3 + 7) - 0.5) * 12;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate((rand(i * 6.7 + 3) - 0.5) * 0.45);
        ctx.fillStyle = "rgba(20,17,26,0.35)";
        ctx.beginPath();
        ctx.ellipse(0, 3, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        const style = i % 5;
        ctx.fillStyle = i % 3 === 0 ? "#8f8a96" : "#7a7684";
        if (style === 0) {
          // cross
          ctx.fillRect(-3, -24, 6, 26);
          ctx.fillRect(-10, -18, 20, 5);
        } else if (style === 1) {
          // broken slab
          ctx.fillRect(-8, -14, 16, 16);
          ctx.fillStyle = "#5d596a";
          ctx.fillRect(-8, -14, 16, 3);
        } else {
          // rounded headstone
          ctx.beginPath();
          ctx.moveTo(-8, 2);
          ctx.lineTo(-8, -13);
          ctx.quadraticCurveTo(0, -24, 8, -13);
          ctx.lineTo(8, 2);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(40,36,50,0.5)";
          ctx.fillRect(-4, -13, 8, 2);
          ctx.fillRect(-4, -8, 8, 2);
        }
        ctx.restore();
      }
      // wrought iron railing around the whole plot, with a lychgate on the north
      ctx.strokeStyle = "#1d1a24";
      ctx.lineWidth = 3;
      for (let a = 0; a < Math.PI * 2; a += 0.075) {
        if (a > 1.35 && a < 1.79) continue; // gap: the way in
        const x = Math.cos(a) * (G.rx + 12);
        const y = Math.sin(a) * (G.ry + 12);
        ctx.beginPath();
        ctx.moveTo(x, y + 4);
        ctx.lineTo(x, y - 13);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y - 15, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "#1d1a24";
        ctx.fill();
      }
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.05) {
        const x = Math.cos(a) * (G.rx + 12);
        const y = Math.sin(a) * (G.ry + 12) - 7;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // ice cities: concentric swept snow rings between the building rings

    if (ice) {
      ctx.strokeStyle = P.ring;
      for (const [rr, lw] of [[CITY.plazaR + 46, 20], [CITY.ringR[1]! + 12, 16]] as [number, number][]) {
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      // drifted snow blown against the inside of the wall
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      for (let a = -Math.PI; a <= Math.PI; a += 0.03) {
        const [x, y] = at(a, cityWallR(a, CITY) - CITY.wallT - 8);
        if (a === -Math.PI) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // --- the frozen canal, cut up from the mountain lake and in through a gate
    if (CITY.canal) {
      const { x1, y1, x2, y2, w } = CITY.canal;
      const ang = Math.atan2(y2 - y1, x2 - x1);
      ctx.save();
      ctx.translate(x1, y1);
      ctx.rotate(ang);
      const len = Math.hypot(x2 - x1, y2 - y1);
      // cut banks of packed snow
      ctx.fillStyle = "#e9f4fb";
      ctx.fillRect(0, -w / 2 - 9, len, w + 18);
      // the ice itself
      ctx.fillStyle = "#9fc9e2";
      ctx.fillRect(0, -w / 2, len, w);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let t = 8; t < len; t += 34) ctx.fillRect(t, -w / 2 + 4, 18, 5);
      // cracks
      ctx.strokeStyle = "rgba(240,252,255,0.65)";
      ctx.lineWidth = 2;
      for (let t = 20; t < len; t += 46) {
        ctx.beginPath();
        ctx.moveTo(t, -w / 2 + 3);
        ctx.lineTo(t + 14, 2);
        ctx.lineTo(t + 4, w / 2 - 3);
        ctx.stroke();
      }
      // a basin where the canal meets the plaza
      ctx.restore();
      ctx.fillStyle = "#e9f4fb";
      ctx.beginPath();
      ctx.ellipse(x2, y2, w * 1.15, w * 0.82, ang, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a8d2e8";
      ctx.beginPath();
      ctx.ellipse(x2, y2, w, w * 0.66, ang, 0, Math.PI * 2);
      ctx.fill();
    }



    // --- the oasis pool at the heart of a desert city
    if (CITY.oasis) {
      const ox = cx + CITY.oasis.dx;
      const oy = cy + CITY.oasis.dy;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ox, oy, CITY.oasis.rx + 9, CITY.oasis.ry + 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#cbab74";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(ox, oy, CITY.oasis.rx, CITY.oasis.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#2f7f9e";
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = "rgba(160,225,240,0.22)";
      for (let i = 0; i < 7; i++) {
        const yy = oy - CITY.oasis.ry + (i * CITY.oasis.ry * 2) / 7 + 6;
        ctx.fillRect(ox - CITY.oasis.rx + ((i * 17) % 30), yy, 34 + (i % 3) * 12, 4);
      }
      ctx.restore();
      // palms round the pool
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.7;
        const px = ox + Math.cos(a) * (CITY.oasis.rx + 26);
        const py = oy + Math.sin(a) * (CITY.oasis.ry + 24);
        ctx.fillStyle = "#8a6a3d";
        ctx.fillRect(px - 3, py - 26, 6, 26);
        ctx.fillStyle = "#4f9c63";
        for (let f = 0; f < 5; f++) {
          const fa = (f / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(px + Math.cos(fa) * 12, py - 28 + Math.sin(fa) * 7, 13, 5, fa, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // --- wooden bridge decks over the moat at every gate
    if (CITY.moatW > 0) {
      for (const g of CITY.gates) {
        if (!g.drawbridge) continue;
        const inner = cityWallR(g.angle, CITY) + CITY.moatGap - 6;
        const outer = inner + CITY.moatW + 14;
        const halfW = g.half * 0.72 * cityWallR(g.angle, CITY);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(g.angle);
        ctx.fillStyle = "#8a6440";
        ctx.fillRect(inner, -halfW, outer - inner, halfW * 2);
        ctx.fillStyle = "#a97b4f";
        for (let d = inner + 3; d < outer - 3; d += 12) ctx.fillRect(d, -halfW + 3, 8, halfW * 2 - 6);
        ctx.fillStyle = "#6c4c30";
        ctx.fillRect(inner, -halfW - 4, outer - inner, 5);
        ctx.fillRect(inner, halfW - 1, outer - inner, 5);
        ctx.restore();
      }
    }


    // --- the wall itself, broken only at the gate mouths
    const drawArc = (from: number, to: number, width: number, colour: string) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.lineCap = "butt";
      ctx.beginPath();
      let first = true;
      for (let a = from; a <= to; a += 0.02) {
        const [x, y] = at(a, cityWallR(a, CITY));
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    const gates = [...CITY.gates].sort((a, b) => a.angle - b.angle);
    for (let i = 0; i < gates.length; i++) {
      const from = gates[i]!.angle + gates[i]!.half;
      const to = (gates[(i + 1) % gates.length]!.angle - gates[(i + 1) % gates.length]!.half) +
        (i === gates.length - 1 ? Math.PI * 2 : 0);
      drawArc(from, to, CITY.wallT + 6, P.wallDark);
      drawArc(from, to, CITY.wallT - 4, P.wallLight);
      if (wood) {
        // palisade: pointed stakes with a woven hedge crown
        for (let a = from; a <= to; a += 0.022) {
          const wr = cityWallR(a, CITY);
          const [x, y] = at(a, wr);
          ctx.fillStyle = ((a * 90) | 0) % 2 === 0 ? "#7d6136" : "#69502b";
          ctx.fillRect(x - 3, y - 6, 6, 12);
          const [hx, hy] = at(a, wr - CITY.wallT / 2 - 2);
          ctx.fillStyle = ((a * 70) | 0) % 3 === 0 ? "#4f7038" : P.merlon;
          ctx.fillRect(hx - 4, hy - 4, 8, 8);
        }
      } else if (goth) {
        // wrought iron set into crumbling stone: whole stretches have fallen,
        // the railings between them are barbed and rusting
        for (let a = from; a <= to; a += 0.03) {
          const wr = cityWallR(a, CITY);
          const ruin = rand(Math.round(a * 40));
          const [x, y] = at(a, wr - CITY.wallT / 2 + 2);
          if (ruin > 0.42) {
            // standing stone course, chipped
            ctx.fillStyle = ruin > 0.78 ? P.merlon : P.wallLight;
            ctx.fillRect(x - 5, y - 5 - (ruin > 0.78 ? 3 : 0), 10, 10);
          } else {
            // collapsed to rubble — the ironwork carries the line
            ctx.fillStyle = "#3d3746";
            ctx.fillRect(x - 5, y + 1, 10, 5);
          }
          const [ix, iy] = at(a, wr);
          ctx.strokeStyle = "#191620";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ix, iy + 4);
          ctx.lineTo(ix, iy - 16);
          ctx.stroke();
          ctx.fillStyle = "#191620";
          ctx.beginPath();
          ctx.moveTo(ix - 3, iy - 16);
          ctx.lineTo(ix + 3, iy - 16);
          ctx.lineTo(ix, iy - 23);
          ctx.closePath();
          ctx.fill();
        }
        // the rail the spikes hang from
        ctx.strokeStyle = "#191620";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let a = from; a <= to; a += 0.02) {
          const [x, y] = at(a, cityWallR(a, CITY));
          if (a === from) ctx.moveTo(x, y - 13);
          else ctx.lineTo(x, y - 13);
        }
        ctx.stroke();
      } else if (ice) {
        // ice-and-stone: rime-capped merlons with icicles hanging off the outer face
        for (let a = from; a <= to; a += 0.05) {
          const wr = cityWallR(a, CITY);
          const [x, y] = at(a, wr - CITY.wallT / 2 + 2);
          ctx.fillStyle = P.merlon;
          ctx.fillRect(x - 5, y - 5, 10, 10);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(x - 5, y - 6, 10, 3);
          const [ix, iy] = at(a, wr + CITY.wallT / 2);
          ctx.fillStyle = "rgba(214,240,255,0.9)";
          ctx.beginPath();
          ctx.moveTo(ix - 3, iy - 2);
          ctx.lineTo(ix + 3, iy - 2);
          ctx.lineTo(ix, iy + 9 + (((a * 60) | 0) % 3) * 3);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // merlons
        for (let a = from; a <= to; a += 0.06) {
          const [x, y] = at(a, cityWallR(a, CITY) - CITY.wallT / 2 + 2);
          ctx.fillStyle = P.merlon;
          ctx.fillRect(x - 4, y - 4, 8, 8);
        }
      }
    }

    // --- gatehouses: a tower each side of every opening
    for (const g of CITY.gates) {
      for (const s of [-1, 1]) {
        const a = g.angle + s * g.half;
        const [x, y] = at(a, cityWallR(a, CITY));
        ctx.fillStyle = P.towerDark;
        ctx.beginPath();
        ctx.arc(x, y, g.kind === "spine" ? 22 : 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = P.towerLight;
        ctx.beginPath();
        ctx.arc(x, y - 3, g.kind === "spine" ? 17 : 13, 0, Math.PI * 2);
        ctx.fill();
        // sandstone cities carry slender minarets on their gatehouses
        if (sand) {
          ctx.fillStyle = P.towerLight;
          ctx.fillRect(x - 6, y - 58, 12, 52);
          ctx.fillStyle = P.towerDark;
          ctx.fillRect(x - 8, y - 40, 16, 5);
          ctx.beginPath();
          ctx.moveTo(x - 10, y - 56);
          ctx.lineTo(x, y - 78);
          ctx.lineTo(x + 10, y - 56);
          ctx.closePath();
          ctx.fillStyle = "#c98f4a";
          ctx.fill();
        }
        // canopy cities: the gate towers are living trees with lookout decks
        if (wood) {
          ctx.fillStyle = "#5a4227";
          ctx.fillRect(x - 5, y - 52, 10, 46);
          ctx.fillStyle = "#6a4f2c";
          ctx.fillRect(x - 15, y - 40, 30, 7);
          ctx.fillStyle = "#3f7a45";
          ctx.beginPath();
          ctx.arc(x, y - 60, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#59a05c";
          ctx.beginPath();
          ctx.arc(x - 7, y - 66, 13, 0, Math.PI * 2);
          ctx.arc(x + 9, y - 62, 11, 0, Math.PI * 2);
          ctx.fill();
        }
        // the Gravehollow: gaunt watch-spires with a lantern and a crow
        if (goth) {
          ctx.fillStyle = P.towerDark;
          ctx.beginPath();
          ctx.moveTo(x - 10, y - 4);
          ctx.lineTo(x - 7, y - 54);
          ctx.lineTo(x + 7, y - 54);
          ctx.lineTo(x + 10, y - 4);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = P.towerLight;
          ctx.fillRect(x - 5, y - 46, 10, 3);
          ctx.beginPath();
          ctx.moveTo(x - 10, y - 52);
          ctx.lineTo(x, y - 78);
          ctx.lineTo(x + 10, y - 52);
          ctx.closePath();
          ctx.fillStyle = "#1c1824";
          ctx.fill();
          // guttering lantern
          ctx.fillStyle = "rgba(214,168,86,0.5)";
          ctx.beginPath();
          ctx.arc(x, y - 40, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#d6a856";
          ctx.fillRect(x - 2, y - 42, 4, 5);
        }
        // ice cities: carved ice spires, snow-capped, with icicle skirts
        if (ice) {
          ctx.fillStyle = P.towerLight;
          ctx.beginPath();
          ctx.moveTo(x - 11, y - 6);
          ctx.lineTo(x - 6, y - 62);
          ctx.lineTo(x + 6, y - 62);
          ctx.lineTo(x + 11, y - 6);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.beginPath();
          ctx.moveTo(x - 9, y - 58);
          ctx.lineTo(x, y - 82);
          ctx.lineTo(x + 9, y - 58);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(190,224,244,0.9)";
          for (const dx of [-8, 0, 8]) {
            ctx.beginPath();
            ctx.moveTo(x + dx - 3, y - 8);
            ctx.lineTo(x + dx + 3, y - 8);
            ctx.lineTo(x + dx, y + 4);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    // --- signature monuments: sphinx / Oak Hall / Frozen Hall / the Cathedral
    const mon = CITY.monument;
    if (mon && mon.kind === "cathedral") {
      const mx = cx + mon.dx;
      const my = cy + mon.dy;
      const w = mon.w;
      const h = mon.h;
      ctx.save();
      // long shadow thrown across the plaza
      ctx.fillStyle = "rgba(14,11,20,0.35)";
      ctx.beginPath();
      ctx.ellipse(mx, my + h / 2 + 4, w / 2 + 30, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      // stepped plinth
      ctx.fillStyle = "#3a3444";
      ctx.fillRect(mx - w / 2 - 14, my + h / 2 - 20, w + 28, 20);
      ctx.fillStyle = "#4a4356";
      ctx.fillRect(mx - w / 2 - 6, my + h / 2 - 28, w + 12, 12);
      // nave — tall, narrow, black stone
      const naveW = w * 0.62;
      ctx.fillStyle = "#2b2635";
      ctx.fillRect(mx - naveW / 2, my - h / 2, naveW, h - 20);
      // buttressed transepts
      ctx.fillStyle = "#241f2d";
      ctx.fillRect(mx - w / 2, my - h / 8, w, h / 2);
      // flying buttresses
      ctx.strokeStyle = "#3b3446";
      ctx.lineWidth = 7;
      for (const s of [-1, 1]) {
        for (const dy of [0, 30]) {
          ctx.beginPath();
          ctx.moveTo(mx + s * (naveW / 2), my - h / 6 + dy);
          ctx.quadraticCurveTo(
            mx + s * (w / 2 - 4),
            my - h / 8 + dy,
            mx + s * (w / 2 + 6),
            my + h / 6 + dy,
          );
          ctx.stroke();
        }
      }
      // steep slate roof
      ctx.fillStyle = "#1c1825";
      ctx.beginPath();
      ctx.moveTo(mx - naveW / 2 - 8, my - h / 2 + 6);
      ctx.lineTo(mx, my - h / 2 - 34);
      ctx.lineTo(mx + naveW / 2 + 8, my - h / 2 + 6);
      ctx.closePath();
      ctx.fill();
      // twin spires, and a taller central one
      for (const [sx, top, wide] of [
        [mx - w / 2 + 16, my - h / 2 - 60, 13],
        [mx + w / 2 - 16, my - h / 2 - 60, 13],
        [mx, my - h / 2 - 118, 16],
      ] as [number, number, number][]) {
        ctx.fillStyle = "#332c3f";
        ctx.fillRect(sx - wide, top + 34, wide * 2, my - h / 8 - (top + 34));
        ctx.fillStyle = "#1b1724";
        ctx.beginPath();
        ctx.moveTo(sx - wide - 4, top + 36);
        ctx.lineTo(sx, top);
        ctx.lineTo(sx + wide + 4, top + 36);
        ctx.closePath();
        ctx.fill();
        // iron finial
        ctx.strokeStyle = "#15121c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, top);
        ctx.lineTo(sx, top - 14);
        ctx.moveTo(sx - 6, top - 9);
        ctx.lineTo(sx + 6, top - 9);
        ctx.stroke();
        // narrow lancet window, lit
        ctx.fillStyle = "rgba(150,84,164,0.55)";
        ctx.fillRect(sx - 3, top + 52, 6, 16);
      }
      // the great rose window
      const rx = mx;
      const ry = my - h / 4;
      ctx.fillStyle = "#5b2f6b";
      ctx.beginPath();
      ctx.arc(rx, ry, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#171320";
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + Math.cos(a) * 26, ry + Math.sin(a) * 26);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(rx, ry, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#8a4fa0";
      ctx.beginPath();
      ctx.arc(rx, ry, 8, 0, Math.PI * 2);
      ctx.fill();
      // stained lancets down the nave
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = ["#3f5f7d", "#6b2f3f", "#3d6b4b"][i]!;
          const lx = mx + s * (naveW / 2 - 16) - 5;
          const ly = my + 4 + i * 22;
          ctx.beginPath();
          ctx.moveTo(lx, ly + 16);
          ctx.lineTo(lx, ly + 5);
          ctx.quadraticCurveTo(lx + 5, ly - 5, lx + 10, ly + 5);
          ctx.lineTo(lx + 10, ly + 16);
          ctx.closePath();
          ctx.fill();
        }
      }
      // arched doors, standing open onto the dark
      ctx.fillStyle = "#100d16";
      ctx.beginPath();
      ctx.moveTo(mx - 22, my + h / 2 - 28);
      ctx.lineTo(mx - 22, my + h / 6);
      ctx.quadraticCurveTo(mx, my + h / 12 - 22, mx + 22, my + h / 6);
      ctx.lineTo(mx + 22, my + h / 2 - 28);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#4d4359";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    } else if (mon && mon.kind === "frozenhall") {
      const mx = cx + mon.dx;
      const my = cy + mon.dy;
      const w = mon.w;
      const h = mon.h;
      ctx.save();
      // swept snow apron
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(mx, my + h / 2 - 6, w / 2 + 26, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      // stone footing
      ctx.fillStyle = "#8496a6";
      ctx.fillRect(mx - w / 2 - 8, my + h / 2 - 26, w + 16, 26);
      ctx.fillStyle = "#9dafbd";
      for (let i = 0; i < 8; i++) ctx.fillRect(mx - w / 2 - 4 + i * (w / 8), my + h / 2 - 22, w / 8 - 8, 18);
      // hall of carved ice blocks
      ctx.fillStyle = "#bcdcf0";
      ctx.fillRect(mx - w / 2, my - h / 5, w, h / 2 + h / 5);
      ctx.fillStyle = "#d5ecfa";
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i < 6; i++) {
          const off = r % 2 ? 10 : 0;
          ctx.fillRect(mx - w / 2 + 4 + off + i * (w / 6), my - h / 5 + 5 + r * 17, w / 6 - 9, 12);
        }
      }
      // great doorway with an ice arch
      ctx.fillStyle = "#5f7f96";
      ctx.beginPath();
      ctx.moveTo(mx - 24, my + h / 2 - 26);
      ctx.lineTo(mx - 24, my + h / 8);
      ctx.quadraticCurveTo(mx, my - h / 8, mx + 24, my + h / 8);
      ctx.lineTo(mx + 24, my + h / 2 - 26);
      ctx.closePath();
      ctx.fill();
      // glacial roof
      ctx.fillStyle = "#a3c9e0";
      ctx.beginPath();
      ctx.moveTo(mx - w / 2 - 14, my - h / 5 + 4);
      ctx.lineTo(mx, my - h / 2 - 10);
      ctx.lineTo(mx + w / 2 + 14, my - h / 5 + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.moveTo(mx - w / 2 - 14, my - h / 5 + 4);
      ctx.lineTo(mx, my - h / 2 - 10);
      ctx.lineTo(mx + 6, my - h / 5 + 4);
      ctx.closePath();
      ctx.fill();
      // icicles along the eaves
      ctx.fillStyle = "rgba(224,246,255,0.95)";
      for (let i = 0; i <= 12; i++) {
        const ix = mx - w / 2 - 12 + i * ((w + 24) / 12);
        const len = 8 + ((i * 7) % 11);
        ctx.beginPath();
        ctx.moveTo(ix - 3, my - h / 5 + 2);
        ctx.lineTo(ix + 3, my - h / 5 + 2);
        ctx.lineTo(ix, my - h / 5 + 2 + len);
        ctx.closePath();
        ctx.fill();
      }
      // twin ice spires flanking the ridge
      for (const s of [-1, 1]) {
        const sx = mx + s * (w / 2 - 6);
        ctx.fillStyle = "#cfe8f8";
        ctx.beginPath();
        ctx.moveTo(sx - 12, my - h / 5);
        ctx.lineTo(sx, my - h / 2 - 62);
        ctx.lineTo(sx + 12, my - h / 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.moveTo(sx - 5, my - h / 2 - 24);
        ctx.lineTo(sx, my - h / 2 - 62);
        ctx.lineTo(sx + 5, my - h / 2 - 24);
        ctx.closePath();
        ctx.fill();
      }
      // brazier glow in the doorway — the forge that never goes out
      ctx.fillStyle = "rgba(255,168,90,0.35)";
      ctx.beginPath();
      ctx.arc(mx, my + h / 5, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (mon && mon.kind === "oakhall") {
      const mx = cx + mon.dx;
      const my = cy + mon.dy;
      const w = mon.w;
      const h = mon.h;
      ctx.save();
      // roots spilling onto the plaza
      ctx.fillStyle = "rgba(70,52,26,0.22)";
      ctx.beginPath();
      ctx.ellipse(mx, my + h / 2 - 6, w / 2 + 22, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#6b5029";
      ctx.lineWidth = 7;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(mx + Math.cos(a) * (w / 3), my + h / 4 + Math.sin(a) * 12);
        ctx.lineTo(mx + Math.cos(a) * (w / 2 + 26), my + h / 3 + Math.sin(a) * 26);
        ctx.stroke();
      }
      // hall body, built around the trunk
      ctx.fillStyle = "#8a6b41";
      ctx.fillRect(mx - w / 2, my - h / 6, w, h / 2 + h / 6);
      ctx.fillStyle = "#a5834f";
      for (let i = 0; i < 9; i++) ctx.fillRect(mx - w / 2 + 5 + i * (w / 9), my - h / 6 + 4, w / 9 - 8, h / 2 + h / 6 - 10);
      // shuttered windows + great door
      ctx.fillStyle = "#4b3a20";
      ctx.fillRect(mx - 22, my + h / 6, 44, h / 3 - 4);
      ctx.fillStyle = "#c8dca0";
      ctx.fillRect(mx - w / 2 + 22, my + 2, 20, 18);
      ctx.fillRect(mx + w / 2 - 42, my + 2, 20, 18);
      // thatched roof
      ctx.fillStyle = "#4e7a3c";
      ctx.beginPath();
      ctx.moveTo(mx - w / 2 - 16, my - h / 6 + 4);
      ctx.lineTo(mx, my - h / 2 - 8);
      ctx.lineTo(mx + w / 2 + 16, my - h / 6 + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#63996a";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(mx - w / 2 + 14 + i * 12, my - h / 6 - 6 - i * 8, w - 28 - i * 24, 5);
      }
      // the oak itself bursting through the ridge
      ctx.fillStyle = "#5f4526";
      ctx.fillRect(mx - 16, my - h / 2 - 66, 32, 62);
      ctx.fillStyle = "#3f7a45";
      ctx.beginPath();
      ctx.arc(mx, my - h / 2 - 84, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4f9155";
      ctx.beginPath();
      ctx.arc(mx - 38, my - h / 2 - 74, 32, 0, Math.PI * 2);
      ctx.arc(mx + 40, my - h / 2 - 78, 29, 0, Math.PI * 2);
      ctx.arc(mx + 4, my - h / 2 - 116, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(190,235,170,0.35)";
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(mx + Math.cos(a) * 40, my - h / 2 - 84 + Math.sin(a) * 34, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (mon) {
      const mx = cx + mon.dx;
      const my = cy + mon.dy;
      const w = mon.w;
      const h = mon.h;
      ctx.save();
      ctx.fillStyle = "rgba(90,66,30,0.20)";
      ctx.beginPath();
      ctx.ellipse(mx, my + h / 2 - 4, w / 2 + 8, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // plinth
      ctx.fillStyle = "#c39a55";
      ctx.fillRect(mx - w / 2, my + h / 2 - 18, w, 18);
      ctx.fillStyle = "#a97f3f";
      ctx.fillRect(mx - w / 2, my + h / 2 - 6, w, 6);
      // couchant body
      ctx.fillStyle = "#e3bd77";
      ctx.beginPath();
      ctx.moveTo(mx - w / 2 + 6, my + h / 2 - 18);
      ctx.lineTo(mx - w / 2 + 16, my - h / 4);
      ctx.lineTo(mx + w / 4, my - h / 3);
      ctx.lineTo(mx + w / 2 - 4, my + h / 2 - 18);
      ctx.closePath();
      ctx.fill();
      // forelegs
      ctx.fillStyle = "#d7ae68";
      ctx.fillRect(mx + w / 6, my + 2, w / 3, h / 2 - 20);
      ctx.fillStyle = "#c39a55";
      for (let i = 0; i < 3; i++) ctx.fillRect(mx + w / 6 + 6 + i * 12, my + h / 2 - 24, 7, 6);
      // headdress + head
      ctx.fillStyle = "#dcb069";
      ctx.beginPath();
      ctx.moveTo(mx + w / 4 - 6, my - h / 3);
      ctx.lineTo(mx + w / 2 - 2, my - h / 2 - 16);
      ctx.lineTo(mx + w / 2 + 16, my - h / 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#efd096";
      ctx.beginPath();
      ctx.ellipse(mx + w / 3 + 6, my - h / 4 - 4, 17, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      // striped nemes
      ctx.fillStyle = "#b9853c";
      for (let i = 0; i < 3; i++) ctx.fillRect(mx + w / 4 + 2, my - h / 3 + i * 7, 20, 3);
      // eyes
      ctx.fillStyle = "#5c4423";
      ctx.fillRect(mx + w / 3 + 1, my - h / 4 - 7, 5, 4);
      ctx.fillRect(mx + w / 3 + 13, my - h / 4 - 7, 5, 4);
      ctx.restore();
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
    // crooked towns lean their houses — spin the canvas about the footprint
    if (b.rot) {
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx.rotate(b.rot);
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      const r = b.rot;
      (b as { rot?: number }).rot = 0;
      this.drawBuilding(ctx, b);
      (b as { rot?: number }).rot = r;
      ctx.restore();
      return;
    }
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

  /**
   * DESOLATUS — same primitive-shape technique as every other creature, just
   * larger (BOSS_SIZE ≈ 1.5x the biggest monster), with horns and a spiked greatsword.
   */
  private drawBoss(ctx: CanvasRenderingContext2D) {
    const s = BOSS_SIZE;
    const x = this.boss.x;
    const y = this.boss.y;
    const f = this.boss.facing;
    const bob = Math.sin(this.time * 2.2) * 3;
    const flash = this.boss.hitFlash > 0;
    this.shadow(ctx, x, y + 16 * s, 18 * s);

    // sword, drawn behind the body when he faces away from it
    const sx = x + f * 20 * s;
    const grad = ctx.createLinearGradient(sx, y - 60 * s + bob, sx, y + 10 * s + bob);
    grad.addColorStop(0, "#221024");
    grad.addColorStop(0.55, "#4a1f5e");
    grad.addColorStop(1, "#8a4bd0");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx - 5 * s, y + 8 * s + bob);
    ctx.lineTo(sx - 5 * s, y - 52 * s + bob);
    ctx.lineTo(sx, y - 64 * s + bob);
    ctx.lineTo(sx + 5 * s, y - 52 * s + bob);
    ctx.lineTo(sx + 5 * s, y + 8 * s + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6d2fa8";
    for (let i = 0; i < 4; i++) {
      const sy = y - 12 * s - i * 11 * s + bob;
      ctx.beginPath();
      ctx.moveTo(sx + f * 5 * s, sy);
      ctx.lineTo(sx + f * 15 * s, sy - 4 * s);
      ctx.lineTo(sx + f * 5 * s, sy - 8 * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#2a1420";
    ctx.fillRect(sx - 9 * s, y + 6 * s + bob, 18 * s, 4 * s);

    // body
    ctx.fillStyle = flash ? "#ffffff" : "#7d1620";
    ctx.beginPath();
    ctx.roundRect(x - 14 * s, y - 8 * s + bob, 28 * s, 24 * s, 8);
    ctx.fill();
    ctx.fillStyle = flash ? "#ffffff" : "#5a0d17";
    ctx.beginPath();
    ctx.roundRect(x - 14 * s, y + 4 * s + bob, 28 * s, 12 * s, 8);
    ctx.fill();
    // head
    ctx.fillStyle = flash ? "#ffffff" : "#9c1f2b";
    ctx.beginPath();
    ctx.arc(x, y - 20 * s + bob, 15 * s, 0, Math.PI * 2);
    ctx.fill();
    // horns
    ctx.fillStyle = "#2a1018";
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + dir * 13 * s, y - 26 * s + bob);
      ctx.quadraticCurveTo(x + dir * 34 * s, y - 44 * s + bob, x + dir * 22 * s, y - 58 * s + bob);
      ctx.quadraticCurveTo(x + dir * 26 * s, y - 40 * s + bob, x + dir * 10 * s, y - 32 * s + bob);
      ctx.closePath();
      ctx.fill();
    }
    // eyes
    ctx.fillStyle = "#ffd45c";
    ctx.fillRect(x - 8 * s, y - 23 * s + bob, 5 * s, 3 * s);
    ctx.fillRect(x + 3 * s, y - 23 * s + bob, 5 * s, 3 * s);

    // nameplate + shared health pool
    const label = `${BOSS_NAME} · Lv ${BOSS_LEVEL}`;
    ctx.font = "bold 15px ui-rounded, 'Baloo 2', system-ui, sans-serif";
    ctx.textAlign = "center";
    const lw = ctx.measureText(label).width + 16;
    ctx.fillStyle = "rgba(46,10,16,0.75)";
    ctx.beginPath();
    ctx.roundRect(x - lw / 2, y - 84 * s + bob, lw, 20, 9);
    ctx.fill();
    ctx.fillStyle = "#ffd9d9";
    ctx.fillText(label, x, y - 70 * s + bob);
    const bw = 120;
    ctx.fillStyle = "rgba(40,20,26,0.5)";
    ctx.fillRect(x - bw / 2, y - 60 * s + bob, bw, 7);
    ctx.fillStyle = "#e0483f";
    ctx.fillRect(x - bw / 2, y - 60 * s + bob, bw * Math.max(0, this.boss.hp / this.boss.maxHp), 7);
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

    // Profession-only nameplate, styled like creature nameplates.
    const npcLabel = npc.title;
    ctx.font = "bold 11px ui-rounded, 'Baloo 2', system-ui, sans-serif";
    ctx.textAlign = "center";
    const nw = ctx.measureText(npcLabel).width + 12;
    ctx.fillStyle = "rgba(52,40,64,0.55)";
    ctx.beginPath();
    ctx.roundRect(x - nw / 2, y + 24, nw, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#f6f2ff";
    ctx.fillText(npcLabel, x, y + 35);
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
    if (r.emote && r.emote.until > Date.now()) {
      this.drawEmoteBubble(ctx, x, y - 72 - bob, r.emote.e);
    }
  }

  /** A small emoji/word bubble floating above a player's head. */
  private drawEmoteBubble(ctx: CanvasRenderingContext2D, x: number, y: number, e: string) {
    const word = e.length > 2;
    ctx.font = word
      ? "bold 15px ui-rounded, 'Baloo 2', system-ui, sans-serif"
      : "20px ui-rounded, 'Baloo 2', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = Math.max(34, ctx.measureText(e).width + 16);
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.strokeStyle = "rgba(70,55,70,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 15, w, 30, 15);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#4a3b52";
    ctx.fillText(e, x, y + 1);
    ctx.textBaseline = "alphabetic";
  }

  /** The 6-option radial that follows the player you tapped. */
  private drawEmoteMenu(ctx: CanvasRenderingContext2D) {
    const menu = this.emoteMenu;
    if (!menu) return;
    if (menu.until <= Date.now()) {
      this.emoteMenu = null;
      return;
    }
    const who = this.remotes.get(menu.id);
    if (!who) {
      this.emoteMenu = null;
      return;
    }
    for (const slot of this.emoteSlots(who.x, who.y)) {
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.strokeStyle = "rgba(70,55,70,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, EMOTE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const word = slot.e.length > 2;
      ctx.font = word
        ? "bold 12px ui-rounded, 'Baloo 2', system-ui, sans-serif"
        : "19px ui-rounded, 'Baloo 2', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#4a3b52";
      ctx.fillText(slot.e, slot.x, slot.y + 1);
      ctx.textBaseline = "alphabetic";
    }
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
    if (this.myEmote && this.myEmote.until > Date.now()) {
      this.drawEmoteBubble(ctx, x, y - 62 - bob, this.myEmote.e);
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

/* ---------------- river geometry (precomputed once per barrier) ------------- */

interface RiverGeom {
  /** densified centreline */
  pts: [number, number][];
  /** unit normals per point */
  nx: number[];
  ny: number[];
  /** smoothed half-width per point (water) */
  hw: number[];
  bank: Path2D;
  water: Path2D;
  core: Path2D;
  minW: number;
  maxW: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  grad?: { ctx: CanvasRenderingContext2D; g: CanvasGradient };
}

const RIVER_CACHE = new Map<string, RiverGeom>();

/** Fill a closed polygon from an offset band, smoothed with quadratic joins. */
function bandPath(pts: [number, number][], nx: number[], ny: number[], hw: number[], k: number) {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const w = hw[i]! * k;
    const [x, y] = pts[i]!;
    left.push([x + nx[i]! * w, y + ny[i]! * w]);
    right.push([x - nx[i]! * w, y - ny[i]! * w]);
  }
  const ring = [...left, ...right.reverse()];
  const p = new Path2D();
  p.moveTo((ring[0]![0] + ring[ring.length - 1]![0]) / 2, (ring[0]![1] + ring[ring.length - 1]![1]) / 2);
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i]!;
    const next = ring[(i + 1) % ring.length]!;
    p.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
  }
  p.closePath();
  return p;
}

/** Build (once) the filled bank/water geometry for a river barrier. */
function riverGeom(bar: (typeof BARRIERS)[number]): RiverGeom {
  const hit = RIVER_CACHE.get(bar.id);
  if (hit) return hit;

  const pts = densify(bar.pts, Math.max(14, bar.width * 0.5));
  const n = pts.length;
  const nx: number[] = new Array(n);
  const ny: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(n - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    nx[i] = -dy / len;
    ny[i] = dx / len;
  }

  // deterministic width jitter, then the same moving-average smoothing the
  // world generator uses for biome/lake outlines
  const raw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const s = Math.sin(i * 0.37 + 1.3) * 0.5 + Math.sin(i * 0.11 + 4.1) * 0.5;
    raw[i] = 1 + s * 0.22;
  }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < n - 1; i++) raw[i] = (raw[i - 1]! + raw[i]! * 2 + raw[i + 1]!) / 4;
  }
  // taper the ends so the mouth doesn't flare
  const hw = raw.map((m) => (bar.width / 2) * m);
  let minW = Infinity;
  let maxW = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    minW = Math.min(minW, hw[i]!);
    maxW = Math.max(maxW, hw[i]!);
    x0 = Math.min(x0, pts[i]![0]);
    y0 = Math.min(y0, pts[i]![1]);
    x1 = Math.max(x1, pts[i]![0]);
    y1 = Math.max(y1, pts[i]![1]);
  }

  const geom: RiverGeom = {
    pts,
    nx,
    ny,
    hw,
    bank: bandPath(pts, nx, ny, hw, 1.16),
    water: bandPath(pts, nx, ny, hw, 1),
    core: bandPath(pts, nx, ny, hw, 0.5),
    minW,
    maxW,
    bbox: { x0, y0, x1, y1 },
  };
  RIVER_CACHE.set(bar.id, geom);
  return geom;
}

/** Cached across-stream depth gradient (rebuilt only if the context changes). */
function riverGradient(ctx: CanvasRenderingContext2D, g: RiverGeom) {
  if (g.grad && g.grad.ctx === ctx) return g.grad.g;
  const { x0, y0, x1, y1 } = g.bbox;
  const horiz = x1 - x0 > y1 - y0;
  const grad = horiz
    ? ctx.createLinearGradient(0, y0, 0, y1)
    : ctx.createLinearGradient(x0, 0, x1, 0);
  grad.addColorStop(0, "rgba(63,111,131,0.35)");
  grad.addColorStop(0.5, "rgba(159,216,238,0.30)");
  grad.addColorStop(1, "rgba(63,111,131,0.35)");
  g.grad = { ctx, g: grad };
  return grad;
}

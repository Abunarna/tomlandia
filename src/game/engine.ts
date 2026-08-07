import {
  BIOMES,
  BUILDINGS,
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
  item,
  statWithPlus,
  upgradeCost,
  type BiomeDef,
  type MonsterKind,
  type NodeKind,
  type NpcDef,
  type NpcRole,
} from "./data";
import { TILE_H, TILE_W } from "./data";
import { levelFromXp } from "./progression";
import { sfx } from "./audio";
import {
  MARKET_FEE,
  feeFor,
  makePlayerListing,
  seedListings,
  simulate,
  suggestedPrice,
  type Listing,
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
  loot?: { item: ItemId; qty: number }[];
  xp?: number;
  leveled?: boolean;
  tagged_by?: string | null;
  respawn_at?: string | null;
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
  | { type: "npc"; id: NpcRole };

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

  quest: QuestState | null = null;
  completed: string[] = [];
  discovered: string[] = ["fields"];
  onInteract: ((id: NpcRole) => void) | null = null;

  /** Phase 3 — marketplace + world clock */
  listings: Listing[] = [];
  tradeLog: TradeLog[] = [];
  private marketCd = 3;
  private clock = DAY_LEN * 0.35;

  joystick = { active: false, dx: 0, dy: 0 };
  private onHud: (s: HudSnapshot) => void;
  private hudCd = 0;
  private saveCd = 30;


  /** Progress is persisted to the cloud by the host app, never to localStorage. */
  private persist: ((s: SaveState) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    onHud: (s: HudSnapshot) => void,
    opts?: { initialSave?: SaveState | null; onPersist?: (s: SaveState) => void },
  ) {
    this.persist = opts?.onPersist ?? null;
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

    this.load(opts?.initialSave ?? null);
    if (!this.listings.length) this.listings = seedListings();
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
      skills: this.skills,
      weapon: this.weapon,
      armor: this.armor,
      food: this.food,
      quest: this.quest,
      completed: this.completed,
      discovered: this.discovered,
      listings: this.listings,
      clock: this.clock,
    };
  }


  save() {
    if (!this.persist) return;
    try {
      this.persist(this.toSave());
      this.pushText(this.px, this.py - 40, "Saved", "#9fd6f5");
    } catch {
      /* ignore */
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

  private load(s: SaveState | null) {
    if (!s) return;
    try {
      this.px = s.px ?? this.px;
      this.py = s.py ?? this.py;
      this.gold = s.gold ?? 0;
      this.inv = Array.isArray(s.inv) ? s.inv.slice(0, INV_SIZE) : this.inv;
      while (this.inv.length < INV_SIZE) this.inv.push(null);
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
      if (Array.isArray(s.listings)) this.listings = s.listings as Listing[];
      if (typeof s.clock === "number") this.clock = s.clock;

      this.hp = Math.min(s.hp ?? this.maxHp, this.maxHp);
    } catch {
      /* ignore */
    }
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

  sellSlot(index: number) {
    const slot = this.inv[index];
    if (!slot) return;
    this.gold += item(slot.id).value * slot.qty;
    this.inv[index] = null;
    this.emitHud(true);
  }

  equipSlot(index: number) {
    const slot = this.inv[index];
    if (!slot) return;
    const def = item(slot.id);
    if (def.kind === "food") {
      this.food = slot.id;
      this.pushText(this.px, this.py - 40, `${def.name} set as snack`, "#ffe0a8");
      this.emitHud(true);
      return;
    }
    if (def.kind !== "weapon" && def.kind !== "armor") return;
    const prev = def.kind === "weapon" ? this.weapon : this.armor;
    const next: EquipState = { id: slot.id, plus: slot.plus ?? 0 };
    if (def.kind === "weapon") this.weapon = next;
    else this.armor = next;
    this.inv[index] = prev ? { id: prev.id, qty: 1, plus: prev.plus } : null;
    this.emitHud(true);
  }

  /* ---------- combat stats ---------- */

  get attack() {
    const lvl = this.lvl("combat");
    const w = this.weapon;
    const base = w ? (item(w.id).attack ?? 0) : 0;
    return Math.round(3 + lvl + statWithPlus(base, w?.plus ?? 0));
  }

  get defense() {
    const lvl = this.lvl("combat");
    const a = this.armor;
    const base = a ? (item(a.id).defense ?? 0) : 0;
    return Math.round(Math.floor(lvl / 2) + statWithPlus(base, a?.plus ?? 0));
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
    this.texts.push({ x, y, text, color, life: 1.1 });
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
    for (const npc of NPCS) {
      const d = Math.hypot(npc.x - wx, npc.y - wy - 8);
      if (d < 44 && (!best || d < best.d)) best = { d, t: { type: "npc", id: npc.id } };
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

  private moveToward(tx: number, ty: number, dt: number, speed = 130): number {
    const dx = tx - this.px;
    const dy = ty - this.py;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      const step = Math.min(d, speed * dt);
      this.px += (dx / d) * step;
      this.py += (dy / d) * step;
      if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
      this.moveT += dt * 10;
    }
    return d;
  }


  /** Loot + XP for a kill we own (we tagged the monster first). */
  private rewardKill(m: Monster, md: (typeof MONSTER_DEFS)[MonsterKind]) {

              
              
              const gold = md.gold[0] + Math.floor(Math.random() * (md.gold[1] - md.gold[0] + 1));
              this.gold += gold;
              sfx.play("coin");
              this.pushText(m.x, m.y - 40, `+${gold}g`, "#ffe08a");

              if (Math.random() < md.dropChance) {
                this.addItem(md.drop, 1);
                this.pushText(m.x + 16, m.y - 56, `+1 ${item(md.drop).name}`, "#dff6c9");
              }
              if (md.hide) {
                this.addItem(md.hide, 1);
                this.grantXp("skinning", md.hideXp);
                this.pushText(m.x - 16, m.y - 68, `+1 ${item(md.hide).name}`, "#f0d3b0");
              }
              this.questTick("kill", m.kind);
              this.grantXp("combat", md.xp);
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
      this.px = Math.max(20, Math.min(WORLD_W - 20, this.px + this.joystick.dx * 160 * dt));
      this.py = Math.max(20, Math.min(WORLD_H - 20, this.py + this.joystick.dy * 160 * dt));
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
        const d = this.moveToward(n.x, n.y + 18, dt);
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
            // Shared node: the server decides whether this swing yields a
            // resource. Several players can mine the same rock at once; it
            // depletes for everyone when the shared charges run out.
            n.pending = true;
            const claim: Promise<HarvestRes> = this.onHarvest
              ? this.onHarvest(n.id)
              : Promise.resolve({ ok: true, charges: n.charges - 1, respawn_at: null });
            void claim
              .then((res) => {
                n.pending = false;
                if (typeof res.charges === "number") n.charges = res.charges;
                n.respawnAt = res.respawn_at ? Date.parse(res.respawn_at) : 0;
                n.depleted = n.respawnAt > Date.now();
                if (res.ok) {
                  this.addItem(def.item, 1);
                  this.questTick("gather", def.item);
                  this.grantXp(def.skill, def.xp);
                  sfx.play("gather");
                  this.pushText(n.x, n.y - 20, `+1 ${item(def.item).name}`, "#dff6c9");
                } else if (res.reason === "depleted") {
                  this.pushText(n.x, n.y - 20, "Depleted", "#cbb9a4");
                }
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
          this.activityProgress = 1 - Math.max(0, this.combatCd);
          if (this.combatCd <= 0) {
            this.combatCd = 1;

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
                      this.hp = Math.ceil(this.maxHp * 0.5);
                      this.px = 700;
                      this.py = 620;
                      this.gold = Math.max(0, Math.floor(this.gold * 0.9));
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
      if (!npc) {
        this.target = { type: "none" };
      } else {
        const d = this.moveToward(npc.x, npc.y + 16, dt);
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

    // simulated marketplace
    this.marketCd -= dt;
    if (this.marketCd <= 0) {
      this.marketCd = 3 + Math.random() * 4;
      const res = simulate(this.listings, now);
      this.listings = res.listings;
      if (res.earned > 0) {
        this.gold += res.earned;
        sfx.play("coin");
        this.pushText(this.px, this.py - 64, `+${res.earned}g market sale`, "#ffe08a");
      }
      if (res.logs.length) this.tradeLog = [...res.logs, ...this.tradeLog].slice(0, 12);
      this.emitHud(true);
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
    this.emitHud(true);
    return earned;
  }

  canCraft(recipeId: string): boolean {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r) return false;
    if (this.lvl(r.skill) < r.req) return false;
    return r.inputs.every((i) => this.countItem(i.id) >= i.qty);
  }

  craft(recipeId: string): boolean {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r || !this.canCraft(r.id)) return false;
    for (const i of r.inputs) this.removeItem(i.id, i.qty);
    this.addItem(r.out, r.outQty);
    sfx.play("craft");
    this.grantXp(r.skill, r.xp);

    this.pushText(this.px, this.py - 56, `+${r.outQty} ${item(r.out).name}`, "#dff6c9");
    this.emitHud(true);
    return true;
  }

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
    this.gold -= cost;
    eq.plus += 1;
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

  suggestPrice(id: ItemId) {
    return suggestedPrice(id);
  }

  /** List a stack (or part of it) from the bag on the global market. */
  listSlot(index: number, qty: number, price: number): boolean {
    const slot = this.inv[index];
    if (!slot) return false;
    const amount = Math.max(1, Math.min(qty, slot.qty));
    const unit = Math.max(1, Math.round(price));
    if (!this.removeItem(slot.id, amount)) return false;
    this.listings = [makePlayerListing(slot.id, amount, unit), ...this.listings];
    sfx.play("craft");
    this.pushText(this.px, this.py - 56, `Listed ${amount}× ${item(slot.id).name}`, "#c9e8ff");
    this.emitHud(true);
    return true;
  }

  buyListing(id: string): boolean {
    const idx = this.listings.findIndex((l) => l.id === id);
    if (idx === -1) return false;
    const l = this.listings[idx]!;
    if (l.mine) return this.cancelListing(id);
    const total = l.price * l.qty;
    if (this.gold < total) {
      sfx.play("error");
      this.pushText(this.px, this.py - 50, "Not enough gold", "#f4b0b0");
      return false;
    }
    if (!this.addItem(l.item, l.qty)) return false;
    this.gold -= total;
    this.listings.splice(idx, 1);
    sfx.play("coin");
    this.pushText(this.px, this.py - 50, `-${total}g`, "#ffd0a8");
    this.emitHud(true);
    return true;
  }

  /** Pull your own listing back into the bag. */
  cancelListing(id: string): boolean {
    const idx = this.listings.findIndex((l) => l.id === id && l.mine);
    if (idx === -1) return false;
    const l = this.listings[idx]!;
    if (!this.addItem(l.item, l.qty)) return false;
    this.listings.splice(idx, 1);
    this.emitHud(true);
    return true;
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
      timeOfDay: this.timeOfDay,
      phase: this.dayPhase,
      market: {
        listings: this.listings.map((l) => ({ ...l })),
        log: this.tradeLog.map((l) => ({ ...l })),
        fee: MARKET_FEE,
      },
      soundOn: sfx.enabled,
      name: this.playerName,
      nearby: this.remotes.size,

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
    for (const b of BUILDINGS) this.drawBuilding(ctx, b);
    this.drawButterflies(ctx);
    for (const v of this.villagers) {
      if (!this.inView(v.x, v.y, view)) continue;
      this.drawVillager(ctx, v);
    }


    const drawables: { y: number; fn: () => void }[] = [];
    for (const n of this.nodes) {
      if (!this.inView(n.x, n.y, view)) continue;
      drawables.push({ y: n.y, fn: () => this.drawNode(ctx, n) });
    }
    for (const m of this.monsters) {
      if (m.dead || !this.inView(m.x, m.y, view)) continue;
      drawables.push({ y: m.y, fn: () => this.drawMonster(ctx, m) });
    }
    for (const npc of NPCS) {
      if (!this.inView(npc.x, npc.y, view)) continue;
      drawables.push({ y: npc.y, fn: () => this.drawNpc(ctx, npc) });
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

    ctx.font = "bold 13px ui-rounded, 'Baloo 2', system-ui, sans-serif";
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

  private drawBiome(ctx: CanvasRenderingContext2D, b: BiomeDef) {
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, b.top);
    g.addColorStop(1, b.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // town plaza
    if (b.id === "fields" || b.id === "desert" || b.id === "forest" || b.id === "winter") {
      ctx.fillStyle = b.detail;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      const px = b.id === "fields" ? b.x + 500 : b.id === "desert" ? b.x + 440 : b.id === "forest" ? b.x + 580 : b.x + 560;
      const py = b.id === "fields" ? 120 : b.id === "desert" ? 150 : b.id === "forest" ? 420 : b.y + 180;
      ctx.roundRect(px, py, 430, 400, 40);
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

    // water feature per biome
    if (b.id === "fields") this.pond(ctx, 300, 640, 110, 62, "#9fd8ee");
    if (b.id === "forest") this.pond(ctx, b.x + 1000, 180, 130, 70, "#7fc9c1");
    if (b.id === "winter") this.pond(ctx, 400, b.y + 560, 150, 74, "#cfeaf5");
    if (b.id === "evil") this.pond(ctx, b.x + 1500, b.y + 800, 160, 80, "#5b4a86");

    // biome label
    ctx.font = "bold 26px ui-rounded, 'Baloo 2', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + 60);
  }

  private pond(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(x - 30, y - 20, rx * 0.35, ry * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, b: (typeof BUILDINGS)[number]) {
    ctx.fillStyle = "rgba(90,70,110,0.14)";
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h + 4, b.w * 0.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y + b.h * 0.4, b.w, b.h * 0.6);
    ctx.fillStyle = b.roof;
    ctx.beginPath();
    ctx.moveTo(b.x - 8, b.y + b.h * 0.42);
    ctx.lineTo(b.x + b.w / 2, b.y - 6);
    ctx.lineTo(b.x + b.w + 8, b.y + b.h * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8b6b52";
    ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h * 0.62, 28, b.h * 0.38);
    ctx.fillStyle = "#bfe6f5";
    ctx.fillRect(b.x + 14, b.y + b.h * 0.55, 20, 18);
    ctx.fillRect(b.x + b.w - 34, b.y + b.h * 0.55, 20, 18);
    ctx.font = "bold 12px ui-rounded, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(70,55,70,0.75)";
    ctx.fillText(b.name, b.x + b.w / 2, b.y - 14);
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
    if (m.hp < m.maxHp) {
      // Shared health pool. Amber bar = another player tagged it first, so the
      // loot is theirs.
      const mine = !m.taggedBy || m.taggedBy === this.userId;
      ctx.fillStyle = "rgba(70,55,70,0.3)";
      ctx.fillRect(m.x - 16, m.y - 40 * s, 32, 5);
      ctx.fillStyle = mine ? "#8fd98a" : "#e8b26a";
      ctx.fillRect(m.x - 16, m.y - 40 * s, 32 * (m.hp / m.maxHp), 5);
    }
  }

  private drawNpc(ctx: CanvasRenderingContext2D, npc: NpcDef) {
    const bob = Math.sin(this.time * 2 + npc.x) * 1.6;
    const x = npc.x;
    const y = npc.y - bob;
    this.shadow(ctx, npc.x, npc.y + 16, 15);
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
    ctx.font = "bold 11px ui-rounded, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(70,55,70,0.7)";
    ctx.fillText(npc.name, x, y + 32);
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

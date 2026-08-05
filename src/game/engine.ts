import {
  BUILDINGS,
  ITEMS,
  MONSTER_DEFS,
  MONSTER_SPAWNS,
  NODE_DEFS,
  NODE_SPAWNS,
  REGION_NAME,
  WORLD_H,
  WORLD_W,
} from "./data";
import { levelFromXp } from "./progression";
import type { HudSnapshot, InvSlot, ItemId, SaveState, SkillId } from "./types";

const SAVE_KEY = "tomlandia.save.v1";
const INV_SIZE = 20;

interface ResNode {
  id: number;
  kind: "copper" | "oak";
  x: number;
  y: number;
  depleted: boolean;
  respawnAt: number;
  sway: number;
}

interface Monster {
  id: number;
  kind: "chicken" | "goblin";
  x: number;
  y: number;
  hx: number;
  hy: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  respawnAt: number;
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
  | { type: "monster"; id: number };

export class GameEngine {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private last = 0;
  private time = 0;
  private cam = { x: 0, y: 0 };
  private dpr = 1;

  // player
  px = WORLD_W / 2;
  py = WORLD_H / 2 + 120;
  hp = 30;
  gold = 0;
  facing = 1;
  private moveT = 0;

  skills: Record<SkillId, { xp: number }> = { mining: { xp: 0 }, woodcutting: { xp: 0 }, combat: { xp: 0 } };
  inv: (InvSlot | null)[] = new Array(INV_SIZE).fill(null);
  weapon: ItemId | null = "wooden_club";
  armor: ItemId | null = "cloth_tunic";

  private nodes: ResNode[] = [];
  private monsters: Monster[] = [];
  private texts: FloatText[] = [];
  private orbs: Orb[] = [];
  private parts: Particle[] = [];
  private butterflies: { x: number; y: number; p: number; s: number }[] = [];

  private target: Target = { type: "none" };
  private gatherProgress = 0;
  private combatCd = 0;
  private regenCd = 0;
  private activity = "Wandering";
  private activityProgress = 0;

  joystick = { active: false, dx: 0, dy: 0 };
  private onHud: (s: HudSnapshot) => void;
  private hudCd = 0;
  private saveCd = 30;

  constructor(canvas: HTMLCanvasElement, onHud: (s: HudSnapshot) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onHud = onHud;

    this.nodes = NODE_SPAWNS.map((n, i) => ({
      id: i,
      kind: n.kind,
      x: n.x,
      y: n.y,
      depleted: false,
      respawnAt: 0,
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
        wanderAt: 0,
        hitFlash: 0,
      };
    });
    for (let i = 0; i < 14; i++) {
      this.butterflies.push({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, p: Math.random() * 10, s: 0.4 + Math.random() * 0.6 });
    }

    this.load();
    this.resize();
  }

  /* ---------- persistence ---------- */

  get maxHp() {
    return 30 + (levelFromXp(this.skills.combat.xp).level - 1) * 6;
  }

  private toSave(): SaveState {
    return {
      v: 1,
      px: this.px,
      py: this.py,
      hp: this.hp,
      gold: this.gold,
      inv: this.inv,
      skills: this.skills,
      weapon: this.weapon,
      armor: this.armor,
    };
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.toSave()));
      this.pushText(this.px, this.py - 40, "Saved", "#9fd6f5");
    } catch {
      /* ignore */
    }
  }

  private load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as SaveState;
      this.px = s.px ?? this.px;
      this.py = s.py ?? this.py;
      this.gold = s.gold ?? 0;
      this.inv = Array.isArray(s.inv) ? s.inv.slice(0, INV_SIZE) : this.inv;
      while (this.inv.length < INV_SIZE) this.inv.push(null);
      if (s.skills) this.skills = { ...this.skills, ...s.skills };
      this.weapon = s.weapon ?? null;
      this.armor = s.armor ?? null;
      this.hp = Math.min(s.hp ?? this.maxHp, this.maxHp);
    } catch {
      /* ignore */
    }
  }

  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }

  /* ---------- inventory ---------- */

  addItem(id: ItemId, qty = 1): boolean {
    const def = ITEMS[id];
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
    this.inv[idx] = { id, qty };
    return true;
  }

  sellSlot(index: number) {
    const slot = this.inv[index];
    if (!slot) return;
    this.gold += ITEMS[slot.id].value * slot.qty;
    this.inv[index] = null;
    this.emitHud(true);
  }

  equipSlot(index: number) {
    const slot = this.inv[index];
    if (!slot) return;
    const def = ITEMS[slot.id];
    if (def.kind !== "weapon" && def.kind !== "armor") return;
    const prev = def.kind === "weapon" ? this.weapon : this.armor;
    if (def.kind === "weapon") this.weapon = slot.id;
    else this.armor = slot.id;
    this.inv[index] = prev ? { id: prev, qty: 1 } : null;
    this.emitHud(true);
  }

  /* ---------- combat stats ---------- */

  get attack() {
    const lvl = levelFromXp(this.skills.combat.xp).level;
    return 3 + lvl + (this.weapon ? (ITEMS[this.weapon].attack ?? 0) : 0);
  }
  get defense() {
    const lvl = levelFromXp(this.skills.combat.xp).level;
    return Math.floor(lvl / 2) + (this.armor ? (ITEMS[this.armor].defense ?? 0) : 0);
  }

  private grantXp(skill: SkillId, amount: number) {
    const before = levelFromXp(this.skills[skill].xp).level;
    this.skills[skill].xp += amount;
    const after = levelFromXp(this.skills[skill].xp).level;
    this.orbs.push({ x: this.px + (Math.random() - 0.5) * 30, y: this.py - 20, life: 0.9 });
    if (after > before) {
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
      if (d < 34 && (!best || d < best.d)) best = { d, t: { type: "monster", id: m.id } };
    }
    for (const n of this.nodes) {
      if (n.depleted) continue;
      const d = Math.hypot(n.x - wx, n.y - wy - 10);
      if (d < 38 && (!best || d < best.d)) best = { d, t: { type: "node", id: n.id } };
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

  private update(dt: number) {
    const now = this.time;

    // joystick overrides target
    if (this.joystick.active && (this.joystick.dx || this.joystick.dy)) {
      this.target = { type: "none" };
      this.px = Math.max(20, Math.min(WORLD_W - 20, this.px + this.joystick.dx * 150 * dt));
      this.py = Math.max(20, Math.min(WORLD_H - 20, this.py + this.joystick.dy * 150 * dt));
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
          this.activity = n.kind === "copper" ? "Mining copper" : "Chopping oak";
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
          if (this.gatherProgress >= 1) {
            this.gatherProgress = 0;
            this.addItem(def.item, 1);
            this.grantXp(def.skill, def.xp);
            this.pushText(n.x, n.y - 20, `+1 ${ITEMS[def.item].name}`, "#dff6c9");
            n.depleted = true;
            n.respawnAt = now + def.respawn;
            this.target = { type: "none" };
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
          this.activity = `Fighting ${MONSTER_DEFS[m.kind].name}`;
          this.combatCd -= dt;
          this.activityProgress = 1 - Math.max(0, this.combatCd) / 1;
          if (this.combatCd <= 0) {
            this.combatCd = 1;
            const md = MONSTER_DEFS[m.kind];
            const dmg = Math.max(1, this.attack - md.defense / 2);
            m.hp -= dmg;
            m.hitFlash = 0.2;
            this.pushText(m.x, m.y - 24, `${dmg}`, "#fff0c9");
            if (m.hp <= 0) {
              m.dead = true;
              m.respawnAt = now + 12;
              const gold = md.gold[0] + Math.floor(Math.random() * (md.gold[1] - md.gold[0] + 1));
              this.gold += gold;
              this.pushText(m.x, m.y - 40, `+${gold}g`, "#ffe08a");
              if (Math.random() < md.dropChance) {
                this.addItem(md.drop, 1);
                this.pushText(m.x + 16, m.y - 56, `+1 ${ITEMS[md.drop].name}`, "#dff6c9");
              }
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
              this.target = { type: "none" };
            } else {
              const taken = Math.max(1, md.attack - this.defense / 2);
              this.hp -= taken;
              this.pushText(this.px, this.py - 34, `-${Math.round(taken)}`, "#f4b0b0");
              if (this.hp <= 0) {
                this.hp = Math.ceil(this.maxHp * 0.5);
                this.px = WORLD_W / 2;
                this.py = WORLD_H / 2 + 120;
                this.gold = Math.max(0, Math.floor(this.gold * 0.9));
                this.pushText(this.px, this.py - 60, "Whew! Rescued by a villager", "#c9d8f5");
                this.target = { type: "none" };
              }
            }
          }
        } else {
          this.activity = "Approaching";
          this.activityProgress = 0;
        }
      }
    } else {
      this.activity = "Wandering";
      this.activityProgress = 0;
    }

    // regen out of combat
    if (this.target.type !== "monster") {
      this.regenCd -= dt;
      if (this.regenCd <= 0) {
        this.regenCd = 2.5;
        if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 1);
      }
    }

    // respawns
    for (const n of this.nodes) if (n.depleted && now >= n.respawnAt) n.depleted = false;
    for (const m of this.monsters) {
      if (m.dead) {
        if (now >= m.respawnAt) {
          m.dead = false;
          m.hp = m.maxHp;
          m.x = m.hx;
          m.y = m.hy;
        }
        continue;
      }
      m.hitFlash = Math.max(0, m.hitFlash - dt);
      if (now >= m.wanderAt) {
        m.wanderAt = now + 1.5 + Math.random() * 3;
        m.hx = m.hx;
      }
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
    for (const b of this.butterflies) {
      b.p += dt;
      b.x += Math.cos(b.p * 0.8 + b.s) * 22 * dt;
      b.y += Math.sin(b.p * 1.3) * 18 * dt;
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

  emitHud(force = false) {
    if (force) this.hudCd = 0.12;
    const mk = (id: SkillId) => {
      const l = levelFromXp(this.skills[id].xp);
      return { level: l.level, xp: this.skills[id].xp, progress: l.progress, into: l.into, need: l.need };
    };
    this.onHud({
      hp: Math.max(0, Math.round(this.hp)),
      maxHp: this.maxHp,
      gold: this.gold,
      level: levelFromXp(this.skills.combat.xp).level,
      region: REGION_NAME,
      skills: { mining: mk("mining"), woodcutting: mk("woodcutting"), combat: mk("combat") },
      inv: this.inv.map((s) => (s ? { ...s } : null)),
      weapon: this.weapon,
      armor: this.armor,
      activity: this.activity,
      activityProgress: this.activityProgress,
    });
  }

  /* ---------- render ---------- */

  private render() {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    // grass base
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#bfe8a0");
    g.addColorStop(1, "#a3dd8c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));

    this.drawGround(ctx);
    for (const b of BUILDINGS) this.drawBuilding(ctx, b);
    this.drawButterflies(ctx);

    const drawables: { y: number; fn: () => void }[] = [];
    for (const n of this.nodes) drawables.push({ y: n.y, fn: () => this.drawNode(ctx, n) });
    for (const m of this.monsters) if (!m.dead) drawables.push({ y: m.y, fn: () => this.drawMonster(ctx, m) });
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
    ctx.restore();

    // soft vignette / bloom
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
    v.addColorStop(0, "rgba(255,255,235,0)");
    v.addColorStop(1, "rgba(120,100,150,0.16)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  private drawGround(ctx: CanvasRenderingContext2D) {
    // paths & patches
    ctx.fillStyle = "#e8dcbb";
    ctx.beginPath();
    ctx.roundRect(500, 120, 420, 380, 40);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 40; i++) {
      const x = ((i * 137) % WORLD_W) + 10;
      const y = ((i * 233) % WORLD_H) + 10;
      ctx.fillRect(x, y, 18, 4);
    }
    ctx.fillStyle = "#95d283";
    for (let i = 0; i < 90; i++) {
      const x = (i * 271) % WORLD_W;
      const y = (i * 419) % WORLD_H;
      ctx.fillRect(x, y, 3, 6);
      ctx.fillRect(x + 5, y + 2, 3, 5);
    }
    // pond
    ctx.fillStyle = "#9fd8ee";
    ctx.beginPath();
    ctx.ellipse(300, 640, 110, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(270, 620, 40, 14, 0, 0, Math.PI * 2);
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
    if (n.depleted) {
      ctx.globalAlpha = 0.35;
    }
    this.shadow(ctx, n.x, n.y + 20, 22);
    if (n.kind === "copper") {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.moveTo(n.x - 24, n.y + 20);
      ctx.lineTo(n.x - 14, n.y - 14);
      ctx.lineTo(n.x + 10, n.y - 20);
      ctx.lineTo(n.x + 24, n.y + 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#cfc2b2";
      ctx.fillRect(n.x - 12, n.y - 10, 12, 8);
      if (!n.depleted) {
        ctx.fillStyle = def.accent;
        ctx.fillRect(n.x - 4, n.y + 2, 8, 8);
        ctx.fillRect(n.x + 8, n.y - 4, 6, 6);
      }
    } else {
      ctx.fillStyle = def.color;
      ctx.fillRect(n.x - 7, n.y - 10, 14, 32);
      const sway = Math.sin(this.time * 1.4 + n.sway) * 3;
      ctx.fillStyle = n.depleted ? "#9ab389" : def.accent;
      ctx.beginPath();
      ctx.arc(n.x + sway, n.y - 30, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = n.depleted ? "#8aa87c" : "#8ed77c";
      ctx.beginPath();
      ctx.arc(n.x + sway - 16, n.y - 18, 18, 0, Math.PI * 2);
      ctx.arc(n.x + sway + 16, n.y - 18, 18, 0, Math.PI * 2);
      ctx.fill();
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
    const bob = Math.sin(this.time * 4 + m.id) * 2;
    this.shadow(ctx, m.x, m.y + 14, 14);
    ctx.fillStyle = m.hitFlash > 0 ? "#ffffff" : d.body;
    // body
    ctx.beginPath();
    ctx.roundRect(m.x - 10, m.y - 6 + bob, 20, 18, 6);
    ctx.fill();
    // big head
    ctx.beginPath();
    ctx.arc(m.x, m.y - 16 + bob, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.accent;
    if (m.kind === "chicken") {
      ctx.beginPath();
      ctx.moveTo(m.x - 4, m.y - 27 + bob);
      ctx.lineTo(m.x, m.y - 34 + bob);
      ctx.lineTo(m.x + 4, m.y - 27 + bob);
      ctx.fill();
      ctx.fillRect(m.x + 10, m.y - 17 + bob, 6, 4);
    } else {
      ctx.beginPath();
      ctx.moveTo(m.x - 13, m.y - 20 + bob);
      ctx.lineTo(m.x - 20, m.y - 26 + bob);
      ctx.lineTo(m.x - 11, m.y - 26 + bob);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(m.x + 13, m.y - 20 + bob);
      ctx.lineTo(m.x + 20, m.y - 26 + bob);
      ctx.lineTo(m.x + 11, m.y - 26 + bob);
      ctx.fill();
    }
    ctx.fillStyle = "#4a3b52";
    ctx.fillRect(m.x - 6, m.y - 18 + bob, 3, 3);
    ctx.fillRect(m.x + 3, m.y - 18 + bob, 3, 3);
    // hp bar
    if (m.hp < m.maxHp) {
      ctx.fillStyle = "rgba(70,55,70,0.3)";
      ctx.fillRect(m.x - 16, m.y - 40, 32, 5);
      ctx.fillStyle = "#8fd98a";
      ctx.fillRect(m.x - 16, m.y - 40, 32 * (m.hp / m.maxHp), 5);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const ctx2 = ctx;
    const walking = this.activity === "Walking" || this.activity === "Wandering" || this.activity === "Approaching";
    const bob = walking ? Math.abs(Math.sin(this.moveT)) * 3 : Math.sin(this.time * 3) * 1.5;
    const x = this.px;
    const y = this.py - bob;
    this.shadow(ctx2, this.px, this.py + 16, 16);
    // legs
    ctx2.fillStyle = "#6f5b8f";
    ctx2.fillRect(x - 7, y + 8, 5, 9);
    ctx2.fillRect(x + 2, y + 8, 5, 9);
    // body
    ctx2.fillStyle = this.armor ? ITEMS[this.armor].color : "#f2c6d8";
    ctx2.beginPath();
    ctx2.roundRect(x - 11, y - 6, 22, 16, 5);
    ctx2.fill();
    // head (oversized)
    ctx2.fillStyle = "#ffe0c2";
    ctx2.beginPath();
    ctx2.arc(x, y - 19, 15, 0, Math.PI * 2);
    ctx2.fill();
    // hair
    ctx2.fillStyle = "#8a5a3b";
    ctx2.beginPath();
    ctx2.arc(x, y - 23, 15, Math.PI, 0);
    ctx2.fill();
    // eyes
    ctx2.fillStyle = "#4a3b52";
    ctx2.fillRect(x - 6 + this.facing * 2, y - 20, 3, 4);
    ctx2.fillRect(x + 3 + this.facing * 2, y - 20, 3, 4);
    // weapon
    if (this.weapon) {
      ctx2.fillStyle = ITEMS[this.weapon].color;
      const swing = this.activity.startsWith("Fighting") ? Math.sin(this.time * 12) * 6 : 0;
      ctx2.fillRect(x + this.facing * 12, y - 8 - swing, 4, 16);
    }
  }
}

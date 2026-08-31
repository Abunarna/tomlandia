import { WORLD_H, WORLD_W, blockedAt } from "./data";

/**
 * DESOLATUS — the shared world boss.
 *
 * One instance for the whole game. His *position* is never broadcast: it is a
 * pure function of wall-clock time along a fixed, deterministic loop that every
 * client generates identically from the same seed, so movement costs zero
 * realtime traffic. Only his HP is real shared state (players change it), and
 * that rides the same row-locked, server-authoritative path regular monsters
 * already use.
 */

export const BOSS_NAME = "DESOLATUS";
export const BOSS_LEVEL = 150;

/** ~1.5x the largest existing monster (Frost Giant, size 1.7) — trimmed for readability. */
export const BOSS_SIZE = 2.55;

/** A quarter of player walk speed (130 px/s) — he lumbers. */
export const BOSS_SPEED = 32.5;

/** Screen tint + banner start here. */
export const BOSS_WARN_RADIUS = 620;
/** He swings at anything inside this — the same reach a player has (34px). */
export const BOSS_ATTACK_RADIUS = 34;
/** Tap range for the player's own swings — matched, so trades are mutual. */
export const BOSS_MELEE_RADIUS = 34;

/**
 * Stats, solved against the live formulas (see server RPC for the mirror):
 *  - defense 85  ≈ 2.2x starsteel_heavy_armor's 38.
 *  - attack 340  → vs a level-150 player in starsteel_heavy_armor (def 75+38=113):
 *    floor(340 * (0.5..1.2) - 56) = 114..352 of a 924 max HP pool, averaging
 *    ~233 ≈ 25% per hit.
 *  - hp 45000    ≈ 20x the Frost Giant's 2200 pool.
 */
export const BOSS_HP = 45000;
export const BOSS_ATTACK = 340;
export const BOSS_DEFENSE = 85;

/* ------------------------------------------------------------------ */
/* Deterministic roaming path                                          */
/* ------------------------------------------------------------------ */

/** Fixed seed — every client must generate the exact same loop. */
const SEED = 0x0de5;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** His bulk means he needs more clearance than a player. */
const CLEARANCE = 26;

function walkable(x: number, y: number) {
  return (
    x > 60 && y > 60 && x < WORLD_W - 60 && y < WORLD_H - 60 && !blockedAt(x, y, CLEARANCE)
  );
}

/** true when he can walk the straight line a->b without clipping anything */
function clearLine(ax: number, ay: number, bx: number, by: number) {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(2, Math.ceil(d / 14));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!walkable(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

interface Leg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  len: number;
  /** cumulative distance at the end of this leg */
  end: number;
}

function buildPath(): { legs: Leg[]; total: number } {
  const rnd = mulberry32(SEED);

  // Start somewhere walkable near the middle of the world.
  let sx = WORLD_W * 0.5;
  let sy = WORLD_H * 0.5;
  for (let i = 0; i < 4000 && !walkable(sx, sy); i++) {
    sx = 100 + rnd() * (WORLD_W - 200);
    sy = 100 + rnd() * (WORLD_H - 200);
  }

  const pts: [number, number][] = [[sx, sy]];
  const WAYPOINTS = 90;
  for (let i = 0; i < WAYPOINTS; i++) {
    const [cx, cy] = pts[pts.length - 1]!;
    let placed = false;
    for (let tries = 0; tries < 90 && !placed; tries++) {
      const reach = 720 - Math.min(500, tries * 8);
      const ang = rnd() * Math.PI * 2;
      const dist = 220 + rnd() * reach;
      const nx = cx + Math.cos(ang) * dist;
      const ny = cy + Math.sin(ang) * dist;
      if (!walkable(nx, ny)) continue;
      if (!clearLine(cx, cy, nx, ny)) continue;
      pts.push([nx, ny]);
      placed = true;
    }
    if (!placed) break;
  }

  // Walk the same route back so the loop is closed and provably walkable.
  const loop = pts.concat(pts.slice(0, -1).reverse());

  const legs: Leg[] = [];
  let acc = 0;
  for (let i = 0; i < loop.length - 1; i++) {
    const [x1, y1] = loop[i]!;
    const [x2, y2] = loop[i + 1]!;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) continue;
    acc += len;
    legs.push({ x1, y1, x2, y2, len, end: acc });
  }
  return { legs, total: acc };
}

let cached: { legs: Leg[]; total: number } | null = null;

function path() {
  if (!cached) cached = buildPath();
  return cached;
}

export interface BossPose {
  x: number;
  y: number;
  /** 1 = walking right, -1 = walking left */
  facing: 1 | -1;
}

/**
 * Where is DESOLATUS right now? Identical on every client for a given clock,
 * so no position ever needs to cross the wire.
 */
export function desolatusAt(nowMs: number = Date.now()): BossPose {
  const { legs, total } = path();
  if (!legs.length || total <= 0) return { x: WORLD_W / 2, y: WORLD_H / 2, facing: 1 };
  let travelled = ((nowMs / 1000) * BOSS_SPEED) % total;
  if (travelled < 0) travelled += total;

  // binary search the leg holding this distance
  let lo = 0;
  let hi = legs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (legs[mid]!.end < travelled) lo = mid + 1;
    else hi = mid;
  }
  const leg = legs[lo]!;
  const into = leg.len - (leg.end - travelled);
  const t = Math.max(0, Math.min(1, into / leg.len));
  return {
    x: leg.x1 + (leg.x2 - leg.x1) * t,
    y: leg.y1 + (leg.y2 - leg.y1) * t,
    facing: leg.x2 >= leg.x1 ? 1 : -1,
  };
}

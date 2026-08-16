/**
 * Walled cities — Grand Haven ("The Walled Hearth") and Sunspire ("The Sphinx
 * City").
 *
 * A city is described purely as geometry so the same definition drives layout,
 * collision and rendering:
 *
 *   plaza ── ring road ── building rings ── perimeter wall ── (moat)
 *
 * The wall is an organic ring: a radius that wobbles with the angle, using the
 * same "jittered outline" idea the biome edges and lake shores use, just
 * expressed as a smooth periodic function so collision stays cheap and exact.
 */

export type GateKind = "spine" | "trail" | "local";

export interface CityGate {
  /** direction from the plaza, radians (canvas space, +y is south) */
  angle: number;
  /** half-width of the opening, radians */
  half: number;
  kind: GateKind;
  label: string;
  /** the primary gate spans the moat on a drawbridge; the rest sit on causeways */
  drawbridge: boolean;
}

export interface CityDef {
  key: string;
  name: string;
  /** stone-and-moat hearth, sandstone medina, or timber canopy town */
  theme: "stone" | "sand" | "wood";
  cx: number;
  cy: number;
  /** open cobbled circle at the heart of town */
  plazaR: number;
  /** radii the buildings are arranged on */
  ringR: number[];
  /** mean wall radius */
  wallR: number;
  /** wall thickness */
  wallT: number;
  /** dry berm between wall and water (0 when the city has no moat) */
  moatGap: number;
  /** width of the water band (0 = no moat) */
  moatW: number;
  /** wobble phase so the two cities don't share an identical silhouette */
  phase: number;
  /** interior water feature at the heart of the city (Sunspire's oasis) */
  oasis?: { dx: number; dy: number; rx: number; ry: number };
  /** signature monument: a solid block players walk around */
  monument?: { dx: number; dy: number; w: number; h: number; kind: "sphinx" | "oakhall" };
  gates: CityGate[];
}

const GRAND_HAVEN: CityDef = {
  key: "grand-haven",
  name: "Grand Haven",
  theme: "stone",
  cx: 800,
  cy: 2300,
  plazaR: 96,
  ringR: [200, 278],
  wallR: 320,
  wallT: 26,
  moatGap: 30,
  moatW: 58,
  phase: 0,
  gates: [
    // 1 — primary: the drawbridge gate, onto the spine road to Willowbrook
    { angle: -0.53, half: 0.17, kind: "spine", label: "Willowbrook Gate", drawbridge: true },
    // 2 — the unmarked northern trail that becomes the desert shortcut
    { angle: -1.35, half: 0.15, kind: "trail", label: "Dust Trail Postern", drawbridge: false },
    // 3, 4 — local wilderness posterns
    { angle: 1.05, half: 0.15, kind: "local", label: "Meadow Postern", drawbridge: false },
    { angle: 2.75, half: 0.15, kind: "local", label: "Westwatch Postern", drawbridge: false },
  ],
};

/**
 * Sunspire sits in the middle of the Sunscorch Desert territory: a sandstone
 * ring wall, no moat (water is far too precious), a spring-fed oasis on the
 * plaza and the great sphinx watching the Willowbrook approach.
 */
const SUNSPIRE: CityDef = {
  key: "sunspire",
  name: "Sunspire",
  theme: "sand",
  cx: 3100,
  cy: 900,
  plazaR: 118,
  ringR: [222, 300],
  wallR: 348,
  wallT: 24,
  moatGap: 0,
  moatW: 0,
  phase: 1.7,
  oasis: { dx: -6, dy: 8, rx: 74, ry: 56 },
  monument: { dx: -388, dy: 185, w: 176, h: 92, kind: "sphinx" },
  gates: [
    // 1 — the caravan gate onto the spine road down to Willowbrook
    { angle: 2.36, half: 0.17, kind: "spine", label: "Caravan Gate", drawbridge: false },
    // 2 — east, facing the Evil Woods where Duskmere will rise
    { angle: 0.46, half: 0.16, kind: "spine", label: "Duskward Gate", drawbridge: false },
    // 3 — the dust-trail shortcut back to Grand Haven's northern postern
    { angle: 3.02, half: 0.15, kind: "trail", label: "Dust Trail Gate", drawbridge: false },
    // 4 — local wilderness postern onto the northern dunes
    { angle: -1.42, half: 0.15, kind: "local", label: "Dune Postern", drawbridge: false },
  ],
};

/**
 * Willowbrook, the canopy city of the Lush Forest: a woven palisade of living
 * hedge and split timber instead of stone, winding walkways between tree-house
 * clusters, and the Great Oak Hall growing straight out of the plaza.
 */
const WILLOWBROOK: CityDef = {
  key: "willowbrook",
  name: "Willowbrook",
  theme: "wood",
  cx: 1960,
  cy: 1710,
  plazaR: 152,
  ringR: [238, 312],
  wallR: 326,
  wallT: 22,
  moatGap: 0,
  moatW: 0,
  phase: 3.4,
  monument: { dx: 0, dy: 0, w: 190, h: 150, kind: "oakhall" },
  gates: [
    // 1 — the fieldward gate, onto the spine road down to Grand Haven
    { angle: 2.67, half: 0.17, kind: "spine", label: "Fieldward Gate", drawbridge: false },
    // 2 — the sunward gate, onto the caravan road up to Sunspire
    { angle: -0.62, half: 0.17, kind: "spine", label: "Sunward Gate", drawbridge: false },
    // 3 — the lakeside postern, out toward the forest fishing lake
    { angle: -2.24, half: 0.15, kind: "local", label: "Lakeside Postern", drawbridge: false },
    // 4 — the bramble postern onto the southern woods
    { angle: 1.25, half: 0.15, kind: "local", label: "Bramble Postern", drawbridge: false },
  ],
};

export const CITIES: CityDef[] = [GRAND_HAVEN, SUNSPIRE, WILLOWBROOK];
/** Grand Haven stays the default city for the many single-city call sites */
export const CITY = GRAND_HAVEN;
export { GRAND_HAVEN, SUNSPIRE, WILLOWBROOK };

/** organic wobble on the wall radius — smooth, deterministic, never self-crossing */
export function cityWallR(a: number, c: CityDef = CITY): number {
  const p = c.phase;
  return (
    c.wallR *
    (1 +
      0.055 * Math.sin(3 * a + 0.9 + p) +
      0.035 * Math.sin(5 * a - 0.4 + p) +
      0.02 * Math.sin(8 * a + 2.1 + p))
  );
}

const MAX_WOBBLE = 1.11;
/** furthest the outer bank (moat, if any) ever reaches from a city's plaza */
export function cityOuterR(c: CityDef = CITY): number {
  return c.wallR * MAX_WOBBLE + c.moatGap + c.moatW;
}
/** Grand Haven's outer radius (kept for existing call sites) */
export const CITY_OUTER_R = cityOuterR(GRAND_HAVEN);

function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** the gate whose opening covers this bearing, if any */
export function cityGateAt(a: number, c: CityDef = CITY): CityGate | null {
  for (const g of c.gates) if (angDiff(a, g.angle) < g.half) return g;
  return null;
}

/** world position of a gate's opening (mid-wall) */
export function cityGatePos(g: CityGate, c: CityDef = CITY): { x: number; y: number } {
  const r = cityWallR(g.angle, c);
  return { x: c.cx + Math.cos(g.angle) * r, y: c.cy + Math.sin(g.angle) * r };
}

/** a point just outside the wall (and moat), straight out from a gate */
export function cityGateApproach(g: CityGate, out = 60, c: CityDef = CITY): { x: number; y: number } {
  const r = cityWallR(g.angle, c) + c.moatGap + c.moatW + out;
  return { x: c.cx + Math.cos(g.angle) * r, y: c.cy + Math.sin(g.angle) * r };
}

/** the city whose footprint contains this point, if any */
export function cityAt(x: number, y: number, margin = 0): CityDef | null {
  for (const c of CITIES) {
    if (Math.hypot(x - c.cx, y - c.cy) < cityOuterR(c) + margin) return c;
  }
  return null;
}

/** the oasis pool (interior water) — blocks movement, drawn as water */
export function inCityOasis(x: number, y: number, pad = 0): boolean {
  for (const c of CITIES) {
    if (!c.oasis) continue;
    const ox = c.cx + c.oasis.dx;
    const oy = c.cy + c.oasis.dy;
    const rx = c.oasis.rx + pad;
    const ry = c.oasis.ry + pad;
    const nx = (x - ox) / rx;
    const ny = (y - oy) / ry;
    if (nx * nx + ny * ny < 1) return true;
  }
  return false;
}

/** the monument footprint — solid */
function onMonument(x: number, y: number, pad = 0): boolean {
  for (const c of CITIES) {
    if (!c.monument) continue;
    const mx = c.cx + c.monument.dx;
    const my = c.cy + c.monument.dy;
    if (
      Math.abs(x - mx) < c.monument.w / 2 + pad &&
      Math.abs(y - my) < c.monument.h / 2 + pad
    ) {
      return true;
    }
  }
  return false;
}

function blockedByCity(c: CityDef, x: number, y: number, pad: number): boolean {
  const dx = x - c.cx;
  const dy = y - c.cy;
  const d = Math.hypot(dx, dy);
  if (d > cityOuterR(c) + pad || d < c.wallR * 0.8 - pad) return false;
  const a = Math.atan2(dy, dx);
  const wr = cityWallR(a, c);
  const gate = cityGateAt(a, c);

  if (!gate && Math.abs(d - wr) < c.wallT / 2 + pad) return true;

  if (c.moatW <= 0) return false;
  const inner = wr + c.moatGap;
  const outer = inner + c.moatW;
  if (d > inner - pad && d < outer + pad) {
    if (!gate) return true;
    // drawbridge deck is a little narrower than the gate mouth
    if (gate.drawbridge) return angDiff(a, gate.angle) > gate.half * 0.72;
    return false;
  }
  return false;
}

/**
 * Solid walls, un-crossable moat water, the oasis pool and the sphinx.
 * Openings: every gate breaks the wall; Grand Haven's moat is bridged by the
 * drawbridge at the primary gate and simply doesn't run across its posterns.
 */
export function cityBlocked(x: number, y: number, pad = 10): boolean {
  if (inCityOasis(x, y, pad)) return true;
  if (onMonument(x, y, pad)) return true;
  for (const c of CITIES) if (blockedByCity(c, x, y, pad)) return true;
  return false;
}

/** water for rendering / road planning: moat bands and the oasis */
export function inCityMoat(x: number, y: number, pad = 0): boolean {
  if (inCityOasis(x, y, pad)) return true;
  for (const c of CITIES) {
    if (c.moatW <= 0) continue;
    const dx = x - c.cx;
    const dy = y - c.cy;
    const d = Math.hypot(dx, dy);
    if (d > cityOuterR(c) + pad || d < c.wallR * 0.8) continue;
    const a = Math.atan2(dy, dx);
    const gate = cityGateAt(a, c);
    if (gate && !gate.drawbridge) continue;
    const inner = cityWallR(a, c) + c.moatGap;
    if (d > inner - pad && d < inner + c.moatW + pad) return true;
  }
  return false;
}

/** everything a wilderness spawn must stay out of: any city and its moat */
export function cityKeepOut(x: number, y: number, margin = 80): boolean {
  return CITIES.some((c) => Math.hypot(x - c.cx, y - c.cy) < cityOuterR(c) + margin);
}

/** push a point radially out past the city instead of dropping it */
export function pushOutsideCity(x: number, y: number, margin = 80): { x: number; y: number } {
  let px = x;
  let py = y;
  for (const c of CITIES) {
    const dx = px - c.cx;
    const dy = py - c.cy;
    const d = Math.hypot(dx, dy) || 1;
    const need = cityOuterR(c) + margin;
    if (d >= need) continue;
    const r = need + (d % 37);
    px = c.cx + (dx / d) * r;
    py = c.cy + (dy / d) * r;
  }
  return { x: px, y: py };
}

/** the wall outline, sampled — used for drawing */
export function cityWallPath(step = 0.02, c: CityDef = CITY): [number, number][] {
  const pts: [number, number][] = [];
  for (let a = -Math.PI; a < Math.PI; a += step) {
    const r = cityWallR(a, c);
    pts.push([c.cx + Math.cos(a) * r, c.cy + Math.sin(a) * r]);
  }
  return pts;
}

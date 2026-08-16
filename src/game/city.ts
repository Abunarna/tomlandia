/**
 * Grand Haven — "The Walled Hearth".
 *
 * The city is described purely as geometry so the same definition drives
 * layout, collision and rendering:
 *
 *   plaza  ── ring road ── building rings ── stone wall ── moat
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
  name: string;
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
  /** dry berm between wall and water */
  moatGap: number;
  /** width of the water band */
  moatW: number;
  gates: CityGate[];
}

export const CITY: CityDef = {
  name: "Grand Haven",
  cx: 800,
  cy: 2300,
  plazaR: 96,
  ringR: [200, 278],
  wallR: 320,
  wallT: 26,
  moatGap: 30,
  moatW: 58,
  gates: [
    // 1 — primary: the drawbridge gate, onto the spine road to Willowbrook
    { angle: -0.53, half: 0.17, kind: "spine", label: "Willowbrook Gate", drawbridge: true },
    // 2 — the unmarked northern trail that will become the desert shortcut
    { angle: -1.35, half: 0.15, kind: "trail", label: "Dust Trail Postern", drawbridge: false },
    // 3, 4 — local wilderness posterns
    { angle: 1.05, half: 0.15, kind: "local", label: "Meadow Postern", drawbridge: false },
    { angle: 2.75, half: 0.15, kind: "local", label: "Westwatch Postern", drawbridge: false },
  ],
};

/** organic wobble on the wall radius — smooth, deterministic, never self-crossing */
export function cityWallR(a: number): number {
  return (
    CITY.wallR *
    (1 + 0.055 * Math.sin(3 * a + 0.9) + 0.035 * Math.sin(5 * a - 0.4) + 0.02 * Math.sin(8 * a + 2.1))
  );
}

const MAX_WOBBLE = 1.11;
/** furthest the outer moat bank ever reaches from the plaza */
export const CITY_OUTER_R = CITY.wallR * MAX_WOBBLE + CITY.moatGap + CITY.moatW;

function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** the gate whose opening covers this bearing, if any */
export function cityGateAt(a: number): CityGate | null {
  for (const g of CITY.gates) if (angDiff(a, g.angle) < g.half) return g;
  return null;
}

/** world position of a gate's opening (mid-wall) */
export function cityGatePos(g: CityGate): { x: number; y: number } {
  const r = cityWallR(g.angle);
  return { x: CITY.cx + Math.cos(g.angle) * r, y: CITY.cy + Math.sin(g.angle) * r };
}

/** a point just outside the moat, straight out from a gate */
export function cityGateApproach(g: CityGate, out = 60): { x: number; y: number } {
  const r = cityWallR(g.angle) + CITY.moatGap + CITY.moatW + out;
  return { x: CITY.cx + Math.cos(g.angle) * r, y: CITY.cy + Math.sin(g.angle) * r };
}

/**
 * Solid wall and un-crossable moat water.
 * Openings: every gate breaks the wall; the moat is bridged by the drawbridge
 * at the primary gate and simply doesn't run across the three posterns, whose
 * approaches are dry causeways.
 */
export function cityBlocked(x: number, y: number, pad = 10): boolean {
  const dx = x - CITY.cx;
  const dy = y - CITY.cy;
  const d = Math.hypot(dx, dy);
  if (d > CITY_OUTER_R + pad || d < CITY.wallR * 0.8 - pad) return false;
  const a = Math.atan2(dy, dx);
  const wr = cityWallR(a);
  const gate = cityGateAt(a);

  if (!gate && Math.abs(d - wr) < CITY.wallT / 2 + pad) return true;

  const inner = wr + CITY.moatGap;
  const outer = inner + CITY.moatW;
  if (d > inner - pad && d < outer + pad) {
    if (!gate) return true;
    // drawbridge deck is a little narrower than the gate mouth
    if (gate.drawbridge) return angDiff(a, gate.angle) > gate.half * 0.72;
    return false;
  }
  return false;
}

/** water for rendering / road planning: the moat band, minus the gate causeways */
export function inCityMoat(x: number, y: number, pad = 0): boolean {
  const dx = x - CITY.cx;
  const dy = y - CITY.cy;
  const d = Math.hypot(dx, dy);
  if (d > CITY_OUTER_R + pad || d < CITY.wallR * 0.8) return false;
  const a = Math.atan2(dy, dx);
  const gate = cityGateAt(a);
  if (gate && !gate.drawbridge) return false;
  const inner = cityWallR(a) + CITY.moatGap;
  return d > inner - pad && d < inner + CITY.moatW + pad;
}

/** everything a wilderness spawn must stay out of: the city and its moat */
export function cityKeepOut(x: number, y: number, margin = 80): boolean {
  return Math.hypot(x - CITY.cx, y - CITY.cy) < CITY_OUTER_R + margin;
}

/** push a point radially out past the moat instead of dropping it */
export function pushOutsideCity(x: number, y: number, margin = 80): { x: number; y: number } {
  const dx = x - CITY.cx;
  const dy = y - CITY.cy;
  const d = Math.hypot(dx, dy) || 1;
  if (d >= CITY_OUTER_R + margin) return { x, y };
  const r = CITY_OUTER_R + margin + (d % 37);
  return { x: CITY.cx + (dx / d) * r, y: CITY.cy + (dy / d) * r };
}

/** the wall outline, sampled — used for drawing */
export function cityWallPath(step = 0.02): [number, number][] {
  const pts: [number, number][] = [];
  for (let a = -Math.PI; a < Math.PI; a += step) {
    const r = cityWallR(a);
    pts.push([CITY.cx + Math.cos(a) * r, CITY.cy + Math.sin(a) * r]);
  }
  return pts;
}

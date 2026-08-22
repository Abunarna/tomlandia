/**
 * Pixel-art river rendering.
 *
 * Rivers keep their existing geometry (centreline + normals + half-width from
 * `riverGeom` in engine.ts). This module only changes how that band is painted:
 * the water/bank shape is rasterised once onto a world-locked pixel grid and
 * cached as a sparse cell map, so the texture never crawls, shimmers or
 * re-randomises when the camera moves, the viewport resizes or React rerenders.
 *
 * Two layers:
 *   - static  : banks + water body (baked into the terrain overlay)
 *   - detail  : sparse highlight clusters (drawn live, optional 4-frame pulse)
 */

export interface CenterGeom {
  pts: [number, number][];
  nx: number[];
  ny: number[];
  hw: number[];
}

/* ------------------------------ palette ---------------------------------- */

export interface RiverPalette {
  bankShadow: string;
  bankMid: string;
  waterDeep: string;
  waterBase: string;
  waterLight: string;
  foamHighlight: string;
}

export const RIVER_PALETTE: RiverPalette = {
  bankShadow: "#25384f",
  bankMid: "#3d6b72",
  waterDeep: "#2f5f86",
  waterBase: "#4a86a8",
  waterLight: "#7fb6c9",
  foamHighlight: "#b9dfe4",
};

const ORDER = [
  "bankShadow",
  "bankMid",
  "waterDeep",
  "waterBase",
  "waterLight",
  "foamHighlight",
] as const;
type PaletteKey = (typeof ORDER)[number];

/* ------------------------------ presets ---------------------------------- */

export interface RiverConfig {
  preset: "fine" | "sprite" | "coarse";
  /** logical art-pixel size, in world px */
  cell: number;
  /** bank treatment thickness, in logical pixels */
  bankPx: number;
  /** fraction of the water surface covered by highlight clusters */
  density: number;
  /** cluster length range, in logical pixels */
  lenMin: number;
  lenMax: number;
  /** discrete pulse rate */
  fps: number;
  animate: boolean;
  palette: RiverPalette;
}

export const RIVER_PRESETS: Record<"fine" | "sprite" | "coarse", Omit<RiverConfig, "palette" | "animate">> = {
  fine: { preset: "fine", cell: 3, bankPx: 2, density: 0.03, lenMin: 3, lenMax: 8, fps: 5 },
  sprite: { preset: "sprite", cell: 4, bankPx: 2, density: 0.025, lenMin: 3, lenMax: 7, fps: 5 },
  coarse: { preset: "coarse", cell: 5, bankPx: 1, density: 0.02, lenMin: 3, lenMax: 6, fps: 5 },
};

export const riverConfig: RiverConfig = {
  ...RIVER_PRESETS.sprite,
  animate: true,
  palette: { ...RIVER_PALETTE },
};

/** Bumped whenever the config changes, so cached rasters + terrain re-bake. */
export let riverVersion = 0;

export function setRiverConfig(patch: Partial<RiverConfig>) {
  Object.assign(riverConfig, patch);
  if (patch.palette) riverConfig.palette = { ...riverConfig.palette, ...patch.palette };
  MASKS.clear();
  riverVersion++;
}

export function applyRiverPreset(name: "fine" | "sprite" | "coarse") {
  setRiverConfig({ ...RIVER_PRESETS[name] });
}

/* ------------------------------ raster ----------------------------------- */

interface Row {
  xs: Int32Array;
  cs: Uint8Array;
}

interface Mask {
  cell: number;
  /** grid row -> sorted cells */
  rows: Map<number, Row>;
  /** number of water cells (used for highlight budgeting) */
  waterCells: number;
  clusters: Cluster[];
}

interface Cluster {
  /** centreline sample index */
  i: number;
  /** lateral position, as a fraction of the local half-width */
  v: number;
  len: number;
  phase: number;
  foam: boolean;
  thickEnd: boolean;
}

const MASKS = new Map<string, Mask>();

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Build (once) the world-locked pixel raster for one river band. */
function buildMask(id: string, g: CenterGeom): Mask {
  const key = `${id}|${riverVersion}`;
  const hit = MASKS.get(key);
  if (hit) return hit;

  const cell = riverConfig.cell;
  const n = g.pts.length;

  // cell record: keep the sample closest to the centreline for classification
  type Rec = { u: number; side: number; i: number };
  const cells = new Map<number, Rec>();
  const KX = 1 << 16;
  const put = (gx: number, gy: number, u: number, side: number, i: number) => {
    const k = (gy + 32768) * KX + (gx + 32768);
    const prev = cells.get(k);
    if (prev && prev.u <= Math.abs(u)) return;
    cells.set(k, { u: Math.abs(u), side, i });
  };

  for (let i = 0; i < n - 1; i++) {
    const a = g.pts[i]!;
    const b = g.pts[i + 1]!;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(seg / (cell * 0.5)));
    for (let s = 0; s < steps; s++) {
      const f = s / steps;
      const px = a[0] + (b[0] - a[0]) * f;
      const py = a[1] + (b[1] - a[1]) * f;
      const hw = g.hw[i]! + (g.hw[i + 1]! - g.hw[i]!) * f;
      const nx = g.nx[i]!;
      const ny = g.ny[i]!;
      const outer = 1 + (riverConfig.bankPx * cell) / hw;
      const du = (cell * 0.5) / hw;
      for (let u = -outer; u <= outer + 1e-6; u += du) {
        const x = px + nx * u * hw;
        const y = py + ny * u * hw;
        put(Math.floor(x / cell), Math.floor(y / cell), u / outer <= 0 ? u : u, u >= 0 ? 1 : -1, i);
      }
    }
  }

  // --- classify -----------------------------------------------------------
  const colorOf = (r: Rec): PaletteKey => {
    const hw = g.hw[r.i]!;
    const nx = g.nx[r.i]!;
    const ny = g.ny[r.i]!;
    // outward direction on this side; "shaded" = pointing down / right
    const shaded = r.side * nx + r.side * ny > 0;
    if (r.u > 1) return shaded ? "bankShadow" : "bankMid";
    if (r.u > 0.84 && shaded) return "waterDeep";
    if (r.u > 0.88 && !shaded) return "waterLight";
    if (r.u > 0.6 && shaded && hash(r.i * 7.3 + r.u * 40) > 0.86) return "waterDeep";
    return "waterBase";
  };

  const painted = new Map<number, number>();
  let waterCells = 0;
  for (const [k, r] of cells) {
    const c = colorOf(r);
    if (c !== "bankShadow" && c !== "bankMid") waterCells++;
    painted.set(k, ORDER.indexOf(c));
  }

  // --- cleanup: drop 1px spikes, fill 1px holes ---------------------------
  const nb = (k: number) => {
    let count = 0;
    if (painted.has(k - 1)) count++;
    if (painted.has(k + 1)) count++;
    if (painted.has(k - KX)) count++;
    if (painted.has(k + KX)) count++;
    return count;
  };
  const spikes: number[] = [];
  for (const k of painted.keys()) if (nb(k) <= 1) spikes.push(k);
  for (const k of spikes) painted.delete(k);
  const holes: [number, number][] = [];
  for (const [k, c] of painted) {
    for (const d of [1, -1, KX, -KX]) {
      const h = k + d;
      if (painted.has(h)) continue;
      if (nb(h) >= 3) holes.push([h, c]);
    }
  }
  for (const [k, c] of holes) if (!painted.has(k)) painted.set(k, c);

  // --- pack into sorted rows ---------------------------------------------
  const byRow = new Map<number, [number, number][]>();
  for (const [k, c] of painted) {
    const gy = Math.floor(k / KX) - 32768;
    const gx = (k % KX) - 32768;
    let arr = byRow.get(gy);
    if (!arr) byRow.set(gy, (arr = []));
    arr.push([gx, c]);
  }
  const rows = new Map<number, Row>();
  for (const [gy, arr] of byRow) {
    arr.sort((a, b) => a[0] - b[0]);
    const xs = new Int32Array(arr.length);
    const cs = new Uint8Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      xs[i] = arr[i]![0];
      cs[i] = arr[i]![1];
    }
    rows.set(gy, { xs, cs });
  }

  const mask: Mask = { cell, rows, waterCells, clusters: [] };
  mask.clusters = buildClusters(id, g, mask);
  MASKS.set(key, mask);
  return mask;
}

/** Deterministic, flow-aligned highlight clusters. */
function buildClusters(id: string, g: CenterGeom, mask: Mask): Cluster[] {
  const { density, lenMin, lenMax } = riverConfig;
  const avgLen = (lenMin + lenMax) / 2;
  const target = Math.max(0, Math.round((mask.waterCells * density) / avgLen));
  const n = g.pts.length;
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 9973;

  const out: Cluster[] = [];
  for (let c = 0; c < target; c++) {
    const h1 = hash(seed + c * 3.11);
    const h2 = hash(seed + c * 7.53 + 1.7);
    const h3 = hash(seed + c * 11.9 + 4.2);
    const h4 = hash(seed + c * 5.27 + 9.1);
    const i = Math.min(n - 2, Math.floor(h1 * (n - 2)));
    // curvature: bends get slightly more activity on the outer side
    const j = Math.min(n - 1, i + 3);
    const curl = g.nx[i]! * g.ny[j]! - g.ny[i]! * g.nx[j]!;
    const bend = Math.min(1, Math.abs(curl) * 6);
    if (h4 > 0.35 + bend * 0.4) continue;
    const side = curl >= 0 ? 1 : -1;
    const v = (h2 * 1.5 - 0.75) * (1 - bend * 0.3) + side * bend * 0.15;
    out.push({
      i,
      v: Math.max(-0.78, Math.min(0.78, v)),
      len: Math.round(lenMin + h3 * (lenMax - lenMin)),
      phase: Math.floor(h2 * 4),
      foam: bend > 0.55 && h3 > 0.82,
      thickEnd: h1 > 0.7,
    });
  }
  return out;
}

/* ------------------------------ drawing ---------------------------------- */

/** Static banks + water body. Cheap: only the rows inside the view are drawn. */
export function drawRiverPixels(
  ctx: CanvasRenderingContext2D,
  id: string,
  g: CenterGeom,
  view: { x: number; y: number; w: number; h: number },
) {
  const mask = buildMask(id, g);
  const cell = mask.cell;
  const gy0 = Math.floor((view.y - cell) / cell);
  const gy1 = Math.ceil((view.y + view.h + cell) / cell);
  const gx0 = Math.floor((view.x - cell) / cell);
  const gx1 = Math.ceil((view.x + view.w + cell) / cell);
  const pal = riverConfig.palette;

  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  // one fill pass per colour keeps state changes down
  for (let ci = 0; ci < ORDER.length; ci++) {
    ctx.fillStyle = pal[ORDER[ci]!];
    let started = false;
    for (let gy = gy0; gy <= gy1; gy++) {
      const row = mask.rows.get(gy);
      if (!row) continue;
      const y = gy * cell;
      for (let k = 0; k < row.xs.length; k++) {
        if (row.cs[k] !== ci) continue;
        const gx = row.xs[k]!;
        if (gx < gx0 || gx > gx1) continue;
        // merge horizontal runs of the same colour into one rect
        let run = 1;
        while (
          k + run < row.xs.length &&
          row.cs[k + run] === ci &&
          row.xs[k + run] === gx + run
        )
          run++;
        ctx.fillRect(gx * cell, y, cell * run, cell);
        k += run - 1;
        started = true;
      }
    }
    void started;
  }
  ctx.imageSmoothingEnabled = prev;
}

/**
 * Sparse highlight clusters. `frame` is the global discrete pulse index; each
 * cluster offsets it by its own phase so they never flash together.
 */
export function drawRiverHighlights(
  ctx: CanvasRenderingContext2D,
  id: string,
  g: CenterGeom,
  view: { x: number; y: number; w: number; h: number },
  frame: number,
) {
  const mask = buildMask(id, g);
  const cell = mask.cell;
  const pal = riverConfig.palette;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  for (const cl of mask.clusters) {
    const i = cl.i;
    const p = g.pts[i]!;
    if (p[0] < view.x - 40 || p[0] > view.x + view.w + 40) continue;
    if (p[1] < view.y - 40 || p[1] > view.y + view.h + 40) continue;

    const f = riverConfig.animate ? (frame + cl.phase) & 3 : 0;
    if (f === 3) continue; // absent beat
    const len = f === 1 ? cl.len + 1 : cl.len;
    const broken = f === 2;

    const hw = g.hw[i]!;
    // tangent = normal rotated 90 degrees
    const tx = g.ny[i]!;
    const ty = -g.nx[i]!;
    const ox = p[0] + g.nx[i]! * cl.v * hw;
    const oy = p[1] + g.ny[i]! * cl.v * hw;

    ctx.fillStyle = cl.foam ? pal.foamHighlight : pal.waterLight;
    for (let s = 0; s < len; s++) {
      if (broken && s % 2 === 1 && s > len / 2) continue;
      const x = ox + tx * s * cell;
      const y = oy + ty * s * cell;
      // stay off the banks
      const dx = x - p[0];
      const dy = y - p[1];
      const u = Math.abs(dx * g.nx[i]! + dy * g.ny[i]!) / hw;
      if (u > 0.86) continue;
      const gx = Math.floor(x / cell) * cell;
      const gy = Math.floor(y / cell) * cell;
      ctx.fillRect(gx, gy, cell, cell);
      if (cl.thickEnd && s === len - 1) ctx.fillRect(gx, gy - cell, cell, cell);
    }
  }
  ctx.imageSmoothingEnabled = prev;
}

/** Discrete pulse index from a seconds clock. */
export function riverFrame(seconds: number) {
  return Math.floor(seconds * riverConfig.fps);
}

/** Ring centreline (city moat) expressed as a CenterGeom. */
export function ringGeom(
  cx: number,
  cy: number,
  radiusAt: (a: number) => number,
  halfWidth: number,
  steps = 360,
): CenterGeom {
  const pts: [number, number][] = [];
  const nx: number[] = [];
  const ny: number[] = [];
  const hw: number[] = [];
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 2 - Math.PI;
    const r = radiusAt(a);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    nx.push(Math.cos(a));
    ny.push(Math.sin(a));
    hw.push(halfWidth);
  }
  return { pts, nx, ny, hw };
}

import { WORLD_H, WORLD_W, blockedAt } from "./data";

export interface WalkPoint {
  x: number;
  y: number;
}

const GRID = 24;
const PAD = 12;
const MAX_VISITED = 60_000;

interface HeapNode {
  key: number;
  score: number;
}

class MinHeap {
  private values: HeapNode[] = [];

  get size() {
    return this.values.length;
  }

  push(node: HeapNode) {
    const values = this.values;
    values.push(node);
    let index = values.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (values[parent]!.score <= node.score) break;
      values[index] = values[parent]!;
      index = parent;
    }
    values[index] = node;
  }

  pop(): HeapNode | undefined {
    const values = this.values;
    const root = values[0];
    const tail = values.pop();
    if (!root || !tail || values.length === 0) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= values.length) break;
      const right = left + 1;
      let child = left;
      if (right < values.length && values[right]!.score < values[left]!.score) child = right;
      if (values[child]!.score >= tail.score) break;
      values[index] = values[child]!;
      index = child;
    }
    values[index] = tail;
    return root;
  }
}

const COLS = Math.floor(WORLD_W / GRID) + 1;
const ROWS = Math.floor(WORLD_H / GRID) + 1;

function pointFor(key: number): WalkPoint {
  const gx = key % COLS;
  const gy = Math.floor(key / COLS);
  return { x: Math.min(WORLD_W, gx * GRID), y: Math.min(WORLD_H, gy * GRID) };
}

function keyFor(gx: number, gy: number) {
  return gy * COLS + gx;
}

function nearestOpenKey(x: number, y: number): number | null {
  const baseX = Math.max(0, Math.min(COLS - 1, Math.round(x / GRID)));
  const baseY = Math.max(0, Math.min(ROWS - 1, Math.round(y / GRID)));
  let best: number | null = null;
  let bestDistance = Infinity;
  for (let radius = 0; radius <= 4; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const gx = baseX + dx;
        const gy = baseY + dy;
        if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) continue;
        const key = keyFor(gx, gy);
        const point = pointFor(key);
        if (blockedAt(point.x, point.y, PAD)) continue;
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < bestDistance) {
          best = key;
          bestDistance = distance;
        }
      }
    }
    if (best !== null) return best;
  }
  return null;
}

function octile(ax: number, ay: number, bx: number, by: number) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function compress(points: WalkPoint[]) {
  if (points.length < 3) return points;
  const out: WalkPoint[] = [points[0]!];
  let lastDx = Math.sign(points[1]!.x - points[0]!.x);
  let lastDy = Math.sign(points[1]!.y - points[0]!.y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const dx = Math.sign(points[i + 1]!.x - points[i]!.x);
    const dy = Math.sign(points[i + 1]!.y - points[i]!.y);
    if (dx !== lastDx || dy !== lastDy) out.push(points[i]!);
    lastDx = dx;
    lastDy = dy;
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * Build a collision-aware walking route on the same geometry used by movement.
 * It is calculated only after direct walking is blocked, so ordinary movement
 * remains allocation-free. The 24-unit grid is narrow enough to find every
 * authored bridge deck while keeping worst-case searches small.
 */
export function findWalkPath(sx: number, sy: number, tx: number, ty: number): WalkPoint[] | null {
  const start = nearestOpenKey(sx, sy);
  const goal = nearestOpenKey(tx, ty);
  if (start === null || goal === null) return null;
  if (start === goal) return blockedAt(tx, ty, PAD) ? [] : [{ x: tx, y: ty }];

  const total = COLS * ROWS;
  const gScore = new Float64Array(total);
  gScore.fill(Infinity);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);
  const closed = new Uint8Array(total);
  const open = new MinHeap();

  const goalX = goal % COLS;
  const goalY = Math.floor(goal / COLS);
  gScore[start] = 0;
  {
    const sxg = start % COLS;
    const syg = Math.floor(start / COLS);
    open.push({ key: start, score: octile(sxg, syg, goalX, goalY) });
  }

  const directions = [
    [-1, 0, 1],
    [1, 0, 1],
    [0, -1, 1],
    [0, 1, 1],
    [-1, -1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [1, 1, Math.SQRT2],
  ] as const;

  let visited = 0;
  while (open.size > 0 && visited < MAX_VISITED) {
    const current = open.pop()!;
    if (closed[current.key]) continue;
    if (current.key === goal) {
      const reversed: WalkPoint[] = [];
      let cursor = goal;
      while (cursor !== start && cursor >= 0) {
        reversed.push(pointFor(cursor));
        cursor = cameFrom[cursor]!;
      }
      reversed.reverse();
      const points = compress(reversed);
      if (!blockedAt(tx, ty, PAD)) points.push({ x: tx, y: ty });
      return points;
    }

    closed[current.key] = 1;
    visited += 1;
    const cx = current.key % COLS;
    const cy = Math.floor(current.key / COLS);

    for (const [dx, dy, cost] of directions) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const neighbour = keyFor(nx, ny);
      if (closed[neighbour]) continue;
      const point = pointFor(neighbour);
      if (blockedAt(point.x, point.y, PAD)) continue;

      // Do not cut diagonally through the corner of a building or river bank.
      if (dx !== 0 && dy !== 0) {
        const horizontal = pointFor(keyFor(cx + dx, cy));
        const vertical = pointFor(keyFor(cx, cy + dy));
        if (blockedAt(horizontal.x, horizontal.y, PAD) || blockedAt(vertical.x, vertical.y, PAD)) continue;
      }

      const tentative = gScore[current.key]! + cost;
      if (tentative >= gScore[neighbour]!) continue;
      cameFrom[neighbour] = current.key;
      gScore[neighbour] = tentative;
      open.push({ key: neighbour, score: tentative + octile(nx, ny, goalX, goalY) });
    }
  }

  return null;
}

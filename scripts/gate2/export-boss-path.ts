import { WORLD_H, WORLD_W, blockedAt } from "../../src/game/data";

const SEED = 0x0de5;
const CLEARANCE = 26;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function walkable(x: number, y: number) {
  return x > 60 && y > 60 && x < WORLD_W - 60 && y < WORLD_H - 60 && !blockedAt(x, y, CLEARANCE);
}

function clearLine(ax: number, ay: number, bx: number, by: number) {
  const distance = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(2, Math.ceil(distance / 14));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (!walkable(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

const random = mulberry32(SEED);
let startX = WORLD_W * 0.5;
let startY = WORLD_H * 0.5;
for (let i = 0; i < 4000 && !walkable(startX, startY); i += 1) {
  startX = 100 + random() * (WORLD_W - 200);
  startY = 100 + random() * (WORLD_H - 200);
}

const points: [number, number][] = [[startX, startY]];
for (let i = 0; i < 90; i += 1) {
  const [currentX, currentY] = points.at(-1)!;
  let placed = false;
  for (let attempt = 0; attempt < 90 && !placed; attempt += 1) {
    const reach = 720 - Math.min(500, attempt * 8);
    const angle = random() * Math.PI * 2;
    const distance = 220 + random() * reach;
    const nextX = currentX + Math.cos(angle) * distance;
    const nextY = currentY + Math.sin(angle) * distance;
    if (!walkable(nextX, nextY) || !clearLine(currentX, currentY, nextX, nextY)) continue;
    points.push([nextX, nextY]);
    placed = true;
  }
  if (!placed) break;
}

const loop = points.concat(points.slice(0, -1).reverse());
process.stdout.write(`${JSON.stringify(loop.map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))]))}\n`);

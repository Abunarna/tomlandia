// XP(level) = 100 * 1.15^level  -> xp required to advance from `level` to `level+1`
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.15, level));
}

export function levelFromXp(xp: number): { level: number; into: number; need: number; progress: number } {
  let level = 1;
  let remaining = xp;
  let need = xpForLevel(level);
  while (remaining >= need && level < 500) {
    remaining -= need;
    level += 1;
    need = xpForLevel(level);
  }
  return { level, into: Math.floor(remaining), need, progress: Math.min(1, remaining / need) };
}

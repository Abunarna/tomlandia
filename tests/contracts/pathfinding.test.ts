import { describe, expect, test } from "bun:test";
import { blockedAt } from "../../src/game/data";
import { findWalkPath } from "../../src/game/pathfinding";

describe("collision-aware walking", () => {
  test("routes the starter-town approach around blocked terrain", () => {
    const route = findWalkPath(1143, 2169, 1394, 2176);
    expect(route).not.toBeNull();
    expect(route!.length).toBeGreaterThan(1);
    expect(route!.every((point) => !blockedAt(point.x, point.y, 12))).toBe(true);
    expect(route!.at(-1)).toEqual({ x: 1394, y: 2176 });
  });

  test("keeps a clear nearby walk direct", () => {
    const route = findWalkPath(1064, 2195, 1088, 2195);
    expect(route).not.toBeNull();
    expect(route!.at(-1)).toEqual({ x: 1088, y: 2195 });
  });
});

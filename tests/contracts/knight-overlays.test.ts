import { describe, expect, it } from "vitest";
import { KNIGHT_ANIMS, OVERLAY_PATHS, type KnightAnim } from "@/game/knight";

const urls = [...Object.values(OVERLAY_PATHS.armor), ...Object.values(OVERLAY_PATHS.weapon)].filter(
  (u): u is string => typeof u === "string",
);

describe("knight overlay registry", () => {
  it("registers no speculative /knight/* paths", () => {
    for (const url of urls) expect(url.startsWith("/knight/")).toBe(false);
  });

  it("registers no armour overlays", () => {
    expect(Object.keys(OVERLAY_PATHS.armor)).toHaveLength(0);
  });

  it("registers only the three bundled weapon overlays", () => {
    expect(Object.keys(OVERLAY_PATHS.weapon).sort()).toEqual(["attack", "idle", "walk"]);
    for (const url of Object.values(OVERLAY_PATHS.weapon)) {
      expect(url).toMatch(/_weapon_strip\.png/);
    }
  });

  it("keeps every animation renderable from its base strip", () => {
    for (const anim of Object.keys(KNIGHT_ANIMS) as KnightAnim[]) {
      expect(KNIGHT_ANIMS[anim].url).toBeTruthy();
    }
  });
});

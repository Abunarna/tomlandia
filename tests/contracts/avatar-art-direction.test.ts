import { describe, expect, test } from "bun:test";
import { RELEASE_TIERS } from "../../src/generated/release-catalog";
import { AVATAR_TIER_ART_DIRECTION } from "../../src/game/avatar-art-direction";

describe("avatar item art direction", () => {
  test("defines two pre-generation keywords for every release tier and item type", () => {
    expect(
      AVATAR_TIER_ART_DIRECTION.map(({ tier, material }) => ({
        tier_index: tier,
        theme: material,
      })),
    ).toEqual(RELEASE_TIERS.map(({ tier_index, theme }) => ({ tier_index, theme })));

    for (const direction of AVATAR_TIER_ART_DIRECTION) {
      expect(direction.materialKeywords).toHaveLength(2);
      expect(direction.heavyArmourKeywords).toHaveLength(2);
      expect(direction.lightArmourKeywords).toHaveLength(2);
      expect(direction.swordKeywords).toHaveLength(2);
    }
  });
});

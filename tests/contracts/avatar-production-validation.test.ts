import { describe, expect, test } from "bun:test";
import { referenceAvatarManifest } from "../../src/game/avatar-reference-manifest";
import { validateAvatarProductionAssets } from "../../src/game/avatar-production-validation";

describe("avatar production artwork gates", () => {
  test("allows geometry proofs only while a pack remains reference status", () => {
    expect(validateAvatarProductionAssets(referenceAvatarManifest)).toEqual([]);
  });

  test("rejects promoting shared proofs as custom production artwork", () => {
    const issues = validateAvatarProductionAssets({
      ...referenceAvatarManifest,
      status: "production",
    });
    expect(issues.some(({ message }) => message.includes("geometry-proof"))).toBe(true);
    expect(issues.some(({ field }) => field.startsWith("male armour."))).toBe(true);
    expect(issues.some(({ field }) => field.startsWith("female armour."))).toBe(true);
    expect(issues.some(({ field }) => field.startsWith("weapon fronts."))).toBe(true);
    expect(issues.some(({ field }) => field.startsWith("weapon backs."))).toBe(true);
  });

  test("rejects one armour image reused for both models", () => {
    const [first, ...rest] = referenceAvatarManifest.armour;
    if (!first) throw new Error("Reference manifest must include armour");
    const issues = validateAvatarProductionAssets({
      ...referenceAvatarManifest,
      status: "production",
      armour: [{ ...first, urls: { male: first.urls.male, female: first.urls.male } }, ...rest],
    });
    expect(
      issues.some(
        ({ field, message }) =>
          field === `armour.${first.id}` && message.includes("separate male and female"),
      ),
    ).toBe(true);
  });

  test("requires every production sword to contain both grip slices", () => {
    const [first, ...rest] = referenceAvatarManifest.weapons;
    if (!first) throw new Error("Reference manifest must include a weapon");
    const issues = validateAvatarProductionAssets({
      ...referenceAvatarManifest,
      status: "production",
      weapons: [{ ...first, backUrl: undefined }, ...rest],
    });
    expect(
      issues.some(
        ({ field, message }) =>
          field === `weapons.${first.id}` && message.includes("rear and front"),
      ),
    ).toBe(true);
  });
});

import type { AvatarAssetManifest, AvatarModel, AvatarValidationIssue } from "./player-avatar";

export type AvatarCatalogueExpectation = {
  armourIds: readonly string[];
  weaponIds: readonly string[];
  facesPerModel: number;
  hairstyles: number;
  tiers: number;
};

const compareIds = (
  field: string,
  actual: readonly string[],
  expected: readonly string[],
): AvatarValidationIssue[] => {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const issues: AvatarValidationIssue[] = [];
  const missing = expected.filter((id) => !actualSet.has(id));
  const unknown = actual.filter((id) => !expectedSet.has(id));
  if (missing.length) issues.push({ field, message: `Missing IDs: ${missing.join(", ")}.` });
  if (unknown.length) issues.push({ field, message: `Unknown IDs: ${unknown.join(", ")}.` });
  if (actual.length !== actualSet.size) {
    issues.push({ field, message: `${field} contains duplicate IDs.` });
  }
  return issues;
};

/** Validates completeness against gameplay content without copying its IDs into avatar code. */
export function validateAvatarCatalogue(
  manifest: AvatarAssetManifest,
  expected: AvatarCatalogueExpectation,
): AvatarValidationIssue[] {
  const issues = [
    ...compareIds(
      "armour",
      manifest.armour.map((entry) => entry.id),
      expected.armourIds,
    ),
    ...compareIds(
      "weapons",
      manifest.weapons.map((entry) => entry.id),
      expected.weaponIds,
    ),
  ];

  for (const model of ["male", "female"] as const satisfies readonly AvatarModel[]) {
    const count = manifest.faces.filter((face) => face.model === model).length;
    if (count !== expected.facesPerModel) {
      issues.push({
        field: "faces",
        message: `Expected ${expected.facesPerModel} ${model} faces, found ${count}.`,
      });
    }
  }
  if (manifest.hairstyles.length !== expected.hairstyles) {
    issues.push({
      field: "hairstyles",
      message: `Expected ${expected.hairstyles} hairstyles, found ${manifest.hairstyles.length}.`,
    });
  }

  const armourByTier = new Map<number, number>();
  for (const entry of manifest.armour) {
    armourByTier.set(entry.tier, (armourByTier.get(entry.tier) ?? 0) + 1);
    for (const model of ["male", "female"] as const) {
      if (!entry.urls[model]) {
        issues.push({ field: `armour.${entry.id}`, message: `Missing ${model} artwork URL.` });
      }
    }
  }
  const weaponsByTier = new Map<number, number>();
  for (const entry of manifest.weapons) {
    weaponsByTier.set(entry.tier, (weaponsByTier.get(entry.tier) ?? 0) + 1);
    if (!entry.frontUrl) {
      issues.push({ field: `weapons.${entry.id}`, message: "Missing front weapon artwork URL." });
    }
  }
  for (let tier = 1; tier <= expected.tiers; tier++) {
    if (armourByTier.get(tier) !== 2) {
      issues.push({
        field: "armour",
        message: `Tier ${tier} must contain heavy and light armour.`,
      });
    }
    if (weaponsByTier.get(tier) !== 1) {
      issues.push({ field: "weapons", message: `Tier ${tier} must contain exactly one sword.` });
    }
  }
  return issues;
}

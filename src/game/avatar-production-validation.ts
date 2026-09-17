import {
  avatarManifestUrls,
  type AvatarAssetManifest,
  type AvatarValidationIssue,
} from "./player-avatar";

const duplicateUrlIssues = (
  field: string,
  entries: readonly { id: string; url: string }[],
): AvatarValidationIssue[] => {
  const firstId = new Map<string, string>();
  const issues: AvatarValidationIssue[] = [];
  for (const entry of entries) {
    const previous = firstId.get(entry.url);
    if (previous) {
      issues.push({
        field: `${field}.${entry.id}`,
        message: `Production artwork URL is shared with ${previous}; each ${field} entry needs custom artwork.`,
      });
    } else {
      firstId.set(entry.url, entry.id);
    }
  }
  return issues;
};

/** Extra gates which apply only when a pack requests production status. */
export function validateAvatarProductionAssets(
  manifest: AvatarAssetManifest,
): AvatarValidationIssue[] {
  if (manifest.status !== "production") return [];

  const issues: AvatarValidationIssue[] = [];
  for (const url of avatarManifestUrls(manifest)) {
    if (url.includes("/reference/")) {
      issues.push({
        field: "status",
        message: `Production packs cannot depend on geometry-proof artwork (${url}).`,
      });
    }
  }

  issues.push(
    ...duplicateUrlIssues(
      "faces",
      manifest.faces.map(({ id, url }) => ({ id, url })),
    ),
    ...duplicateUrlIssues(
      "hairstyles",
      manifest.hairstyles.map(({ id, url }) => ({ id, url })),
    ),
    ...duplicateUrlIssues(
      "male armour",
      manifest.armour.map(({ id, urls }) => ({ id, url: urls.male })),
    ),
    ...duplicateUrlIssues(
      "female armour",
      manifest.armour.map(({ id, urls }) => ({ id, url: urls.female })),
    ),
    ...duplicateUrlIssues(
      "weapon fronts",
      manifest.weapons.map(({ id, frontUrl }) => ({ id, url: frontUrl })),
    ),
    ...duplicateUrlIssues(
      "weapon backs",
      manifest.weapons.flatMap(({ id, backUrl }) => (backUrl ? [{ id, url: backUrl }] : [])),
    ),
  );

  for (const armour of manifest.armour) {
    if (armour.urls.male === armour.urls.female) {
      issues.push({
        field: `armour.${armour.id}`,
        message: "Production armour requires separate male and female artwork URLs.",
      });
    }
  }
  for (const weapon of manifest.weapons) {
    if (!weapon.backUrl) {
      issues.push({
        field: `weapons.${weapon.id}`,
        message: "Every production sword requires rear and front slices around the fixed grip.",
      });
    }
  }
  return issues;
}

export function assertAvatarProductionAssets(manifest: AvatarAssetManifest): void {
  const issues = validateAvatarProductionAssets(manifest);
  if (issues.length) {
    throw new Error(issues.map(({ field, message }) => `${field}: ${message}`).join("\n"));
  }
}

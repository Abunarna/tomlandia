import { z } from "zod";
import {
  assertAvatarManifest,
  avatarManifestUrls,
  type AvatarAssetManifest,
} from "./player-avatar";
import { assertAvatarProductionAssets } from "./avatar-production-validation";

const model = z.enum(["male", "female"]);
const body = z.object({ skinUrl: z.string().min(1), modestyUrl: z.string().min(1) });
const manifestSchema = z.object({
  version: z.literal(1),
  status: z.enum(["reference", "production"]),
  registration: z.object({
    width: z.literal(384),
    height: z.literal(384),
    pivotX: z.number(),
    footY: z.number(),
    masks: z.object({
      bodyMale: z.string().min(1),
      bodyFemale: z.string().min(1),
      face: z.string().min(1),
      hair: z.string().min(1),
      neckSeam: z.string().min(1),
      gripSocket: z.string().min(1),
      weapon: z.string().min(1),
    }),
  }),
  bodies: z.object({ male: body, female: body }),
  faces: z.array(
    z.object({ id: z.string().min(1), model, url: z.string().min(1), label: z.string().min(1) }),
  ),
  hairstyles: z.array(
    z.object({
      id: z.string().min(1),
      models: z.array(model).min(1),
      url: z.string().min(1),
      label: z.string().min(1),
    }),
  ),
  armour: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      tier: z.number().int().positive(),
      tint: z.string().optional(),
      urls: z.object({ male: z.string().min(1), female: z.string().min(1) }),
    }),
  ),
  weapons: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      tier: z.number().int().positive(),
      tint: z.string().optional(),
      backUrl: z.string().min(1).optional(),
      frontUrl: z.string().min(1),
    }),
  ),
  activities: z.array(
    z.object({
      id: z.enum(["idle", "walk", "attack", "mine", "chop", "fish", "loot"]),
      label: z.string().min(1),
      glyph: z.string(),
    }),
  ),
});

function assertAvatarPath(url: string, kind: "manifest" | "asset") {
  const parsed = new URL(url, "http://avatar.local");
  if (parsed.origin !== "http://avatar.local" || !parsed.pathname.startsWith("/assets/avatar/")) {
    throw new Error(`Avatar ${kind} URL must be a same-origin path under /assets/avatar/.`);
  }
  if (kind === "manifest" && !parsed.pathname.endsWith(".json")) {
    throw new Error(`Avatar manifest URL must end with .json.`);
  }
}

export function parseAvatarManifest(value: unknown): AvatarAssetManifest {
  const result = manifestSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid avatar manifest:\n${details}`);
  }
  const manifest = result.data satisfies AvatarAssetManifest;
  for (const url of avatarManifestUrls(manifest)) assertAvatarPath(url, "asset");
  assertAvatarManifest(manifest);
  assertAvatarProductionAssets(manifest);
  return manifest;
}

export async function loadAvatarManifest(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<AvatarAssetManifest> {
  assertAvatarPath(url, "manifest");
  const response = await fetcher(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Avatar manifest failed to load from ${url} (${response.status}).`);
  }
  return parseAvatarManifest(await response.json());
}

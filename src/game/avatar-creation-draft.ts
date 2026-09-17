import { z } from "zod";
import type { AvatarAssetManifest, CharacterAppearance } from "./player-avatar";

export const AVATAR_DRAFT_STORAGE_KEY = "tomlandia.avatar-draft.v1";

export type CharacterCreationDraft = {
  version: 1;
  name: string;
  appearance: CharacterAppearance;
};

const colour = z.string().regex(/^#[0-9a-f]{6}$/i, "Expected a six-digit hex colour");
const draftSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(18),
  appearance: z.object({
    bodyType: z.enum(["male", "female"]),
    faceVariant: z.string().min(1),
    skinTone: colour,
    hairStyle: z.string().min(1),
    hairColor: colour,
  }),
});

export function parseCharacterCreationDraft(
  value: unknown,
  manifest: AvatarAssetManifest,
): CharacterCreationDraft {
  const draft = draftSchema.parse(value);
  const face = manifest.faces.find(({ id }) => id === draft.appearance.faceVariant);
  if (!face || face.model !== draft.appearance.bodyType) {
    throw new Error("Draft face is not compatible with its body model");
  }
  const hair = manifest.hairstyles.find(({ id }) => id === draft.appearance.hairStyle);
  if (!hair || !hair.models.includes(draft.appearance.bodyType)) {
    throw new Error("Draft hairstyle is not compatible with its body model");
  }
  return draft;
}

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadCharacterCreationDraft(
  storage: DraftStorage,
  manifest: AvatarAssetManifest,
): CharacterCreationDraft | null {
  const raw = storage.getItem(AVATAR_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return parseCharacterCreationDraft(JSON.parse(raw), manifest);
  } catch {
    storage.removeItem(AVATAR_DRAFT_STORAGE_KEY);
    return null;
  }
}

export function saveCharacterCreationDraft(
  storage: DraftStorage,
  manifest: AvatarAssetManifest,
  draft: CharacterCreationDraft,
): void {
  const checked = parseCharacterCreationDraft(draft, manifest);
  storage.setItem(AVATAR_DRAFT_STORAGE_KEY, JSON.stringify(checked));
}

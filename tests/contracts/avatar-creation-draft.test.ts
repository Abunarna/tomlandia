import { describe, expect, test } from "bun:test";
import {
  AVATAR_DRAFT_STORAGE_KEY,
  loadCharacterCreationDraft,
  parseCharacterCreationDraft,
  saveCharacterCreationDraft,
  type CharacterCreationDraft,
} from "../../src/game/avatar-creation-draft";
import { referenceAvatarManifest } from "../../src/game/avatar-reference-manifest";

const validDraft: CharacterCreationDraft = {
  version: 1,
  name: " Rowan ",
  appearance: {
    bodyType: "female",
    faceVariant: "female-face-1",
    skinTone: "#dca77e",
    hairStyle: "hair-bob",
    hairColor: "#35251e",
  },
};

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set(AVATAR_DRAFT_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("character creation drafts", () => {
  test("normalises, saves, and reloads a manifest-compatible draft", () => {
    const storage = memoryStorage();
    saveCharacterCreationDraft(storage, referenceAvatarManifest, validDraft);
    expect(loadCharacterCreationDraft(storage, referenceAvatarManifest)?.name).toBe("Rowan");
  });

  test("rejects a face belonging to the other body model", () => {
    expect(() =>
      parseCharacterCreationDraft(
        { ...validDraft, appearance: { ...validDraft.appearance, faceVariant: "male-face-1" } },
        referenceAvatarManifest,
      ),
    ).toThrow("not compatible");
  });

  test("removes corrupt or obsolete browser data", () => {
    const storage = memoryStorage('{"version":99}');
    expect(loadCharacterCreationDraft(storage, referenceAvatarManifest)).toBeNull();
    expect(storage.getItem(AVATAR_DRAFT_STORAGE_KEY)).toBeNull();
  });
});

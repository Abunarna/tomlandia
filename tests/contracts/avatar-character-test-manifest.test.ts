import { describe, expect, test } from "bun:test";
import { characterTestAvatarManifest } from "../../src/game/avatar-character-test-manifest";
import { referenceAvatarManifest } from "../../src/game/avatar-reference-manifest";
import { validateAvatarManifest } from "../../src/game/player-avatar";

describe("character test avatar manifest", () => {
  test("reviews every fitted candidate face and hairstyle on stable bodies", () => {
    expect(validateAvatarManifest(characterTestAvatarManifest)).toEqual([]);
    expect(characterTestAvatarManifest.faces).toHaveLength(8);
    expect(characterTestAvatarManifest.hairstyles).toHaveLength(10);
    expect(characterTestAvatarManifest.bodies).toBe(referenceAvatarManifest.bodies);

    for (const entry of [
      ...characterTestAvatarManifest.faces,
      ...characterTestAvatarManifest.hairstyles,
    ]) {
      expect(entry.url).toStartWith("/assets/avatar/candidate-v1/review/");
    }
  });
});

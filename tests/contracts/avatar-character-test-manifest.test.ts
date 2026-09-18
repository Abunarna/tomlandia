import { describe, expect, test } from "bun:test";
import { characterTestAvatarManifest } from "../../src/game/avatar-character-test-manifest";
import { validateAvatarManifest } from "../../src/game/player-avatar";

describe("character test avatar manifest", () => {
  test("reviews the registered body pair with every fitted candidate face and hairstyle", () => {
    expect(validateAvatarManifest(characterTestAvatarManifest)).toEqual([]);
    expect(characterTestAvatarManifest.faces).toHaveLength(8);
    expect(characterTestAvatarManifest.hairstyles).toHaveLength(10);
    expect(characterTestAvatarManifest.bodies).toEqual({
      male: {
        skinUrl: "/assets/avatar/candidate-v1/review/body-male-grayscale-skin-deterministic-v4.png",
        modestyUrl: "/assets/avatar/candidate-v1/review/body-male-modesty-deterministic.png",
      },
      female: {
        skinUrl: "/assets/avatar/candidate-v1/review/body-female-grayscale-skin.png",
        modestyUrl: "/assets/avatar/candidate-v1/review/body-female-modesty-deterministic.png",
      },
    });

    for (const entry of [
      ...characterTestAvatarManifest.faces,
      ...characterTestAvatarManifest.hairstyles,
    ]) {
      expect(entry.url).toStartWith("/assets/avatar/candidate-v1/review/");
    }
  });
});

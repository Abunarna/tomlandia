import { describe, expect, test } from "bun:test";
import { characterTestAvatarManifest } from "../../src/game/avatar-character-test-manifest";
import { deriveAvatarLabSelection } from "../../src/game/avatar-lab-selection";

describe("Avatar Lab manifest selection", () => {
  test("uses registered candidate IDs rather than inferred face names", () => {
    const selection = deriveAvatarLabSelection(characterTestAvatarManifest, { model: "female" });
    expect(selection.face).toBe("female-face-warm");
    expect(selection.hair).toBe("hair-adventurer-crop");
  });

  test("preserves compatible selections and replaces model-incompatible ones", () => {
    const femaleOnlyHair = {
      ...characterTestAvatarManifest,
      hairstyles: characterTestAvatarManifest.hairstyles.map((entry, index) =>
        index === 0 ? { ...entry, models: ["female"] as const } : entry,
      ),
    };
    const selection = deriveAvatarLabSelection(femaleOnlyHair, {
      model: "male",
      face: "female-face-warm",
      hair: "hair-adventurer-crop",
      armour: "copper_light_armor",
      weapon: "copper_sword",
      activity: "attack",
    });
    expect(selection.face).toBe("male-face-steadfast");
    expect(selection.hair).toBe("hair-ranger-layers");
    expect(selection.armour).toBe("copper_light_armor");
    expect(selection.weapon).toBe("copper_sword");
    expect(selection.activity).toBe("attack");
  });
});

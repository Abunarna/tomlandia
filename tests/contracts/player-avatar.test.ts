import { describe, expect, test } from "bun:test";

import {
  assertAvatarImageDimensions,
  assertAvatarManifest,
  assertAvatarPixelAlpha,
  assertAvatarVisualState,
  avatarManifestUrls,
  type AvatarAssetManifest,
  type PlayerVisualState,
} from "../../src/game/player-avatar";
import {
  AVATAR_REGISTRATION_MAP,
  avatarBoundaryMaskUrls,
  pixelsOutsideBoundary,
  pixelsOutsideMask,
  pointInBoundary,
} from "../../src/game/avatar-registration";
import { validateAvatarCatalogue } from "../../src/game/avatar-catalogue-validation";
import { loadAvatarManifest, parseAvatarManifest } from "../../src/game/avatar-manifest-loader";

const manifest: AvatarAssetManifest = {
  version: 1,
  status: "reference",
  registration: {
    width: 384,
    height: 384,
    pivotX: 192,
    footY: 300,
    masks: {
      bodyMale: "/assets/avatar/masks/body-male.png",
      bodyFemale: "/assets/avatar/masks/body-female.png",
      face: "/assets/avatar/masks/face.png",
      hair: "/assets/avatar/masks/hair.png",
      neckSeam: "/assets/avatar/masks/neck.png",
      gripSocket: "/assets/avatar/masks/grip.png",
      weapon: "/assets/avatar/masks/weapon.png",
    },
  },
  bodies: {
    male: {
      skinUrl: "/assets/avatar/body/male-skin.png",
      modestyUrl: "/assets/avatar/body/male-modesty.png",
    },
    female: {
      skinUrl: "/assets/avatar/body/female-skin.png",
      modestyUrl: "/assets/avatar/body/female-modesty.png",
    },
  },
  faces: [
    { id: "male-face-1", model: "male", label: "Male 1", url: "/assets/avatar/face/male-1.png" },
    {
      id: "female-face-1",
      model: "female",
      label: "Female 1",
      url: "/assets/avatar/face/female-1.png",
    },
  ],
  hairstyles: [
    {
      id: "hair-crop",
      models: ["male", "female"],
      label: "Crop",
      url: "/assets/avatar/hair/crop.png",
    },
  ],
  armour: [
    {
      id: "copper_light_armor",
      label: "Copper Light Armour",
      tier: 1,
      urls: {
        male: "/assets/avatar/armour/copper-male.png",
        female: "/assets/avatar/armour/copper-female.png",
      },
    },
  ],
  weapons: [
    {
      id: "copper_sword",
      label: "Copper Sword",
      tier: 1,
      backUrl: "/assets/avatar/weapon/copper-back.png",
      frontUrl: "/assets/avatar/weapon/copper-front.png",
    },
  ],
  activities: [{ id: "idle", label: "Idle", glyph: "…" }],
};

const state: PlayerVisualState = {
  appearance: {
    bodyType: "female",
    faceVariant: "female-face-1",
    skinTone: "#c68642",
    hairStyle: "hair-crop",
    hairColor: "#52321f",
  },
  equipment: { armour: "copper_light_armor", weapon: "copper_sword" },
  activity: "idle",
};

describe("player avatar development contracts", () => {
  test("accepts a registered model, face, hair, armour, weapon, and activity", () => {
    expect(() => assertAvatarVisualState(state, manifest)).not.toThrow();
  });

  test("rejects a face registered for a different body model", () => {
    expect(() =>
      assertAvatarVisualState(
        { ...state, appearance: { ...state.appearance, faceVariant: "male-face-1" } },
        manifest,
      ),
    ).toThrow("not compatible with female");
  });

  test("rejects duplicate manifest IDs", () => {
    expect(() =>
      assertAvatarManifest({
        ...manifest,
        hairstyles: [...manifest.hairstyles, manifest.hairstyles[0]!],
      }),
    ).toThrow('Duplicate hairstyles id "hair-crop"');
  });

  test("requires separate skin and modesty artwork for both models", () => {
    expect(() =>
      assertAvatarManifest({
        ...manifest,
        bodies: {
          ...manifest.bodies,
          female: { ...manifest.bodies.female, modestyUrl: "" },
        },
      }),
    ).toThrow("Missing female skin or modesty URL");
  });

  test("rejects missing equipment visuals", () => {
    expect(() =>
      assertAvatarVisualState(
        { ...state, equipment: { ...state.equipment, weapon: "missing-sword" } },
        manifest,
      ),
    ).toThrow("equipment.weapon references missing manifest asset");
  });

  test("requires the canonical registration map", () => {
    expect(() =>
      assertAvatarManifest({
        ...manifest,
        registration: { ...manifest.registration, footY: 299 },
      }),
    ).toThrow("x=192 and y=300");
  });

  test("requires every raster layer to use the 384 by 384 source canvas", () => {
    expect(() =>
      assertAvatarImageDimensions(
        { naturalWidth: 384, naturalHeight: 383 },
        "/assets/avatar/armour/wrong.png",
      ),
    ).toThrow("must be 384x384");
  });

  test("requires transparent canvas space and visible artwork", () => {
    expect(() =>
      assertAvatarPixelAlpha(new Uint8ClampedArray([20, 20, 20, 255]), "/opaque.png"),
    ).toThrow("must contain transparent canvas pixels");
    expect(() => assertAvatarPixelAlpha(new Uint8ClampedArray([0, 0, 0, 0]), "/empty.png")).toThrow(
      "contains no visible artwork",
    );
    expect(() =>
      assertAvatarPixelAlpha(new Uint8ClampedArray([0, 0, 0, 0, 20, 20, 20, 255]), "/valid.png"),
    ).not.toThrow();
  });

  test("deduplicates shared reference URLs before loading", () => {
    expect(avatarManifestUrls(manifest)).toEqual([
      "/assets/avatar/body/male-skin.png",
      "/assets/avatar/body/male-modesty.png",
      "/assets/avatar/body/female-skin.png",
      "/assets/avatar/body/female-modesty.png",
      "/assets/avatar/masks/body-male.png",
      "/assets/avatar/masks/body-female.png",
      "/assets/avatar/masks/face.png",
      "/assets/avatar/masks/hair.png",
      "/assets/avatar/masks/neck.png",
      "/assets/avatar/masks/grip.png",
      "/assets/avatar/masks/weapon.png",
      "/assets/avatar/face/male-1.png",
      "/assets/avatar/face/female-1.png",
      "/assets/avatar/hair/crop.png",
      "/assets/avatar/armour/copper-male.png",
      "/assets/avatar/armour/copper-female.png",
      "/assets/avatar/weapon/copper-back.png",
      "/assets/avatar/weapon/copper-front.png",
    ]);
  });

  test("uses versioned registration boundaries to find illegal visible pixels", () => {
    const face = AVATAR_REGISTRATION_MAP.face;
    expect(pointInBoundary(192, 100, face)).toBe(true);
    expect(pointInBoundary(40, 40, face)).toBe(false);

    const pixels = new Uint8ClampedArray(384 * 384 * 4);
    pixels[(100 * 384 + 192) * 4 + 3] = 255;
    pixels[(20 * 384 + 20) * 4 + 3] = 255;
    expect(pixelsOutsideBoundary(pixels, face)).toEqual([[20, 20]]);
  });

  test("uses alpha masks as the precise production boundary contract", () => {
    const pixels = new Uint8ClampedArray(8);
    const mask = new Uint8ClampedArray(8);
    pixels[3] = 255;
    pixels[7] = 255;
    mask[3] = 255;
    expect(pixelsOutsideMask(pixels, mask, 2)).toEqual([[1, 0]]);
    expect(avatarBoundaryMaskUrls(AVATAR_REGISTRATION_MAP)).toHaveLength(7);
  });

  test("audits exact gameplay catalogue coverage and model counts", () => {
    const expected = {
      armourIds: ["copper_light_armor"],
      weaponIds: ["copper_sword"],
      facesPerModel: 1,
      hairstyles: 1,
      tiers: 1,
    };
    expect(validateAvatarCatalogue(manifest, expected)).toEqual([
      { field: "armour", message: "Tier 1 must contain heavy and light armour." },
    ]);

    const broken = {
      ...manifest,
      faces: manifest.faces.slice(0, 1),
      weapons: [{ ...manifest.weapons[0]!, id: "invented_sword" }],
    };
    expect(validateAvatarCatalogue(broken, expected)).toEqual(
      expect.arrayContaining([
        { field: "weapons", message: "Missing IDs: copper_sword." },
        { field: "weapons", message: "Unknown IDs: invented_sword." },
        { field: "faces", message: "Expected 1 female faces, found 0." },
      ]),
    );
  });

  test("parses a same-origin candidate manifest and rejects unsafe asset URLs", () => {
    expect(parseAvatarManifest(structuredClone(manifest))).toEqual(manifest);
    expect(() =>
      parseAvatarManifest({
        ...manifest,
        bodies: {
          ...manifest.bodies,
          male: { ...manifest.bodies.male, skinUrl: "https://example.com/body.png" },
        },
      }),
    ).toThrow("same-origin path under /assets/avatar/");
  });

  test("loads a valid candidate manifest and reports missing JSON files", async () => {
    const fetcher = async () => new Response(JSON.stringify(manifest), { status: 200 });
    await expect(
      loadAvatarManifest("/assets/avatar/candidate/manifest.json", fetcher),
    ).resolves.toEqual(manifest);
    await expect(
      loadAvatarManifest(
        "/assets/avatar/candidate/missing.json",
        async () => new Response("missing", { status: 404 }),
      ),
    ).rejects.toThrow("failed to load");
  });
});

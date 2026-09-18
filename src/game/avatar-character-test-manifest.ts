import type { AvatarAssetManifest } from "./player-avatar";
import { referenceAvatarManifest } from "./avatar-reference-manifest";

const REVIEW_ROOT = "/assets/avatar/candidate-v1/review";

/**
 * Review-only manifest for the in-game character test. The deterministically
 * registered candidate skin and modesty layers are exercised with the fitted
 * candidate faces and hairstyles without promoting them to production artwork.
 */
export const characterTestAvatarManifest: AvatarAssetManifest = {
  ...referenceAvatarManifest,
  bodies: {
    male: {
      skinUrl: `${REVIEW_ROOT}/body-male-grayscale-skin-deterministic-v4.png`,
      modestyUrl: `${REVIEW_ROOT}/body-male-modesty-deterministic.png`,
    },
    female: {
      skinUrl: `${REVIEW_ROOT}/body-female-grayscale-skin.png`,
      modestyUrl: `${REVIEW_ROOT}/body-female-modesty-deterministic.png`,
    },
  },
  faces: (
    [
      ["male-face-steadfast", "male", "male-face-01-steadfast.png", "Steadfast"],
      ["male-face-rugged", "male", "male-face-02-rugged.png", "Rugged"],
      ["male-face-shrewd", "male", "male-face-03-shrewd.png", "Shrewd"],
      ["male-face-wise", "male", "male-face-04-wise.png", "Wise"],
      ["female-face-warm", "female", "female-face-01-warm-fitted.png", "Warm"],
      ["female-face-resolute", "female", "female-face-02-resolute.png", "Resolute"],
      ["female-face-clever", "female", "female-face-03-clever.png", "Clever"],
      ["female-face-serene", "female", "female-face-04-serene.png", "Serene"],
    ] as const
  ).map(([id, model, file, label]) => ({
    id,
    model: model as "male" | "female",
    url: `${REVIEW_ROOT}/${file}`,
    label,
  })),
  hairstyles: (
    [
      ["hair-adventurer-crop", "hair-01-adventurer-crop-grayscale.png", "Adventurer Crop"],
      ["hair-ranger-layers", "hair-02-ranger-layers-grayscale.png", "Ranger Layers"],
      ["hair-wayfarer-tail", "hair-03-wayfarer-tail-grayscale.png", "Wayfarer Tail"],
      ["hair-warden-topknot", "hair-04-warden-topknot-grayscale.png", "Warden Topknot"],
      ["hair-scholar-sweep", "hair-05-scholar-sweep-grayscale.png", "Scholar Sweep"],
      ["hair-nomad-braids", "hair-06-nomad-braids-grayscale.png", "Nomad Braids"],
      ["hair-vanguard-coils", "hair-07-vanguard-coils-grayscale.png", "Vanguard Coils"],
      ["hair-seafarer-waves", "hair-08-seafarer-waves-grayscale.png", "Seafarer Waves"],
      ["hair-sentinel-undercut", "hair-09-sentinel-undercut-grayscale.png", "Sentinel Undercut"],
      ["hair-artisan-bob", "hair-10-artisan-bob-grayscale.png", "Artisan Bob"],
    ] as const
  ).map(([id, file, label]) => ({
    id,
    models: ["male", "female"] as const,
    url: `${REVIEW_ROOT}/${file}`,
    label,
  })),
};

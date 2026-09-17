import { RELEASE_ARMOUR, RELEASE_WEAPONS } from "../generated/release-catalog";
import type {
  AvatarActivityManifestEntry,
  AvatarAssetManifest,
  AvatarModel,
} from "./player-avatar";
import { validateAvatarCatalogue } from "./avatar-catalogue-validation";

const ROOT = "/assets/avatar/reference";
const models = ["male", "female"] as const satisfies readonly AvatarModel[];

const titleCase = (value: string) =>
  value
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");

const activities = [
  { id: "idle", label: "Idle", glyph: "…" },
  { id: "walk", label: "Walking", glyph: "➜" },
  { id: "attack", label: "Fighting", glyph: "⚔" },
  { id: "mine", label: "Mining", glyph: "⛏" },
  { id: "chop", label: "Woodcutting", glyph: "🪓" },
  { id: "fish", label: "Fishing", glyph: "◜" },
  { id: "loot", label: "Gathering", glyph: "✦" },
] as const satisfies readonly AvatarActivityManifestEntry[];

/**
 * Geometry-proof artwork only. Production art replaces URLs without changing
 * the renderer or gameplay catalogue mapping.
 */
export const referenceAvatarManifest: AvatarAssetManifest = {
  version: 1,
  status: "reference",
  registration: {
    width: 384,
    height: 384,
    pivotX: 192,
    footY: 300,
    masks: {
      bodyMale: `${ROOT}/mask-body-male.png`,
      bodyFemale: `${ROOT}/mask-body-female.png`,
      face: `${ROOT}/mask-face.png`,
      hair: `${ROOT}/mask-hair.png`,
      neckSeam: `${ROOT}/mask-neck-seam.png`,
      gripSocket: `${ROOT}/mask-grip-socket.png`,
      weapon: `${ROOT}/mask-weapon.png`,
    },
  },
  bodies: {
    male: {
      skinUrl: `${ROOT}/body-skin-male.png`,
      modestyUrl: `${ROOT}/body-modesty-male.png`,
    },
    female: {
      skinUrl: `${ROOT}/body-skin-female.png`,
      modestyUrl: `${ROOT}/body-modesty-female.png`,
    },
  },
  faces: models.flatMap((model) =>
    Array.from({ length: 4 }, (_, index) => ({
      id: `${model}-face-${index + 1}`,
      model,
      url: `${ROOT}/face-${model}-${index + 1}.png`,
      label: `Face ${index + 1}`,
    })),
  ),
  hairstyles: [
    "crop",
    "swept",
    "bob",
    "curls",
    "mohawk",
    "braid",
    "waves",
    "topknot",
    "fringe",
    "long",
  ].map((name, index) => ({
    id: `hair-${name}`,
    models,
    url: `${ROOT}/hair-${index + 1}.png`,
    label: titleCase(name),
  })),
  armour: RELEASE_ARMOUR.map((entry) => ({
    id: entry.id,
    label: entry.name,
    tier: entry.tier_index,
    tint: entry.colour,
    urls: {
      male: `${ROOT}/armour-${entry.family === "heavy_armor" ? "heavy" : "light"}-male.png`,
      female: `${ROOT}/armour-${entry.family === "heavy_armor" ? "heavy" : "light"}-female.png`,
    },
  })),
  weapons: RELEASE_WEAPONS.map((entry) => ({
    id: entry.id,
    label: entry.name,
    tier: entry.tier_index,
    tint: entry.colour,
    backUrl: `${ROOT}/sword-back.png`,
    frontUrl: `${ROOT}/sword-front.png`,
  })),
  activities,
};

export const AVATAR_CATALOGUE_EXPECTATION = {
  armourIds: RELEASE_ARMOUR.map((entry) => entry.id),
  weaponIds: RELEASE_WEAPONS.map((entry) => entry.id),
  facesPerModel: 4,
  hairstyles: 10,
  tiers: 16,
} as const;

export const referenceAvatarCatalogueIssues = validateAvatarCatalogue(
  referenceAvatarManifest,
  AVATAR_CATALOGUE_EXPECTATION,
);

/** Front-facing, manifest-backed player avatar contracts and Canvas renderer. */

import {
  AVATAR_REGISTRATION_MAP,
  pixelsOutsideBoundary,
  pixelsOutsideMask,
  type AvatarBoundary,
  type AvatarPoint,
  type AvatarRegistrationMap,
} from "./avatar-registration";

export const AVATAR_SOURCE_SIZE = 384;
export const AVATAR_LOGICAL_WIDTH = 128;
export const AVATAR_LOGICAL_HEIGHT = 160;
export const AVATAR_PIVOT_X = 192;
export const AVATAR_FOOT_Y = 300;

export type AvatarModel = "male" | "female";
export type PlayerActivity = "idle" | "walk" | "attack" | "mine" | "chop" | "fish" | "loot";

export type CharacterAppearance = {
  bodyType: AvatarModel;
  faceVariant: string;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
};

export type EquipmentVisuals = {
  armour: string | null;
  weapon: string | null;
};

export type PlayerVisualState = {
  appearance: CharacterAppearance;
  equipment: EquipmentVisuals;
  activity: PlayerActivity;
};

export const AVATAR_LAYER_ORDER = [
  "shadow",
  "weaponBack",
  "body",
  "face",
  "armour",
  "hair",
  "weaponFront",
  "activity",
] as const;

export type ModelAssetUrls = Record<AvatarModel, string>;
export type AvatarBodyManifestEntry = {
  skinUrl: string;
  modestyUrl: string;
};

export type AvatarFaceManifestEntry = {
  id: string;
  model: AvatarModel;
  url: string;
  label: string;
};

export type AvatarHairManifestEntry = {
  id: string;
  models: readonly AvatarModel[];
  url: string;
  label: string;
};

export type AvatarArmourManifestEntry = {
  id: string;
  label: string;
  tier: number;
  tint?: string | undefined;
  urls: ModelAssetUrls;
};

export type AvatarWeaponManifestEntry = {
  id: string;
  label: string;
  tier: number;
  tint?: string | undefined;
  backUrl?: string | undefined;
  frontUrl: string;
};

export type AvatarActivityManifestEntry = {
  id: PlayerActivity;
  label: string;
  glyph: string;
};

export type AvatarRegistration = {
  width: 384;
  height: 384;
  pivotX: number;
  footY: number;
  masks: {
    bodyMale: string;
    bodyFemale: string;
    face: string;
    hair: string;
    neckSeam: string;
    gripSocket: string;
    weapon: string;
  };
};

export type AvatarAssetManifest = {
  version: 1;
  status: "reference" | "production";
  registration: AvatarRegistration;
  bodies: Record<AvatarModel, AvatarBodyManifestEntry>;
  faces: readonly AvatarFaceManifestEntry[];
  hairstyles: readonly AvatarHairManifestEntry[];
  armour: readonly AvatarArmourManifestEntry[];
  weapons: readonly AvatarWeaponManifestEntry[];
  activities: readonly AvatarActivityManifestEntry[];
};

export type AvatarValidationIssue = {
  field: string;
  message: string;
};

const duplicateIds = <T extends { id: string }>(entries: readonly T[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) duplicates.add(entry.id);
    seen.add(entry.id);
  }
  return [...duplicates];
};

/** Returns every structural manifest problem so the Avatar Lab can display them together. */
export function validateAvatarManifest(manifest: AvatarAssetManifest): AvatarValidationIssue[] {
  const issues: AvatarValidationIssue[] = [];
  const { registration } = manifest;
  if (registration.width !== AVATAR_SOURCE_SIZE || registration.height !== AVATAR_SOURCE_SIZE) {
    issues.push({ field: "registration", message: "Avatar source canvas must be 384×384." });
  }
  if (registration.pivotX !== AVATAR_PIVOT_X || registration.footY !== AVATAR_FOOT_Y) {
    issues.push({
      field: "registration",
      message: "Avatar registration must use x=192 and y=300.",
    });
  }

  for (const model of ["male", "female"] as const) {
    if (!manifest.bodies[model].skinUrl || !manifest.bodies[model].modestyUrl) {
      issues.push({ field: `bodies.${model}`, message: `Missing ${model} skin or modesty URL.` });
    }
    if (!manifest.faces.some((face) => face.model === model)) {
      issues.push({ field: "faces", message: `No face is registered for ${model}.` });
    }
  }

  for (const [field, entries] of [
    ["faces", manifest.faces],
    ["hairstyles", manifest.hairstyles],
    ["armour", manifest.armour],
    ["weapons", manifest.weapons],
    ["activities", manifest.activities],
  ] as const) {
    for (const id of duplicateIds(entries as readonly { id: string }[])) {
      issues.push({ field, message: `Duplicate ${field} id "${id}".` });
    }
  }

  for (const hair of manifest.hairstyles) {
    if (hair.models.length === 0) {
      issues.push({
        field: `hairstyles.${hair.id}`,
        message: "Hairstyle has no compatible model.",
      });
    }
  }
  return issues;
}

export function assertAvatarManifest(manifest: AvatarAssetManifest): void {
  const issues = validateAvatarManifest(manifest);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.field}: ${issue.message}`).join("\n"));
  }
}

/** Throws in development when visual state points outside the supplied manifest. */
export function assertAvatarVisualState(
  state: PlayerVisualState,
  manifest: AvatarAssetManifest,
): void {
  assertAvatarManifest(manifest);
  const { bodyType, faceVariant, hairStyle } = state.appearance;
  const face = manifest.faces.find((entry) => entry.id === faceVariant);
  if (!face)
    throw new Error(`Avatar faceVariant references missing manifest asset "${faceVariant}".`);
  if (face.model !== bodyType) {
    throw new Error(`Avatar face "${faceVariant}" is not compatible with ${bodyType}.`);
  }
  const hair = manifest.hairstyles.find((entry) => entry.id === hairStyle);
  if (!hair) throw new Error(`Avatar hairStyle references missing manifest asset "${hairStyle}".`);
  if (!hair.models.includes(bodyType)) {
    throw new Error(`Avatar hairstyle "${hairStyle}" is not compatible with ${bodyType}.`);
  }
  const { armour, weapon } = state.equipment;
  if (armour && !manifest.armour.some((entry) => entry.id === armour)) {
    throw new Error(`Avatar equipment.armour references missing manifest asset "${armour}".`);
  }
  if (weapon && !manifest.weapons.some((entry) => entry.id === weapon)) {
    throw new Error(`Avatar equipment.weapon references missing manifest asset "${weapon}".`);
  }
  if (!manifest.activities.some((entry) => entry.id === state.activity)) {
    throw new Error(`Avatar activity references missing manifest entry "${state.activity}".`);
  }
}

/** Checks the common transparent-layer canvas contract after an image loads. */
export function assertAvatarImageDimensions(
  image: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight">,
  assetUrl: string,
): void {
  if (image.naturalWidth !== AVATAR_SOURCE_SIZE || image.naturalHeight !== AVATAR_SOURCE_SIZE) {
    throw new Error(
      `Avatar asset "${assetUrl}" must be ${AVATAR_SOURCE_SIZE}x${AVATAR_SOURCE_SIZE}; received ${image.naturalWidth}x${image.naturalHeight}.`,
    );
  }
}

/** Checks that a layer has both visible artwork and transparent canvas space. */
export function assertAvatarPixelAlpha(pixels: Uint8ClampedArray, assetUrl: string): void {
  let hasTransparentPixel = false;
  let hasVisiblePixel = false;
  for (let index = 3; index < pixels.length; index += 4) {
    const alpha = pixels[index]!;
    if (alpha < 255) hasTransparentPixel = true;
    if (alpha > 0) hasVisiblePixel = true;
    if (hasTransparentPixel && hasVisiblePixel) return;
  }
  if (!hasTransparentPixel) {
    throw new Error(`Avatar asset "${assetUrl}" must contain transparent canvas pixels.`);
  }
  throw new Error(`Avatar asset "${assetUrl}" contains no visible artwork.`);
}

function assertAvatarImageTransparency(image: HTMLImageElement, assetUrl: string): void {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SOURCE_SIZE;
  canvas.height = AVATAR_SOURCE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error(`Avatar asset "${assetUrl}" could not be inspected.`);
  ctx.drawImage(image, 0, 0);
  assertAvatarPixelAlpha(ctx.getImageData(0, 0, canvas.width, canvas.height).data, assetUrl);
}

export function avatarManifestUrls(manifest: AvatarAssetManifest): string[] {
  const urls = new Set<string>();
  for (const body of Object.values(manifest.bodies)) {
    urls.add(body.skinUrl);
    urls.add(body.modestyUrl);
  }
  Object.values(manifest.registration.masks).forEach((url) => urls.add(url));
  for (const entry of [...manifest.faces, ...manifest.hairstyles]) urls.add(entry.url);
  for (const entry of manifest.armour) Object.values(entry.urls).forEach((url) => urls.add(url));
  for (const entry of manifest.weapons) {
    if (entry.backUrl) urls.add(entry.backUrl);
    urls.add(entry.frontUrl);
  }
  return [...urls];
}

export function loadAvatarAsset(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      try {
        assertAvatarImageDimensions(image, url);
        assertAvatarImageTransparency(image, url);
        resolve(image);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error(`Avatar asset is missing at ${url}.`));
    image.src = url;
  });
}

export type AvatarLoadState = "idle" | "loading" | "ready" | "error";
export type AvatarRasterLayer = "weaponBack" | "body" | "face" | "armour" | "hair" | "weaponFront";
export type AvatarDrawOptions = {
  layers?: Partial<Record<AvatarRasterLayer, boolean>>;
};

export class PlayerAvatarRenderer {
  readonly images = new Map<string, HTMLImageElement>();
  readonly errors = new Map<string, string>();
  loadState: AvatarLoadState = "idle";
  private tintCache = new Map<string, HTMLCanvasElement>();
  private pixelCache = new Map<string, Uint8ClampedArray>();
  private violationCache = new Map<string, readonly AvatarPoint[]>();

  constructor(
    readonly manifest: AvatarAssetManifest,
    readonly registrationMap: AvatarRegistrationMap = AVATAR_REGISTRATION_MAP,
  ) {
    assertAvatarManifest(manifest);
  }

  async preload(): Promise<void> {
    this.loadState = "loading";
    this.errors.clear();
    await Promise.all(
      avatarManifestUrls(this.manifest).map(async (url) => {
        try {
          this.images.set(url, await loadAvatarAsset(url));
        } catch (error) {
          this.errors.set(url, error instanceof Error ? error.message : String(error));
        }
      }),
    );
    this.loadState = this.errors.size === 0 ? "ready" : "error";
  }

  private tinted(url: string, colour: string): CanvasImageSource | null {
    const image = this.images.get(url);
    if (!image || typeof document === "undefined") return image ?? null;
    const key = `${url}|${colour}`;
    const cached = this.tintCache.get(key);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SOURCE_SIZE;
    canvas.height = AVATAR_SOURCE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return image;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    this.tintCache.set(key, canvas);
    return canvas;
  }

  pixelData(url: string): Uint8ClampedArray | null {
    const cached = this.pixelCache.get(url);
    if (cached) return cached;
    const image = this.images.get(url);
    if (!image || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SOURCE_SIZE;
    canvas.height = AVATAR_SOURCE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    this.pixelCache.set(url, pixels);
    return pixels;
  }

  boundaryViolations(url: string, boundary: AvatarBoundary): readonly AvatarPoint[] {
    const maskByBoundary: Record<string, string> = {
      "body-male": this.manifest.registration.masks.bodyMale,
      "body-female": this.manifest.registration.masks.bodyFemale,
      face: this.manifest.registration.masks.face,
      hair: this.manifest.registration.masks.hair,
      "neck-seam": this.manifest.registration.masks.neckSeam,
      "grip-socket": this.manifest.registration.masks.gripSocket,
      weapon: this.manifest.registration.masks.weapon,
    };
    const maskUrl = maskByBoundary[boundary.id] ?? boundary.maskUrl;
    const key = `${url}|${maskUrl}`;
    const cached = this.violationCache.get(key);
    if (cached) return cached;
    const pixels = this.pixelData(url);
    if (!pixels) return [];
    const maskPixels = this.pixelData(maskUrl);
    const violations = maskPixels
      ? pixelsOutsideMask(pixels, maskPixels)
      : pixelsOutsideBoundary(pixels, boundary);
    this.violationCache.set(key, violations);
    return violations;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    state: PlayerVisualState,
    x: number,
    footY: number,
    height: number,
    options: AvatarDrawOptions = {},
  ): boolean {
    assertAvatarVisualState(state, this.manifest);
    if (this.loadState !== "ready") return false;
    const model = state.appearance.bodyType;
    const face = this.manifest.faces.find((entry) => entry.id === state.appearance.faceVariant)!;
    const hair = this.manifest.hairstyles.find((entry) => entry.id === state.appearance.hairStyle)!;
    const armour = this.manifest.armour.find((entry) => entry.id === state.equipment.armour);
    const weapon = this.manifest.weapons.find((entry) => entry.id === state.equipment.weapon);
    const scale = height / AVATAR_SOURCE_SIZE;
    const dx = Math.round(x - this.manifest.registration.pivotX * scale);
    const dy = Math.round(footY - this.manifest.registration.footY * scale);
    const drawSize = Math.round(AVATAR_SOURCE_SIZE * scale);
    const visible = (layer: AvatarRasterLayer) => options.layers?.[layer] !== false;
    const drawUrl = (url?: string, tint?: string) => {
      if (!url) return;
      const source = tint ? this.tinted(url, tint) : this.images.get(url);
      if (source) ctx.drawImage(source, 0, 0, 384, 384, dx, dy, drawSize, drawSize);
    };

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (visible("weaponBack")) drawUrl(weapon?.backUrl, weapon?.tint);
    if (visible("body")) {
      drawUrl(this.manifest.bodies[model].skinUrl, state.appearance.skinTone);
      drawUrl(this.manifest.bodies[model].modestyUrl);
    }
    if (visible("face")) drawUrl(face.url);
    if (visible("armour")) drawUrl(armour?.urls[model], armour?.tint);
    if (visible("hair")) drawUrl(hair.url, state.appearance.hairColor);
    if (visible("weaponFront")) drawUrl(weapon?.frontUrl, weapon?.tint);
    ctx.restore();
    return true;
  }
}

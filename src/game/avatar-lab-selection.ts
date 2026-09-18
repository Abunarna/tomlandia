import type { AvatarAssetManifest, AvatarModel, PlayerActivity } from "./player-avatar";

export type AvatarLabSelection = {
  model: AvatarModel;
  face: string;
  hair: string;
  armour: string;
  weapon: string;
  activity: PlayerActivity;
};

export function firstCompatibleFaceId(manifest: AvatarAssetManifest, model: AvatarModel): string {
  return manifest.faces.find((entry) => entry.model === model)?.id ?? "";
}

export function firstCompatibleHairId(manifest: AvatarAssetManifest, model: AvatarModel): string {
  return manifest.hairstyles.find((entry) => entry.models.includes(model))?.id ?? "";
}

export function deriveAvatarLabSelection(
  manifest: AvatarAssetManifest,
  current?: Partial<AvatarLabSelection>,
): AvatarLabSelection {
  const model = current?.model ?? "female";
  const face = manifest.faces.some((entry) => entry.id === current?.face && entry.model === model)
    ? current!.face!
    : firstCompatibleFaceId(manifest, model);
  const hair = manifest.hairstyles.some(
    (entry) => entry.id === current?.hair && entry.models.includes(model),
  )
    ? current!.hair!
    : firstCompatibleHairId(manifest, model);
  const armour = manifest.armour.some((entry) => entry.id === current?.armour)
    ? current!.armour!
    : (manifest.armour[0]?.id ?? "");
  const weapon = manifest.weapons.some((entry) => entry.id === current?.weapon)
    ? current!.weapon!
    : (manifest.weapons[0]?.id ?? "");
  const activity = manifest.activities.some((entry) => entry.id === current?.activity)
    ? current!.activity!
    : (manifest.activities[0]?.id ?? "idle");
  return { model, face, hair, armour, weapon, activity };
}

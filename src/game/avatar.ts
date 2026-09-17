/**
 * Character-art reviewer data: body models, faces, hairstyles and palettes.
 * Layered vector art so every combination renders live without asset loading.
 */

export type BodyModel = "female" | "male";

export interface FaceOption {
  id: string;
  name: string;
  /** eye shape radius-y multiplier */
  eye: "round" | "narrow" | "wide" | "soft";
  brow: "flat" | "arched" | "angled" | "low";
  mouth: "smile" | "neutral" | "smirk" | "open";
}

export const BODY_MODELS: { id: BodyModel; name: string }[] = [
  { id: "female", name: "Female" },
  { id: "male", name: "Male" },
];

export const FACES: Record<BodyModel, FaceOption[]> = {
  female: [
    { id: "f-1", name: "Bright", eye: "round", brow: "arched", mouth: "smile" },
    { id: "f-2", name: "Focused", eye: "narrow", brow: "flat", mouth: "neutral" },
    { id: "f-3", name: "Bold", eye: "wide", brow: "angled", mouth: "smirk" },
    { id: "f-4", name: "Calm", eye: "soft", brow: "low", mouth: "neutral" },
  ],
  male: [
    { id: "m-1", name: "Rugged", eye: "narrow", brow: "low", mouth: "neutral" },
    { id: "m-2", name: "Noble", eye: "round", brow: "flat", mouth: "smile" },
    { id: "m-3", name: "Fierce", eye: "wide", brow: "angled", mouth: "smirk" },
    { id: "m-4", name: "Weary", eye: "soft", brow: "low", mouth: "open" },
  ],
};

export interface HairStyle {
  id: string;
  name: string;
  /** main hair silhouette behind/over the head */
  path: string;
  /** optional back layer drawn behind the head */
  back?: string;
}

/** Head is centred at (100, 78) with radius ~34 in the 200x260 viewBox. */
export const HAIRSTYLES: HairStyle[] = [
  {
    id: "cropped",
    name: "Cropped",
    path: "M66 74c0-22 15-35 34-35s34 13 34 35c-6-12-18-16-34-16s-28 4-34 16z",
  },
  {
    id: "tousled",
    name: "Tousled",
    path: "M64 76c2-26 18-38 36-38s34 12 36 38c-6-8-10-14-18-12-6 2-8 8-16 6-7-2-8-8-16-7-8 1-14 6-22 13z",
  },
  {
    id: "braids",
    name: "Braids",
    back: "M60 70c-8 30-6 60 2 84 8-2 12-8 10-18-4-22-4-44 0-62zM140 70c8 30 6 60-2 84-8-2-12-8-10-18 4-22 4-44 0-62z",
    path: "M64 74c2-24 18-36 36-36s34 12 36 36c-8-14-20-20-36-20s-28 6-36 20z",
  },
  {
    id: "ponytail",
    name: "Ponytail",
    back: "M128 62c16 6 22 26 18 52-3 20-10 32-20 38 2-18 6-32 4-50-1-14-3-28-2-40z",
    path: "M64 72c4-22 18-34 36-34s32 12 36 34c-10-12-22-17-36-17s-26 5-36 17z",
  },
  {
    id: "long-waves",
    name: "Long Waves",
    back: "M58 72c-4 44 0 76 6 96 10-4 14-12 12-24-6-30-6-52-2-72zM142 72c4 44 0 76-6 96-10-4-14-12-12-24 6-30 6-52 2-72z",
    path: "M62 78c0-28 18-40 38-40s38 12 38 40c-8-16-22-24-38-24s-30 8-38 24z",
  },
  {
    id: "topknot",
    name: "Topknot",
    back: "M100 24c10 0 16 7 16 15s-7 13-16 13-16-5-16-13 6-15 16-15z",
    path: "M68 72c2-20 14-32 32-32s30 12 32 32c-8-10-18-14-32-14s-24 4-32 14z",
  },
  {
    id: "undercut",
    name: "Undercut",
    path: "M66 66c6-18 18-28 34-28s28 10 34 28c-10-8-22-11-34-11s-24 3-34 11zM66 66c0 6 0 10 1 14 8-8 20-11 33-11s25 3 33 11c1-4 1-8 1-14z",
  },
  {
    id: "curls",
    name: "Curls",
    path: "M64 74c0-8 4-12 9-13 1-8 8-13 15-12 4-7 12-10 19-7 6-5 15-4 19 2 8-1 14 5 14 13 5 2 7 7 6 14-8-14-22-20-41-20s-33 8-41 23z",
  },
  {
    id: "mohawk",
    name: "Mohawk",
    path: "M92 20c6 6 10 20 10 36 0 8 0 14-1 20h-11c-1-6-2-14-2-22 0-14 1-25 4-34zM70 70c2-8 6-14 12-18-1 8-1 16 0 24-5-2-9-4-12-6zM130 70c-2-8-6-14-12-18 1 8 1 16 0 24 5-2 9-4 12-6z",
  },
  {
    id: "shaved",
    name: "Shaved",
    path: "M70 70c2-18 14-30 30-30s28 12 30 30c-8-6-18-9-30-9s-22 3-30 9z",
  },
];

export const SKIN_TONES = [
  { id: "porcelain", name: "Porcelain", color: "#f3d3bd" },
  { id: "sand", name: "Sand", color: "#e7bb98" },
  { id: "honey", name: "Honey", color: "#d29a6e" },
  { id: "bronze", name: "Bronze", color: "#b3774c" },
  { id: "umber", name: "Umber", color: "#8a5533" },
  { id: "ebony", name: "Ebony", color: "#5d3722" },
];

export const HAIR_COLORS = [
  { id: "raven", name: "Raven", color: "#20191c" },
  { id: "chestnut", name: "Chestnut", color: "#5a3520" },
  { id: "auburn", name: "Auburn", color: "#8c3b1c" },
  { id: "amber", name: "Amber", color: "#c08a2e" },
  { id: "wheat", name: "Wheat", color: "#e0c68a" },
  { id: "ash", name: "Ash", color: "#9aa3a8" },
  { id: "frost", name: "Frost", color: "#e4eef3" },
  { id: "ember", name: "Ember", color: "#b02a3a" },
];

export interface CharacterDraft {
  name: string;
  model: BodyModel;
  faceId: string;
  hairId: string;
  skin: string;
  hairColor: string;
}

export const DRAFT_STORAGE_KEY = "tomlandia.character.draft";

export const DEFAULT_DRAFT: CharacterDraft = {
  name: "",
  model: "female",
  faceId: FACES.female[0]!.id,
  hairId: HAIRSTYLES[0]!.id,
  skin: SKIN_TONES[1]!.color,
  hairColor: HAIR_COLORS[1]!.color,
};

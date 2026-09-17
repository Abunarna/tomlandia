import type { AvatarModel } from "./player-avatar";

export type AvatarPoint = readonly [x: number, y: number];
export type AvatarBoundary = {
  id: string;
  label: string;
  colour: string;
  maskUrl: string;
  points: readonly AvatarPoint[];
};

export type AvatarRegistrationMap = {
  version: 1;
  canvas: { width: 384; height: 384; pivotX: 192; footY: 300 };
  modelEnvelopes: Record<AvatarModel, AvatarBoundary>;
  face: AvatarBoundary;
  hair: AvatarBoundary;
  neckSeam: AvatarBoundary;
  gripSocket: AvatarBoundary;
  weapon: AvatarBoundary;
};

/**
 * Stage-1 geometry. These polygons are versioned registration data, not offsets
 * chosen by individual assets. Production masks will refine them after body art
 * approval without changing the renderer's coordinate system.
 */
export const AVATAR_REGISTRATION_MAP: AvatarRegistrationMap = {
  version: 1,
  canvas: { width: 384, height: 384, pivotX: 192, footY: 300 },
  modelEnvelopes: {
    male: {
      id: "body-male",
      label: "Male body envelope",
      colour: "#4f9b67",
      maskUrl: "/assets/avatar/reference/mask-body-male.png",
      points: [
        [126, 55],
        [258, 55],
        [258, 300],
        [126, 300],
      ],
    },
    female: {
      id: "body-female",
      label: "Female body envelope",
      colour: "#4f9b67",
      maskUrl: "/assets/avatar/reference/mask-body-female.png",
      points: [
        [132, 55],
        [252, 55],
        [252, 300],
        [132, 300],
      ],
    },
  },
  face: {
    id: "face",
    label: "Face-only boundary",
    colour: "#d34b6d",
    maskUrl: "/assets/avatar/reference/mask-face.png",
    points: [
      [158, 75],
      [226, 75],
      [226, 136],
      [158, 136],
    ],
  },
  hair: {
    id: "hair",
    label: "Hair envelope",
    colour: "#8b5eb5",
    maskUrl: "/assets/avatar/reference/mask-hair.png",
    points: [
      [145, 35],
      [239, 35],
      [239, 174],
      [145, 174],
    ],
  },
  neckSeam: {
    id: "neck-seam",
    label: "Required neck overlap",
    colour: "#e3a52f",
    maskUrl: "/assets/avatar/reference/mask-neck-seam.png",
    points: [
      [177, 132],
      [207, 132],
      [207, 158],
      [177, 158],
    ],
  },
  gripSocket: {
    id: "grip-socket",
    label: "Sword grip socket",
    colour: "#e45e35",
    maskUrl: "/assets/avatar/reference/mask-grip-socket.png",
    points: [
      [218, 211],
      [257, 211],
      [257, 282],
      [218, 282],
    ],
  },
  weapon: {
    id: "weapon",
    label: "Maximum weapon envelope",
    colour: "#267bb1",
    maskUrl: "/assets/avatar/reference/mask-weapon.png",
    points: [
      [205, 45],
      [330, 45],
      [330, 292],
      [205, 292],
    ],
  },
};

export function pointInBoundary(x: number, y: number, boundary: AvatarBoundary): boolean {
  let inside = false;
  const points = boundary.points;
  for (let i = 0, previous = points.length - 1; i < points.length; previous = i++) {
    const [xi, yi] = points[i]!;
    const [xj, yj] = points[previous]!;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pixelsOutsideBoundary(
  pixels: Uint8ClampedArray,
  boundary: AvatarBoundary,
  width = 384,
): AvatarPoint[] {
  const invalid: AvatarPoint[] = [];
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] === 0) continue;
    const pixel = (index - 3) / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (!pointInBoundary(x + 0.5, y + 0.5, boundary)) invalid.push([x, y]);
  }
  return invalid;
}

export function pixelsOutsideMask(
  pixels: Uint8ClampedArray,
  maskPixels: Uint8ClampedArray,
  width = 384,
): AvatarPoint[] {
  if (pixels.length !== maskPixels.length) {
    throw new Error(`Avatar layer and boundary mask must have matching pixel dimensions.`);
  }
  const invalid: AvatarPoint[] = [];
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] === 0 || maskPixels[index]! > 0) continue;
    const pixel = (index - 3) / 4;
    invalid.push([pixel % width, Math.floor(pixel / width)]);
  }
  return invalid;
}

export function avatarBoundaryMaskUrls(map: AvatarRegistrationMap): string[] {
  return [
    ...Object.values(map.modelEnvelopes),
    map.face,
    map.hair,
    map.neckSeam,
    map.gripSocket,
    map.weapon,
  ].map((boundary) => boundary.maskUrl);
}

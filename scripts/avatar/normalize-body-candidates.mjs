import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const SIZE = 384;
const TARGET_FOOT_Y = 300;
const TARGET_HEIGHT = 238;
const candidateSets = [
  {
    id: "original",
    sources: [
      { model: "female", input: "public/assets/avatar/candidate-v1/source/body-female-source.png" },
      { model: "male", input: "public/assets/avatar/candidate-v1/source/body-male-source.png" },
    ],
    sheet: "docs/images/avatar-candidate-v1-body-review.png",
    report: "public/assets/avatar/candidate-v1/review/normalization-report.json",
  },
  {
    id: "face-neutral",
    compareTo: "original",
    sources: [
      {
        model: "female",
        input: "public/assets/avatar/candidate-v1/source/body-female-face-neutral-source.png",
      },
      {
        model: "male",
        input: "public/assets/avatar/candidate-v1/source/body-male-face-neutral-source.png",
      },
    ],
    sheet: "docs/images/avatar-candidate-v1-face-neutral-review.png",
    report: "public/assets/avatar/candidate-v1/review/face-neutral-normalization-report.json",
  },
  {
    id: "female-skin-master",
    compareTo: "face-neutral",
    sources: [
      {
        model: "female",
        input: "public/assets/avatar/candidate-v1/source/body-female-grayscale-skin-source.png",
      },
    ],
    sheet: "docs/images/avatar-candidate-v1-female-skin-comparison.png",
    report: "public/assets/avatar/candidate-v1/review/female-skin-normalization-report.json",
  },
  {
    id: "male-skin-master",
    compareTo: "face-neutral",
    sources: [
      {
        model: "male",
        input: "public/assets/avatar/candidate-v1/source/body-male-grayscale-skin-source.png",
      },
    ],
    sheet: "docs/images/avatar-candidate-v1-male-skin-comparison.png",
    report: "public/assets/avatar/candidate-v1/review/male-skin-normalization-report.json",
  },
  {
    id: "male-skin-master-corrected",
    compareTo: "face-neutral",
    sources: [
      {
        model: "male",
        input:
          "public/assets/avatar/candidate-v1/source/body-male-grayscale-skin-corrected-source.png",
      },
    ],
    sheet: "docs/images/avatar-candidate-v1-male-skin-corrected-comparison.png",
    report:
      "public/assets/avatar/candidate-v1/review/male-skin-corrected-normalization-report.json",
  },
  {
    id: "male-skin-master-corrected-v2",
    compareTo: "face-neutral",
    sources: [
      {
        model: "male",
        input:
          "public/assets/avatar/candidate-v1/source/body-male-grayscale-skin-corrected-v2-source.png",
      },
    ],
    sheet: "docs/images/avatar-candidate-v1-male-skin-corrected-v2-comparison.png",
    report:
      "public/assets/avatar/candidate-v1/review/male-skin-corrected-v2-normalization-report.json",
  },
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (name, data) => {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
};

function decodeRgbPng(bytes) {
  if (bytes.readUInt32BE(0) !== 0x89504e47 || bytes[24] !== 8 || bytes[25] !== 2)
    throw new Error("Candidate source must be an 8-bit RGB PNG");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  let offset = 8;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
    if (type === "IEND") break;
  }
  const packed = inflateSync(Buffer.concat(idat));
  const stride = width * 3;
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const raw = packed[y * (stride + 1) + 1 + x];
      const left = x >= 3 ? pixels[y * stride + x - 3] : 0;
      const above = y ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y && x >= 3 ? pixels[(y - 1) * stride + x - 3] : 0;
      const prediction =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? above
              : filter === 3
                ? Math.floor((left + above) / 2)
                : filter === 4
                  ? paeth(left, above, upperLeft)
                  : null;
      if (prediction === null) throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = (raw + prediction) & 255;
    }
  }
  return { width, height, pixels };
}

function encodeRgba(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    pixels.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function removeGreen({ width, height, pixels }) {
  const rgba = Buffer.alloc(width * height * 4);
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 3;
      const target = (y * width + x) * 4;
      let [r, g, b] = [pixels[source], pixels[source + 1], pixels[source + 2]];
      const dominance = g - Math.max(r, b);
      const alpha = g > 20 && dominance > 15 ? 0 : 255;
      if (alpha === 0) r = g = b = 0;
      rgba[target] = r;
      rgba[target + 1] = g;
      rgba[target + 2] = b;
      rgba[target + 3] = alpha;
      if (alpha > 24) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  if (maxX < 0) throw new Error("Chroma removal found no subject");
  return { width, height, pixels: rgba, bounds: { minX, minY, maxX, maxY } };
}

function registerSubject(source) {
  const subjectHeight = source.bounds.maxY - source.bounds.minY + 1;
  const scale = TARGET_HEIGHT / subjectHeight;
  const subjectWidth = source.bounds.maxX - source.bounds.minX + 1;
  const targetWidth = Math.round(subjectWidth * scale);
  const left = Math.round(192 - targetWidth / 2);
  const top = TARGET_FOOT_Y - TARGET_HEIGHT + 1;
  const output = Buffer.alloc(SIZE * SIZE * 4);
  for (let ty = 0; ty < TARGET_HEIGHT; ty++)
    for (let tx = 0; tx < targetWidth; tx++) {
      const sx = source.bounds.minX + Math.min(subjectWidth - 1, Math.floor(tx / scale));
      const sy = source.bounds.minY + Math.min(subjectHeight - 1, Math.floor(ty / scale));
      const si = (sy * source.width + sx) * 4;
      const di = ((top + ty) * SIZE + left + tx) * 4;
      source.pixels.copy(output, di, si, si + 4);
    }
  return {
    pixels: output,
    sourceBounds: source.bounds,
    targetBounds: { minX: left, minY: top, maxX: left + targetWidth - 1, maxY: TARGET_FOOT_Y },
    scale,
  };
}

const registeredSets = new Map();
const sourceRegistrations = new Map();
const compareMasks = (
  beforePixels,
  afterPixels,
  bounds = { minX: 0, minY: 0, maxX: 383, maxY: 383 },
) => {
  let intersection = 0,
    union = 0,
    changed = 0;
  for (let y = bounds.minY; y <= bounds.maxY; y++)
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const pixel = y * SIZE + x;
      const before = beforePixels[pixel * 4 + 3] > 0;
      const after = afterPixels[pixel * 4 + 3] > 0;
      if (before && after) intersection++;
      if (before || after) union++;
      if (before !== after) changed++;
    }
  return {
    changedPixels: changed,
    intersectionOverUnion: Number((intersection / Math.max(1, union)).toFixed(6)),
  };
};
const grayscaleStats = (pixels) => {
  let visible = 0,
    coloured = 0,
    maximumChannelSpread = 0;
  for (let pixel = 0; pixel < SIZE * SIZE; pixel++) {
    const index = pixel * 4;
    if (pixels[index + 3] === 0) continue;
    visible++;
    const spread =
      Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) -
      Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
    maximumChannelSpread = Math.max(maximumChannelSpread, spread);
    if (spread > 12) coloured++;
  }
  return {
    maximumChannelSpread,
    colouredPixels: coloured,
    colouredFraction: Number((coloured / visible).toFixed(6)),
  };
};
const forceGrayscale = (pixels) => {
  for (let pixel = 0; pixel < SIZE * SIZE; pixel++) {
    const index = pixel * 4;
    if (pixels[index + 3] === 0) continue;
    const value = Math.round(
      pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114,
    );
    pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
  }
};
for (const set of candidateSets) {
  const results = [];
  const reviewRasters = [];
  for (const source of set.sources) {
    const sourceBytes = readFileSync(resolve(source.input));
    const decoded = decodeRgbPng(sourceBytes);
    const chromaRemoved = removeGreen(decoded);
    const registered = registerSubject(chromaRemoved);
    sourceRegistrations.set(`${set.id}:${source.model}`, {
      sourceBounds: chromaRemoved.bounds,
      scale: registered.scale,
      targetBounds: registered.targetBounds,
    });
    const isSkinMaster = set.id.includes("skin-master");
    if (isSkinMaster) forceGrayscale(registered.pixels);
    const suffix =
      set.id === "original"
        ? "combined"
        : set.id === "face-neutral"
          ? "face-neutral-combined"
          : set.id.startsWith("male-skin-master-corrected")
            ? set.id.endsWith("-v2")
              ? "grayscale-skin-corrected-v2"
              : "grayscale-skin-corrected"
            : "grayscale-skin";
    const output = `public/assets/avatar/candidate-v1/review/body-${source.model}-${suffix}.png`;
    mkdirSync(dirname(resolve(output)), { recursive: true });
    const outputBytes = encodeRgba(SIZE, SIZE, registered.pixels);
    writeFileSync(resolve(output), outputBytes);
    reviewRasters.push(registered.pixels);
    const previous = set.compareTo
      ? registeredSets.get(`${set.compareTo}:${source.model}`)
      : undefined;
    let silhouetteComparison;
    if (previous) {
      silhouetteComparison = {
        whole: compareMasks(previous, registered.pixels),
        head: compareMasks(previous, registered.pixels, {
          minX: 150,
          minY: 55,
          maxX: 234,
          maxY: 115,
        }),
        hands: compareMasks(previous, registered.pixels, {
          minX: 125,
          minY: 145,
          maxX: 260,
          maxY: 210,
        }),
        feet: compareMasks(previous, registered.pixels, {
          minX: 135,
          minY: 265,
          maxX: 250,
          maxY: 305,
        }),
      };
    }
    const passesSilhouetteGate =
      silhouetteComparison &&
      silhouetteComparison.whole.intersectionOverUnion > 0.99 &&
      silhouetteComparison.head.intersectionOverUnion > 0.99 &&
      silhouetteComparison.hands.intersectionOverUnion > 0.99 &&
      silhouetteComparison.feet.intersectionOverUnion > 0.98;
    const isRejectedSkinMaster = isSkinMaster && !passesSilhouetteGate;
    const failedSilhouetteRegions = silhouetteComparison
      ? [
          ["whole", 0.99],
          ["head", 0.99],
          ["hands", 0.99],
          ["feet", 0.98],
        ]
          .filter(
            ([region, threshold]) =>
              silhouetteComparison[region].intersectionOverUnion <= threshold,
          )
          .map(
            ([region]) =>
              `${region === "hands" ? "hand" : region}-region silhouette changed beyond the acceptance threshold`,
          )
      : [];
    results.push({
      model: source.model,
      input: source.input,
      output,
      sourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
      outputSha256: createHash("sha256").update(outputBytes).digest("hex"),
      sourceSize: [decoded.width, decoded.height],
      sourceBounds: registered.sourceBounds,
      targetBounds: registered.targetBounds,
      targetCenterX: (registered.targetBounds.minX + registered.targetBounds.maxX) / 2,
      centerDeltaFromPivot: (registered.targetBounds.minX + registered.targetBounds.maxX) / 2 - 192,
      scale: Number(registered.scale.toFixed(6)),
      status: isRejectedSkinMaster ? "rejected" : "review-only",
      ...(silhouetteComparison ? { silhouetteComparison } : {}),
      ...(isSkinMaster ? { grayscale: grayscaleStats(registered.pixels) } : {}),
      blockers:
        set.id === "original"
          ? [
              "face is baked into body source",
              "skin and modesty clothing are not separate layers",
              "male/female grip sockets require comparison",
            ]
          : set.id === "face-neutral"
            ? [
                "skin and modesty clothing are not separate layers",
                "male/female grip sockets require comparison",
              ]
            : isRejectedSkinMaster
              ? [...failedSilhouetteRegions, "matching modesty overlay has not been derived"]
              : [
                  "silhouette and grip comparison requires approval",
                  "matching modesty overlay has not been derived",
                ],
    });
    registeredSets.set(`${set.id}:${source.model}`, registered.pixels);
  }
  const sheetRasters = set.id.includes("skin-master")
    ? [registeredSets.get(`face-neutral:${set.sources[0].model}`), ...reviewRasters]
    : reviewRasters;
  const sheetWidth = SIZE * 2 + 32;
  const sheet = Buffer.alloc(sheetWidth * SIZE * 4);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < sheetWidth; x++) {
      const index = (y * sheetWidth + x) * 4;
      const shade = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? 222 : 242;
      sheet[index] = shade;
      sheet[index + 1] = shade - 4;
      sheet[index + 2] = shade + 2;
      sheet[index + 3] = 255;
    }
  sheetRasters.forEach((pixels, column) => {
    const offsetX = column * (SIZE + 32);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const source = (y * SIZE + x) * 4;
        if (pixels[source + 3] === 0) continue;
        pixels.copy(sheet, (y * sheetWidth + offsetX + x) * 4, source, source + 4);
      }
  });
  mkdirSync(dirname(resolve(set.sheet)), { recursive: true });
  writeFileSync(resolve(set.sheet), encodeRgba(sheetWidth, SIZE, sheet));
  writeFileSync(
    resolve(set.report),
    `${JSON.stringify({ version: 1, variant: set.id, registration: { width: 384, height: 384, pivotX: 192, footY: 300 }, results }, null, 2)}\n`,
  );
}

const faceSource =
  "public/assets/avatar/candidate-v1/source/candidate-v1-face-female-01-warm-source.png";
const faceOutput = "public/assets/avatar/candidate-v1/review/face-female-01-warm.png";
const faceReport = "public/assets/avatar/candidate-v1/review/face-female-01-warm-report.json";
const faceSheet = "docs/images/avatar-candidate-v1-face-female-01-warm-review.png";
const femaleRegistration = sourceRegistrations.get("face-neutral:female");
const faceSourceBytes = readFileSync(resolve(faceSource));
const faceDecoded = removeGreen(decodeRgbPng(faceSourceBytes));
const facePixels = Buffer.alloc(SIZE * SIZE * 4);
const referenceWidth =
  femaleRegistration.sourceBounds.maxX - femaleRegistration.sourceBounds.minX + 1;
for (let y = 0; y < TARGET_HEIGHT; y++)
  for (
    let x = 0;
    x < femaleRegistration.targetBounds.maxX - femaleRegistration.targetBounds.minX + 1;
    x++
  ) {
    const sourceX =
      femaleRegistration.sourceBounds.minX +
      Math.min(referenceWidth - 1, Math.floor(x / femaleRegistration.scale));
    const sourceY = femaleRegistration.sourceBounds.minY + Math.floor(y / femaleRegistration.scale);
    const sourceIndex = (sourceY * faceDecoded.width + sourceX) * 4;
    const targetIndex =
      ((femaleRegistration.targetBounds.minY + y) * SIZE +
        femaleRegistration.targetBounds.minX +
        x) *
      4;
    faceDecoded.pixels.copy(facePixels, targetIndex, sourceIndex, sourceIndex + 4);
  }
const faceBounds = { minX: SIZE, minY: SIZE, maxX: -1, maxY: -1 };
let visiblePixels = 0;
let pixelsOutsideFaceBoundary = 0;
for (let y = 0; y < SIZE; y++)
  for (let x = 0; x < SIZE; x++) {
    if (facePixels[(y * SIZE + x) * 4 + 3] === 0) continue;
    visiblePixels++;
    faceBounds.minX = Math.min(faceBounds.minX, x);
    faceBounds.minY = Math.min(faceBounds.minY, y);
    faceBounds.maxX = Math.max(faceBounds.maxX, x);
    faceBounds.maxY = Math.max(faceBounds.maxY, y);
    if (x < 158 || x > 226 || y < 75 || y > 136) pixelsOutsideFaceBoundary++;
  }
const faceOutputBytes = encodeRgba(SIZE, SIZE, facePixels);
writeFileSync(resolve(faceOutput), faceOutputBytes);
const faceStatus =
  visiblePixels > 0 && pixelsOutsideFaceBoundary === 0 ? "review-only" : "rejected";
writeFileSync(
  resolve(faceReport),
  `${JSON.stringify(
    {
      version: 1,
      variant: "female-face-01-warm",
      registration: { width: 384, height: 384, pivotX: 192, footY: 300 },
      input: faceSource,
      output: faceOutput,
      sourceSha256: createHash("sha256").update(faceSourceBytes).digest("hex"),
      outputSha256: createHash("sha256").update(faceOutputBytes).digest("hex"),
      sourceSize: [faceDecoded.width, faceDecoded.height],
      visibleBounds: faceBounds,
      visiblePixels,
      pixelsOutsideFaceBoundary,
      status: faceStatus,
      blockers:
        faceStatus === "rejected"
          ? ["visible face pixels extend outside the registered face boundary"]
          : ["game-scale readability and composite appearance require visual approval"],
    },
    null,
    2,
  )}\n`,
);
const femaleBody = registeredSets.get("face-neutral:female");
const faceSheetPixels = Buffer.from(femaleBody);
for (let index = 0; index < facePixels.length; index += 4) {
  if (facePixels[index + 3] === 0) continue;
  facePixels.copy(faceSheetPixels, index, index, index + 4);
}
writeFileSync(resolve(faceSheet), encodeRgba(SIZE, SIZE, faceSheetPixels));

const registeredFaceSource =
  "public/assets/avatar/candidate-v1/source/candidate-v1-face-female-01-warm-registered-source.png";
const registeredFaceOutput =
  "public/assets/avatar/candidate-v1/review/face-female-01-warm-registered-combined.png";
const registeredFaceReport =
  "public/assets/avatar/candidate-v1/review/face-female-01-warm-registered-report.json";
const registeredFaceSheet =
  "docs/images/avatar-candidate-v1-face-female-01-warm-registered-review.png";
const registeredFaceSourceBytes = readFileSync(resolve(registeredFaceSource));
const registeredFaceDecoded = decodeRgbPng(registeredFaceSourceBytes);
const registeredFace = registerSubject(removeGreen(registeredFaceDecoded));
const registeredFaceOutputBytes = encodeRgba(SIZE, SIZE, registeredFace.pixels);
writeFileSync(resolve(registeredFaceOutput), registeredFaceOutputBytes);
const registeredFaceSilhouette = compareMasks(femaleBody, registeredFace.pixels);
let changedPixels = 0;
let changedPixelsOutsideFaceBoundary = 0;
for (let y = 0; y < SIZE; y++)
  for (let x = 0; x < SIZE; x++) {
    const index = (y * SIZE + x) * 4;
    let changed = false;
    for (let channel = 0; channel < 4; channel++)
      if (femaleBody[index + channel] !== registeredFace.pixels[index + channel]) {
        changed = true;
        break;
      }
    if (!changed) continue;
    changedPixels++;
    if (x < 158 || x > 226 || y < 75 || y > 136) changedPixelsOutsideFaceBoundary++;
  }
const registeredFaceStatus =
  registeredFaceSilhouette.intersectionOverUnion > 0.99 && changedPixelsOutsideFaceBoundary === 0
    ? "review-only"
    : "rejected";
writeFileSync(
  resolve(registeredFaceReport),
  `${JSON.stringify(
    {
      version: 1,
      variant: "female-face-01-warm-registered",
      registration: { width: 384, height: 384, pivotX: 192, footY: 300 },
      input: registeredFaceSource,
      output: registeredFaceOutput,
      sourceSha256: createHash("sha256").update(registeredFaceSourceBytes).digest("hex"),
      outputSha256: createHash("sha256").update(registeredFaceOutputBytes).digest("hex"),
      sourceSize: [registeredFaceDecoded.width, registeredFaceDecoded.height],
      targetBounds: registeredFace.targetBounds,
      silhouetteComparison: registeredFaceSilhouette,
      changedPixels,
      changedPixelsOutsideFaceBoundary,
      status: registeredFaceStatus,
      blockers:
        registeredFaceStatus === "rejected"
          ? [
              "the authoritative body and clothing were redrawn outside the face boundary",
              "the authoritative silhouette was not preserved",
            ]
          : ["face isolation and game-scale appearance require visual approval"],
    },
    null,
    2,
  )}\n`,
);
const registeredSheetWidth = SIZE * 2 + 32;
const registeredSheetPixels = Buffer.alloc(registeredSheetWidth * SIZE * 4);
for (let y = 0; y < SIZE; y++)
  for (let x = 0; x < registeredSheetWidth; x++) {
    const index = (y * registeredSheetWidth + x) * 4;
    const shade = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? 222 : 242;
    registeredSheetPixels[index] = shade;
    registeredSheetPixels[index + 1] = shade - 4;
    registeredSheetPixels[index + 2] = shade + 2;
    registeredSheetPixels[index + 3] = 255;
  }
[femaleBody, registeredFace.pixels].forEach((pixels, column) => {
  const offsetX = column * (SIZE + 32);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const sourceIndex = (y * SIZE + x) * 4;
      if (pixels[sourceIndex + 3] === 0) continue;
      pixels.copy(
        registeredSheetPixels,
        (y * registeredSheetWidth + offsetX + x) * 4,
        sourceIndex,
        sourceIndex + 4,
      );
    }
});
writeFileSync(
  resolve(registeredFaceSheet),
  encodeRgba(registeredSheetWidth, SIZE, registeredSheetPixels),
);

function fitIsolatedFace(source, maxWidth = 32, maxHeight = 28) {
  const sourceWidth = source.bounds.maxX - source.bounds.minX + 1;
  const sourceHeight = source.bounds.maxY - source.bounds.minY + 1;
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const left = Math.round(192 - targetWidth / 2);
  const top = Math.round(94 - targetHeight / 2);
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < targetHeight; y++)
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = source.bounds.minX + Math.min(sourceWidth - 1, Math.floor(x / scale));
      const sourceY = source.bounds.minY + Math.min(sourceHeight - 1, Math.floor(y / scale));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const targetIndex = ((top + y) * SIZE + left + x) * 4;
      source.pixels.copy(pixels, targetIndex, sourceIndex, sourceIndex + 4);
    }
  return {
    pixels,
    scale,
    targetBounds: {
      minX: left,
      minY: top,
      maxX: left + targetWidth - 1,
      maxY: top + targetHeight - 1,
    },
  };
}

const femaleFittedFaceCandidates = [
  {
    id: "female-face-01-warm-fitted",
    source: "public/assets/avatar/candidate-v1/source/candidate-v1-face-female-01-warm-source.png",
  },
  {
    id: "female-face-02-resolute",
    source:
      "public/assets/avatar/candidate-v1/source/candidate-v1-face-female-02-resolute-source.png",
  },
  {
    id: "female-face-03-clever",
    source:
      "public/assets/avatar/candidate-v1/source/candidate-v1-face-female-03-clever-source.png",
  },
  {
    id: "female-face-04-serene",
    source:
      "public/assets/avatar/candidate-v1/source/candidate-v1-face-female-04-serene-source.png",
  },
];
const maleFittedFaceCandidates = [
  {
    id: "male-face-01-steadfast",
    source:
      "public/assets/avatar/candidate-v1/source/candidate-v1-face-male-01-steadfast-source.png",
  },
  {
    id: "male-face-02-rugged",
    source: "public/assets/avatar/candidate-v1/source/candidate-v1-face-male-02-rugged-source.png",
  },
  {
    id: "male-face-03-shrewd",
    source: "public/assets/avatar/candidate-v1/source/candidate-v1-face-male-03-shrewd-source.png",
  },
  {
    id: "male-face-04-wise",
    source: "public/assets/avatar/candidate-v1/source/candidate-v1-face-male-04-wise-source.png",
  },
];

function processFittedFaces({ model, candidates, reportPath, sheetPath }) {
  const body = registeredSets.get(`face-neutral:${model}`);
  const results = [];
  const composites = [];
  for (const candidate of candidates) {
    const sourceBytes = readFileSync(resolve(candidate.source));
    const decoded = removeGreen(decodeRgbPng(sourceBytes));
    const fitted = fitIsolatedFace(decoded);
    const output = `public/assets/avatar/candidate-v1/review/${candidate.id}.png`;
    const outputBytes = encodeRgba(SIZE, SIZE, fitted.pixels);
    writeFileSync(resolve(output), outputBytes);
    let outsideBoundary = 0;
    let visible = 0;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        if (fitted.pixels[(y * SIZE + x) * 4 + 3] === 0) continue;
        visible++;
        if (x < 158 || x > 226 || y < 75 || y > 136) outsideBoundary++;
      }
    const composite = Buffer.from(body);
    for (let index = 0; index < fitted.pixels.length; index += 4) {
      if (fitted.pixels[index + 3] === 0) continue;
      fitted.pixels.copy(composite, index, index, index + 4);
    }
    composites.push(composite);
    results.push({
      id: candidate.id,
      input: candidate.source,
      output,
      sourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
      outputSha256: createHash("sha256").update(outputBytes).digest("hex"),
      sourceSize: [decoded.width, decoded.height],
      sourceBounds: decoded.bounds,
      targetBounds: fitted.targetBounds,
      scale: Number(fitted.scale.toFixed(6)),
      visiblePixels: visible,
      pixelsOutsideFaceBoundary: outsideBoundary,
      status: outsideBoundary === 0 ? "review-only" : "rejected",
      blockers:
        outsideBoundary === 0
          ? ["game-scale readability and visual identity require approval"]
          : ["visible pixels extend outside the registered face boundary"],
    });
  }
  writeFileSync(
    resolve(reportPath),
    `${JSON.stringify(
      {
        version: 1,
        variant: `${model}-fitted-faces`,
        registration: { width: 384, height: 384, pivotX: 192, footY: 300 },
        fitBox: { centerX: 192, centerY: 94, maxWidth: 32, maxHeight: 28 },
        results,
      },
      null,
      2,
    )}\n`,
  );
  const sheetWidth = SIZE * composites.length;
  const sheet = Buffer.alloc(sheetWidth * SIZE * 4);
  composites.forEach((pixels, column) => {
    for (let y = 0; y < SIZE; y++)
      pixels.copy(sheet, (y * sheetWidth + column * SIZE) * 4, y * SIZE * 4, (y + 1) * SIZE * 4);
  });
  writeFileSync(resolve(sheetPath), encodeRgba(sheetWidth, SIZE, sheet));
}

processFittedFaces({
  model: "female",
  candidates: femaleFittedFaceCandidates,
  reportPath: "public/assets/avatar/candidate-v1/review/female-fitted-faces-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-female-fitted-faces-review.png",
});
processFittedFaces({
  model: "male",
  candidates: maleFittedFaceCandidates,
  reportPath: "public/assets/avatar/candidate-v1/review/male-fitted-faces-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-male-fitted-faces-review.png",
});

function processHairCandidate({ id, source, output, reportPath, sheetPath, fitBox }) {
  const sourceBytes = readFileSync(resolve(source));
  const decoded = removeGreen(decodeRgbPng(sourceBytes));
  const sourceWidth = decoded.bounds.maxX - decoded.bounds.minX + 1;
  const sourceHeight = decoded.bounds.maxY - decoded.bounds.minY + 1;
  const scale = Math.min(fitBox.maxWidth / sourceWidth, fitBox.maxHeight / sourceHeight);
  const targetWidth = Math.round(sourceWidth * scale);
  const targetHeight = Math.round(sourceHeight * scale);
  const left = Math.round(fitBox.centerX - targetWidth / 2);
  const top = Math.round(fitBox.centerY - targetHeight / 2);
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < targetHeight; y++)
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = decoded.bounds.minX + Math.min(sourceWidth - 1, Math.floor(x / scale));
      const sourceY = decoded.bounds.minY + Math.min(sourceHeight - 1, Math.floor(y / scale));
      const sourceIndex = (sourceY * decoded.width + sourceX) * 4;
      const targetIndex = ((top + y) * SIZE + left + x) * 4;
      decoded.pixels.copy(pixels, targetIndex, sourceIndex, sourceIndex + 4);
    }
  forceGrayscale(pixels);
  const outputBytes = encodeRgba(SIZE, SIZE, pixels);
  writeFileSync(resolve(output), outputBytes);
  let visiblePixels = 0;
  let pixelsOutsideHairBoundary = 0;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (pixels[(y * SIZE + x) * 4 + 3] === 0) continue;
      visiblePixels++;
      if (x < 145 || x > 239 || y < 35 || y > 174) pixelsOutsideHairBoundary++;
    }
  const targetBounds = {
    minX: left,
    minY: top,
    maxX: left + targetWidth - 1,
    maxY: top + targetHeight - 1,
  };
  writeFileSync(
    resolve(reportPath),
    `${JSON.stringify(
      {
        version: 1,
        variant: id,
        registration: { width: 384, height: 384, pivotX: 192, footY: 300 },
        fitBox,
        input: source,
        output,
        sourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
        outputSha256: createHash("sha256").update(outputBytes).digest("hex"),
        sourceSize: [decoded.width, decoded.height],
        sourceBounds: decoded.bounds,
        targetBounds,
        scale: Number(scale.toFixed(6)),
        visiblePixels,
        pixelsOutsideHairBoundary,
        grayscale: grayscaleStats(pixels),
        status: pixelsOutsideHairBoundary === 0 ? "review-only" : "rejected",
        blockers:
          pixelsOutsideHairBoundary === 0
            ? ["male/female fit, tinting, and game-scale readability require approval"]
            : ["visible pixels extend outside the registered hair boundary"],
      },
      null,
      2,
    )}\n`,
  );
  const composites = ["male", "female"].map((model) => {
    const composite = Buffer.from(registeredSets.get(`face-neutral:${model}`));
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 0) continue;
      pixels.copy(composite, index, index, index + 4);
    }
    return composite;
  });
  const sheet = Buffer.alloc(SIZE * 2 * SIZE * 4);
  composites.forEach((composite, column) => {
    for (let y = 0; y < SIZE; y++)
      composite.copy(sheet, (y * SIZE * 2 + column * SIZE) * 4, y * SIZE * 4, (y + 1) * SIZE * 4);
  });
  writeFileSync(resolve(sheetPath), encodeRgba(SIZE * 2, SIZE, sheet));
}

processHairCandidate({
  id: "hair-01-adventurer-crop",
  source:
    "public/assets/avatar/candidate-v1/source/candidate-v1-hair-01-adventurer-crop-grayscale-source.png",
  output: "public/assets/avatar/candidate-v1/review/hair-01-adventurer-crop-grayscale.png",
  reportPath: "public/assets/avatar/candidate-v1/review/hair-01-adventurer-crop-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-hair-01-adventurer-crop-review.png",
  fitBox: { centerX: 192, centerY: 78, maxWidth: 60, maxHeight: 50 },
});
processHairCandidate({
  id: "hair-02-ranger-layers",
  source:
    "public/assets/avatar/candidate-v1/source/candidate-v1-hair-02-ranger-layers-grayscale-source.png",
  output: "public/assets/avatar/candidate-v1/review/hair-02-ranger-layers-grayscale.png",
  reportPath: "public/assets/avatar/candidate-v1/review/hair-02-ranger-layers-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-hair-02-ranger-layers-review.png",
  fitBox: { centerX: 192, centerY: 88, maxWidth: 66, maxHeight: 72 },
});
processHairCandidate({
  id: "hair-03-wayfarer-tail",
  source:
    "public/assets/avatar/candidate-v1/source/candidate-v1-hair-03-wayfarer-tail-grayscale-source.png",
  output: "public/assets/avatar/candidate-v1/review/hair-03-wayfarer-tail-grayscale.png",
  reportPath: "public/assets/avatar/candidate-v1/review/hair-03-wayfarer-tail-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-hair-03-wayfarer-tail-review.png",
  fitBox: { centerX: 192, centerY: 84, maxWidth: 72, maxHeight: 64 },
});
processHairCandidate({
  id: "hair-04-warden-topknot",
  source:
    "public/assets/avatar/candidate-v1/source/candidate-v1-hair-04-warden-topknot-grayscale-source.png",
  output: "public/assets/avatar/candidate-v1/review/hair-04-warden-topknot-grayscale.png",
  reportPath: "public/assets/avatar/candidate-v1/review/hair-04-warden-topknot-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-hair-04-warden-topknot-review.png",
  fitBox: { centerX: 192, centerY: 83, maxWidth: 66, maxHeight: 72 },
});
processHairCandidate({
  id: "hair-05-scholar-sweep",
  source:
    "public/assets/avatar/candidate-v1/source/candidate-v1-hair-05-scholar-sweep-grayscale-source.png",
  output: "public/assets/avatar/candidate-v1/review/hair-05-scholar-sweep-grayscale.png",
  reportPath: "public/assets/avatar/candidate-v1/review/hair-05-scholar-sweep-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-hair-05-scholar-sweep-review.png",
  fitBox: { centerX: 192, centerY: 80, maxWidth: 64, maxHeight: 56 },
});
processHairCandidate({
  id: "hair-06-nomad-braids",
  source:
    "public/assets/avatar/candidate-v1/source/candidate-v1-hair-06-nomad-braids-grayscale-source.png",
  output: "public/assets/avatar/candidate-v1/review/hair-06-nomad-braids-grayscale.png",
  reportPath: "public/assets/avatar/candidate-v1/review/hair-06-nomad-braids-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-hair-06-nomad-braids-review.png",
  fitBox: { centerX: 192, centerY: 87, maxWidth: 64, maxHeight: 72 },
});
processHairCandidate({
  id: "hair-07-vanguard-coils",
  source:
    "public/assets/avatar/candidate-v1/source/candidate-v1-hair-07-vanguard-coils-grayscale-source.png",
  output: "public/assets/avatar/candidate-v1/review/hair-07-vanguard-coils-grayscale.png",
  reportPath: "public/assets/avatar/candidate-v1/review/hair-07-vanguard-coils-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-hair-07-vanguard-coils-review.png",
  fitBox: { centerX: 192, centerY: 79, maxWidth: 68, maxHeight: 58 },
});
processHairCandidate({
  id: "hair-08-seafarer-waves",
  source:
    "public/assets/avatar/candidate-v1/source/candidate-v1-hair-08-seafarer-waves-grayscale-source.png",
  output: "public/assets/avatar/candidate-v1/review/hair-08-seafarer-waves-grayscale.png",
  reportPath: "public/assets/avatar/candidate-v1/review/hair-08-seafarer-waves-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-hair-08-seafarer-waves-review.png",
  fitBox: { centerX: 192, centerY: 87, maxWidth: 76, maxHeight: 78 },
});
processHairCandidate({
  id: "hair-09-sentinel-undercut",
  source:
    "public/assets/avatar/candidate-v1/source/candidate-v1-hair-09-sentinel-undercut-grayscale-source.png",
  output: "public/assets/avatar/candidate-v1/review/hair-09-sentinel-undercut-grayscale.png",
  reportPath: "public/assets/avatar/candidate-v1/review/hair-09-sentinel-undercut-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-hair-09-sentinel-undercut-review.png",
  fitBox: { centerX: 192, centerY: 78, maxWidth: 60, maxHeight: 52 },
});
processHairCandidate({
  id: "hair-10-artisan-bob",
  source:
    "public/assets/avatar/candidate-v1/source/candidate-v1-hair-10-artisan-bob-grayscale-source.png",
  output: "public/assets/avatar/candidate-v1/review/hair-10-artisan-bob-grayscale.png",
  reportPath: "public/assets/avatar/candidate-v1/review/hair-10-artisan-bob-report.json",
  sheetPath: "docs/images/avatar-candidate-v1-hair-10-artisan-bob-review.png",
  fitBox: { centerX: 192, centerY: 84, maxWidth: 68, maxHeight: 66 },
});
console.log("Normalized body, face, and hair candidates to transparent 384×384 review PNGs.");

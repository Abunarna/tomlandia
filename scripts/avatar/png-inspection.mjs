import { inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

export function inspectPng(bytes) {
  const source = Buffer.from(bytes);
  if (source.length < 33 || !source.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("Not a PNG file (signature missing)");
  }

  let offset = 8;
  let header;
  let palette;
  let transparency;
  const idat = [];
  while (offset + 12 <= source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.toString("ascii", offset + 4, offset + 8);
    const data = source.subarray(offset + 8, offset + 8 + length);
    if (data.length !== length) throw new Error(`Truncated PNG ${type} chunk`);
    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") transparency = data;
    else if (type === "IDAT") idat.push(data);
    offset += length + 12;
    if (type === "IEND") break;
  }
  if (!header || idat.length === 0) throw new Error("PNG is missing IHDR or IDAT data");
  if (header.bitDepth !== 8 || header.interlace !== 0) {
    throw new Error("Only non-interlaced 8-bit PNG references are supported");
  }

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.colorType];
  if (!channels) throw new Error(`Unsupported PNG colour type ${header.colorType}`);
  const stride = header.width * channels;
  const packed = inflateSync(Buffer.concat(idat));
  if (packed.length !== (stride + 1) * header.height)
    throw new Error("Unexpected PNG scanline length");
  const pixels = Buffer.alloc(stride * header.height);
  for (let y = 0; y < header.height; y += 1) {
    const filter = packed[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[y * (stride + 1) + 1 + x];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const above = y ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
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

  let visiblePixels = 0;
  let transparentPixels = 0;
  let minX = header.width;
  let minY = header.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < header.height; y += 1) {
    for (let x = 0; x < header.width; x += 1) {
      const index = (y * header.width + x) * channels;
      let alpha = 255;
      if (header.colorType === 6) alpha = pixels[index + 3];
      else if (header.colorType === 4) alpha = pixels[index + 1];
      else if (header.colorType === 3) alpha = transparency?.[pixels[index]] ?? 255;
      if (alpha === 0) transparentPixels += 1;
      else {
        visiblePixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const total = header.width * header.height;
  return {
    ...header,
    hasAlpha: header.colorType === 4 || header.colorType === 6 || Boolean(transparency),
    visiblePixels,
    transparentPixels,
    visibleCoverage: Number((visiblePixels / total).toFixed(6)),
    visibleBounds: visiblePixels
      ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null,
  };
}

export function inspectJpeg(bytes) {
  const source = Buffer.from(bytes);
  if (source.length < 4 || source[0] !== 0xff || source[1] !== 0xd8) {
    throw new Error("Not a JPEG file (signature missing)");
  }
  let offset = 2;
  while (offset + 4 <= source.length) {
    if (source[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = source[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = source.readUInt16BE(offset);
    if (length < 2 || offset + length > source.length) throw new Error("Truncated JPEG segment");
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      const height = source.readUInt16BE(offset + 3);
      const width = source.readUInt16BE(offset + 5);
      return {
        format: "jpeg",
        width,
        height,
        bitDepth: source[offset + 2],
        colorType: "jpeg",
        hasAlpha: false,
        visiblePixels: width * height,
        transparentPixels: 0,
        visibleCoverage: 1,
        visibleBounds: { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1, width, height },
      };
    }
    offset += length;
  }
  throw new Error("JPEG dimensions were not found");
}

export function inspectReferenceImage(bytes, filename) {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "png") return { format: "png", ...inspectPng(bytes) };
  if (extension === "jpg" || extension === "jpeg") return inspectJpeg(bytes);
  throw new Error(`Unsupported reference image extension: .${extension}`);
}

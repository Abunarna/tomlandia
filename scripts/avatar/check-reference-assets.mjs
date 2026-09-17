import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";

const ROOT = resolve("public/assets/avatar/reference");
const files = readdirSync(ROOT).filter((name) => name.endsWith(".png"));
const expected = 35;
const errors = [];

for (const name of files) {
  const bytes = readFileSync(resolve(ROOT, name));
  const signature = bytes.subarray(0, 8).toString("hex");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colourType = bytes[25];
  if (signature !== "89504e470d0a1a0a") errors.push(`${name}: invalid PNG signature`);
  if (width !== 384 || height !== 384)
    errors.push(`${name}: expected 384×384, found ${width}×${height}`);
  if (colourType !== 6) errors.push(`${name}: expected RGBA colour type 6, found ${colourType}`);

  let offset = 8;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scanlines = inflateSync(Buffer.concat(idat));
  let transparent = 0;
  let visible = 0;
  for (let y = 0; y < height; y++) {
    if (scanlines[y * (width * 4 + 1)] !== 0) {
      errors.push(`${name}: checker only supports generator filter 0`);
      break;
    }
    for (let x = 0; x < width; x++) {
      const alpha = scanlines[y * (width * 4 + 1) + 1 + x * 4 + 3];
      if (alpha === 0) transparent++;
      else visible++;
    }
  }
  if (transparent === 0) errors.push(`${name}: no transparent pixels`);
  if (visible === 0) errors.push(`${name}: no visible pixels`);
}

if (files.length !== expected)
  errors.push(`expected ${expected} reference PNGs, found ${files.length}`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} transparent 384×384 RGBA reference PNGs.`);
}

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUTPUT = "content/v2/sprite-metadata.json";
const REGISTRY = "docs/overhaul/gate-0/id-registry.json";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

const metadata = JSON.parse(await readFile(OUTPUT, "utf8"));
const registry = JSON.parse(await readFile(REGISTRY, "utf8"));
if (metadata.schema_version !== "tomlandia-creature-sprite-metadata/v1") {
  throw new Error(`Unexpected sprite metadata schema: ${metadata.schema_version ?? "none"}`);
}
if (!Array.isArray(metadata.sprites) || metadata.sprites.length !== 32) {
  throw new Error(`Expected 32 prepared creature sprites; found ${metadata.sprites?.length ?? "none"}`);
}
if (/archiveOrdinal/i.test(JSON.stringify(metadata))) {
  throw new Error("Archive ordinals must not enter canonical sprite metadata");
}

const sprites = [...metadata.sprites].sort((a, b) => a.kind.localeCompare(b.kind));
const actualKinds = sprites.map((sprite) => sprite.kind);
const expectedKinds = [...registry.sprite_kinds].sort((a, b) => a.localeCompare(b));
if (new Set(actualKinds).size !== 32 || JSON.stringify(actualKinds) !== JSON.stringify(expectedKinds)) {
  throw new Error("Prepared sprite metadata does not exactly match the locked 32-kind registry");
}

const sha256 = /^[0-9a-f]{64}$/;
for (const sprite of sprites) {
  const expectedPath = `assets/creatures/${sprite.kind}.png`;
  if (sprite.asset_key !== `${sprite.kind}_sprite` || sprite.asset_path !== expectedPath) {
    throw new Error(`${sprite.kind}: non-canonical asset identity`);
  }
  if (!sha256.test(sprite.source_sha256) || !sha256.test(sprite.padded_sha256)) {
    throw new Error(`${sprite.kind}: invalid SHA-256 provenance`);
  }
  if (sprite.motion_profile !== "static_front_facing_bob") {
    throw new Error(`${sprite.kind}: unexpected motion profile`);
  }

  const bytes = await readFile(`public/${expectedPath}`);
  const signature = bytes.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error(`${sprite.kind}: asset is not a valid PNG`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== sprite.canvas.width || height !== sprite.canvas.height) {
    throw new Error(`${sprite.kind}: PNG dimensions ${width}x${height} do not match canonical canvas`);
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== sprite.padded_sha256) throw new Error(`${sprite.kind}: padded asset hash mismatch`);

  const inCanvas = (value, maximum) => Number.isFinite(value) && value >= 0 && value <= maximum;
  if (!inCanvas(sprite.pivot.x, width) || !inCanvas(sprite.pivot.y, height)) {
    throw new Error(`${sprite.kind}: pivot falls outside the padded canvas`);
  }
  for (const [label, bounds] of [["visual", sprite.visual_bounds], ["click", sprite.click_bounds]]) {
    if (
      !inCanvas(bounds.left, width) || !inCanvas(bounds.right, width)
      || !inCanvas(bounds.top, height) || !inCanvas(bounds.bottom, height)
      || bounds.left > bounds.right || bounds.top > bounds.bottom
    ) {
      throw new Error(`${sprite.kind}: ${label} bounds fall outside the padded canvas`);
    }
  }
}

const output = `${JSON.stringify(canonical({ ...metadata, sprites }), null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(OUTPUT, "utf8").catch(() => "");
  if (current !== output) {
    console.error(`Gate 5 sprite metadata drift: ${OUTPUT}`);
    process.exitCode = 1;
  } else {
    console.log(`Verified ${OUTPUT} (${sprites.length} canonical kinds)`);
  }
} else {
  await mkdir("content/v2", { recursive: true });
  await writeFile(OUTPUT, output, "utf8");
  console.log(`Wrote ${OUTPUT} (${sprites.length} canonical kinds)`);
}

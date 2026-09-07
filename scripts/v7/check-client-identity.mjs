// V7 published-client identity guard.
//
// Proves that every generated client release pin agrees with the V7 release
// being activated, so the V6 stale-world-stamp incident cannot repeat. It
// reads generated files only; it performs no database access.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const RELEASE = Object.freeze({
  contentVersion: "v7",
  spawnSetVersion: "v7",
  contentManifestHash: "89789521c5b84948af1b954e86fdd9d6bea127d8315d3bb5b4f553d340a46935",
  worldSpawnHash: "3c3602f8247d58655d4a004f4af1cf330f606a84d0f22509e8a5ab5cdc47577c",
  nodes: 369,
  monsters: 361,
});

const read = async (relativePath) => readFile(path.join(repoRoot, relativePath), "utf8");

const contentManifest = await read("src/generated/content-manifest.ts");
const worldManifest = await read("src/generated/world-manifest.ts");
const releaseCatalog = await read("src/generated/release-catalog.ts");

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(
  contentManifest.includes(`export const CONTENT_VERSION = "${RELEASE.contentVersion}"`),
  `content-manifest.ts CONTENT_VERSION is not ${RELEASE.contentVersion}`,
);
expect(
  contentManifest.includes(`export const SPAWN_SET_VERSION = "${RELEASE.spawnSetVersion}"`),
  `content-manifest.ts SPAWN_SET_VERSION is not ${RELEASE.spawnSetVersion}`,
);
expect(
  contentManifest.includes(`export const CONTENT_MANIFEST_HASH = "${RELEASE.contentManifestHash}"`),
  "content-manifest.ts does not carry the V7 content hash",
);
expect(
  worldManifest.includes(`export const SPAWN_SET_VERSION = "${RELEASE.spawnSetVersion}"`),
  `world-manifest.ts SPAWN_SET_VERSION is not ${RELEASE.spawnSetVersion}`,
);
expect(
  worldManifest.includes(`export const WORLD_SPAWN_HASH = "${RELEASE.worldSpawnHash}"`),
  "world-manifest.ts does not carry the V7 world-spawn hash",
);
expect(
  worldManifest.includes(`{ nodes: ${RELEASE.nodes}, monsters: ${RELEASE.monsters} }`),
  "world-manifest.ts spawn counts do not match V7",
);
expect(
  releaseCatalog.includes(`RELEASE_CONTENT_VERSION = "${RELEASE.contentVersion}"`),
  "release-catalog.ts is not promoted to V7",
);

if (failures.length) {
  console.error("V7 client identity check FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  [
    "V7 client identity verified:",
    `  content version:  ${RELEASE.contentVersion}`,
    `  world version:    ${RELEASE.spawnSetVersion}`,
    `  content hash:     ${RELEASE.contentManifestHash}`,
    `  world spawn hash: ${RELEASE.worldSpawnHash}`,
  ].join("\n"),
);

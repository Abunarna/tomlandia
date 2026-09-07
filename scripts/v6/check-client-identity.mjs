// V6 published-client identity guard.
//
// The V6 world manifest was once left pinned to the V5 spawn set while the
// content manifest had already been promoted, which put the published client
// into maintenance mode against live V6. This static check proves that every
// client-side release pin agrees with active production V6 before any build or
// publish. It reads generated files only; it performs no database access.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const ACTIVE_RELEASE = Object.freeze({
  contentVersion: "v6",
  spawnSetVersion: "v6",
  contentManifestHash: "d87267194b34a7eba300115adfa29600d1d63f52daad4e0e96b947414e673d9e",
  worldSpawnHash: "69a4276f9466c02eef28ff8b8d93804e9d103504c163c1e1aa630dd9aba0c163",
  nodes: 369,
  monsters: 361,
});

const read = async (relativePath) => readFile(path.join(repoRoot, relativePath), "utf8");

const contentManifest = await read("src/generated/content-manifest.ts");
const worldManifest = await read("src/generated/world-manifest.ts");

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(
  contentManifest.includes(`export const CONTENT_VERSION = "${ACTIVE_RELEASE.contentVersion}"`),
  `content-manifest.ts CONTENT_VERSION is not ${ACTIVE_RELEASE.contentVersion}`,
);
expect(
  contentManifest.includes(`export const SPAWN_SET_VERSION = "${ACTIVE_RELEASE.spawnSetVersion}"`),
  `content-manifest.ts SPAWN_SET_VERSION is not ${ACTIVE_RELEASE.spawnSetVersion}`,
);
expect(
  contentManifest.includes(
    `export const CONTENT_MANIFEST_HASH = "${ACTIVE_RELEASE.contentManifestHash}"`,
  ),
  "content-manifest.ts does not carry the active V6 content hash",
);
expect(
  worldManifest.includes(`export const SPAWN_SET_VERSION = "${ACTIVE_RELEASE.spawnSetVersion}"`),
  `world-manifest.ts SPAWN_SET_VERSION is not ${ACTIVE_RELEASE.spawnSetVersion}`,
);
expect(
  worldManifest.includes(`export const WORLD_SPAWN_HASH = "${ACTIVE_RELEASE.worldSpawnHash}"`),
  "world-manifest.ts does not carry the active V6 world-spawn hash",
);
expect(
  worldManifest.includes(
    `{ nodes: ${ACTIVE_RELEASE.nodes}, monsters: ${ACTIVE_RELEASE.monsters} }`,
  ),
  "world-manifest.ts spawn counts do not match active V6",
);

if (failures.length) {
  console.error("V6 client identity check FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  [
    "V6 client identity verified against active production release:",
    `  content version:  ${ACTIVE_RELEASE.contentVersion}`,
    `  world version:    ${ACTIVE_RELEASE.spawnSetVersion}`,
    `  content hash:     ${ACTIVE_RELEASE.contentManifestHash}`,
    `  world spawn hash: ${ACTIVE_RELEASE.worldSpawnHash}`,
  ].join("\n"),
);

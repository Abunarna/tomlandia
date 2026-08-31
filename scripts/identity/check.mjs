// Canonical identity guard.
//
// Refuses to let content/migration work run against anything other than the
// canonical Cozy Canvas project. Any release action must be preceded by this
// check so a remix or fork can never be mistaken for the canonical backend.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const CANONICAL_IDENTITY = Object.freeze({
  lovableProjectId: "10d00f6b-da27-43c4-a205-c0b7841a64fc",
  supabaseProjectRef: "fhelsfnbvrmnxuynyoqu",
  productionUrl: "https://tomlandia.lovable.app",
  contentRelease: "v3",
  contentManifestHash: "f8bc150f0edd4abfdec405dd7f58007d3e9da699100f2ec54cf2ecbd9fa03a0a",
  worldSpawnHash: "38d2615e5ce144f70ffe8bf791603afae42b16b0c87fae1da0a1a886d7a8acba",
});

async function read(relativePath) {
  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const env = (await read(".env")) ?? "";
const config = (await read("supabase/config.toml")) ?? "";

expect(
  env.includes(CANONICAL_IDENTITY.supabaseProjectRef),
  `.env does not reference the canonical Supabase project ref ${CANONICAL_IDENTITY.supabaseProjectRef}`,
);
expect(
  config.includes(CANONICAL_IDENTITY.supabaseProjectRef),
  `supabase/config.toml does not reference the canonical Supabase project ref ${CANONICAL_IDENTITY.supabaseProjectRef}`,
);

const envRef = /VITE_SUPABASE_PROJECT_ID\s*=\s*"?([a-z0-9]+)"?/.exec(env)?.[1];
expect(
  !envRef || envRef === CANONICAL_IDENTITY.supabaseProjectRef,
  `.env points at a non-canonical Supabase project ref: ${envRef}`,
);

// The canonical client must be pinned to the canonical content release.
const contentManifest = (await read("src/generated/content-manifest.ts")) ?? "";
const worldManifest = (await read("src/generated/world-manifest.ts")) ?? "";

expect(
  contentManifest.includes(`export const CONTENT_VERSION = "${CANONICAL_IDENTITY.contentRelease}"`),
  `src/generated/content-manifest.ts is not pinned to contentRelease ${CANONICAL_IDENTITY.contentRelease}`,
);
expect(
  contentManifest.includes(`export const SPAWN_SET_VERSION = "${CANONICAL_IDENTITY.contentRelease}"`),
  `src/generated/content-manifest.ts spawn-set version is not ${CANONICAL_IDENTITY.contentRelease}`,
);
expect(
  contentManifest.includes(CANONICAL_IDENTITY.contentManifestHash),
  "src/generated/content-manifest.ts does not carry the canonical content-manifest hash",
);
expect(
  worldManifest.includes(`export const SPAWN_SET_VERSION = "${CANONICAL_IDENTITY.contentRelease}"`),
  `src/generated/world-manifest.ts is not pinned to contentRelease ${CANONICAL_IDENTITY.contentRelease}`,
);
expect(
  worldManifest.includes(CANONICAL_IDENTITY.worldSpawnHash),
  "src/generated/world-manifest.ts does not carry the canonical world-spawn hash",
);

if (failures.length) {
  console.error("Canonical identity check FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  [
    "Canonical identity verified:",
    `  Lovable project ID:  ${CANONICAL_IDENTITY.lovableProjectId}`,
    `  Supabase project ref: ${CANONICAL_IDENTITY.supabaseProjectRef}`,
    `  Production URL:       ${CANONICAL_IDENTITY.productionUrl}`,
    `  Content release:      ${CANONICAL_IDENTITY.contentRelease}`,
    `  Content manifest:     ${CANONICAL_IDENTITY.contentManifestHash}`,
    `  World spawn hash:     ${CANONICAL_IDENTITY.worldSpawnHash}`,
  ].join("\n"),
);

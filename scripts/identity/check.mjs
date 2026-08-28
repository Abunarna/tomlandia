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
  ].join("\n"),
);

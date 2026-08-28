import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateOutputs, generateRuntimeOutputs, OUTPUT_PATHS } from "./model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));

// Which release to verify, and where its generated artifacts live. The active
// client build (v3) writes into the repo root; earlier releases keep their
// generated artifacts under artifacts/<version> so both stay verifiable.
const argv = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};
const inputPath = argValue("--input", "content/v2/manifest.authoring.json");
const artifactRoot = argValue("--artifact-root", "artifacts/v2");

const manifest = await readJson(inputPath);
const registry = await readJson("docs/overhaul/gate-0/id-registry.json");
const schema = await readJson("content/schema/manifest.schema.json");

if (schema.$id !== "https://tomlandia.game/schemas/content-manifest-v1.json") {
  throw new Error("Unexpected canonical manifest schema identity");
}
if (manifest.lifecycle === "draft") {
  let draftRuntimeRejected = false;
  try {
    generateRuntimeOutputs(manifest, registry);
  } catch (error) {
    draftRuntimeRejected = /Refusing runtime generation/.test(String(error?.message));
  }
  if (!draftRuntimeRejected) throw new Error("Draft manifest unexpectedly entered runtime generation");
} else if (manifest.lifecycle === "runtime") {
  generateRuntimeOutputs(manifest, registry);
} else {
  throw new Error(`Unsupported canonical manifest lifecycle: ${manifest.lifecycle}`);
}

const generated = generateOutputs(manifest, registry);
for (const [relativePath, expected] of Object.entries(generated.files)) {
  const actual = await readFile(path.join(root, artifactRoot, relativePath), "utf8");
  if (actual !== expected) throw new Error(`Generated output drift: ${relativePath}`);
  if (!actual.includes(generated.hash)) throw new Error(`Generated output omits manifest hash: ${relativePath}`);
}

const client = generated.files[OUTPUT_PATHS.client];
const sql = generated.files[OUTPUT_PATHS.sql];
if (!client.includes(`CONTENT_MANIFEST_HASH = "${generated.hash}"`)) {
  throw new Error("Generated client hash does not match canonical manifest");
}
if (!sql.includes(`Manifest SHA-256: ${generated.hash}`)) {
  throw new Error("Generated SQL hash does not match canonical manifest");
}
if (manifest.lifecycle === "draft" && !sql.includes("draft-only and cannot be applied")) {
  throw new Error("Draft SQL is missing its hard execution guard");
}
if (manifest.lifecycle === "runtime") {
  if (!sql.includes("This stages content only; it never changes the active control row.")) {
    throw new Error("Runtime SQL is missing its staged-only safety declaration");
  }
  if (!sql.includes("'staged'")) throw new Error("Runtime SQL does not create a staged version");
  if (/VALUES \([^\n]*'active'/.test(sql)) throw new Error("Runtime SQL attempts to activate content");
  if (/archiveOrdinal/i.test(JSON.stringify(manifest))) {
    throw new Error("Archive ordinals must never enter the canonical manifest");
  }
}

const dataSource = await readFile(path.join(root, "src/game/data.ts"), "utf8");
if (/return\s+ITEMS\[id\]\s*\?\?\s*ITEMS\["oak_logs"\]/.test(dataSource)) {
  throw new Error("Unknown item IDs still silently fall back to oak_logs");
}
if (!dataSource.includes("UnknownItemIdError")) {
  throw new Error("Unknown item IDs do not have a visible typed failure");
}

const migration = await readFile(
  path.join(root, "supabase/migrations/20260824070000_gate4_content_contract.sql"),
  "utf8",
);
const gate5Migration = await readFile(
  path.join(root, "supabase/migrations/20260824080000_gate5_complete_content_contract.sql"),
  "utf8",
);
for (const requiredFragment of [
  "CREATE TABLE public.game_content_versions",
  "CREATE TABLE public.game_content_control",
  "CREATE TABLE public.game_content_items",
  "CREATE TABLE public.game_content_spawns",
  "CREATE OR REPLACE FUNCTION public.game_validate_content_version",
  "PRIMARY KEY (content_version, item_id, plus)",
  "unsupported_content_version",
]) {
  if (!migration.includes(requiredFragment)) throw new Error(`Gate 4 migration omits: ${requiredFragment}`);
}
if (/^INSERT INTO public\.game_content_versions/gm.test(migration)) {
  throw new Error("Gate 4 schema migration must not insert a content version");
}
if (/^INSERT INTO public\.game_content_control/gm.test(migration)) {
  throw new Error("Gate 4 schema migration must not create an active control row");
}
for (const requiredFragment of [
  "ADD COLUMN starter_loadout",
  "ADD COLUMN mechanics",
  "ADD COLUMN icon_key",
  "ADD COLUMN visual jsonb",
  "ADD COLUMN reward_mode",
  "replace_or_compensate",
  "game_content_items_tier_band_fkey",
  "CREATE OR REPLACE FUNCTION public.game_validate_content_version",
]) {
  if (!gate5Migration.includes(requiredFragment)) {
    throw new Error(`Gate 5 migration omits: ${requiredFragment}`);
  }
}
if (/^INSERT INTO public\.game_content_versions/gm.test(gate5Migration)) {
  throw new Error("Gate 5 schema migration must not insert a content version");
}
if (/^INSERT INTO public\.game_content_control/gm.test(gate5Migration)) {
  throw new Error("Gate 5 schema migration must not create an active control row");
}

console.log(`Canonical content contract verified: ${manifest.content_version} (${manifest.lifecycle}, ${generated.hash})`);

/**
 * Generates the V7 client release catalogue into artifacts/v7.
 *
 * The catalogue shape is produced by the shared release-agnostic generator, so
 * V7 cannot fork it. The published client keeps the active (V6) catalogue until
 * rollout: --promote writes src/generated/release-catalog.ts instead.
 */
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const promote = argv.includes("--promote");
const output = promote
  ? "src/generated/release-catalog.ts"
  : "artifacts/v7/src/generated/release-catalog.ts";

const result = spawnSync(
  process.execPath,
  [
    "scripts/v6/build-client-catalog.mjs",
    "--input",
    "content/v7/manifest.authoring.json",
    "--output",
    output,
    "--generator",
    "scripts/v7/build-client-catalog.mjs",
    ...(argv.includes("--check") ? ["--check"] : []),
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);

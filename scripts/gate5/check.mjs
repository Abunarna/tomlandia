import { spawnSync } from "node:child_process";

const loader = [
  "--no-warnings",
  "--experimental-strip-types",
  "--loader",
  "./scripts/gate5/ts-loader.mjs",
];

const checks = [
  ["live definitions", ["scripts/gate5/snapshot-live.mjs", "--check"]],
  ["frozen V1 spawn baseline", ["scripts/gate5/check-frozen-spawns.mjs"]],
  ["sprite metadata", ["scripts/gate5/normalize-sprites.mjs", "--check"]],
  ["locked V2 content baseline", ["scripts/gate5/check-locked-v2-content.mjs"]],
  ["generated content contract", ["scripts/content/check.mjs"]],
  ["generated artifact drift", ["scripts/content/generate.mjs", "--check"]],
  ["manifest validation tests", ["--test", "tests/content/manifest-contract.test.mjs"]],
  ["complete-content tests", ["--test", "tests/content/gate5-complete-content.test.mjs"]],
  ["new spawn geometry", [...loader, "scripts/gate5/check-world-spawns.mjs"]],
];

for (const [label, args] of checks) {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`Gate 5 check failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`Gate 5 complete-content verification passed (${checks.length} check groups)`);

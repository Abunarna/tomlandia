import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const snapshotPath = join(root, "docs/overhaul/gate-1/rpc-contracts.snapshot.json");
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const expected = Object.keys(snapshot.rpcs).sort();
const failures = [];

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const sourceFiles = filesUnder(sourceRoot).filter((path) => /\.[cm]?[jt]sx?$/.test(path));
const calls = [];

for (const path of sourceFiles) {
  const source = readFileSync(path, "utf8");
  const matches = [...source.matchAll(/\.rpc\(\s*["']([a-z0-9_]+)["']/g)];
  if (matches.length === 0) continue;

  if (!source.includes("parseRpcResponse")) {
    failures.push(`${relative(root, path)} invokes an RPC without parseRpcResponse`);
  }

  for (const match of matches) {
    calls.push(match[1]);
    const tail = source.slice(match.index, match.index + 2_000);
    if (/as\s+unknown\s+as/.test(tail)) {
      failures.push(`${relative(root, path)} treats a double cast as RPC validation near ${match[1]}`);
    }
  }
}

const actual = [...new Set(calls)].sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  failures.push(`RPC call set differs from snapshot\nexpected: ${expected.join(", ")}\nactual:   ${actual.join(", ")}`);
}

// market_browse has two deliberate consumers: the game server function and
// the authenticated read-only MCP tool. Both are required to parse the same
// shared contract; every mutation RPC retains a single application boundary.
const expectedBoundaryCounts = { market_browse: 2 };
for (const name of expected) {
  const count = calls.filter((value) => value === name).length;
  const wanted = expectedBoundaryCounts[name] ?? 1;
  if (count !== wanted) failures.push(`${name} must have ${wanted} validated application boundary/boundaries; found ${count}`);
}

const boundaryFiles = [
  "src/lib/world.functions.ts",
  "src/lib/market.functions.ts",
  "src/lib/leaderboard.functions.ts",
  "src/routes/_authenticated/play.tsx",
  "src/lib/mcp/tools/browse-market.ts",
];
const legacyResponseTypes =
  /as\s+unknown\s+as\s+(?:HarvestRes|DamageRes|FishRes|PotionRes|CraftRes|GearRes|BrowseRes|MarketRes|LeaderRes|SyncAck)/;
for (const file of boundaryFiles) {
  const source = readFileSync(join(root, file), "utf8");
  if (legacyResponseTypes.test(source)) failures.push(`${file} still casts an RPC payload to a response type`);
}

const migrationDir = join(root, "supabase/migrations");
const migrationCount = readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).length;
if (migrationCount < 39) failures.push(`migration history is incomplete: expected at least 39 files, found ${migrationCount}`);

if (failures.length) {
  console.error(`Gate 1 static boundary check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Gate 1 static boundary check passed: ${actual.length} RPCs, ${migrationCount} migrations, zero cast-as-validation boundaries.`);

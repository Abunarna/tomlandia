/**
 * Deterministic V7 verification.
 *
 * Runs every V7 generator in --check mode (so any hand edit to a generated
 * artifact fails), then asserts the release invariants the owner froze:
 * the healing curve, the heal-only delta, unchanged values and recipes,
 * unchanged world geometry, no deletions, and the generic manual-eating fix.
 */
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FOODS, FOOD_IDS, HEAL_CURVE, V6_VERSION, V7_VERSION } from "./model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = async (rel) => readFile(path.join(root, rel), "utf8");
const readJson = async (rel) => JSON.parse(await read(rel));

const run = (label, args) => {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`V7 check failed: ${label}`);
    process.exit(result.status ?? 1);
  }
};

run("content and world artifacts", ["scripts/v7/build.mjs", "--check"]);
run("client catalogue", ["scripts/v7/build-client-catalog.mjs", "--check"]);
run("migrations", ["scripts/v7/build-migrations.mjs", "--check"]);
run("planning model", ["scripts/v7/model-healing-foods.mjs", "--check"]);

const expected = [15, 45, 120, 135, 155, 180, 210, 245, 300, 340, 375, 445, 485, 525, 605, 645];
if (HEAL_CURVE.join(",") !== expected.join(",")) {
  throw new Error("The frozen V7 healing curve has been altered");
}
if (new Set(FOOD_IDS).size !== 16) throw new Error("V7 must carry exactly 16 stable food ids");

const v6 = await readJson("content/v6/manifest.authoring.json");
const v7 = await readJson("content/v7/manifest.authoring.json");
if (v6.content_version !== V6_VERSION || v7.content_version !== V7_VERSION) {
  throw new Error("V7 must derive from canonical V6");
}

const byId = (manifest) => new Map(manifest.runtime.items.map((item) => [item.id, item]));
const before = byId(v6);
const after = byId(v7);
if (before.size !== after.size) throw new Error("V7 changes the item count");

for (const [id, prior] of before) {
  const next = after.get(id);
  if (!next) throw new Error(`V7 deletes item ${id}`);
  const food = FOODS.find((entry) => entry.id === id);
  const priorCopy = structuredClone(prior);
  const nextCopy = structuredClone(next);
  if (food) {
    if (nextCopy.stats.heal !== food.heal) {
      throw new Error(`${id} does not carry its frozen heal (${food.heal})`);
    }
    priorCopy.stats.heal = nextCopy.stats.heal;
  }
  if (JSON.stringify(priorCopy) !== JSON.stringify(nextCopy)) {
    throw new Error(`V7 changes a field other than heal on ${id}`);
  }
  if (prior.value !== next.value) throw new Error(`V7 changes the value of ${id}`);
}

if (JSON.stringify(v6.runtime.recipes) !== JSON.stringify(v7.runtime.recipes)) {
  throw new Error("V7 changes recipes; only healing amounts may change");
}
for (const key of ["monsters", "nodes", "fish", "quests", "fishing_spots", "bosses"]) {
  if (JSON.stringify(v6.runtime[key]) !== JSON.stringify(v7.runtime[key])) {
    throw new Error(`V7 changes ${key}; only healing amounts may change`);
  }
}

const mechanics = v7.runtime.mechanics.healing_foods;
if (!Array.isArray(mechanics) || mechanics.length !== 16) {
  throw new Error("V7 runtime mechanics must publish all 16 dishes");
}
for (const entry of mechanics) {
  const food = FOODS.find((row) => row.id === entry.item_id);
  if (!food || entry.heal !== food.heal) throw new Error(`Mechanics drift for ${entry.item_id}`);
  if (entry.value !== before.get(entry.item_id).value) {
    throw new Error(`Mechanics publish a changed value for ${entry.item_id}`);
  }
}

const world6 = await readJson("content/v6/world-spawn-manifest.json");
const world7 = await readJson("content/v7/world-spawn-manifest.json");
const geometry = (world) =>
  world.spawns
    .map((spawn) => `${spawn.entity_type}|${spawn.kind}|${spawn.x}|${spawn.y}`)
    .sort()
    .join("\n");
if (geometry(world6) !== geometry(world7)) throw new Error("V7 moves world spawns");
if (world7.spawns.length !== 730) throw new Error("V7 changes the spawn count");

const runtimeSql = await read("supabase/v7/food-runtime.sql");
for (const required of [
  "game_runtime_items",
  "FOR UPDATE",
  "'full_health'",
  "'too_fast'",
  "'not_food'",
  "least(heal, max_hp - hp)",
  "GRANT EXECUTE ON FUNCTION public.consume_food(integer) TO authenticated",
]) {
  if (!runtimeSql.includes(required)) {
    throw new Error(`Manual eating is missing its ${required} guarantee`);
  }
}
const runtimeBody = (runtimeSql.match(/AS \$\$[\s\S]*?\n\$\$;/) ?? [""])[0];
if (!runtimeBody) throw new Error("Manual eating has no function body");
if (/public\.game_items/.test(runtimeBody)) {
  throw new Error("Manual eating still reads the legacy item table");
}
for (const id of FOOD_IDS) {
  if (runtimeBody.includes(id)) throw new Error(`Manual eating hard-codes ${id}`);
}
if (/CREATE OR REPLACE FUNCTION public\.try_auto_eat/.test(runtimeSql)) {
  throw new Error("V7 must not redefine auto-eat");
}

const tests = await read("supabase/tests/v7_manual_eating.sql");
for (const id of FOOD_IDS) {
  if (!tests.includes(id)) throw new Error(`No manual-eating regression covers ${id}`);
}

const clientCatalogue = await read("src/generated/release-catalog.ts");
if (!clientCatalogue.includes("RELEASE_FOODS")) {
  throw new Error("The client catalogue does not publish the food ladder");
}
if (clientCatalogue.includes(`RELEASE_CONTENT_VERSION = "${V7_VERSION}"`)) {
  throw new Error("The V7 client catalogue must not be promoted before activation");
}

console.log(
  `V7 verified: 16 dishes re-rated, values unchanged, world unchanged, manual eating generic (${HEAL_CURVE.join(", ")})`,
);

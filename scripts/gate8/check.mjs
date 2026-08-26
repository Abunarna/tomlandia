import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const run = (args) => {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(["scripts/gate8/build-creature-registry.mjs", "--check"]);
run(["scripts/gate8/build-content-catalog.mjs", "--check"]);
run(["--test", "tests/content/gate8-content-display.test.mjs", "tests/content/gate8-creature-sprites.test.mjs", "tests/content/gate8-market-tiers.test.mjs", "tests/content/gate8-world-runtime.test.mjs"]);

const [engine, runtime, world] = await Promise.all([
  readFile(resolve(root, "src/game/engine.ts"), "utf8"),
  readFile(resolve(root, "src/game/world-runtime.ts"), "utf8"),
  readFile(resolve(root, "src/game/world.ts"), "utf8"),
]);
if (!engine.includes("preloadCreatureSprites") || !engine.includes("creaturePointerHit")) {
  throw new Error("Gate 8 sprite preload and pointer integration are required");
}
if (!engine.includes("drawCreatureSprite") || !engine.includes("if (!usedSprite)")) {
  throw new Error("Gate 8 must retain a procedural monster fallback");
}
if (!engine.includes("sprite.visual_bounds.top") || !engine.includes("labelTop")) {
  throw new Error("Gate 8 sprite labels must follow prepared visual bounds");
}
if (!runtime.includes("V2_WORLD_SPAWN_HASH") || !runtime.includes('mode: "maintenance"')) {
  throw new Error("Gate 8 version mismatch must fail closed into maintenance");
}
if (!world.includes("game_world_runtime_status") || !world.includes("resolveWorldRuntime")) {
  throw new Error("Gate 8 client must check the world runtime control plane");
}
console.log("Gate 8 dual-client static verification passed.");

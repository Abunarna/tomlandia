import { readFile, writeFile } from "node:fs/promises";

import { biomeAt, blockedAt, WORLD_H, WORLD_W } from "../../src/game/data.ts";
import { NEW_MONSTER_SPAWN_SPECS, NEW_NODE_SPAWN_SPECS } from "./spawn-spec.mjs";

const OUTPUT = "content/v2/new-spawn-placements.json";

function candidatesFor(spec, count) {
  const [kind, biome, subzone, anchorX, anchorY] = spec;
  const candidates = [];
  for (let radius = 0; radius <= 320 && candidates.length < count; radius += 16) {
    const steps = radius === 0 ? 1 : 24;
    for (let step = 0; step < steps && candidates.length < count; step += 1) {
      const angle = (Math.PI * 2 * step) / steps;
      const x = Math.round(anchorX + Math.cos(angle) * radius);
      const y = Math.round(anchorY + Math.sin(angle) * radius);
      if (x < 0 || x > WORLD_W || y < 0 || y > WORLD_H) continue;
      if (biomeAt(x, y).key.split("-")[0] !== biome || blockedAt(x, y, 14)) continue;
      if (candidates.some((candidate) => Math.hypot(candidate.x - x, candidate.y - y) < 28)) continue;
      candidates.push({ kind, biome, subzone, x, y });
    }
  }
  if (candidates.length !== count) {
    throw new Error(`Could not place ${count} safe ${kind} spawns near ${anchorX},${anchorY}`);
  }
  return candidates;
}

const placements = {
  schema_version: "tomlandia-gate5-new-spawn-placements/v1",
  world: { width: WORLD_W, height: WORLD_H },
  node_spawns: NEW_NODE_SPAWN_SPECS.flatMap((spec) => candidatesFor(spec, 10)),
  monster_spawns: NEW_MONSTER_SPAWN_SPECS.flatMap((spec) => candidatesFor(spec, 6)),
};
const output = `${JSON.stringify(placements, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(OUTPUT, "utf8").catch(() => "");
  if (current !== output) {
    console.error(`Gate 5 new-spawn placement drift: ${OUTPUT}`);
    process.exitCode = 1;
  } else {
    console.log(`Verified ${OUTPUT}`);
  }
} else {
  await writeFile(OUTPUT, output, "utf8");
  console.log(
    `Wrote ${OUTPUT} (${placements.node_spawns.length} node candidates, ` +
      `${placements.monster_spawns.length} monster spawns)`,
  );
}

import { readFile } from "node:fs/promises";

import { biomeAt, blockedAt, WORLD_H, WORLD_W } from "../world-source/data.mjs";

const manifest = JSON.parse(await readFile("content/v2/manifest.authoring.json", "utf8"));
const registry = JSON.parse(await readFile("docs/overhaul/gate-0/id-registry.json", "utf8"));
const issues = [];

const check = (spawns, kinds, entityType) => {
  const expectedKinds = new Set(kinds);
  for (const spawn of spawns.filter((entry) => expectedKinds.has(entry.kind))) {
    const path = `${entityType}:${spawn.kind}:${spawn.ordinal}`;
    const actualBiome = biomeAt(spawn.x, spawn.y).key.split("-")[0];
    if (actualBiome !== spawn.biome) {
      issues.push(`${path} declares ${spawn.biome} but biomeAt(${spawn.x}, ${spawn.y}) is ${actualBiome}`);
    }
    if (blockedAt(spawn.x, spawn.y, 14)) issues.push(`${path} is on blocked world geometry`);
    if (spawn.x < 0 || spawn.x > WORLD_W || spawn.y < 0 || spawn.y > WORLD_H) {
      issues.push(`${path} is outside ${WORLD_W}×${WORLD_H}`);
    }
  }
};

check(manifest.runtime.node_spawns, registry.new_ids.node_kinds, "node");
check(manifest.runtime.monster_spawns, registry.new_ids.monster_kinds, "monster");

if (issues.length) {
  console.error(`Gate 5 new-spawn geometry failed with ${issues.length} issue(s):\n- ${issues.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Gate 5 new-spawn geometry passed (${registry.new_ids.node_kinds.length} node kinds, ` +
      `${registry.new_ids.monster_kinds.length} monster kinds)`,
  );
}

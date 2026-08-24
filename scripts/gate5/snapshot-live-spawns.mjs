import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { biomeAt, MONSTER_SPAWNS, NODE_SPAWNS } from "../../src/game/data.ts";

const SOURCE = "src/game/data.ts";
const OUTPUT = "docs/overhaul/gate-5/live-v1-spawns.json";

function canonicalSpawns(spawns) {
  return spawns.map(({ kind, x, y }) => ({
    kind,
    x,
    y,
    biome: biomeAt(x, y).key.split("-")[0],
  }));
}

const source = await readFile(SOURCE, "utf8");
const snapshot = {
  snapshot_version: "tomlandia-v1-spawn-snapshot/1",
  source_file: SOURCE,
  source_sha256: createHash("sha256").update(source).digest("hex"),
  node_spawns: canonicalSpawns(NODE_SPAWNS),
  monster_spawns: canonicalSpawns(MONSTER_SPAWNS),
};

const expected = `${JSON.stringify(snapshot, null, 2)}\n`;
const check = process.argv.includes("--check");

if (check) {
  const current = await readFile(OUTPUT, "utf8").catch(() => "");
  if (current !== expected) {
    console.error(`Gate 5 live spawn snapshot drift detected: ${OUTPUT}`);
    process.exitCode = 1;
  } else {
    console.log(`Verified ${OUTPUT}`);
  }
} else {
  await mkdir("docs/overhaul/gate-5", { recursive: true });
  await writeFile(OUTPUT, expected, "utf8");
  console.log(
    `Wrote ${OUTPUT} (${snapshot.node_spawns.length} nodes, ${snapshot.monster_spawns.length} monsters)`,
  );
}

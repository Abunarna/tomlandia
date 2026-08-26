import { readFile } from "node:fs/promises";

const path = "docs/overhaul/gate-5/live-v1-spawns.json";
const snapshot = JSON.parse(await readFile(path, "utf8"));

if (snapshot.snapshot_version !== "tomlandia-v1-spawn-snapshot/1") {
  throw new Error("Unexpected frozen V1 spawn snapshot version");
}
if (snapshot.node_spawns.length !== 311 || snapshot.monster_spawns.length !== 289) {
  throw new Error("Frozen V1 spawn baseline count drifted");
}
const identities = new Set(snapshot.node_spawns.map((spawn, ordinal) => `${spawn.kind}:${ordinal}:${spawn.x}:${spawn.y}`));
if (identities.size !== snapshot.node_spawns.length) {
  throw new Error("Frozen V1 node spawn baseline contains duplicate rows");
}
console.log("Verified frozen Gate 5 V1 spawn baseline (311 nodes, 289 monsters).");

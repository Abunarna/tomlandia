import { readFile } from "node:fs/promises";

import { manifestHash, validateManifest } from "../content/model.mjs";

const [manifest, registry, placements, locked] = await Promise.all([
  readFile("content/v2/manifest.authoring.json", "utf8").then(JSON.parse),
  readFile("docs/overhaul/gate-0/id-registry.json", "utf8").then(JSON.parse),
  readFile("content/v2/new-spawn-placements.json", "utf8").then(JSON.parse),
  readFile("content/v2/locked-world-placements.json", "utf8").then(JSON.parse),
]);

// Gate 5 is a captured V2 baseline. The legacy renderer's evolving placement
// arrays are not an authority allowed to rewrite this reviewed world.
validateManifest(manifest, registry);
if (manifestHash(manifest) !== "02da86c9d232f28628fbf015fab906a637af19fccaf8ebae0ae1e1d236b6054d") {
  throw new Error("Locked V2 content manifest drifted");
}
if (placements.node_spawns.length !== 90 || placements.monster_spawns.length !== 72) {
  throw new Error("Locked V2 candidate placement counts drifted");
}
if (locked.spawn_hash !== "166990ac15a5791c8ab2bf590867fa471211ad6696ad7ec17c3700c0ba82e80d") {
  throw new Error("Locked Gate 7 spawn hash drifted");
}
console.log("Verified locked Gate 5/7 V2 content baseline.");

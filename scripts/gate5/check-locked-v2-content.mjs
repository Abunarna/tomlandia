import { readFile } from "node:fs/promises";

import { validateManifest } from "../content/model.mjs";

const [manifest, registry, placements, locked] = await Promise.all([
  readFile("content/v2/manifest.authoring.json", "utf8").then(JSON.parse),
  readFile("docs/overhaul/gate-0/id-registry.json", "utf8").then(JSON.parse),
  readFile("content/v2/new-spawn-placements.json", "utf8").then(JSON.parse),
  readFile("content/v2/locked-world-placements.json", "utf8").then(JSON.parse),
]);

// Gate 5 is a captured V2 baseline. The legacy renderer's evolving placement
// arrays are not an authority allowed to rewrite this reviewed world.
validateManifest(manifest, registry);
if (manifest.runtime.node_spawns.length !== 369 || manifest.runtime.monster_spawns.length !== 361) {
  throw new Error("Locked V2 content spawn counts drifted");
}
if (placements.node_spawns.length !== 90 || placements.monster_spawns.length !== 72) {
  throw new Error("Locked V2 candidate placement counts drifted");
}
if (locked.spawn_hash !== "a903f8f9f6037b8232e14971f5dcb2a0eba92ed37b684db92125f71adf074767") {
  throw new Error("Locked Gate 7 spawn hash drifted");
}
console.log("Verified locked Gate 5/7 V2 content baseline.");

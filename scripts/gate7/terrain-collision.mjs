import {
  NODE_DEFS,
  NODE_SPAWNS,
  blockedAt,
} from "../../content/v2/frozen/data.ts";

// The live collision helper includes v1 resource discs. Gate 7 replaces that
// spawn set, so generation first subtracts those known discs and reachability
// then adds every reviewed v2 node disc explicitly. Live runtime code remains
// byte-for-byte unchanged, preserving the Gate 5 evidence snapshot.
const liveNodeDiscs = NODE_SPAWNS.map((node) => ({
  x: node.x,
  y: node.y + (NODE_DEFS[node.kind].shape === "tree" ? 8 : 2),
  radius: NODE_DEFS[node.kind].shape === "bush" ? 11 : 14,
}));

export function terrainBlockedAt(x, y, pad = 10, wadesRivers = false) {
  if (!blockedAt(x, y, pad, wadesRivers)) return false;
  const insideReplacedV1Disc = liveNodeDiscs.some((disc) => {
    const radius = disc.radius + pad;
    return Math.abs(x - disc.x) < radius
      && Math.abs(y - disc.y) < radius
      && Math.hypot(x - disc.x, y - disc.y) < radius;
  });
  return !insideReplacedV1Disc;
}

// Frozen world-source selector.
//
// Content releases must never be generated from the mutable runtime world in
// src/game — re-running a generator after gameplay edits silently re-rolls
// every sampled spawn placement. Each release therefore has an immutable
// frozen snapshot under content/<version>/frozen, and every generator reads
// the world through this module.
//
// Default: the V2 cut (the live release). Set TOMLANDIA_WORLD_SOURCE to the
// directory of another frozen snapshot, relative to this file, to generate a
// different release.

import { WORLD_SOURCE_DIR, WORLD_SOURCE_FILE } from "./path.mjs";

export { WORLD_SOURCE_DIR, WORLD_SOURCE_FILE };

const source = await import(`${WORLD_SOURCE_DIR}/data.ts`);

export const {
  WORLD_W,
  WORLD_H,
  NODE_DEFS,
  NODE_SPAWNS,
  MONSTER_DEFS,
  MONSTER_SPAWNS,
  NPCS,
  biomeAt,
  blockedAt,
} = source;

export default source;

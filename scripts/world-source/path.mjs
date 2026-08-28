// Frozen world-source location (no TypeScript import; safe for plain node).
// See scripts/world-source/data.mjs for why releases read a frozen snapshot.

export const WORLD_SOURCE_DIR = process.env["TOMLANDIA_WORLD_SOURCE"] ?? "../../content/v2/frozen";
export const WORLD_SOURCE_FILE = `${WORLD_SOURCE_DIR.replace(/^\.\.\/\.\.\//, "")}/data.ts`;

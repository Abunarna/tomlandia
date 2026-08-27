import {
  ITEMS,
  MONSTER_DEFS,
  NODE_DEFS,
  type MonsterDefT,
  type NodeDefT,
} from "./data";
import { V2_CONTENT_MONSTERS, V2_CONTENT_NODES, V2_ITEM_BY_ID } from "../generated/content-catalog";
import type { ItemDef, ItemFamily } from "./types";

/**
 * Client-only V2 catalog adapter. It deliberately does not live in data.ts:
 * Gate 7 imports the static world model from there and must remain independent
 * of renderer-only content registration.
 */
const nodes = NODE_DEFS as Record<string, NodeDefT>;
const monsters = MONSTER_DEFS as Record<string, MonsterDefT>;

let initialized = false;

/**
 * Register generated V2 definitions in the renderer's runtime registries.
 *
 * This is intentionally explicit and idempotent. The package declares modules
 * side-effect-free, so relying on a bare side-effect import allows production
 * bundlers to remove the registration code entirely.
 */
export function ensureV2RuntimeContent() {
  if (initialized) return;

for (const definition of V2_CONTENT_NODES) {
  if (nodes[definition.kind]) continue;
  const shape = definition.skill === "woodcutting" ? "tree" : definition.skill === "gathering" ? "bush" : "rock";
  nodes[definition.kind] = {
    name: definition.name,
    skill: definition.skill,
    shape,
    xp: 1,
    item: definition.item_id,
    time: 4,
    respawn: 60,
    req: definition.level_requirement,
    color: "#637080",
    accent: shape === "tree" ? "#9cc7b1" : shape === "bush" ? "#b7d9c0" : "#9fd0e5",
  };
}

for (const definition of V2_CONTENT_MONSTERS) {
  if (monsters[definition.kind]) continue;
  const hue = (definition.tier_index * 41) % 360;
  monsters[definition.kind] = {
    name: definition.name,
    hp: definition.hp,
    attack: definition.attack,
    defense: definition.defense,
    xp: 0,
    gold: [0, 0],
    drop: "feather",
    dropChance: 0,
    hide: null,
    hideXp: 0,
    body: `hsl(${hue} 42% 64%)`,
    accent: `hsl(${(hue + 30) % 360} 55% 78%)`,
    size: 1.25,
    ears: "spikes",
  };
}

for (const definition of Object.values(V2_ITEM_BY_ID)) {
  if (ITEMS[definition.id]) continue;
  ITEMS[definition.id] = {
    id: definition.id,
    name: definition.name,
    value: definition.value,
    color: definition.colour,
    kind: definition.kind as ItemDef["kind"],
    family: definition.family as ItemFamily,
    stackable: definition.stackable,
    attack: definition.stats.attack,
    defense: definition.stats.defense,
    speed: definition.stats.speed,
    heal: definition.stats.heal,
    dmgBoost: definition.stats.dmg_boost,
    boostHits: definition.stats.boost_hits,
  };
}

  const missingNodes = V2_CONTENT_NODES.filter((definition) => !nodes[definition.kind]).map((definition) => definition.kind);
  const missingMonsters = V2_CONTENT_MONSTERS.filter((definition) => !monsters[definition.kind]).map((definition) => definition.kind);
  const missingItems = Object.values(V2_ITEM_BY_ID).filter((definition) => !ITEMS[definition.id]).map((definition) => definition.id);
  if (missingNodes.length || missingMonsters.length || missingItems.length) {
    throw new Error(
      `V2 runtime content registry incomplete (nodes=${missingNodes.join(",")}; monsters=${missingMonsters.join(",")}; items=${missingItems.join(",")})`,
    );
  }
  initialized = true;
}

// Keep eager registration for every current consumer. WorldNet also calls the
// function explicitly, which makes this module reachable even with sideEffects=false.
ensureV2RuntimeContent();

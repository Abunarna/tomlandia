import { V2_CONTENT_MONSTERS, V2_CONTENT_NODES, V2_ITEM_BY_ID } from "../generated/content-catalog";
import {
  MONSTER_DEFS,
  NODE_DEFS,
  registerV2Items,
  type MonsterDefT,
  type NodeDefT,
} from "./data";
import type { ItemDef, ItemFamily } from "./types";

const nodeDefinitions = NODE_DEFS as Record<string, NodeDefT>;
const monsterDefinitions = MONSTER_DEFS as Record<string, MonsterDefT>;

registerV2Items(
  Object.values(V2_ITEM_BY_ID).map((generated): ItemDef => ({
    id: generated.id,
    name: generated.name,
    value: generated.value,
    color: generated.colour,
    kind: generated.kind as ItemDef["kind"],
    family: generated.family as ItemFamily,
    stackable: generated.stackable,
    attack: generated.stats.attack,
    defense: generated.stats.defense,
    speed: generated.stats.speed,
    heal: generated.stats.heal,
    dmgBoost: generated.stats.dmg_boost,
    boostHits: generated.stats.boost_hits,
  })),
);

for (const node of V2_CONTENT_NODES) {
  if (nodeDefinitions[node.kind]) continue;
  const shape = node.skill === "woodcutting" ? "tree" : node.skill === "gathering" ? "bush" : "rock";
  nodeDefinitions[node.kind] = {
    name: node.name,
    skill: node.skill,
    shape,
    xp: 1,
    item: node.item_id,
    time: 4,
    respawn: 60,
    req: node.level_requirement,
    color: "#637080",
    accent: shape === "tree" ? "#9cc7b1" : shape === "bush" ? "#b7d9c0" : "#9fd0e5",
  };
}

for (const monster of V2_CONTENT_MONSTERS) {
  if (monsterDefinitions[monster.kind]) continue;
  const hue = (monster.tier_index * 41) % 360;
  monsterDefinitions[monster.kind] = {
    name: monster.name,
    hp: monster.hp,
    attack: monster.attack,
    defense: monster.defense,
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

import { NODE_SPAWNS, MONSTER_SPAWNS, NODE_DEFS } from "../src/game/data";
const n = NODE_SPAWNS.map((s, i) => `(${i},'${s.kind}',${s.x},${s.y},${NODE_DEFS[s.kind].respawn})`);
const m = MONSTER_SPAWNS.map((s, i) => `(${i},'${s.kind}',${s.x},${s.y})`);
console.log(`NODES\n${n.join(",")}\nMOBS\n${m.join(",")}`);

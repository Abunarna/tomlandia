import { NODE_SPAWNS, MONSTER_SPAWNS, NODE_DEFS, MONSTER_DEFS } from "../src/game/data";
import { worldCellId as cellKey } from "../src/game/world";
const n = (NODE_SPAWNS as any[]).map((s, i) => { const d: any = (NODE_DEFS as any)[s.kind]; return `(${i},'${cellKey(s.x, s.y)}','${s.kind}',${Math.round(s.x)},${Math.round(s.y)},${d.charges ?? 3},${d.charges ?? 3},${d.respawn ?? 30},${d.time ?? d.time_s ?? 3})`; });
const m = (MONSTER_SPAWNS as any[]).map((s, i) => { const d: any = (MONSTER_DEFS as any)[s.kind]; return `(${i},'${cellKey(s.x, s.y)}','${s.kind}',${Math.round(s.x)},${Math.round(s.y)},${d.hp},${d.hp})`; });
console.log(`delete from world_nodes; insert into world_nodes (id,cell,kind,x,y,charges,max_charges,respawn_s,gather_s) values ${n.join(",")};`);
console.log(`delete from world_monsters; insert into world_monsters (id,cell,kind,x,y,hp,max_hp) values ${m.join(",")};`);
console.log(`delete from player_positions; delete from world_cooldowns;`);
console.log(`update player_saves set data = jsonb_set(jsonb_set(data,'{px}','800'),'{py}','2300');`);

import { NODE_SPAWNS, MONSTER_SPAWNS, FISHING_SPOTS, NODE_DEFS } from "../src/game/data";
const rows = (a: string[]) => a.join(",");
const n = NODE_SPAWNS.map((s, i) => `(${i},'${s.kind}',${s.x},${s.y},${NODE_DEFS[s.kind].respawn})`);
const m = MONSTER_SPAWNS.map((s, i) => `(${i},'${s.kind}',${s.x},${s.y})`);
const f = FISHING_SPOTS.map((s) => `(${s.id},${Math.round(s.x)},${Math.round(s.y)},'${s.lake}')`);
console.log(`DELETE FROM public.world_nodes;
INSERT INTO public.world_nodes (id,cell,kind,x,y,charges,max_charges,respawn_s,gather_s)
SELECT v.id, floor(v.x/700)||':'||floor(v.y/500), v.kind, v.x, v.y, 4, 4, v.rs, d.time_s
FROM (VALUES ${rows(n)}) AS v(id,kind,x,y,rs)
JOIN public.game_node_defs d ON d.kind = v.kind;
DELETE FROM public.world_monsters;
INSERT INTO public.world_monsters (id,cell,kind,x,y,hp,max_hp)
SELECT v.id, floor(v.x/700)||':'||floor(v.y/500), v.kind, v.x, v.y, d.hp, d.hp
FROM (VALUES ${rows(m)}) AS v(id,kind,x,y)
JOIN public.game_monster_defs d ON d.kind = v.kind;
DELETE FROM public.game_fishing_spots;
INSERT INTO public.game_fishing_spots (id,x,y,lake) VALUES ${rows(f)};
DELETE FROM public.world_cooldowns;
DELETE FROM public.player_positions;
UPDATE public.player_saves SET data = jsonb_set(jsonb_set(data,'{px}','700'::jsonb,true),'{py}','2400'::jsonb,true);
UPDATE public.world_boss SET x = 2800, y = 1500, updated_at = now() WHERE id = 1;`);

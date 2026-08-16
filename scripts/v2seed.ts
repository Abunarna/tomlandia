import { NODE_SPAWNS, MONSTER_SPAWNS, FISHING_SPOTS, NODE_DEFS, MONSTER_DEFS } from "../src/game/data";
import { worldCellId } from "../src/game/world";
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const n = NODE_SPAWNS.map((s, i) => {
  const d = NODE_DEFS[s.kind];
  return `(${i},${q(worldCellId(s.x, s.y))},${q(s.kind)},${s.x},${s.y},4,4,${d.respawn},${d.time})`;
});
const m = MONSTER_SPAWNS.map((s, i) => {
  const d = MONSTER_DEFS[s.kind];
  return `(${i},${q(worldCellId(s.x, s.y))},${q(s.kind)},${s.x},${s.y},${d.hp},${d.hp})`;
});
const f = FISHING_SPOTS.map((s) => `(${s.id},${Math.round(s.x)},${Math.round(s.y)},${q(s.lake)})`);
console.log(`DELETE FROM public.world_nodes;
INSERT INTO public.world_nodes (id,cell,kind,x,y,charges,max_charges,respawn_s,gather_s) VALUES
${n.join(",\n")};
DELETE FROM public.world_monsters;
INSERT INTO public.world_monsters (id,cell,kind,x,y,hp,max_hp) VALUES
${m.join(",\n")};
DELETE FROM public.game_fishing_spots;
INSERT INTO public.game_fishing_spots (id,x,y,lake) VALUES
${f.join(",\n")};
DELETE FROM public.world_cooldowns;
DELETE FROM public.player_positions;
UPDATE public.player_saves SET data = jsonb_set(jsonb_set(data,'{px}','700'::jsonb,true),'{py}','2400'::jsonb,true);
UPDATE public.world_boss SET x = 2800, y = 1500, respawn_at = NULL, updated_at = now() WHERE id = 1;`);

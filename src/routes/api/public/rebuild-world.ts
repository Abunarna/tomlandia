import { createFileRoute } from "@tanstack/react-router";
import { NODE_SPAWNS, MONSTER_SPAWNS, NODE_DEFS, MONSTER_DEFS } from "@/game/data";
import { worldCellId } from "@/game/world";

const TOKEN = "5f3a91c2d84e47b6";

export const Route = createFileRoute("/api/public/rebuild-world")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-admin-token") !== TOKEN) return new Response("no", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nodes = NODE_SPAWNS.map((s, i) => {
          const d = NODE_DEFS[s.kind];
          return {
            id: i + 1,
            cell: worldCellId(s.x, s.y),
            kind: s.kind,
            x: s.x,
            y: s.y,
            charges: 4,
            max_charges: 4,
            gather_s: d.time,
            respawn_s: d.respawn,
            respawn_at: null,
          };
        });
        const mobs = MONSTER_SPAWNS.map((s, i) => {
          const d = MONSTER_DEFS[s.kind];
          return {
            id: i + 1,
            cell: worldCellId(s.x, s.y),
            kind: s.kind,
            x: s.x,
            y: s.y,
            hp: d.hp,
            max_hp: d.hp,
            tagged_by: null,
            tagged_at: null,
            respawn_at: null,
          };
        });
        await supabaseAdmin.from("world_nodes").delete().gte("id", 0);
        await supabaseAdmin.from("world_monsters").delete().gte("id", 0);
        const e1 = await supabaseAdmin.from("world_nodes").insert(nodes);
        const e2 = await supabaseAdmin.from("world_monsters").insert(mobs);
        return Response.json({ nodes: nodes.length, mobs: mobs.length, e1: e1.error, e2: e2.error });
      },
    },
  },
});

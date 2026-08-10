import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LeaderRow {
  rank: number;
  name: string;
  score: number;
  me: boolean;
}

export interface LeaderRes {
  ok: boolean;
  skill?: string;
  top?: LeaderRow[];
  me?: LeaderRow | null;
  reason?: string;
}

/**
 * Rankings come from `player_scores`, a tiny indexed table the database keeps in
 * sync whenever a player's save is written — no full scan of player data.
 */
export const fetchLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ skill: z.string().min(1).max(32) }).parse(input))
  .handler(async ({ data, context }): Promise<LeaderRes> => {
    const { data: res, error } = await context.supabase.rpc("leaderboard", { _skill: data.skill });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as LeaderRes;
  });

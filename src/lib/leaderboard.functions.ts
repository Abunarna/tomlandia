import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseRpcResponse, rpcContracts } from "@/contracts/rpc";

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

/** Rankings are read through the shared, authenticated RPC contract. */
export const fetchLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ skill: z.string().min(1).max(32) }).parse(input))
  .handler(async ({ data, context }): Promise<LeaderRes> => {
    const request = rpcContracts.leaderboard.request.parse({ _skill: data.skill });
    const { data: res, error } = await context.supabase.rpc("leaderboard", request);
    return parseRpcResponse<LeaderRes>(
      "leaderboard",
      rpcContracts.leaderboard.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

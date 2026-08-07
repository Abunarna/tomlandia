import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Phase 8 — shared world mutations.
 *
 * Clients never write world_nodes / world_monsters directly (they only have
 * SELECT). Every state change goes through these server functions, which call
 * SECURITY DEFINER database routines that lock the row, enforce per-player
 * cooldowns and clamp damage — so contention is resolved in one place.
 */

export interface HarvestResult {
  ok: boolean;
  reason?: string;
  charges?: number;
  respawn_at?: string | null;
}

export interface DamageResult {
  ok: boolean;
  reason?: string;
  hp?: number;
  max_hp?: number;
  killed?: boolean;
  /** True only for the player who tagged the monster first. */
  credited?: boolean;
  tagged_by?: string | null;
  respawn_at?: string | null;
}

export const harvestNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().min(0) }).parse(input))
  .handler(async ({ data, context }): Promise<HarvestResult> => {
    const { data: res, error } = await context.supabase.rpc("harvest_node", { _id: data.id });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as HarvestResult;
  });

export const damageMonster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.number().int().min(0), dmg: z.number().int().min(1).max(400) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<DamageResult> => {
    const { data: res, error } = await context.supabase.rpc("damage_monster", {
      _id: data.id,
      _dmg: data.dmg,
    });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as DamageResult;
  });

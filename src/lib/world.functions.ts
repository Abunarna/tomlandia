import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CraftRes, DamageRes, FishRes, HarvestRes, PotionRes } from "@/game/engine";

/**
 * Phase 9 — server-authoritative actions.
 *
 * The client only ever says "I want to harvest node 12 from here". The database
 * routines behind these functions verify range, level, cooldown and shared
 * world state, compute the outcome, write it into the player's save, and return
 * the authoritative result.
 */

const point = { x: z.number().finite(), y: z.number().finite() };

export const harvestNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().min(0), ...point }).parse(input))
  .handler(async ({ data, context }): Promise<HarvestRes> => {
    const { data: res, error } = await context.supabase.rpc("harvest_node", {
      _id: data.id,
      _x: data.x,
      _y: data.y,
    });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as HarvestRes;
  });

export const attackMonster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().min(0), ...point }).parse(input))
  .handler(async ({ data, context }): Promise<DamageRes> => {
    const { data: res, error } = await context.supabase.rpc("attack_monster", {
      _id: data.id,
      _x: data.x,
      _y: data.y,
    });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as DamageRes;
  });

export const craftItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ recipe: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }): Promise<CraftRes> => {
    const { data: res, error } = await context.supabase.rpc("craft_item", { _recipe: data.recipe });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as CraftRes;
  });

export const fishCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().min(0), ...point }).parse(input))
  .handler(async ({ data, context }): Promise<FishRes> => {
    const { data: res, error } = await context.supabase.rpc("fish_cast", {
      _spot: data.id,
      _x: data.x,
      _y: data.y,
    });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as FishRes;
  });

export const usePotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ item: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }): Promise<PotionRes> => {
    const { data: res, error } = await context.supabase.rpc("use_potion", { _item: data.item });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as PotionRes;
  });

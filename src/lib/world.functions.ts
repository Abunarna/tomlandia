import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CraftRes, DamageRes, FishRes, GearRes, HarvestRes, PotionRes } from "@/game/engine";

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

/**
 * Bag, gear and bank changes. These cross the boundary between client-owned
 * state (equipment, snack, bank) and server-owned state (inventory, gold), so
 * they are resolved in one locked database step instead of being pushed up as
 * part of a whole-save write that a concurrent reward could overwrite.
 */
export const equipSlotAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ index: z.number().int().min(0).max(19) }).parse(input))
  .handler(async ({ data, context }): Promise<GearRes> => {
    const { data: res, error } = await context.supabase.rpc("gear_equip", { _index: data.index });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as GearRes;
  });

export const upgradeGear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ which: z.enum(["weapon", "armor"]) }).parse(input))
  .handler(async ({ data, context }): Promise<GearRes> => {
    const { data: res, error } = await context.supabase.rpc("gear_upgrade", { _which: data.which });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as GearRes;
  });

export const dropSlotAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ index: z.number().int().min(0).max(19) }).parse(input))
  .handler(async ({ data, context }): Promise<GearRes> => {
    const { data: res, error } = await context.supabase.rpc("inv_drop", { _index: data.index });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as GearRes;
  });

export const bankGold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ dir: z.enum(["in", "out"]), amount: z.number().int().min(1) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<GearRes> => {
    const { data: res, error } = await context.supabase.rpc("bank_gold", {
      _dir: data.dir,
      _amount: data.amount,
    });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as GearRes;
  });

export const bankItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dir: z.enum(["in", "out"]),
        index: z.number().int().min(0).max(59),
        qty: z.number().int().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<GearRes> => {
    const { data: res, error } = await context.supabase.rpc("bank_item", {
      _dir: data.dir,
      _index: data.index,
      _qty: data.qty,
    });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as GearRes;
  });

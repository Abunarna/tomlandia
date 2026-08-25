import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CraftRes, DamageRes, FishRes, GearRes, HarvestRes, PotionRes } from "@/game/engine";
import { parseRpcResponse, rpcContracts } from "@/contracts/rpc";

/**
 * Phase 9 — server-authoritative actions.
 *
 * Every request and response crossing the database boundary is parsed by the
 * shared Gate 1 contract. A SQL/client drift is now a loud protocol error.
 */

const point = { x: z.number().finite(), y: z.number().finite() };

export const harvestNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().min(0), ...point }).parse(input))
  .handler(async ({ data, context }): Promise<HarvestRes> => {
    const request = rpcContracts.harvest_node.request.parse({ _id: data.id, _x: data.x, _y: data.y });
    const { data: res, error } = await context.supabase.rpc("harvest_node", request);
    return parseRpcResponse<HarvestRes>(
      "harvest_node",
      rpcContracts.harvest_node.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const attackMonster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().min(0), ...point }).parse(input))
  .handler(async ({ data, context }): Promise<DamageRes> => {
    const request = rpcContracts.attack_monster.request.parse({ _id: data.id, _x: data.x, _y: data.y });
    const { data: res, error } = await context.supabase.rpc("attack_monster", request);
    return parseRpcResponse<DamageRes>(
      "attack_monster",
      rpcContracts.attack_monster.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

/** DESOLATUS coordinates are independently checked by the database routine. */
export const attackBoss = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ ...point, bx: z.number().finite(), by: z.number().finite(), passive: z.boolean().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<DamageRes> => {
    const request = rpcContracts.attack_boss.request.parse({
      _x: data.x,
      _y: data.y,
      _bx: data.bx,
      _by: data.by,
      _passive: data.passive ?? false,
    });
    const { data: res, error } = await context.supabase.rpc("attack_boss", request);
    return parseRpcResponse<DamageRes>(
      "attack_boss",
      rpcContracts.attack_boss.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const craftItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ recipe: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }): Promise<CraftRes> => {
    const request = rpcContracts.craft_item.request.parse({ _recipe: data.recipe });
    const { data: res, error } = await context.supabase.rpc("craft_item", request);
    return parseRpcResponse<CraftRes>(
      "craft_item",
      rpcContracts.craft_item.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const fishCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.number().int().min(0), ...point }).parse(input))
  .handler(async ({ data, context }): Promise<FishRes> => {
    const request = rpcContracts.fish_cast.request.parse({ _spot: data.id, _x: data.x, _y: data.y });
    const { data: res, error } = await context.supabase.rpc("fish_cast", request);
    return parseRpcResponse<FishRes>(
      "fish_cast",
      rpcContracts.fish_cast.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const usePotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ item: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }): Promise<PotionRes> => {
    const request = rpcContracts.use_potion.request.parse({ _item: data.item });
    const { data: res, error } = await context.supabase.rpc("use_potion", request);
    return parseRpcResponse<PotionRes>(
      "use_potion",
      rpcContracts.use_potion.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const equipSlotAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ index: z.number().int().min(-1).max(19) }).parse(input))
  .handler(async ({ data, context }): Promise<GearRes> => {
    const request = rpcContracts.gear_equip.request.parse({ _index: data.index });
    const { data: res, error } = await context.supabase.rpc("gear_equip", request);
    return parseRpcResponse<GearRes>(
      "gear_equip",
      rpcContracts.gear_equip.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const upgradeGear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ which: z.enum(["weapon", "armor"]) }).parse(input))
  .handler(async ({ data, context }): Promise<GearRes> => {
    const request = rpcContracts.gear_upgrade.request.parse({ _which: data.which });
    const { data: res, error } = await context.supabase.rpc("gear_upgrade", request);
    return parseRpcResponse<GearRes>(
      "gear_upgrade",
      rpcContracts.gear_upgrade.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const dropSlotAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ index: z.number().int().min(0).max(19) }).parse(input))
  .handler(async ({ data, context }): Promise<GearRes> => {
    const request = rpcContracts.inv_drop.request.parse({ _index: data.index });
    const { data: res, error } = await context.supabase.rpc("inv_drop", request);
    return parseRpcResponse<GearRes>(
      "inv_drop",
      rpcContracts.inv_drop.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const sellSlotAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ index: z.number().int().min(0).max(19) }).parse(input))
  .handler(async ({ data, context }): Promise<GearRes> => {
    const request = rpcContracts.inv_sell.request.parse({ _index: data.index });
    const { data: res, error } = await context.supabase.rpc("inv_sell", request);
    return parseRpcResponse<GearRes>(
      "inv_sell",
      rpcContracts.inv_sell.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const bankGold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dir: z.enum(["in", "out"]), amount: z.number().int().min(1) }).parse(input))
  .handler(async ({ data, context }): Promise<GearRes> => {
    const request = rpcContracts.bank_gold.request.parse({ _dir: data.dir, _amount: data.amount });
    const { data: res, error } = await context.supabase.rpc("bank_gold", request);
    return parseRpcResponse<GearRes>(
      "bank_gold",
      rpcContracts.bank_gold.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const bankItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ dir: z.enum(["in", "out"]), index: z.number().int().min(0).max(59), qty: z.number().int().min(1) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<GearRes> => {
    const request = rpcContracts.bank_item.request.parse({ _dir: data.dir, _index: data.index, _qty: data.qty });
    const { data: res, error } = await context.supabase.rpc("bank_item", request);
    return parseRpcResponse<GearRes>(
      "bank_item",
      rpcContracts.bank_item.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

/** Eat a specific bag slot; healing and inventory consumption are one transaction. */
export const consumeFood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ index: z.number().int().min(0).max(19) }).parse(input))
  .handler(async ({ data, context }): Promise<GearRes> => {
    const request = rpcContracts.consume_food.request.parse({ _index: data.index });
    const { data: res, error } = await context.supabase.rpc("consume_food", request);
    return parseRpcResponse<GearRes>(
      "consume_food",
      rpcContracts.consume_food.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

/** Settle an out-of-combat regeneration tick against the authoritative save. */
export const recoverPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GearRes> => {
    rpcContracts.player_recover.request.parse({});
    const { data: res, error } = await context.supabase.rpc("player_recover");
    return parseRpcResponse<GearRes>(
      "player_recover",
      rpcContracts.player_recover.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

/** Accept, abandon or claim a quest entirely inside the save row lock. */
export const settleQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ action: z.enum(["accept", "abandon", "claim"]), quest: z.string().min(1).max(64).nullable() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<GearRes> => {
    const request = rpcContracts.quest_action.request.parse({ _action: data.action, _quest: data.quest });
    const { data: res, error } = await context.supabase.rpc("quest_action", request);
    return parseRpcResponse<GearRes>(
      "quest_action",
      rpcContracts.quest_action.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

/** Sell every resource stack and credit the exact stored quantities atomically. */
export const sellAllResourcesAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GearRes> => {
    rpcContracts.sell_all_resources.request.parse({});
    const { data: res, error } = await context.supabase.rpc("sell_all_resources");
    return parseRpcResponse<GearRes>(
      "sell_all_resources",
      rpcContracts.sell_all_resources.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

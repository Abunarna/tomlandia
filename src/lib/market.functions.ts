import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BrowseRes, MarketRes } from "@/game/market";

/**
 * Phase 10 — shared marketplace.
 *
 * The client never touches listings directly. It asks to list, buy or cancel;
 * the database routines verify ownership, gold and bag space, move everything
 * atomically, take the 5% fee and return the player's authoritative state.
 */

export const browseMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BrowseRes> => {
    const { data, error } = await context.supabase.rpc("market_browse");
    if (error) return { ok: false, reason: error.message };
    return (data ?? { ok: false, reason: "empty" }) as unknown as BrowseRes;
  });

export const listOnMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        item: z.string().min(1).max(64),
        qty: z.number().int().min(1).max(100000),
        price: z.number().int().min(1).max(10000000),
        plus: z.number().int().min(0).max(100).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<MarketRes> => {
    const { data: res, error } = await context.supabase.rpc("market_list", {
      _item: data.item,
      _qty: data.qty,
      _price: data.price,
      _plus: data.plus,
    });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as MarketRes;
  });

export const buyFromMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(100000).default(1) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<MarketRes> => {
    const { data: res, error } = await context.supabase.rpc("market_buy", {
      _id: data.id,
      _qty: data.qty,
    });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as MarketRes;
  });


export const cancelMarketListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<MarketRes> => {
    const { data: res, error } = await context.supabase.rpc("market_cancel", { _id: data.id });
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "empty" }) as unknown as MarketRes;
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BrowseRes, MarketRes } from "@/game/market";
import { parseRpcResponse, rpcContracts } from "@/contracts/rpc";

/** Server-authoritative global exchange actions with validated RPC boundaries. */

export const browseMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BrowseRes> => {
    rpcContracts.market_browse.request.parse({});
    const { data, error } = await context.supabase.rpc("market_browse");
    return parseRpcResponse<BrowseRes>(
      "market_browse",
      rpcContracts.market_browse.response,
      error ? { ok: false, reason: error.message } : (data ?? { ok: false, reason: "empty" }),
    );
  });

export const listOnMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        item: z.string().min(1).max(64),
        qty: z.number().int().min(1).max(100_000),
        price: z.number().int().min(1).max(10_000_000),
        plus: z.number().int().min(0).max(100).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<MarketRes> => {
    const request = rpcContracts.market_list.request.parse({
      _item: data.item,
      _qty: data.qty,
      _price: data.price,
      _plus: data.plus,
    });
    const { data: res, error } = await context.supabase.rpc("market_list", request);
    return parseRpcResponse<MarketRes>(
      "market_list",
      rpcContracts.market_list.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const buyFromMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(100_000).default(1) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<MarketRes> => {
    const request = rpcContracts.market_buy.request.parse({ _id: data.id, _qty: data.qty });
    const { data: res, error } = await context.supabase.rpc("market_buy", request);
    return parseRpcResponse<MarketRes>(
      "market_buy",
      rpcContracts.market_buy.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

export const cancelMarketListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<MarketRes> => {
    const request = rpcContracts.market_cancel.request.parse({ _id: data.id });
    const { data: res, error } = await context.supabase.rpc("market_cancel", request);
    return parseRpcResponse<MarketRes>(
      "market_cancel",
      rpcContracts.market_cancel.response,
      error ? { ok: false, reason: error.message } : (res ?? { ok: false, reason: "empty" }),
    );
  });

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { item } from "@/game/data";
import type { BrowseRes } from "@/game/market";

export default defineTool({
  name: "browse_market",
  title: "Browse marketplace",
  description:
    "Browse the shared Tomlandia marketplace order book: current listings (item, quantity, price, seller) and recent trades.",
  inputSchema: {
    item_id: z.string().optional().describe("Optional item id to filter listings by, e.g. copper_ore."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ item_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("market_browse");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const res = (data ?? {}) as unknown as BrowseRes;
    const all = res.listings ?? [];
    const listings = (item_id ? all.filter((l) => l.item === item_id) : all).map((l) => ({
      ...l,
      name: item(l.item)?.name ?? l.item,
    }));
    const trades = (res.trades ?? []).slice(0, 20);

    const text = listings.length
      ? listings.map((l) => `${l.qty}× ${l.name} @ ${l.price}g — ${l.seller}${l.mine ? " (you)" : ""}`).join("\n")
      : "No listings match.";
    return {
      content: [{ type: "text", text }],
      structuredContent: { listings, trades },
    };
  },
});

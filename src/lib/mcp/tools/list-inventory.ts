import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { item } from "@/game/data";
import type { SaveState } from "@/game/types";

export default defineTool({
  name: "list_inventory",
  title: "List inventory",
  description: "List the items currently in the signed-in adventurer's 20-slot bag, with quantities and values.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: row, error } = await supabase
      .from("player_saves")
      .select("data")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const save = (row?.data as unknown as SaveState | undefined) ?? null;
    const items = (save?.inv ?? [])
      .map((slot, index) => {
        if (!slot) return null;
        const def = item(slot.id);
        return {
          slot: index,
          id: slot.id,
          name: def?.name ?? slot.id,
          qty: slot.qty,
          plus: slot.plus ?? 0,
          unitValue: def?.value ?? 0,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const summary = items.length
      ? items.map((i) => `${i.qty}× ${i.name}${i.plus ? ` +${i.plus}` : ""} (slot ${i.slot})`).join("\n")
      : "Bag is empty.";
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { items, freeSlots: 20 - items.length, gold: save?.gold ?? 0 },
    };
  },
});

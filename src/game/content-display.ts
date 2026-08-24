import { V2_ITEM_BY_ID } from "@/generated/content-catalog";
import { ITEMS } from "./data";

export type ContentItemDisplay =
  | { status: "legacy"; id: string; name: string; value: number }
  | { status: "generated"; id: string; name: string; value: number }
  | { status: "unknown"; id: string; name: string; value: null };

/**
 * Never substitute an unrelated legacy item for an unfamiliar ID. Generated
 * v2 IDs deliberately remain visibly identified until their full client
 * definition is active; corrupt/unknown values are surfaced separately.
 */
export function displayContentItem(id: string): ContentItemDisplay {
  const legacy = ITEMS[id];
  if (legacy) return { status: "legacy", id, name: legacy.name, value: legacy.value };
  const generated = V2_ITEM_BY_ID[id as keyof typeof V2_ITEM_BY_ID];
  if (generated) {
    return { status: "generated", id, name: generated.name, value: generated.value };
  }
  return { status: "unknown", id, name: `[unknown content: ${id}]`, value: null };
}

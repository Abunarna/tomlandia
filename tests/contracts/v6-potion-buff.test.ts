/**
 * V6 potion client contract.
 *
 * The client must mirror the server's buff exactly, parse both the legacy flat
 * shape and the V6 percentage shape, and rank auto-potion candidates by
 * percentage, then hits, then tier.
 */
import { describe, expect, test } from "bun:test";

import { bestPotionIndex, readServerBuff } from "../../src/game/potion-buff";
import type { ItemDef, InvSlot } from "../../src/game/types";

const potion = (over: Partial<ItemDef> & { id: string }): ItemDef => ({
  name: over.id,
  stackable: true,
  value: 10,
  color: "#fff",
  kind: "potion",
  ...over,
});

describe("readServerBuff", () => {
  test("no buff", () => {
    expect(readServerBuff(undefined)).toBeNull();
    expect(readServerBuff(null)).toBeNull();
  });

  test("valid legacy V5 flat buff", () => {
    expect(readServerBuff({ dmg: 10, hits: 30, item: "shadow_venom" })).toEqual({
      pct: 0,
      dmg: 10,
      hits: 30,
      item: "shadow_venom",
    });
  });

  test("valid V6 percentage buff", () => {
    expect(
      readServerBuff({ strength_pct: 12, hits: 30, item: "minor_venom_draught", content_version: "v6" }),
    ).toEqual({ pct: 12, dmg: 0, hits: 30, item: "minor_venom_draught" });
  });

  test("expired buff", () => {
    expect(readServerBuff({ strength_pct: 12, hits: 0, item: "x" })).toBeNull();
  });

  test("unknown potion still yields the server's effect", () => {
    expect(readServerBuff({ strength_pct: 12, hits: 3 })?.item).toBeNull();
  });

  test("corrupt buff", () => {
    expect(readServerBuff({ hits: Number.NaN } as never)).toBeNull();
    expect(readServerBuff({ strength_pct: -5, dmg: -1, hits: 5 })).toBeNull();
    expect(readServerBuff("nonsense" as never)).toBeNull();
  });
});

describe("bestPotionIndex", () => {
  const defs: Record<string, ItemDef> = {
    weak: potion({ id: "weak", strengthPct: 12, boostHits: 8, tier: 1 }),
    strong: potion({ id: "strong", strengthPct: 18, boostHits: 35, tier: 16 }),
    sameShortHits: potion({ id: "sameShortHits", strengthPct: 18, boostHits: 20, tier: 15 }),
    legacy: potion({ id: "legacy", dmgBoost: 48, boostHits: 35, tier: 16 }),
    food: potion({ id: "food", kind: "food", heal: 20 }),
  };
  const slots = (...ids: string[]): (InvSlot | null)[] => ids.map((id) => (id ? { id, qty: 1 } : null));

  test("ranks by percentage first", () => {
    expect(bestPotionIndex(slots("weak", "strong"), defs)).toBe(1);
  });

  test("then by hit count", () => {
    expect(bestPotionIndex(slots("sameShortHits", "strong"), defs)).toBe(1);
  });

  test("percentage potions outrank legacy flat potions", () => {
    expect(bestPotionIndex(slots("legacy", "weak"), defs)).toBe(1);
  });

  test("ignores definitions the release does not publish", () => {
    expect(bestPotionIndex(slots("ghost"), defs)).toBe(-1);
  });

  test("ignores food and empty bags", () => {
    expect(bestPotionIndex(slots("food"), defs)).toBe(-1);
    expect(bestPotionIndex([null, null], defs)).toBe(-1);
  });
});

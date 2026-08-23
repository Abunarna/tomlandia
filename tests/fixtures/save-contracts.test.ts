import { describe, expect, test } from "bun:test";
import { rpcContracts } from "../../src/contracts/rpc";
import { storedSaveSchema } from "../../src/contracts/save";
import { edgeSaveFixtures, generatedSaveCases } from "./save-fixtures";

describe("stored save contract", () => {
  for (const [name, fixture] of Object.entries(edgeSaveFixtures)) {
    test(`accepts ${name}`, () => {
      expect(storedSaveSchema.safeParse(fixture).success).toBe(true);
    });
  }

  test("accepts deterministic generated inventory, bank, buff, gear, and stale-revision cases", () => {
    const cases = generatedSaveCases();
    expect(cases).toHaveLength(128);
    for (const { save, revision } of cases) {
      expect(storedSaveSchema.safeParse(save).success).toBe(true);
      expect(
        rpcContracts.player_sync.request.safeParse({ _data: save, _rev: revision }).success,
      ).toBe(true);
    }
  });

  test("accepts a stale revision of zero", () => {
    const parsed = rpcContracts.player_sync.request.parse({ _data: edgeSaveFixtures.short_bank, _rev: 0 });
    expect(parsed._rev).toBe(0);
  });

  test("accepts an omitted revision for an initial sync", () => {
    const parsed = rpcContracts.player_sync.request.parse({ _data: edgeSaveFixtures.null_slots });
    expect("_rev" in parsed).toBe(false);
  });

  test("rejects item loss and corrupt-range shapes", () => {
    const tooManySlots = { ...edgeSaveFixtures.full_bag, inv: [...edgeSaveFixtures.full_bag.inv, null] };
    const negativeQuantity = { ...edgeSaveFixtures.null_slots, inv: [{ id: "copper_ore", qty: -1 }] };
    const overCap = { ...edgeSaveFixtures.upgraded_gear, weapon: { id: "steel_sword", plus: 101 } };
    const oversizedBank = {
      ...edgeSaveFixtures.short_bank,
      bank: { gold: 0, items: Array.from({ length: 61 }, () => null) },
    };

    for (const invalid of [tooManySlots, negativeQuantity, overCap, oversizedBank]) {
      expect(storedSaveSchema.safeParse(invalid).success).toBe(false);
    }
  });
});

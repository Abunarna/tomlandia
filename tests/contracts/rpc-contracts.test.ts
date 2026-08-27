import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  RpcContractError,
  parseRpcResponse,
  rpcContractManifest,
  rpcContracts,
} from "../../src/contracts/rpc";
import { edgeSaveFixtures } from "../fixtures/save-fixtures";

const snapshotPath = new URL("../../docs/overhaul/gate-1/rpc-contracts.snapshot.json", import.meta.url);
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

describe("RPC contract registry", () => {
  test("matches the reviewed Gate 1 snapshot", () => {
    expect(rpcContractManifest).toEqual(snapshot);
    expect(Object.keys(rpcContracts).sort()).toEqual(Object.keys(snapshot.rpcs).sort());
  });

  test("parses a representative request for every application RPC", () => {
    const id = "0d22314f-0f93-45ef-a1f7-ac4737d5ed6d";
    const requests = {
      game_world_runtime_status: {},
      harvest_node: { _id: 1, _x: 2, _y: 3 },
      harvest_node_v2: { _id: id, _x: 2, _y: 3 },
      attack_monster: { _id: 1, _x: 2, _y: 3 },
      attack_monster_v2: { _id: id, _x: 2, _y: 3 },
      attack_boss: { _x: 2, _y: 3, _bx: 4, _by: 5, _passive: false },
      craft_item: { _recipe: "smith_copper_sword" },
      fish_cast: { _spot: 1, _x: 2, _y: 3 },
      use_potion: { _item: "minor_venom_draught" },
      gear_equip: { _index: 0 },
      gear_upgrade: { _which: "weapon" },
      inv_drop: { _index: 0 },
      inv_sell: { _index: 0 },
      bank_gold: { _dir: "in", _amount: 1 },
      bank_item: { _dir: "out", _index: 59, _qty: 1 },
      market_browse: {},
      market_list: { _item: "copper_ore", _qty: 1, _price: 2, _plus: 0 },
      market_buy: { _id: id, _qty: 1 },
      market_cancel: { _id: id },
      leaderboard: { _skill: "total" },
      player_sync: { _data: edgeSaveFixtures.null_slots, _rev: 0 },
      track_position: { _uid: id, _x: 2, _y: 3 },
      consume_food: { _index: 0 },
      player_recover: {},
      quest_action: { _action: "accept", _quest: "copper_run" },
      sell_all_resources: {},
    } as const;

    for (const name of Object.keys(rpcContracts) as (keyof typeof rpcContracts)[]) {
      expect(rpcContracts[name].request.safeParse(requests[name]).success).toBe(true);
    }
  });

  test("rejects the live legacy attack_monster response aliases", () => {
    const liveLegacyShape = {
      ok: true,
      hp: 8,
      dmg: 3,
      taken: 1,
      killed: false,
      credited: true,
      tagged_by: "0d22314f-0f93-45ef-a1f7-ac4737d5ed6d",
      gold: 0,
      loot: [],
      xp: 0,
      levelup: false,
      level: 1,
      respawn_at: null,
      save: edgeSaveFixtures.null_slots,
    };
    expect(rpcContracts.attack_monster.response.safeParse(liveLegacyShape).success).toBe(false);
  });

  test("requires every canonical key when attack_monster succeeds", () => {
    expect(
      rpcContracts.attack_monster.response.safeParse({
        ok: true,
        leveled: false,
        state: {},
      }).success,
    ).toBe(false);
  });

  test("accepts the canonical attack response keys", () => {
    const canonical = {
      ok: true,
      hp: 8,
      dmg: 3,
      taken: 1,
      killed: false,
      credited: true,
      tagged_by: "0d22314f-0f93-45ef-a1f7-ac4737d5ed6d",
      gold: 0,
      loot: [],
      xp: 0,
      leveled: false,
      level: 1,
      respawn_at: null,
      buff: { dmg: 7, hits: 11, item: "minor_venom_draught" },
      state: { inv: edgeSaveFixtures.null_slots.inv, gold: 0, skills: edgeSaveFixtures.null_slots.skills },
    };
    expect(rpcContracts.attack_monster.response.safeParse(canonical).success).toBe(true);
  });

  test("throws a named contract error without logging the raw save", () => {
    expect(() => parseRpcResponse("attack_monster", rpcContracts.attack_monster.response, { ok: true, save: {} }))
      .toThrow(RpcContractError);
    try {
      parseRpcResponse("attack_monster", rpcContracts.attack_monster.response, { ok: true, save: { gold: 999 } });
    } catch (error) {
      expect(String(error)).not.toContain("999");
    }
  });
});

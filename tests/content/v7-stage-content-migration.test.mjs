/**
 * Regression tests for the generated V7 migrations.
 *
 * V7 changes exactly one field per dish (how much it heals) and repairs manual
 * eating generically. It must delete nothing, re-identify nothing, leave prices,
 * recipes, world geometry, saves and the market untouched, and never carry a
 * per-dish allowlist.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { FOODS, FOOD_IDS, HEAL_CURVE } from "../../scripts/v7/model.mjs";

const stage = await readFile("supabase/migrations/20260908120000_v7_stage_content.sql", "utf8");
const world = await readFile("supabase/migrations/20260908120100_v7_stage_world.sql", "utf8");
const activate = await readFile("supabase/migrations/20260908120200_v7_activate.sql", "utf8");
const all = { stage, world, activate };

test("the frozen healing curve is the one the owner approved", () => {
  assert.deepEqual(
    [...HEAL_CURVE],
    [15, 45, 120, 135, 155, 180, 210, 245, 300, 340, 375, 445, 485, 525, 605, 645],
  );
  assert.equal(new Set(FOOD_IDS).size, 16);
});

test("every dish is re-rated in place, and none is deleted or re-identified", () => {
  for (const food of FOODS) {
    assert.ok(stage.includes(`'${food.id}'`), `missing staged row for ${food.id}`);
  }
  for (const [name, sql] of Object.entries(all)) {
    for (const statement of sql.match(/DELETE FROM[\s\S]*?;/g) ?? []) {
      for (const id of FOOD_IDS) {
        assert.ok(!statement.includes(`'${id}'`), `${name} deletes stable dish ${id}`);
      }
    }
  }
});

test("no migration touches player, market or profile state", () => {
  for (const [name, sql] of Object.entries(all)) {
    const ddl = sql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\n\$\$;/g, "");
    for (const table of ["player_saves", "player_save_backups", "market_listings", "profiles"]) {
      assert.ok(
        !new RegExp(`(UPDATE|DELETE FROM|INSERT INTO)\\s+public\\.${table}`).test(ddl),
        `${name} mutates ${table}`,
      );
    }
  }
});

test("manual eating is generic, authoritative and locked", () => {
  const body = stage.match(
    /CREATE OR REPLACE FUNCTION public\.consume_food\(_index integer\)[\s\S]*?\n\$\$;/,
  )?.[0];
  assert.ok(body, "the stage migration does not rebuild manual eating");
  assert.match(body, /game_runtime_items/);
  assert.ok(!/public\.game_items/.test(body), "manual eating still reads the legacy item table");
  assert.match(body, /FOR UPDATE/);
  assert.match(body, /least\(heal, max_hp - hp\)/);
  for (const reason of ["not_food", "full_health", "too_fast", "empty", "bad_slot"]) {
    assert.ok(body.includes(`'${reason}'`), `manual eating cannot reject with ${reason}`);
  }
  for (const id of FOOD_IDS) {
    assert.ok(!body.includes(id), `manual eating hard-codes ${id}`);
  }
});

test("auto-eat is left exactly as V6 shipped it", () => {
  for (const [name, sql] of Object.entries(all)) {
    assert.ok(
      !/CREATE OR REPLACE FUNCTION public\.try_auto_eat/.test(sql),
      `${name} redefines auto-eat`,
    );
  }
});

test("staging never activates, and activation is the only control write", () => {
  assert.ok(!/UPDATE public\.game_content_control/.test(stage), "stage-content activates V7");
  assert.ok(!/UPDATE public\.game_content_control/.test(world), "stage-world activates V7");
  assert.match(activate, /game_content_control/);
  assert.match(activate, /'v7'/);
});

test("the release keeps V6 rows for rollback", () => {
  for (const [name, sql] of Object.entries(all)) {
    assert.ok(
      !/DELETE FROM public\.game_content_items[\s\S]{0,200}'v6'/.test(sql),
      `${name} removes V6 content rows`,
    );
  }
});

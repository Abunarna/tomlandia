/**
 * Regression tests for the generated V6 migrations.
 *
 * V5 taught us that deleting and reinserting stable FK-parent rows breaks the
 * staged recipes (FK 23503). V6 must rename and re-rate the 16 potions in
 * place, delete nothing, keep both combat paths on one shared strength helper,
 * and leave healing food, saves and the market alone.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { POTIONS, POTION_IDS } from "../../scripts/v6/model.mjs";

const stage = await readFile("supabase/migrations/20260903120000_v6_stage_content.sql", "utf8");
const world = await readFile("supabase/migrations/20260903120100_v6_stage_world.sql", "utf8");
const activate = await readFile("supabase/migrations/20260903120200_v6_activate.sql", "utf8");
const all = { stage, world, activate };

test("potions are renamed and re-rated in place, never deleted", () => {
  assert.match(stage, /UPDATE public\.game_content_items/);
  for (const potion of POTIONS) {
    assert.ok(stage.includes(`'${potion.id}'`), `missing in-place update for ${potion.id}`);
    assert.ok(stage.includes(potion.name), `missing normalised name for ${potion.id}`);
  }
  for (const [name, sql] of Object.entries(all)) {
    for (const statement of sql.match(/DELETE FROM[\s\S]*?;/g) ?? []) {
      for (const id of POTION_IDS) {
        assert.ok(!statement.includes(`'${id}'`), `${name} deletes stable potion ${id}`);
      }
    }
  }
});

test("the strength percentage is authoritative server content", () => {
  assert.ok(stage.includes("strength_pct"), "no strength percentage column staged");
  assert.match(stage, /apply_strength_buff/);
  for (const fn of ["use_potion", "attack_monster_v2", "attack_boss_v1"]) {
    assert.ok(stage.includes(fn), `${fn} is not rebuilt on the shared helper`);
  }
});

test("no migration touches saves, markets or healing food destructively", () => {
  for (const [name, sql] of Object.entries(all)) {
    assert.ok(!/DROP TABLE|TRUNCATE/i.test(sql), `${name} performs a destructive change`);
    assert.ok(
      !/DELETE FROM public\.(market_listings|market_prices|market_trades|player_saves)/i.test(sql),
      `${name} deletes player or market rows`,
    );
    assert.ok(sql.includes("BEGIN;"), `${name} is not transactional`);
    assert.ok(sql.trimEnd().endsWith("COMMIT;"), `${name} is not committed as one unit`);
  }
});

test("activation converts valid buffs and keeps v5 for rollback", () => {
  assert.ok(activate.includes("game_validate_content_version('v6')"));
  assert.ok(activate.includes("INSERT INTO public.player_save_backups"));
  assert.ok(activate.includes("'retired'"), "v5 is not retired");
  assert.ok(
    !/DELETE FROM public\.game_content_\w+\s+WHERE content_version = 'v5'/.test(activate),
    "activation removes v5 rollback rows",
  );
});

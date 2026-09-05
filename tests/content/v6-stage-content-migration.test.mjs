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

test("activation revokes every direct execute path to the shared helper", () => {
  assert.ok(
    activate.includes(
      "REVOKE ALL\nON FUNCTION public.apply_strength_buff(jsonb, numeric)\nFROM PUBLIC, anon, authenticated, service_role;",
    ),
    "step 3 does not carry the least-privilege revoke",
  );
  // The hardening ships inside activation; there is no fourth migration and the
  // already-applied steps must stay byte-stable.
  for (const [name, sql] of [
    ["stage-content", stage],
    ["stage-world", world],
  ]) {
    assert.ok(
      !sql.includes("FROM PUBLIC, anon, authenticated, service_role;"),
      `${name} must not carry the activation-time revoke`,
    );
  }
});

test("the shared helper keeps its safe, side-effect-free shape", () => {
  const body = stage.slice(
    stage.indexOf("CREATE OR REPLACE FUNCTION public.apply_strength_buff"),
    stage.indexOf("REVOKE ALL ON FUNCTION public.apply_strength_buff"),
  );
  assert.ok(body.includes("IMMUTABLE"), "the helper is not IMMUTABLE");
  assert.ok(!/SECURITY DEFINER/.test(body), "the helper must stay SECURITY INVOKER");
  assert.match(body, /SET search_path (=|TO) '?public'?/, "the helper does not pin search_path");
  assert.ok(
    !/\b(INSERT|UPDATE|DELETE)\b\s+(INTO|FROM|public\.)/i.test(body),
    "the helper writes a table",
  );
  assert.ok(!/\bEXECUTE\s+format|EXECUTE\s+'/i.test(body), "the helper runs dynamic SQL");
  assert.ok(
    !/player_saves|world_boss|game_world_|market_/.test(body),
    "the helper reads or mutates player state",
  );
});

test("the public boss entry point keeps a gate, but not the legacy v1 contract", () => {
  assert.ok(
    activate.includes(
      "CREATE OR REPLACE FUNCTION public.attack_boss(\n  _x numeric, _y numeric, _bx numeric, _by numeric, _passive boolean DEFAULT false\n)",
    ),
    "activation does not rebuild the public wrapper with its client signature",
  );
  assert.ok(
    activate.includes("PERFORM public.game_assert_action_allowed(false);"),
    "the wrapper drops maintenance / minimum-client enforcement",
  );
  assert.ok(
    !activate.includes("PERFORM public.game_assert_action_allowed(true);"),
    "the wrapper still asserts the legacy v1 world contract",
  );
  assert.ok(
    activate.includes("RETURN public.attack_boss_v1(_x, _y, _bx, _by, _passive);"),
    "the wrapper does not delegate to the authoritative implementation",
  );
  assert.ok(
    activate.includes(
      "GRANT EXECUTE ON FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) TO authenticated;",
    ),
    "signed-in players lose the public boss entry point",
  );
  assert.ok(
    /REVOKE ALL ON FUNCTION public\.attack_boss_v1\(numeric, numeric, numeric, numeric, boolean\)\s*\nFROM PUBLIC, anon, authenticated;/.test(
      activate,
    ),
    "attack_boss_v1 must stay non-public",
  );
});

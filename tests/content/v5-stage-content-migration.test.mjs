/**
 * Regression test for the V5 stage-content migration.
 *
 * The first rollout attempt failed because the generated SQL deleted and
 * reinserted the 16 stable sword rows, which the already-copied v5 recipes
 * still referenced (FK 23503). The swords must be renamed in place instead.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DELETED_ITEMS, SWORD_IDS } from "../../scripts/v5/model.mjs";

const sql = await readFile("supabase/migrations/20260901120000_v5_stage_content.sql", "utf8");
const itemDeletes = [...sql.matchAll(/DELETE FROM public\.game_content_items[\s\S]*?;/g)].map(
  (match) => match[0],
);

test("swords are renamed in place, never deleted and reinserted", () => {
  assert.match(sql, /UPDATE public\.game_content_items AS item\nSET name = renamed\.name/);
  assert.match(sql, /\) AS renamed\(id, name\)/);
  for (const id of SWORD_IDS) {
    assert.ok(sql.includes(`('${id}', '`), `missing in-place rename for ${id}`);
  }
});

test("the item deletion names all four tester ids", () => {
  assert.ok(itemDeletes.length > 0, "no item deletion found");
  for (const statement of itemDeletes) {
    for (const id of DELETED_ITEMS) {
      assert.ok(statement.includes(`'${id}'`), `item deletion omits tester id ${id}`);
    }
  }
});

test("the item deletion names none of the 16 stable sword ids", () => {
  for (const statement of itemDeletes) {
    for (const id of SWORD_IDS) {
      assert.ok(!statement.includes(`'${id}'`), `item deletion still removes sword ${id}`);
    }
  }
});

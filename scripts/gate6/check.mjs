import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");

const build = spawnSync(process.execPath, [resolve(root, "scripts/gate6/build-migration.mjs"), "--check"], {
  cwd: root,
  encoding: "utf8",
});
if (build.status !== 0) throw new Error(build.stderr || build.stdout || "Gate 6 generation check failed");

const [migration, foundation, actions, gate4, gate5] = await Promise.all([
  read("supabase/migrations/20260824090000_gate6_inactive_server_content.sql"),
  read("supabase/gate6/runtime-foundation.sql"),
  read("supabase/gate6/runtime-actions.sql"),
  read("supabase/migrations/20260824070000_gate4_content_contract.sql"),
  read("supabase/migrations/20260824080000_gate5_complete_content_contract.sql"),
]);

const expectedMigrationHashes = {
  gate4: "f063c816e8915333404a5fd1c19a499d0828f2849c2d70bdcee61dacdc0c3dd9",
  gate5: "d21b4f659ebf8e897d006312ca08e61867708a46382fd345c492b47c929f8157",
};
if (hash(gate4) !== expectedMigrationHashes.gate4) throw new Error("Gate 4 migration history changed");
if (hash(gate5) !== expectedMigrationHashes.gate5) throw new Error("Gate 5 migration history changed");

const requiredFoundation = [
  "CREATE TABLE public.game_release_control",
  "CREATE TABLE public.game_content_progression_levels",
  "CREATE OR REPLACE FUNCTION public.game_active_content_version()",
  "CREATE OR REPLACE FUNCTION public.game_runtime_status()",
  "CREATE OR REPLACE FUNCTION public.game_assert_action_allowed",
  "CREATE VIEW public.game_runtime_items",
  "CREATE VIEW public.game_runtime_recipes",
  "CREATE VIEW public.game_runtime_quests",
  "market_listings_versioned_item_guard",
];
for (const marker of requiredFoundation) {
  if (!foundation.includes(marker)) throw new Error(`Missing Gate 6 foundation marker: ${marker}`);
}

const playerRpcs = [
  "player_sync", "profile_set_username", "gear_equip", "gear_upgrade", "inv_drop", "inv_sell",
  "bank_gold", "bank_item", "consume_food", "player_recover", "quest_action", "sell_all_resources",
  "use_potion", "craft_item", "harvest_node", "fish_cast", "attack_monster", "attack_boss",
  "market_browse", "market_list", "market_buy", "market_cancel",
];
for (const rpc of playerRpcs) {
  const start = actions.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${rpc}`);
  if (start < 0) throw new Error(`Missing guarded public RPC: ${rpc}`);
  const bodyEnd = actions.indexOf("\n$$;", start);
  const body = actions.slice(start, bodyEnd + 4);
  if (!body.includes("game_assert_action_allowed")) throw new Error(`RPC lacks release guard: ${rpc}`);
}

for (const worldRpc of ["harvest_node", "fish_cast", "attack_monster", "attack_boss"]) {
  const start = actions.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${worldRpc}`);
  const body = actions.slice(start, actions.indexOf("\n$$;", start) + 4);
  if (!body.includes("game_assert_action_allowed(true)")) {
    throw new Error(`Legacy world RPC is not v1-only: ${worldRpc}`);
  }
}

if (!migration.includes("Manifest SHA-256: a0d654a993f5a213c6ce667b6fbd29053e0432e351872492b0a6bf3d7b1cff77")) {
  throw new Error("Gate 6 did not embed the approved Gate 5 manifest");
}
if (!migration.includes("('v2', 150, NULL, 133630835)")) {
  throw new Error("Gate 6 did not embed all 150 approved progression levels");
}
if (/INSERT\s+INTO\s+public\.game_content_control/i.test(migration)) {
  throw new Error("Gate 6 must not insert an activation control row");
}
if (/UPDATE\s+public\.game_content_control/i.test(migration)) {
  throw new Error("Gate 6 must not update activation control");
}
if (/UPDATE\s+public\.game_content_versions\s+SET[\s\S]{0,200}?status\s*=\s*'active'/i.test(migration)) {
  throw new Error("Gate 6 contains an active-status update");
}
if (/supabase\.co|postgres(?:ql)?:\/\//i.test(migration)) {
  throw new Error("Gate 6 migration contains an external database target");
}

console.log("Gate 6 static safety, dispatch, history and determinism checks passed.");

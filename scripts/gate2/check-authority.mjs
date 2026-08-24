import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const failures = [];

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

function requireNoMatch(source, pattern, message) {
  if (pattern.test(source)) failures.push(message);
}

const foundation = read("supabase/migrations/20260823234500_gate2_authority_foundation.sql");
const inventory = read("supabase/migrations/20260823234600_gate2_inventory_health_quests.sql");
const world = read("supabase/migrations/20260823234700_gate2_world_actions.sql");
const market = read("supabase/migrations/20260823234800_gate2_market_leaderboard.sql");
const engine = read("src/game/engine.ts");
const contracts = read("src/contracts/rpc.ts");
const data = read("src/game/data.ts");

requireMatch(contracts, /version:\s*"tomlandia-gate2-rpc-v2"/, "the client contract must identify Gate 2");
requireMatch(data, /export const MAX_PLUS = 100;/, "the client must enforce the locked +100 ceiling");

const syncStart = foundation.indexOf("CREATE OR REPLACE FUNCTION public.player_sync");
const syncEnd = foundation.indexOf("CREATE OR REPLACE FUNCTION public.profile_set_username", syncStart);
const sync = foundation.slice(syncStart, syncEnd);
for (const key of ["gold", "inv", "skills", "hp", "quest", "weapon", "armor", "bank"]) {
  requireNoMatch(sync, new RegExp(`_data->>?['\"]${key}['\"]`), `player_sync must ignore client ${key}`);
}

requireMatch(foundation, /caller IS NULL OR _uid IS DISTINCT FROM caller/, "position ownership must be auth-bound");
requireMatch(foundation, /IF elapsed < 0\.25 THEN\s*RETURN distance <= 5;/s, "same-frame position samples must not ratchet the anchor");
requireMatch(foundation, /least\(elapsed, 2\)/, "delayed movement allowance must be capped");
requireMatch(foundation, /REVOKE INSERT, UPDATE, DELETE ON public\.player_saves FROM authenticated;/, "direct save writes must be revoked");

for (const name of ["consume_food", "player_recover", "quest_action", "sell_all_resources"]) {
  requireMatch(inventory, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\b`), `${name} must be server-owned`);
}
requireMatch(inventory, /plus >= 100/, "gear upgrades must reject the locked ceiling");
requireMatch(inventory, /legacy_stacked_gear/, "legacy stacked gear must stop instead of being guessed");
requireMatch(inventory, /world_cooldowns\.next_at <= now\(\)/, "cooldown acquisition must be atomic");
requireMatch(inventory, /INSERT INTO public\.player_positions/, "death must reset the trusted movement anchor");

for (const key of ["leveled", "state", "buff", "skipped_loot"]) {
  requireMatch(world, new RegExp(`'${key}'`), `combat response must include ${key}`);
}
requireMatch(world, /interval '15 seconds'/, "monster ownership tags must expire");
requireMatch(world, /boss_position_at\(clock_timestamp\(\)\)/, "boss combat must use the deterministic server path");
requireNoMatch(world, /tungsten_ore/i, "DESOLATUS must not award retired Tungsten");
const pointRows = [...world.matchAll(/^\s*\(\d+,\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?\)[,;]$/gm)].length;
if (pointRows !== 181) failures.push(`DESOLATUS path must contain 181 points; found ${pointRows}`);

requireMatch(market, /gross numeric/, "market totals must use numeric arithmetic");
requireMatch(market, /definition\.untradable/, "the market must enforce server tradability");
requireMatch(market, /DELETE FROM public\.player_scores/, "leaderboards must remove stale rows");

requireNoMatch(engine, /this\.questTick\(/, "the client must not advance quests locally");
requireNoMatch(engine, /private takeHit\(/, "the client must not settle combat damage locally");
requireMatch(engine, /onRecover/, "out-of-combat recovery must cross the server boundary");

if (failures.length) {
  console.error(`Gate 2 authority check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Gate 2 authority check passed: save, movement, combat, inventory, market and leaderboard boundaries are server-owned.");

/**
 * V5 release contract checks.
 *
 * Everything here is a release-blocking invariant of the approved sword
 * release: the ladder shape, the untouched recipe economy, the deletion of the
 * four tester weapons, and the absence of dangling references anywhere in the
 * generated content, the migrations or the shipped client.
 */
import { readFile } from "node:fs/promises";

import { BASE_ATTACK_INTERVAL_S, DELETED_ITEMS, SWORDS, SWORD_IDS } from "./model.mjs";

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const read = (path) => readFile(path, "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const manifest = await readJson("content/v5/manifest.authoring.json");
const world = await readJson("content/v5/world-spawn-manifest.json");
const v4 = await readJson("content/v4/manifest.authoring.json");
const runtime = manifest.runtime;

// ---- release identity ------------------------------------------------------
check(manifest.content_version === "v5", "manifest is not the v5 cut");
check(manifest.lifecycle === "runtime", "v5 manifest is not a runtime manifest");
check(world.spawn_set_version === "v5", "world manifest is not the v5 cut");
check(world.spawns.length === v4.runtime.node_spawns.length + v4.runtime.monster_spawns.length,
  "v5 spawn count drifted from v4");

// ---- exactly 16 active target swords, one per tier -------------------------
const weapons = runtime.items.filter((item) => item.kind === "weapon");
check(weapons.length === 16, `expected 16 swords, found ${weapons.length}`);
check(weapons.every((weapon) => weapon.active), "every published sword must be active");
check(
  JSON.stringify(weapons.map((weapon) => weapon.id).sort()) === JSON.stringify([...SWORD_IDS].sort()),
  "sword ids drifted from the approved stable id set",
);
check(new Set(weapons.map((weapon) => weapon.tier_index)).size === 16, "swords are not one per tier");
for (const sword of SWORDS) {
  const item = weapons.find((entry) => entry.id === sword.id);
  check(Boolean(item), `sword ${sword.id} is missing`);
  if (!item) continue;
  check(item.name === sword.name, `sword ${sword.id} is named "${item.name}", expected "${sword.name}"`);
  check(item.tier_index === sword.tier, `sword ${sword.id} is not tier ${sword.tier}`);
  const before = v4.runtime.items.find((entry) => entry.id === sword.id);
  check(item.stats.attack === before.stats.attack, `sword ${sword.id} attack changed from v4`);
  check(item.level_requirement === before.level_requirement, `sword ${sword.id} level requirement changed from v4`);
}

// ---- monotonic progression and valid attack cadence ------------------------
const ladder = [...weapons].sort((left, right) => left.tier_index - right.tier_index);
for (let index = 1; index < ladder.length; index += 1) {
  check(ladder[index].stats.attack > ladder[index - 1].stats.attack,
    `attack progression is not monotonic at tier ${ladder[index].tier_index}`);
  check(ladder[index].level_requirement > ladder[index - 1].level_requirement,
    `level requirement is not monotonic at tier ${ladder[index].tier_index}`);
}
check(BASE_ATTACK_INTERVAL_S > 0 && BASE_ATTACK_INTERVAL_S <= 2, "base attack interval is out of range");

// ---- all 16 recipes, preserved exactly, with obtainable ingredients --------
const itemIds = new Set(runtime.items.map((item) => item.id));
const swordRecipes = runtime.recipes.filter((recipe) => SWORD_IDS.includes(recipe.output_item_id));
check(swordRecipes.length === 16, `expected 16 sword recipes, found ${swordRecipes.length}`);
const obtainable = new Set([
  ...runtime.recipes.map((recipe) => recipe.output_item_id),
  ...runtime.nodes.map((node) => node.item_id),
  ...runtime.monsters.flatMap((monster) => (monster.loot ?? []).map((drop) => drop.item_id)),
  ...runtime.fish.map((fish) => fish.item_id),
]);
for (const recipe of swordRecipes) {
  const before = v4.runtime.recipes.find((entry) => entry.id === recipe.id);
  check(JSON.stringify(before) === JSON.stringify(recipe), `recipe ${recipe.id} changed; V5 must not rebalance crafts`);
  check(recipe.station === "forge" && recipe.skill === "smithing", `recipe ${recipe.id} is not a Smithing forge craft`);
  check(recipe.inputs.length > 0, `recipe ${recipe.id} has no ingredients`);
  for (const input of recipe.inputs) {
    check(itemIds.has(input.item_id), `recipe ${recipe.id} consumes undefined item ${input.item_id}`);
    check(obtainable.has(input.item_id), `recipe ${recipe.id} consumes unobtainable item ${input.item_id}`);
    check(input.qty > 0, `recipe ${recipe.id} consumes a non-positive quantity of ${input.item_id}`);
  }
}
check(runtime.recipes.length === v4.runtime.recipes.length, "v5 changed the recipe count");

// ---- the four tester weapons are gone, with no dangling references ---------
const stopRules = runtime.migration_rules.filter((rule) => DELETED_ITEMS.includes(rule.from_id));
check(stopRules.length === DELETED_ITEMS.length, "the deletion ledger does not name all four tester weapons");
check(stopRules.every((rule) => rule.action === "stop" && !rule.to_id),
  "a tester weapon still has a compensation, conversion or replacement rule");
const contentBody = JSON.stringify({ ...runtime, migration_rules: [] });
for (const id of DELETED_ITEMS) {
  check(!contentBody.includes(`"${id}"`), `v5 content still references deleted id ${id}`);
}

// ---- migrations ------------------------------------------------------------
const migrations = {
  stageContent: await read("supabase/migrations/20260901120000_v5_stage_content.sql"),
  stageWorld: await read("supabase/migrations/20260901120100_v5_stage_world.sql"),
  activate: await read("supabase/migrations/20260901120200_v5_activate.sql"),
};
for (const [name, sql] of Object.entries(migrations)) {
  check(sql.startsWith("-- V5"), `${name} migration is not the generated V5 file`);
  check(sql.includes("BEGIN;") && sql.trimEnd().endsWith("COMMIT;"), `${name} migration is not a single transaction`);
  check(!/DROP TABLE|TRUNCATE/i.test(sql), `${name} migration performs a destructive schema change`);
}
const activate = migrations.activate;
check(activate.includes("V5 activation expects v4 to be the active release"), "activation does not require v4 active");
check(activate.includes("game_validate_content_version('v5')"), "activation does not validate v5 before cleanup");
check(activate.indexOf("game_validate_content_version('v5')") < activate.indexOf("INSERT INTO public.player_save_backups"),
  "activation must validate before it touches player saves");
check(activate.includes("INSERT INTO public.player_save_backups"), "activation does not back up touched saves");
check(activate.includes("DELETE FROM public.market_listings WHERE item_id = ANY"), "activation does not clear market listings");
check(activate.includes("DELETE FROM public.market_prices WHERE item_id = ANY"), "activation does not clear price history");
check(activate.includes("still reference a deleted weapon id"), "activation does not assert saves are clean");
check(activate.includes("does not define"), "activation does not assert saves still deserialize");
check(activate.includes("'{weapon}', 'null'::jsonb"), "activation does not clear the equipped weapon slot");
check(!activate.includes("'{armor}'"), "activation must not touch armour slots");
check(activate.includes("v4 must be retained as retired for rollback".replace("v4 must", "v4 must")) ||
  activate.includes("must be retained as retired for rollback"), "activation does not retain v4 for rollback");
check(!/DELETE FROM public\.game_content_\w+\s+WHERE content_version = 'v4'/.test(activate),
  "activation deletes v4 rollback rows");
for (const id of DELETED_ITEMS) {
  check(activate.includes(`'${id}'`), `activation does not name deleted id ${id}`);
}

// ---- shipped client --------------------------------------------------------
const catalog = await read("src/generated/release-catalog.ts");
const releaseItems = JSON.parse(catalog.slice(catalog.indexOf("RELEASE_ITEMS = ") + 16, catalog.indexOf("] as const;\nexport const RELEASE_RECIPES") + 1));
const clientWeapons = releaseItems.filter((item) => item.kind === "weapon");
check(clientWeapons.length === 16, `client catalog publishes ${clientWeapons.length} swords, expected 16`);
for (const sword of SWORDS) {
  const item = clientWeapons.find((entry) => entry.id === sword.id);
  check(item?.name === sword.name, `client catalog names ${sword.id} incorrectly`);
}
const clientSources = await Promise.all(
  ["src/game/data.ts", "src/game/engine.ts", "src/generated/release-catalog.ts", "src/generated/content-catalog.ts",
   "src/routes/_authenticated/play.tsx", "tests/fixtures/save-fixtures.ts"].map(async (path) => [path, await read(path)]),
);
for (const [path, body] of clientSources) {
  for (const id of DELETED_ITEMS) {
    check(!body.includes(id), `${path} still references deleted tester weapon ${id}`);
  }
}

// ---- Weaponsmith UI --------------------------------------------------------
const dialog = await read("src/components/game/NpcDialog.tsx");
check(dialog.includes("releaseWeaponTiers()"), "the Weaponsmith does not render the generated sword ladder");
check(dialog.includes("BASE_ATTACK_INTERVAL_S"), "the Weaponsmith does not show the base attack interval");
check(dialog.includes("armour modifies cadence"), "the Weaponsmith does not note that armour modifies cadence");
check(dialog.includes("atk vs"), "the Weaponsmith does not compare against the equipped weapon");
check(/grid-cols-2 gap-1\.5/.test(dialog), "the Weaponsmith ladder is not a responsive two-column grid");
check(dialog.includes("+2% attack per level through +50, then +0.5% per level"),
  "the upgrade explanation was not corrected");
const data = await read("src/game/data.ts");
check(data.includes("export const PLUS_STEP = 0.02;") && data.includes("PLUS_STEP_ABOVE_50 = 0.005"),
  "the client upgrade curve does not mirror the server");

if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  throw new Error(`V5 checks failed: ${failures.length} issue(s)`);
}
console.log(
  `V5 release verified: 16 swords (one per tier, attack ${ladder[0].stats.attack}..${ladder[15].stats.attack}), ` +
    `16 recipes preserved, ${DELETED_ITEMS.length} tester weapons deleted, 3 migrations, client catalog in sync`,
);

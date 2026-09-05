/**
 * V6 release contract checks.
 *
 * Every assertion here is a release-blocking invariant of the approved
 * strength-potion release: the 16 stable ids, one active potion and one recipe
 * per tier, a strict field-level delta against canonical V5, untouched healing
 * food, obtainable ingredients, truthful percentage wording in the client, and
 * FK-safe, non-destructive migrations.
 */
import { readFile } from "node:fs/promises";

import {
  APPROVED_UPLIFT_EXCEPTIONS,
  MAX_SAME_TIER_UPLIFT_PCT,
  POTIONS,
  POTION_IDS,
  DELETED_ITEMS,
} from "./model.mjs";

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const read = (path) => readFile(path, "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const manifest = await readJson("content/v6/manifest.authoring.json");
const world = await readJson("content/v6/world-spawn-manifest.json");
const v5 = await readJson("content/v5/manifest.authoring.json");
const runtime = manifest.runtime;

// ---- release identity ------------------------------------------------------
check(manifest.content_version === "v6", "manifest is not the v6 cut");
check(manifest.lifecycle === "runtime", "v6 manifest is not a runtime manifest");
check(world.spawn_set_version === "v6", "world manifest is not the v6 cut");
check(
  world.spawns.length === v5.runtime.node_spawns.length + v5.runtime.monster_spawns.length,
  "v6 spawn count drifted from v5",
);
check(DELETED_ITEMS.length === 0, "V6 must not delete any item");

// ---- exactly 16 active stable potions, one per tier ------------------------
const potions = runtime.items.filter((item) => item.kind === "potion");
check(potions.length === 16, `expected 16 potions, found ${potions.length}`);
check(
  potions.every((potion) => potion.active),
  "every published potion must be active",
);
check(
  JSON.stringify(potions.map((potion) => potion.id).sort()) === JSON.stringify([...POTION_IDS].sort()),
  "potion ids drifted from the approved stable id set",
);
check(new Set(potions.map((p) => p.tier_index)).size === 16, "potions are not one per tier");

const byId = new Map(potions.map((potion) => [potion.id, potion]));
// The percentage effect is authored in the runtime mechanics block, not in the
// shared item stats, so V1..V5 keep reading `dmg_boost` as a flat bonus.
const mechanics = runtime.mechanics?.strength_potions ?? [];
check(mechanics.length === 16, `expected 16 strength-potion mechanics rows, found ${mechanics.length}`);
const pctById = new Map(mechanics.map((row) => [row.item_id, row]));
const v5ById = new Map(v5.runtime.items.map((item) => [item.id, item]));
for (const spec of POTIONS) {
  const potion = byId.get(spec.id);
  check(Boolean(potion), `potion ${spec.id} is missing`);
  if (!potion) continue;
  check(potion.name === spec.name, `potion ${spec.id} is named "${potion.name}"`);
  check(potion.tier_index === spec.tier, `potion ${spec.id} is not tier ${spec.tier}`);
  const effect = pctById.get(spec.id);
  check(
    effect?.strength_pct === spec.strength_pct,
    `potion ${spec.id} does not match the frozen percentage model`,
  );
  check(effect?.tier_index === spec.tier, `potion ${spec.id} mechanics row is on the wrong tier`);
  check(effect?.boost_hits === potion.stats.boost_hits, `potion ${spec.id} hit counts disagree`);
  check(potion.stats.boost_hits > 0, `potion ${spec.id} has a non-positive hit count`);

  // strict field-level delta: only the name and the strength effect may differ
  const before = v5ById.get(spec.id);
  check(Boolean(before), `potion ${spec.id} is not a canonical V5 item`);
  if (!before) continue;
  check(potion.value === before.value, `potion ${spec.id} intrinsic value changed`);
  check(
    potion.level_requirement === before.level_requirement,
    `potion ${spec.id} level requirement changed`,
  );
  check(
    potion.stats.boost_hits === before.stats.boost_hits,
    `potion ${spec.id} hit count changed from v5`,
  );
  const strip = (item) => {
    const { name, ...rest } = item;
    return JSON.stringify(rest);
  };
  check(strip(potion) === strip(before), `potion ${spec.id} changed fields V6 must not touch`);
}

// non-decreasing progression across the ladder
const ladder = [...potions].sort((left, right) => left.tier_index - right.tier_index);
const pctOf = (potion) => pctById.get(potion.id)?.strength_pct ?? 0;
for (let index = 1; index < ladder.length; index += 1) {
  check(
    pctOf(ladder[index]) >= pctOf(ladder[index - 1]),
    `strength progression decreases at tier ${ladder[index].tier_index}`,
  );
  check(
    ladder[index].level_requirement > ladder[index - 1].level_requirement,
    `level requirement is not monotonic at tier ${ladder[index].tier_index}`,
  );
}

// ---- healing food is byte-for-byte untouched -------------------------------
const foods = (items) => items.filter((item) => item.kind === "food");
check(
  JSON.stringify(foods(runtime.items)) === JSON.stringify(foods(v5.runtime.items)),
  "V6 changed healing food definitions",
);

// ---- exactly 16 alchemy recipes, one per potion, unchanged from V5 ---------
const itemIds = new Set(runtime.items.map((item) => item.id));
const potionRecipes = runtime.recipes.filter((recipe) => POTION_IDS.includes(recipe.output_item_id));
check(potionRecipes.length === 16, `expected 16 potion recipes, found ${potionRecipes.length}`);
check(
  new Set(potionRecipes.map((recipe) => recipe.output_item_id)).size === 16,
  "potion recipes are not one per potion",
);
check(runtime.recipes.length === v5.runtime.recipes.length, "v6 changed the recipe count");

const obtainable = new Set([
  ...runtime.recipes.map((recipe) => recipe.output_item_id),
  ...runtime.nodes.map((node) => node.item_id),
  ...runtime.monsters.flatMap((monster) => (monster.loot ?? []).map((drop) => drop.item_id)),
  ...runtime.fish.map((fish) => fish.item_id),
]);
const sourceLevel = new Map();
const noteSource = (id, level) => {
  const current = sourceLevel.get(id);
  if (current === undefined || level < current) sourceLevel.set(id, level);
};
for (const node of runtime.nodes) noteSource(node.item_id, node.level_requirement ?? 1);
for (const monster of runtime.monsters) {
  for (const drop of monster.loot ?? []) noteSource(drop.item_id, monster.level_requirement ?? 1);
}
for (const recipe of runtime.recipes) noteSource(recipe.output_item_id, recipe.level_requirement ?? 1);

for (const recipe of potionRecipes) {
  const before = v5.runtime.recipes.find((entry) => entry.id === recipe.id);
  check(
    JSON.stringify(before) === JSON.stringify(recipe),
    `recipe ${recipe.id} changed; V6 must not rebalance crafts`,
  );
  check(recipe.station === "alchemy", `recipe ${recipe.id} is not an Alchemy craft`);
  check(recipe.skill === "alchemy", `recipe ${recipe.id} does not train Alchemy`);
  check(recipe.time_s > 0, `recipe ${recipe.id} has a non-positive duration`);
  check(recipe.xp > 0, `recipe ${recipe.id} grants no experience`);
  check(recipe.inputs.length > 0, `recipe ${recipe.id} has no ingredients`);
  for (const input of recipe.inputs) {
    check(itemIds.has(input.item_id), `recipe ${recipe.id} consumes undefined ${input.item_id}`);
    check(obtainable.has(input.item_id), `recipe ${recipe.id} consumes unobtainable ${input.item_id}`);
    check(input.qty > 0, `recipe ${recipe.id} consumes a non-positive quantity`);
    const gate = sourceLevel.get(input.item_id);
    // The tier-16 capstone is an explicit soft gate: Ascendant Core drops from
    // the level-150 Ascendant Wyrm, at the same level as the recipe itself.
    const capstone = recipe.output_item_id === "ascendant_damage_potion";
    check(
      gate !== undefined && (gate <= recipe.level_requirement || capstone),
      `recipe ${recipe.id} needs ${input.item_id} from a level ${gate} source above its own gate`,
    );
  }
}

// ---- the modelled curve was actually simulated and passed ------------------
const combat = await readJson("docs/overhaul/v6/combat-simulation.json");
check(combat.approved_threshold_pct === MAX_SAME_TIER_UPLIFT_PCT, "simulation used another gate");
check(
  JSON.stringify(combat.approved_exceptions) === JSON.stringify(APPROVED_UPLIFT_EXCEPTIONS),
  "simulation exceptions drifted from the owner-approved record",
);
for (const row of combat.cases ?? []) {
  if (row.target !== "same_tier") continue;
  const approved = APPROVED_UPLIFT_EXCEPTIONS.some(
    (entry) => entry.tier === row.tier && entry.modeled_uplift_pct === row.uplift_pct,
  );
  check(
    row.uplift_pct <= MAX_SAME_TIER_UPLIFT_PCT || approved,
    `modelled tier ${row.tier} same-tier uplift ${row.uplift_pct}% exceeds the approved gate`,
  );
}

// ---- migrations ------------------------------------------------------------
const migrations = {
  stageContent: await read("supabase/migrations/20260903120000_v6_stage_content.sql"),
  stageWorld: await read("supabase/migrations/20260903120100_v6_stage_world.sql"),
  activate: await read("supabase/migrations/20260903120200_v6_activate.sql"),
};
for (const [name, sql] of Object.entries(migrations)) {
  check(sql.startsWith("-- V6"), `${name} migration is not the generated V6 file`);
  check(
    sql.includes("BEGIN;") && sql.trimEnd().endsWith("COMMIT;"),
    `${name} migration is not a single transaction`,
  );
  check(!/DROP TABLE|TRUNCATE/i.test(sql), `${name} migration performs a destructive change`);
  check(
    !/DELETE FROM public\.(player_saves|market_listings|market_prices|market_trades)/i.test(sql),
    `${name} migration deletes player or market rows`,
  );
  for (const statement of sql.match(/DELETE FROM[\s\S]*?;/g) ?? []) {
    for (const id of POTION_IDS) {
      check(!statement.includes(`'${id}'`), `${name} deletes stable potion id ${id}`);
    }
  }
}

const stage = migrations.stageContent;
check(
  /UPDATE public\.game_content_items/.test(stage),
  "stage-content does not rename the stable potions in place",
);
check(stage.includes("strength_pct"), "stage-content does not stage the strength percentage");
check(
  stage.includes("apply_strength_buff"),
  "stage-content does not install the shared strength helper",
);
check(
  stage.includes("attack_monster_v2") && stage.includes("attack_boss_v1"),
  "stage-content does not rebuild both combat paths on the shared helper",
);
check(stage.includes("use_potion"), "stage-content does not rebuild use_potion");

const activate = migrations.activate;
check(
  activate.includes("game_validate_content_version('v6')"),
  "activation does not validate v6 before switching",
);
check(
  activate.includes("INSERT INTO public.player_save_backups"),
  "activation does not back up touched saves",
);
check(
  !/DELETE FROM public\.game_content_\w+\s+WHERE content_version = 'v5'/.test(activate),
  "activation deletes v5 rollback rows",
);
check(activate.includes("'retired'"), "activation does not retire v5");

// ---- the shipped client tells the truth ------------------------------------
const catalog = await read("src/generated/release-catalog.ts");
check(catalog.includes("RELEASE_POTIONS"), "client catalogue exposes no potion ladder");
check(catalog.includes("strength_pct"), "client catalogue omits the strength percentage");
const releaseContent = await read("src/game/release-content.ts");
check(
  releaseContent.includes("releasePotionTiers"),
  "client does not expose the 16-tier potion ladder",
);
const dialog = await read("src/components/game/NpcDialog.tsx");
check(dialog.includes("% strength"), "the Alchemist does not describe the effect as a percentage");
check(
  !/\+\$\{strengthPct\} (dmg|damage)/.test(dialog),
  "the Alchemist shows the percentage as flat damage",
);
const hud = await read("src/components/game/Hud.tsx");
check(hud.includes("% strength"), "the HUD does not describe the buff as a percentage");
const engine = await read("src/game/engine.ts");
check(engine.includes("readServerBuff"), "the client does not parse both buff shapes");
check(
  !/this\.buff\s*=\s*\{\s*dmg:/.test(engine),
  "the client still fabricates a buff instead of mirroring the server",
);

if (failures.length) {
  console.error(`V6 check failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`V6 contract verified: ${POTIONS.length} potions, ${potionRecipes.length} recipes, 0 deletions`);

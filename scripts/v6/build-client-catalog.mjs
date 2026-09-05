/**
 * Generates the client-side V6 content catalog.
 *
 * Identical in shape to the V5 catalog, plus the strength-potion ladder: the
 * 16 stable potion ids with their authoritative percentage, boosted hits and
 * Alchemy recipe, so the Alchemist can render all 16 tiers (including locked
 * ones) without a hand-written copy of the release data.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const source = resolve(root, "content/v6/manifest.authoring.json");
const output = resolve(root, "src/generated/release-catalog.ts");
const checkOnly = process.argv.includes("--check");

const manifest = JSON.parse(await readFile(source, "utf8"));
if (manifest.lifecycle !== "runtime") throw new Error("Client catalog requires the approved runtime manifest");
const runtime = manifest.runtime;

// Skills the client's Recipe type accepts; the station is the NPC surface.
const CRAFT_SKILLS = new Set(["smithing", "tailoring", "skinning", "cooking", "alchemy"]);

const items = runtime.items
  .map(
    ({
      id,
      name,
      value,
      kind,
      family,
      colour,
      rarity,
      tier_index,
      level_requirement,
      stackable,
      tradable,
      stats,
    }) => ({
      id,
      name,
      value,
      kind,
      family,
      colour,
      rarity,
      tier_index,
      level_requirement,
      stackable,
      tradable,
      stats,
    }),
  )
  .sort((left, right) => left.id.localeCompare(right.id));

const recipes = runtime.recipes
  .map((recipe) => {
    if (!CRAFT_SKILLS.has(recipe.skill)) throw new Error(`Recipe ${recipe.id} uses non-craft skill ${recipe.skill}`);
    return {
      id: recipe.id,
      station: recipe.station,
      skill: recipe.skill,
      out: recipe.output_item_id,
      outQty: recipe.output_qty,
      inputs: [...recipe.inputs]
        .map(({ item_id, qty }) => ({ id: item_id, qty }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      req: recipe.level_requirement,
      xp: recipe.xp,
      time: recipe.time_s,
      tier_index: recipe.tier_index,
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id));

const armour = items.filter((entry) => entry.kind === "armor");
const heavy = armour.filter((entry) => entry.family === "heavy_armor");
const light = armour.filter((entry) => entry.family === "light_armor");
if (heavy.length !== 16 || light.length !== 16) {
  throw new Error(`Expected 16 heavy and 16 light armour sets, got ${heavy.length}/${light.length}`);
}
for (const set of armour) {
  if (!recipes.some((recipe) => recipe.out === set.id)) throw new Error(`Armour ${set.id} has no recipe`);
}

const weapons = items
  .filter((entry) => entry.kind === "weapon")
  .sort((left, right) => left.tier_index - right.tier_index);
if (weapons.length !== 16) throw new Error(`Expected 16 swords, got ${weapons.length}`);
weapons.forEach((weapon, index) => {
  if (weapon.tier_index !== index + 1) throw new Error(`Sword ladder has no tier ${index + 1}`);
  if (!recipes.some((recipe) => recipe.out === weapon.id)) throw new Error(`Sword ${weapon.id} has no recipe`);
  if (index > 0 && weapon.stats.attack <= weapons[index - 1].stats.attack) {
    throw new Error(`Sword attack progression is not monotonic at tier ${weapon.tier_index}`);
  }
});

// ---- strength potions ------------------------------------------------------
const strengthRows = [...runtime.mechanics.strength_potions].sort(
  (left, right) => left.tier_index - right.tier_index,
);
if (strengthRows.length !== 16) throw new Error(`Expected 16 strength potions, got ${strengthRows.length}`);
const potions = strengthRows.map((row, index) => {
  const item = items.find((entry) => entry.id === row.item_id);
  if (!item) throw new Error(`Strength potion ${row.item_id} is not an item`);
  if (item.kind !== "potion") throw new Error(`Strength potion ${row.item_id} is not a potion`);
  if (item.tier_index !== row.tier_index) throw new Error(`Potion ${row.item_id} tier mismatch`);
  if (row.tier_index !== index + 1) throw new Error(`Potion ladder has no tier ${index + 1}`);
  if (row.boost_hits !== item.stats.boost_hits) {
    throw new Error(`Potion ${row.item_id} boost hits disagree with the item definition`);
  }
  if (index > 0 && row.strength_pct < strengthRows[index - 1].strength_pct) {
    throw new Error(`Strength progression is not monotonic at tier ${row.tier_index}`);
  }
  const recipe = recipes.find((entry) => entry.out === row.item_id);
  if (!recipe) throw new Error(`Potion ${row.item_id} has no recipe`);
  if (recipe.skill !== "alchemy") throw new Error(`Potion ${row.item_id} is not crafted with Alchemy`);
  return {
    id: row.item_id,
    tier_index: row.tier_index,
    strength_pct: row.strength_pct,
    boost_hits: row.boost_hits,
    recipe_id: recipe.id,
  };
});
const potionItems = items.filter((entry) => entry.kind === "potion");
if (potionItems.length !== 16) throw new Error(`Expected 16 potion items, got ${potionItems.length}`);

const tiers = manifest.tiers
  .map(({ tier_index, level_requirement, theme }) => ({ tier_index, level_requirement, theme }))
  .sort((left, right) => left.tier_index - right.tier_index);

const generated =
  `/* eslint-disable */\n` +
  `/* GENERATED by scripts/v6/build-client-catalog.mjs. Do not edit. */\n` +
  `/* Release: ${manifest.content_version} */\n\n` +
  `export const RELEASE_CONTENT_VERSION = ${JSON.stringify(manifest.content_version)} as const;\n` +
  `export const RELEASE_TIERS = ${JSON.stringify(tiers, null, 2)} as const;\n` +
  `export const RELEASE_ITEMS = ${JSON.stringify(items, null, 2)} as const;\n` +
  `export const RELEASE_RECIPES = ${JSON.stringify(recipes, null, 2)} as const;\n` +
  `export const RELEASE_POTIONS = ${JSON.stringify(potions, null, 2)} as const;\n\n` +
  `export const RELEASE_ITEM_BY_ID = Object.fromEntries(RELEASE_ITEMS.map((entry) => [entry.id, entry])) as Record<string, (typeof RELEASE_ITEMS)[number]>;\n` +
  `export const RELEASE_ARMOUR = RELEASE_ITEMS.filter((entry) => entry.kind === "armor");\n` +
  `export const RELEASE_WEAPONS = RELEASE_ITEMS.filter((entry) => entry.kind === "weapon");\n` +
  `export const RELEASE_POTION_BY_ID = Object.fromEntries(RELEASE_POTIONS.map((entry) => [entry.id, entry])) as Record<string, (typeof RELEASE_POTIONS)[number]>;\n` +
  `export const BASE_ATTACK_INTERVAL_S = 0.85;\n`;

if (checkOnly) {
  if ((await readFile(output, "utf8").catch(() => "")) !== generated) {
    throw new Error("Client release catalog drifted; run node scripts/v6/build-client-catalog.mjs");
  }
  console.log(
    `Verified client catalog (${items.length} items, ${recipes.length} recipes, ${armour.length} armour, ${weapons.length} swords, ${potions.length} potions)`,
  );
} else {
  await writeFile(output, generated);
  console.log(
    `Wrote ${output.slice(root.length + 1)} (${items.length} items, ${recipes.length} recipes, ${armour.length} armour, ${weapons.length} swords, ${potions.length} potions)`,
  );
}

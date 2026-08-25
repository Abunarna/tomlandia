import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { manifestHash, validateManifest } from "../../scripts/content/model.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const [manifest, registry, model, approval, live, liveSpawns, sprites, summary] = await Promise.all([
  readJson("content/v2/manifest.authoring.json"),
  readJson("docs/overhaul/gate-0/id-registry.json"),
  readJson("docs/overhaul/gate-3/balance-model.proposed.json"),
  readJson("docs/overhaul/gate-3/approval-record.json"),
  readJson("docs/overhaul/gate-5/live-v1-snapshot.json"),
  readJson("docs/overhaul/gate-5/live-v1-spawns.json"),
  readJson("content/v2/sprite-metadata.json"),
  readJson("docs/overhaul/gate-5/content-summary.json"),
]);

const runtime = manifest.runtime;
const byId = new Map(runtime.items.map((item) => [item.id, item]));
const byMonster = new Map(runtime.monsters.map((monster) => [monster.kind, monster]));
const byNode = new Map(runtime.nodes.map((node) => [node.kind, node]));
const byRecipeOutput = new Map(runtime.recipes.map((recipe) => [recipe.output_item_id, recipe]));
const retired = new Set(registry.retired_ids);
const activeItems = runtime.items.filter((item) => item.active);

const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
const newRegistryItems = Object.entries(registry.new_ids)
  .filter(([category]) => category !== "node_kinds" && category !== "monster_kinds")
  .flatMap(([, ids]) => ids);

const IN_PLACE = Object.values(registry.in_place_ids).flat();
const WEAPONS = [
  "copper_sword", "bronze_sword", "iron_sword", "steel_sword", "mithril_blade",
  "sunsteel_blade", "runite_greatsword", "shadow_blade", "frost_greatblade",
  "wyrmsteel_blade", "glacial_greatblade", "starsteel_blade", "voidsteel_greatblade",
  "wyrmforged_blade", "ancient_greatblade", "ascendant_blade",
];
const FOODS = [
  "honey_bun", "berry_pie", "hearty_stew", "fishermans_stew", "golden_koi_feast",
  "sunspiced_eel", "runic_fish_stew", "shadow_stew", "frost_tonic", "wyrm_feast",
  "phoenix_fillet", "starsteel_feast", "void_feast", "wyrmforged_feast",
  "ancient_feast", "ascendant_feast",
];
const POTIONS = [
  "minor_venom_draught", "bronze_damage_potion", "goblins_fury_tonic",
  "steel_damage_potion", "serpents_bite_elixir", "sunsteel_damage_potion",
  "runite_damage_potion", "shadow_venom", "froststeel_damage_potion",
  "wyrmsteel_damage_potion", "frostfire_brew", "starsteel_damage_potion",
  "voidsteel_damage_potion", "wyrmforged_damage_potion", "ancient_damage_potion",
  "ascendant_damage_potion",
];

test("Gate 5 is hash-bound to the approved numeric model and remains staged-only", () => {
  const result = validateManifest(manifest, registry);
  assert.equal(result.lifecycle, "runtime");
  assert.equal(result.hash, summary.manifest_hash);
  assert.equal(result.hash, manifestHash(manifest));
  assert.equal(approval.status, "owner_approved");
  assert.equal(approval.approvedModelHash, model.modelHash);
  assert.equal(runtime.mechanics.approved_balance_model_hash, model.modelHash);
  assert.deepEqual(
    {
      weapon: runtime.mechanics.weapon_multiplier_rule,
      light: runtime.mechanics.light_attack_multiplier_rule,
      defense: runtime.mechanics.defense_multiplier_rule,
      upgrade: runtime.mechanics.upgrade_cost_rule,
      resale: runtime.mechanics.gear_resale_rule,
    },
    {
      weapon: model.formulas.upgradeWeaponMultiplier,
      light: model.formulas.upgradeLightAttackMultiplier,
      defense: model.formulas.upgradeDefenseMultiplier,
      upgrade: model.formulas.upgradeCost,
      resale: model.formulas.gearResale,
    },
  );
  assert.deepEqual(
    [runtime.mechanics.max_level, runtime.mechanics.max_plus, runtime.mechanics.market_fee_pct],
    [150, 100, 5],
  );
  assert.equal(summary.safety.activation_performed, false);
  assert.equal(summary.safety.production_database_writes, false);
});

test("complete entity counts and locked ID inventories are exact", () => {
  assert.deepEqual(summary.counts, {
    tiers: 16,
    items: 174,
    active_items: 168,
    inactive_items: 6,
    recipes: 108,
    nodes: 27,
    monsters: 32,
    fish: 5,
    fishing_spots: 6,
    quests: 8,
    bosses: 1,
    node_spawns: 369,
    monster_spawns: 361,
    migration_rules: 6,
    sprites: 32,
  });
  assert.deepEqual(
    sorted(runtime.items.map((item) => item.id)),
    sorted([...live.captured_fields.items.map((item) => item.id), ...newRegistryItems]),
  );
  assert.deepEqual(
    sorted(runtime.nodes.map((node) => node.kind)),
    sorted([
      ...Object.keys(live.captured_fields.nodes).filter((kind) => kind !== "tungsten"),
      ...registry.new_ids.node_kinds,
    ]),
  );
  assert.deepEqual(sorted(runtime.monsters.map((monster) => monster.kind)), sorted(registry.sprite_kinds));
});

test("all six retired IDs are inactive and absent from every active dependency", () => {
  assert.deepEqual(sorted(runtime.items.filter((item) => !item.active).map((item) => item.id)), sorted(retired));
  const references = [
    ...runtime.recipes.flatMap((recipe) => [recipe.output_item_id, ...recipe.inputs.map((input) => input.item_id)]),
    ...runtime.nodes.map((node) => node.item_id),
    ...runtime.monsters.flatMap((monster) => monster.loot.map((drop) => drop.item_id)),
    ...runtime.fish.map((rule) => rule.item_id),
    ...runtime.fishing_spots.flatMap((spot) => spot.fish_item_ids),
    ...runtime.quests.flatMap((quest) => [quest.target_id, ...quest.reward_items.map((reward) => reward.item_id)]),
    ...runtime.bosses.flatMap((boss) => boss.rewards.map((reward) => reward.item_id)),
  ];
  assert.equal(references.some((id) => retired.has(id)), false);
  assert.equal(runtime.node_spawns.some((spawn) => spawn.kind === "tungsten"), false);
  assert.equal(runtime.nodes.some((node) => node.kind === "tungsten"), false);
});

test("every level tier has one weapon, two armor styles, one food and one potion with approved stats", () => {
  for (const tier of model.tiers) {
    const tierIndex = tier.tierIndex;
    const weapons = activeItems.filter((item) => item.tier_index === tierIndex && item.kind === "weapon");
    const armor = activeItems.filter((item) => item.tier_index === tierIndex && item.kind === "armor");
    const foods = activeItems.filter((item) => item.tier_index === tierIndex && item.kind === "food");
    const potions = activeItems.filter((item) => item.tier_index === tierIndex && item.kind === "potion");
    assert.equal(weapons.length, 1, `weapon tier ${tierIndex}`);
    assert.equal(armor.length, 2, `armor tier ${tierIndex}`);
    assert.equal(foods.length, 1, `food tier ${tierIndex}`);
    assert.equal(potions.length, 1, `potion tier ${tierIndex}`);
    assert.equal(weapons[0].stats.attack, tier.weaponAttack);
    const heavy = armor.find((item) => item.stats.speed === 0 && item.stats.attack === 0);
    const light = armor.find((item) => item.stats.speed > 0 && item.stats.attack > 0);
    assert.ok(heavy, `heavy armor tier ${tierIndex}`);
    assert.ok(light, `light armor tier ${tierIndex}`);
    assert.equal(heavy.stats.defense, tier.heavyDefense);
    assert.equal(light.stats.defense, tier.lightDefense);
    assert.equal(light.stats.attack, tier.lightAttack);
    assert.equal(light.stats.speed, tier.lightSpeed);
    assert.ok(heavy.stats.defense > light.stats.defense);
    assert.equal(foods[0].stats.heal, tier.food.heal);
    assert.equal(potions[0].stats.dmg_boost, tier.potion.damageBoost);
    assert.equal(potions[0].stats.boost_hits, tier.potion.boostHits);
  }
  assert.deepEqual(WEAPONS.map((id) => byId.get(id).tier_index), model.tiers.map((tier) => tier.tierIndex));
  assert.deepEqual(FOODS.map((id) => byId.get(id).tier_index), model.tiers.map((tier) => tier.tierIndex));
  assert.deepEqual(POTIONS.map((id) => byId.get(id).tier_index), model.tiers.map((tier) => tier.tierIndex));
});

test("all 23 locked in-place items preserve identity and never regress a live stat", () => {
  assert.equal(IN_PLACE.length, 23);
  const liveById = new Map(live.captured_fields.items.map((item) => [item.id, item]));
  for (const id of IN_PLACE) {
    const before = liveById.get(id);
    const after = byId.get(id);
    assert.ok(before && after?.active, id);
    for (const [beforeKey, afterKey] of [
      ["attack", "attack"], ["defense", "defense"], ["heal", "heal"],
      ["speed", "speed"], ["dmgBoost", "dmg_boost"], ["boostHits", "boost_hits"],
    ]) {
      assert.ok(after.stats[afterKey] >= (before[beforeKey] ?? 0), `${id}.${afterKey}`);
    }
    assert.equal(after.stackable, before.stackable);
  }
});

test("20 protected monsters retain exact live combat/reward fields and spawn positions", () => {
  for (const [kind, before] of Object.entries(live.captured_fields.monsters)) {
    const after = byMonster.get(kind);
    assert.deepEqual(
      [after.name, after.hp, after.attack, after.defense, after.xp, after.gold_min, after.gold_max],
      [before.name, before.hp, before.attack, before.defense, before.xp, before.gold[0], before.gold[1]],
      kind,
    );
    const drop = after.loot.find((entry) => entry.channel === "drop");
    assert.equal(drop?.item_id, kind === "frost_giant" ? "frost_giant_heart" : (before.drop ?? undefined));
    assert.equal(drop?.chance, before.dropChance ?? undefined);
    const hide = after.loot.find((entry) => entry.channel === "hide");
    assert.equal(hide?.item_id, before.hide ?? undefined);
    assert.equal(hide?.xp, before.hide ? before.hideXp : undefined);
  }
  const actual = runtime.monster_spawns
    .filter((spawn) => Object.hasOwn(live.captured_fields.monsters, spawn.kind))
    .map(({ kind, x, y }) => ({ kind, x, y }));
  const expected = liveSpawns.monster_spawns.map(({ kind, x, y }) => ({ kind, x, y }));
  assert.deepEqual(actual, expected);
});

test("all recipe dependencies close at or below their consuming requirement", () => {
  assert.equal(runtime.recipes.length, 108);
  for (const recipe of runtime.recipes) {
    assert.ok(byId.get(recipe.output_item_id)?.active, recipe.id);
    for (const input of recipe.inputs) {
      const item = byId.get(input.item_id);
      assert.ok(item?.active, `${recipe.id}:${input.item_id}`);
      assert.ok(
        item.level_requirement <= recipe.level_requirement,
        `${recipe.id} requires level-${item.level_requirement} ${input.item_id} at level ${recipe.level_requirement}`,
      );
    }
  }
  assert.deepEqual(byRecipeOutput.get("runite_bar").inputs, [{ item_id: "runite_ore", qty: 2 }]);
  assert.deepEqual(byRecipeOutput.get("mystic_cloth").inputs, [
    { item_id: "desert_bloom", qty: 1 }, { item_id: "herb_weave", qty: 2 },
  ]);
  assert.deepEqual(byRecipeOutput.get("shadowweave").inputs, [
    { item_id: "gloomcap", qty: 2 }, { item_id: "mystic_cloth", qty: 2 },
  ]);
  assert.deepEqual(byRecipeOutput.get("frost_tonic").inputs, [
    { item_id: "deepwater_eel", qty: 2 }, { item_id: "thick_leather", qty: 1 },
  ]);
  const armorRecipes = runtime.recipes.filter((recipe) => recipe.station === "armor");
  for (const recipe of armorRecipes) {
    const output = byId.get(recipe.output_item_id);
    const isHeavy = output.stats.attack === 0 && output.stats.speed === 0;
    assert.equal(recipe.skill, isHeavy ? "smithing" : "tailoring", recipe.id);
  }
});

test("node corrections are lower-only and every new node has a full authored cluster", () => {
  assert.equal(byNode.get("mithril").level_requirement, 40);
  assert.equal(byNode.get("runite").level_requirement, 60);
  assert.equal(byNode.get("palm").level_requirement, 40);
  for (const kind of ["copper", "iron", "sandstone"]) {
    const before = live.captured_fields.nodes[kind];
    const after = byNode.get(kind);
    assert.deepEqual(
      [after.name, after.level_requirement, after.xp, after.gather_s, after.respawn_s, after.item_id],
      [before.name, before.req, before.xp, before.time, before.respawn, before.item],
    );
  }
  const expectedLevels = [25, 45, 78, 100, 110, 120, 130, 140, 150];
  assert.deepEqual(registry.new_ids.node_kinds.map((kind) => byNode.get(kind).level_requirement), expectedLevels);
  for (const kind of registry.new_ids.node_kinds) {
    const node = byNode.get(kind);
    const spawns = runtime.node_spawns.filter((spawn) => spawn.kind === kind);
    assert.ok(spawns.length >= node.cluster_min, kind);
  }
  const preserved = runtime.node_spawns
    .filter((spawn) => Object.hasOwn(live.captured_fields.nodes, spawn.kind))
    .map(({ kind, x, y }) => ({ kind, x, y }));
  const expected = liveSpawns.node_spawns
    .filter((spawn) => spawn.kind !== "tungsten")
    .map(({ kind, x, y }) => ({ kind, x, y }));
  assert.deepEqual(preserved, expected);
});

test("existing quests are server-ready with only the two locked reward corrections", () => {
  assert.equal(runtime.quests.length, 8);
  const source = new Map(live.captured_fields.quests.map((quest) => [quest.id, quest]));
  for (const quest of runtime.quests) {
    const before = source.get(quest.id);
    assert.deepEqual(
      [quest.name, quest.description, quest.kind, quest.target_id, quest.count, quest.gold, quest.xp_skill, quest.xp],
      [before.name, before.desc, before.kind, before.key, before.count, before.gold, before.xpSkill, before.xp],
    );
  }
  assert.deepEqual(runtime.quests.find((quest) => quest.id === "goblin_trouble").reward_items, [
    { item_id: "copper_bar", qty: 1 },
  ]);
  assert.deepEqual(runtime.quests.find((quest) => quest.id === "wolf_watch").reward_items, [
    { item_id: "bronze_sword", qty: 1 },
  ]);
  assert.equal(runtime.quests.filter((quest) => quest.reward_items.length).length, 2);
});

test("DESOLATUS uses the exact approved fixed-pool model with no item drop", () => {
  const boss = runtime.bosses[0];
  const approved = model.boss;
  assert.deepEqual(
    [boss.hp, boss.attack, boss.defense, boss.respawn_s, boss.reward_mode],
    [approved.hp, approved.attack, approved.defense, approved.respawnMinutes * 60, approved.rewardMode],
  );
  assert.deepEqual(
    [boss.target_contributors, boss.minimum_damage, boss.xp_pool, boss.xp_per_player_cap,
      boss.gold_pool_min, boss.gold_pool_max, boss.gold_per_player_cap_min, boss.gold_per_player_cap_max],
    [approved.rewardBudget.targetContributors, approved.rewardBudget.minimumDamage,
      approved.rewardBudget.xpPool, approved.rewardBudget.xpPerPlayerCap,
      approved.rewardBudget.goldPool[0], approved.rewardBudget.goldPool[1],
      approved.rewardBudget.goldPerPlayerCap[0], approved.rewardBudget.goldPerPlayerCap[1]],
  );
  assert.deepEqual(boss.rewards, []);
});

test("migration rules, starter loadout and player notice match locked decisions", () => {
  assert.deepEqual(sorted(runtime.migration_rules.map((rule) => rule.from_id)), sorted(registry.retired_ids));
  const club = runtime.migration_rules.find((rule) => rule.from_id === "wooden_club");
  assert.deepEqual(club, {
    from_id: "wooden_club",
    action: "replace_or_compensate",
    to_id: "copper_sword",
    captured_value_required: true,
    equipped_action: "replace_preserve_plus",
    unequipped_action: "compensate_captured_value",
    notice_key: "wooden_club_equipped_replace_unequipped_compensate",
  });
  for (const rule of runtime.migration_rules.filter((rule) => rule.from_id !== "wooden_club")) {
    assert.equal(rule.action, "compensate");
    assert.equal(rule.captured_value_required, true);
  }
  assert.deepEqual(runtime.starter_loadout, {
    weapon_item_id: "copper_sword", armor_item_id: "cloth_tunic", plus: 0,
  });
  const notice = runtime.player_notice.details.join(" ");
  assert.match(notice, /Frostguard Plate.*Starsteel.*level 110/);
  assert.match(notice, /Wyrmscale Plate.*Voidsteel.*level 120/);
});

test("all 32 padded sprite assets are canonical, hash-verified and archive-ordinal free", async () => {
  assert.equal(sprites.sprites.length, 32);
  assert.deepEqual(sorted(sprites.sprites.map((sprite) => sprite.kind)), sorted(registry.sprite_kinds));
  assert.doesNotMatch(JSON.stringify(sprites), /archiveOrdinal/i);
  for (const sprite of sprites.sprites) {
    const bytes = await readFile(`public/${sprite.asset_path}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sprite.padded_sha256, sprite.kind);
    const monster = byMonster.get(sprite.kind);
    assert.equal(monster.visual.padded_sha256, sprite.padded_sha256);
    assert.equal(monster.visual.asset_path, sprite.asset_path);
  }
});

test("fishing keeps five species while approved per-tier XP is explicit", () => {
  assert.equal(runtime.fish.length, 5);
  for (const checkpoint of [1, 100, 150]) {
    const sum = runtime.fish.reduce(
      (total, rule) => total + rule.weights.find((weight) => weight.level === checkpoint).weight,
      0,
    );
    assert.ok(Math.abs(sum - 1) < 1e-12);
  }
  assert.deepEqual(
    runtime.mechanics.fishing_xp_curve,
    model.tiers.map((tier) => ({
      tier_index: tier.tierIndex,
      level_requirement: tier.levelRequirement,
      xp_per_action: tier.skillRewards.fishing.xpPerAction,
    })),
  );
});

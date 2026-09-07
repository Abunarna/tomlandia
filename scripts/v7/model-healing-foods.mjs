/**
 * V7 healing-food planning model (deterministic).
 *
 * Derives the current healing-food contract directly from canonical V6
 * (content/v6/manifest.authoring.json), applies the owner's candidate heal
 * curve and provisional value rule, and runs seeded encounter + economy
 * simulations using the authoritative production formulas.
 *
 * Emits (all byte-deterministic):
 *   docs/overhaul/v7/healing-foods-current-and-proposed.json
 *   docs/overhaul/v7/healing-foods-balance-model.json
 *
 * Never mutates release content. This is a planning artifact only.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => JSON.parse(readFileSync(path.join(root, p), "utf8"));

export const CANONICAL_SOURCE = "content/v6/manifest.authoring.json";

/** Owner-supplied candidate heal curve, tier 1..16. */
export const CANDIDATE_HEAL = [
  15, 45, 120, 135, 155, 180, 210, 245, 300, 340, 375, 445, 485, 525, 605, 645,
];

/** Provisional. NOT frozen until the economy gate is owner-approved. */
export const CANDIDATE_VALUE_RULE = "round_up_to_5(max(current_value, ingredient_intrinsic_value * 1.25))";

const roundUp5 = (n) => Math.ceil(n / 5) * 5;

/* ------------------------------------------------------------------ */
/* Authoritative production formulas (verified against live functions) */
/* ------------------------------------------------------------------ */

export const FORMULAS = {
  max_hp: "30 + (combat_level - 1) * 6",
  incoming_damage: "max(0, floor(monster_attack * U[0.5,1.2) - player_defense * 0.5))",
  outgoing_damage: "max(1, floor(player_attack * U[0.6,1.2) - monster_defense * 0.4))",
  attack_stat: "round(3 + combat_level + weapon.attack + armour.attack)",
  defense_stat: "round(floor(combat_level / 2) + armour.defense)",
  swing_seconds: "max(0.5, 1 - armour.speed) - 0.15",
  effective_heal: "min(food.heal, max_hp - current_hp)",
  food_gate_seconds: 2,
  weapon_multiplier: "1 + 2% * min(plus,50) + 0.5% * max(plus-50,0)",
  light_attack_multiplier: "1 + 5% * min(plus,20) + 1% * max(plus-20,0)",
  defense_multiplier: "1 + 0.1% * plus",
};

const maxHp = (level) => 30 + (level - 1) * 6;
const weaponMult = (plus) => 1 + 0.02 * Math.min(plus, 50) + 0.005 * Math.max(plus - 50, 0);
const lightAtkMult = (plus) => 1 + 0.05 * Math.min(plus, 20) + 0.01 * Math.max(plus - 20, 0);
const defMult = (plus) => 1 + 0.001 * plus;

/** Deterministic PRNG (mulberry32) so every run reproduces byte-identically. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Canonical extraction                                                */
/* ------------------------------------------------------------------ */

export function loadCanonical() {
  const manifest = read(CANONICAL_SOURCE);
  const rt = manifest.runtime;
  const items = new Map(rt.items.map((i) => [i.id, i]));
  const byOutput = new Map(rt.recipes.map((r) => [r.output_item_id, r]));

  const foods = rt.items
    .filter((i) => i.family === "food")
    .sort((a, b) => a.tier_index - b.tier_index)
    .map((item) => {
      const recipe = byOutput.get(item.id);
      if (!recipe) throw new Error(`Food ${item.id} has no recipe`);
      return { item, recipe };
    });

  if (foods.length !== 16) throw new Error(`Expected 16 foods, found ${foods.length}`);

  return { manifest, rt, items, foods };
}

/** Earliest canonical acquisition route for an ingredient. */
export function acquisition(rt, id, seen = new Set()) {
  if (seen.has(id)) return { id, circular: true, routes: [] };
  seen.add(id);
  const routes = [];
  for (const f of rt.fish) if (f.item_id === id) routes.push({ kind: "fish", skill: "fishing", level: f.level_requirement });
  for (const n of rt.nodes) if (n.item_id === id) routes.push({ kind: "node", skill: n.skill, node: n.kind, level: n.level_requirement });
  for (const m of rt.monsters)
    for (const l of m.loot ?? [])
      if (l.item_id === id) routes.push({ kind: "drop", monster: m.kind, level: m.level_requirement, chance: l.chance });
  for (const r of rt.recipes)
    if (r.output_item_id === id)
      routes.push({
        kind: "recipe",
        recipe: r.id,
        skill: r.skill,
        level: r.level_requirement,
        inputs: r.inputs.map((i) => acquisition(rt, i.item_id, new Set(seen))),
      });
  const earliest = routes.length ? Math.min(...routes.map((r) => r.level)) : null;
  return { id, circular: false, earliest_level: earliest, routes };
}

/* ------------------------------------------------------------------ */
/* Current + proposed contract                                         */
/* ------------------------------------------------------------------ */

export function buildCurrentAndProposed() {
  const { rt, items, foods } = loadCanonical();

  const rows = foods.map(({ item, recipe }, index) => {
    const tier = item.tier_index;
    const intrinsic = recipe.inputs.reduce((sum, i) => sum + (items.get(i.item_id)?.value ?? 0) * i.qty, 0);
    const candidateValue = roundUp5(Math.max(item.value, intrinsic * 1.25));
    const level = item.level_requirement;
    return {
      tier_index: tier,
      level_requirement: level,
      id: item.id,
      name: item.name,
      icon_key: item.icon_key,
      colour: item.colour,
      rarity: item.rarity,
      kind: item.kind,
      family: item.family,
      stackable: item.stackable,
      tradable: item.tradable,
      active: item.active,
      current_heal: item.stats.heal,
      candidate_heal: CANDIDATE_HEAL[index],
      current_value: item.value,
      ingredient_intrinsic_value: intrinsic,
      candidate_value: candidateValue,
      candidate_value_frozen: false,
      recipe: {
        id: recipe.id,
        station: recipe.station,
        skill: recipe.skill,
        level_requirement: recipe.level_requirement,
        xp: recipe.xp,
        time_s: recipe.time_s,
        output_item_id: recipe.output_item_id,
        output_qty: recipe.output_qty,
        inputs: recipe.inputs.map((i) => ({ item_id: i.item_id, qty: i.qty })),
      },
      heal_pct_of_max_hp_at_level: Number(((CANDIDATE_HEAL[index] / maxHp(level)) * 100).toFixed(1)),
      current_heal_pct_of_max_hp_at_level: Number(((item.stats.heal / maxHp(level)) * 100).toFixed(1)),
    };
  });

  const ingredientIds = [...new Set(rows.flatMap((r) => r.recipe.inputs.map((i) => i.item_id)))].sort();
  const ingredients = ingredientIds.map((id) => {
    const info = acquisition(rt, id);
    const item = items.get(id);
    const usedBy = rows.filter((r) => r.recipe.inputs.some((i) => i.item_id === id));
    const gate = Math.min(...usedBy.map((r) => r.recipe.level_requirement));
    return {
      id,
      name: item?.name ?? null,
      defined: Boolean(item),
      active: Boolean(item?.active),
      value: item?.value ?? null,
      earliest_level: info.earliest_level,
      obtainable: info.routes.length > 0,
      circular: info.circular,
      available_at_or_below_recipe_gate: info.earliest_level !== null && info.earliest_level <= gate,
      earliest_recipe_gate_using_it: gate,
      routes: info.routes,
    };
  });

  return {
    schema: "tomlandia.v7.healing-foods.current-and-proposed/1",
    derived_from: CANONICAL_SOURCE,
    canonical_content_version: "v6",
    candidate_heal_curve: CANDIDATE_HEAL,
    candidate_value_rule: CANDIDATE_VALUE_RULE,
    candidate_value_status: "provisional-pending-owner-decision",
    stable_fields:
      "id, name, recipe id, output id, inputs, quantities, cooking requirement, xp, time_s, output_qty, stackable, tradable, icon, colour, rarity, tier",
    foods: rows,
    ingredients,
  };
}

/* ------------------------------------------------------------------ */
/* Encounter model                                                     */
/* ------------------------------------------------------------------ */

const BANDS = 16;

function gearFor(rt, tier) {
  const pick = (family) => rt.items.find((i) => i.family === family && i.tier_index === tier);
  return {
    weapon: pick("weapon"),
    heavy: pick("heavy_armor"),
    light: pick("light_armor"),
  };
}

function monstersFor(rt, tierLevels, tier) {
  const low = tierLevels[tier - 1];
  const high = tier < BANDS ? tierLevels[tier] : 1e9;
  const band = rt.monsters.filter((m) => m.level_requirement >= low && m.level_requirement < high);
  const sameTier = band.length ? band[Math.floor(band.length / 2)] : rt.monsters[rt.monsters.length - 1];
  const worst = band.length
    ? band.reduce((a, b) => (b.attack > a.attack ? b : a))
    : rt.monsters[rt.monsters.length - 1];
  const adjacentLow = tier < BANDS ? tierLevels[tier] : tierLevels[tier - 1];
  const adjacent =
    rt.monsters.filter((m) => m.level_requirement >= adjacentLow).sort((a, b) => a.level_requirement - b.level_requirement)[0] ??
    worst;
  return { same_tier: sameTier, adjacent_tier: adjacent, worst_in_band: worst };
}

/** One deterministic encounter sequence; returns aggregate metrics. */
function simulate({ level, weapon, armour, plus, threshold, target, heal, kills, seed, foodCooldownS }) {
  const rand = rng(seed);
  const hpMax = maxHp(level);
  const armourAtkMult = armour.family === "light_armor" ? lightAtkMult(plus) : 1;
  const atk = Math.round(
    3 + level + weapon.stats.attack * weaponMult(plus) + armour.stats.attack * armourAtkMult,
  );
  const def = Math.round(Math.floor(level / 2) + armour.stats.defense * defMult(plus));
  const swing = Math.max(0.5, 1 - armour.stats.speed) - 0.15;

  let hp = hpMax;
  let time = 0;
  let lastFood = -Infinity;
  let foodUsed = 0;
  let nominal = 0;
  let effective = 0;
  let deaths = 0;
  let downtime = 0;
  let swings = 0;
  let killsDone = 0;

  while (killsDone < kills) {
    let mobHp = target.hp;
    while (mobHp > 0) {
      swings += 1;
      time += swing;
      mobHp -= Math.max(1, Math.floor(atk * (0.6 + rand() * 0.6) - target.defense * 0.4));
      const taken = Math.max(0, Math.floor(target.attack * (0.5 + rand() * 0.7) - def * 0.5));
      hp = Math.max(0, hp - taken);
      // Authoritative ordering: damage -> auto-eat -> death resolution.
      if (hp < hpMax && hp / hpMax <= threshold && time - lastFood >= foodCooldownS) {
        const gain = Math.min(heal, hpMax - hp);
        hp += gain;
        nominal += heal;
        effective += gain;
        foodUsed += 1;
        lastFood = time;
      }
      if (hp <= 0) {
        deaths += 1;
        hp = Math.ceil(hpMax / 2);
        downtime += 25; // corpse run back to the band from the rescue point
        time += 25;
      }
    }
    killsDone += 1;
  }

  const minutes = time / 60;
  return {
    swings,
    kills: killsDone,
    time_s: Number(time.toFixed(1)),
    time_to_kill_s: Number((time / killsDone).toFixed(2)),
    nominal_healing: nominal,
    effective_healing: effective,
    overheal: nominal - effective,
    overheal_pct: nominal ? Number((((nominal - effective) / nominal) * 100).toFixed(1)) : 0,
    food_used: foodUsed,
    food_per_kill: Number((foodUsed / killsDone).toFixed(3)),
    food_per_minute: Number((foodUsed / Math.max(minutes, 1e-9)).toFixed(2)),
    inventory_duration_min_28: Number((28 / Math.max(foodUsed / Math.max(minutes, 1e-9), 1e-9)).toFixed(1)),
    deaths,
    death_probability_per_kill: Number((deaths / killsDone).toFixed(4)),
    downtime_s: downtime,
    xp_per_hour: Math.round((target.xp * killsDone) / Math.max(minutes / 60, 1e-9)),
    gold_per_hour: Math.round(
      (((target.gold_min + target.gold_max) / 2) * killsDone) / Math.max(minutes / 60, 1e-9),
    ),
  };
}

export function buildBalanceModel() {
  const { rt } = loadCanonical();
  const contract = buildCurrentAndProposed();
  const manifest = read(CANONICAL_SOURCE);
  const tierLevels = manifest.tiers.sort((a, b) => a.tier_index - b.tier_index).map((t) => t.level_requirement);
  const bosses = rt.bosses.concat(
    rt.monsters
      .filter((m) => m.kind === "ascendant_wyrm")
      .map((m) => ({ id: m.kind, name: m.name, hp: m.hp, attack: m.attack, defense: m.defense, xp: m.xp, gold_min: m.gold_min, gold_max: m.gold_max })),
  );

  const cases = [];
  let seed = 0x7c0de;
  for (const food of contract.foods) {
    const tier = food.tier_index;
    const level = food.level_requirement;
    const gear = gearFor(rt, tier);
    const targets = monstersFor(rt, tierLevels, tier);
    const bossTargets = {
      ascendant_wyrm: rt.monsters.find((m) => m.kind === "ascendant_wyrm"),
      desolatus: rt.bosses.find((b) => b.id === "desolatus"),
    };
    for (const armourKey of ["heavy", "light"]) {
      const armour = gear[armourKey];
      for (const plus of [0, 20, 50, 100]) {
        for (const threshold of [0.25, 0.5, 0.75]) {
          for (const [targetKey, target] of Object.entries({ ...targets, ...bossTargets })) {
            if (!target) continue;
            // Boss targets are endgame content: only model them where the
            // player band is within 10 levels of the boss requirement.
            const bossLevel = targetKey === "desolatus" ? 150 : targetKey === "ascendant_wyrm" ? 150 : null;
            if (bossLevel !== null && level < bossLevel - 10) continue;
            const isBoss = targetKey === "desolatus";
            const kills = isBoss ? 1 : 8;
            // Paired seeding: current and candidate healing share one seed so
            // the comparison isolates the heal change, not PRNG noise.
            seed += 1;
            const caseSeed = seed;
            for (const [healKey, heal] of [
              ["current", food.current_heal],
              ["candidate", food.candidate_heal],
            ]) {
              cases.push({
                tier_index: tier,
                food_id: food.id,
                level,
                armour: armourKey,
                plus,
                auto_eat_threshold: threshold,
                target: targetKey,
                target_kind: target.kind ?? target.id,
                healing_variant: healKey,
                heal,
                heal_pct_of_max_hp: Number(((heal / maxHp(level)) * 100).toFixed(1)),
                result: simulate({
                  level,
                  weapon: gear.weapon,
                  armour,
                  plus,
                  threshold,
                  target,
                  heal,
                  kills,
                  seed: caseSeed,
                  foodCooldownS: 2,
                }),
              });
            }
          }
        }
      }
    }
  }

  // Sensitivity: +/-5% max HP and 1.5 / 2.0 / 2.5s food cooldown, one
  // representative configuration per tier (heavy, +0, 50% threshold, same tier).
  const sensitivity = [];
  for (const food of contract.foods) {
    const gear = gearFor(rt, food.tier_index);
    const target = monstersFor(rt, tierLevels, food.tier_index).same_tier;
    for (const hpScale of [0.95, 1.0, 1.05]) {
      for (const cooldown of [1.5, 2.0, 2.5]) {
        seed += 1;
        const level = food.level_requirement;
        const scaledLevel = Math.max(1, Math.round((maxHp(level) * hpScale - 30) / 6) + 1);
        sensitivity.push({
          food_id: food.id,
          max_hp_scale: hpScale,
          food_cooldown_s: cooldown,
          candidate: simulate({
            level: scaledLevel,
            weapon: gear.weapon,
            armour: gear.heavy,
            plus: 0,
            threshold: 0.5,
            target,
            heal: food.candidate_heal,
            kills: 8,
            seed,
            foodCooldownS: cooldown,
          }),
        });
      }
    }
  }

  // Economy: vendor / market loop per food.
  const feePct = rt.mechanics.market_fee_pct;
  const economy = contract.foods.map((food) => {
    const ingredientMinutes = food.recipe.inputs.reduce((sum, input) => {
      const ing = contract.ingredients.find((i) => i.id === input.item_id);
      const route = ing?.routes?.[0];
      // Deterministic acquisition-time proxy: gather/fish ~4s, drops scaled by chance ~8s.
      const per = route?.kind === "drop" ? 8 / Math.max(route.chance ?? 1, 0.05) : route?.kind === "recipe" ? 10 : 4;
      return sum + (per * input.qty) / 60;
    }, 0);
    const netMarket = (value) => Math.floor(value * (1 - feePct / 100));
    return {
      food_id: food.id,
      tier_index: food.tier_index,
      current_value: food.current_value,
      candidate_value: food.candidate_value,
      ingredient_intrinsic_value: food.ingredient_intrinsic_value,
      value_over_intrinsic_current: Number((food.current_value / Math.max(food.ingredient_intrinsic_value, 1)).toFixed(2)),
      value_over_intrinsic_candidate: Number((food.candidate_value / Math.max(food.ingredient_intrinsic_value, 1)).toFixed(2)),
      market_net_current: netMarket(food.current_value),
      market_net_candidate: netMarket(food.candidate_value),
      ingredient_minutes_per_food: Number(ingredientMinutes.toFixed(2)),
      healing_per_gold_current: Number((food.current_heal / Math.max(food.current_value, 1)).toFixed(3)),
      healing_per_gold_candidate: Number((food.candidate_heal / Math.max(food.candidate_value, 1)).toFixed(3)),
      cooking_xp: food.recipe.xp,
      cooking_time_s: food.recipe.time_s,
    };
  });

  return {
    schema: "tomlandia.v7.healing-foods.balance-model/1",
    derived_from: CANONICAL_SOURCE,
    formulas: FORMULAS,
    deterministic: true,
    prng: "mulberry32, fixed seed sequence",
    telemetry: {
      food_consumption: "unavailable - no consumption telemetry table exists in production",
      deaths: "unavailable - no death telemetry table exists in production",
      crafting: "unavailable - no crafting telemetry table exists in production",
      market: "insufficient - production market history holds 15 trades and 0 food trades",
    },
    case_count: cases.length,
    cases,
    sensitivity,
    economy,
  };
}

/* ------------------------------------------------------------------ */

const stable = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function writeArtifacts({ check = false } = {}) {
  const outputs = {
    "docs/overhaul/v7/healing-foods-current-and-proposed.json": stable(buildCurrentAndProposed()),
    "docs/overhaul/v7/healing-foods-balance-model.json": stable(buildBalanceModel()),
  };
  const drift = [];
  for (const [rel, content] of Object.entries(outputs)) {
    const dest = path.join(root, rel);
    if (check) {
      let actual = null;
      try {
        actual = readFileSync(dest, "utf8");
      } catch {
        actual = null;
      }
      if (actual !== content) drift.push(rel);
    } else {
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, content, "utf8");
    }
  }
  return { outputs: Object.keys(outputs), drift };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  const { outputs, drift } = writeArtifacts({ check });
  if (drift.length) {
    console.error(`V7 planning artifact drift:\n- ${drift.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`${check ? "Verified" : "Generated"} ${outputs.length} V7 planning artifacts`);
}

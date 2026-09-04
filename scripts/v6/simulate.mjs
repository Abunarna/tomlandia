/**
 * Deterministic V6 combat and economy model.
 *
 * The damage roll is uniform on [0.6, 1.2). Instead of sampling it randomly we
 * integrate it on a fixed 4000-point grid, so every number in the emitted
 * artifacts is reproducible byte-for-byte.
 *
 *   base_attack    = round(3 + combat_level + weapon_attack + armour_attack)
 *   strength_bonus = round(base_attack * strength_pct / 100)
 *   damage         = max(1, floor(buffed_attack * U[0.6,1.2) - defense * 0.4))
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

import { prettyCanonicalJson } from "../content/model.mjs";
import { BASE_ATTACK_INTERVAL_S, MAX_SAME_TIER_UPLIFT_PCT, POTIONS } from "./model.mjs";

const checkOnly = process.argv.includes("--check");
const OUT = Object.freeze({
  combat: "docs/overhaul/v6/combat-simulation.json",
  economy: "docs/overhaul/v6/economy-simulation.json",
});

const manifest = JSON.parse(await readFile("content/v6/manifest.authoring.json", "utf8"));
const runtime = manifest.runtime;
const items = new Map(runtime.items.map((item) => [item.id, item]));
const strengthByTier = new Map(runtime.mechanics.strength_potions.map((row) => [row.tier_index, row]));

const GRID = 4000;
const PLUS_LEVELS = [0, 20, 50, 100];
const BOSS_DEFENSE = 85; // DESOLATUS, hard-coded in attack_boss_v1
const round = (value) => Math.round(value);
const r2 = (value) => Math.round(value * 100) / 100;
const r3 = (value) => Math.round(value * 1000) / 1000;

const weaponMultiplier = (plus) => 1 + 0.02 * Math.min(plus, 50) + 0.005 * Math.max(plus - 50, 0);
const lightAttackMultiplier = (plus) => 1 + 0.05 * Math.min(plus, 20) + 0.01 * Math.max(plus - 20, 0);
const defenseMultiplier = (plus) => 1 + 0.001 * plus;

/** Mean of max(1, floor(attack * u - defense * 0.4)) over u ~ U[0.6, 1.2). */
function meanDamage(attack, defense) {
  let total = 0;
  for (let index = 0; index < GRID; index += 1) {
    const u = 0.6 + (0.6 * (index + 0.5)) / GRID;
    total += Math.max(1, Math.floor(attack * u - defense * 0.4));
  }
  return total / GRID;
}

const tiers = manifest.tiers.map((tier) => tier.tier_index).sort((l, r) => l - r);
const weaponByTier = new Map(
  runtime.items.filter((item) => item.kind === "weapon").map((item) => [item.tier_index, item]),
);
const armourByTier = new Map();
for (const item of runtime.items.filter((entry) => entry.kind === "armor")) {
  const row = armourByTier.get(item.tier_index) ?? {};
  row[item.family === "heavy_armor" ? "heavy" : "light"] = item;
  armourByTier.set(item.tier_index, row);
}
const monstersByTier = new Map();
for (const monster of runtime.monsters) {
  if (!monstersByTier.has(monster.tier_index)) monstersByTier.set(monster.tier_index, []);
  monstersByTier.get(monster.tier_index).push(monster);
}
const tierLevel = new Map(manifest.tiers.map((tier) => [tier.tier_index, tier.level_requirement]));
const ascendant = runtime.monsters.find((monster) => monster.kind === "ascendant_wyrm");

const combatRows = [];
const violations = [];

for (const tier of tiers) {
  const potion = POTIONS.find((entry) => entry.tier === tier);
  const strength = strengthByTier.get(tier);
  const weapon = weaponByTier.get(tier);
  const armour = armourByTier.get(tier);
  const combatLevel = tierLevel.get(tier);
  const sameTier = [...(monstersByTier.get(tier) ?? [])].sort((l, r) => l.kind.localeCompare(r.kind));
  const adjacent = [...(monstersByTier.get(Math.min(tier + 1, 16)) ?? [])].sort((l, r) =>
    l.kind.localeCompare(r.kind),
  );
  const pool = [...sameTier, ...adjacent];
  if (!pool.length || !weapon || !armour?.heavy || !armour?.light) continue;

  const lowDefense = pool.reduce((best, m) => (m.defense < best.defense ? m : best), pool[0]);
  const highDefense = pool.reduce((best, m) => (m.defense > best.defense ? m : best), pool[0]);
  const sameTierTarget = sameTier.reduce(
    (best, m) => (Math.abs(m.defense - lowDefense.defense) >= 0 && m.hp > best.hp ? m : best),
    sameTier[0],
  );
  const adjacentTarget = adjacent[0];

  for (const style of ["heavy", "light"]) {
    const set = armour[style];
    const swingSeconds = Math.max(0.5, 1 - (set.stats.speed ?? 0)) - 0.15;
    for (const plus of PLUS_LEVELS) {
      const weaponAttack = weapon.stats.attack * weaponMultiplier(plus);
      const armourAttack = (set.stats.attack ?? 0) * lightAttackMultiplier(plus);
      const armourDefense = (set.stats.defense ?? 0) * defenseMultiplier(plus);
      const baseAttack = round(3 + combatLevel + weaponAttack + armourAttack);
      const bonus = round((baseAttack * strength.strength_pct) / 100);
      const buffedAttack = baseAttack + bonus;
      const defenseStat = round(Math.floor(combatLevel / 2) + armourDefense);

      const targets = [
        ["low_defense", lowDefense],
        ["same_tier", sameTierTarget],
        ["adjacent_tier", adjacentTarget],
        ["high_defense", highDefense],
        ["ascendant_wyrm", ascendant],
        ["desolatus_boss", { kind: "desolatus", defense: BOSS_DEFENSE, hp: 250000, attack: 340, xp: 0, gold_min: 0, gold_max: 0 }],
      ].filter(([, target]) => Boolean(target));

      for (const [label, target] of targets) {
        const before = meanDamage(baseAttack, target.defense);
        const after = meanDamage(buffedAttack, target.defense);
        const uplift = ((after - before) / before) * 100;
        const dpmBefore = (before * 60) / swingSeconds;
        const dpmAfter = (after * 60) / swingSeconds;
        const hitsBefore = Math.ceil(target.hp / before);
        const hitsAfter = Math.ceil(target.hp / after);
        const incoming = Math.max(0, Math.floor(target.attack * 0.85 - defenseStat * 0.5));
        const kills = 3600 / (hitsAfter * swingSeconds);
        const boostedSeconds = strength.boost_hits * swingSeconds;

        const row = {
          tier,
          potion_id: potion.id,
          strength_pct: strength.strength_pct,
          boost_hits: strength.boost_hits,
          armour: style,
          plus,
          target: label,
          target_kind: target.kind,
          target_defense: target.defense,
          base_attack: baseAttack,
          strength_bonus: bonus,
          buffed_attack: buffedAttack,
          player_defense: defenseStat,
          mean_damage_unbuffed: r3(before),
          mean_damage_buffed: r3(after),
          post_defense_uplift_pct: r2(uplift),
          swing_seconds: r2(swingSeconds),
          damage_per_minute_unbuffed: r2(dpmBefore),
          damage_per_minute_buffed: r2(dpmAfter),
          hits_to_kill_unbuffed: hitsBefore,
          hits_to_kill_buffed: hitsAfter,
          time_to_kill_s_unbuffed: r2(hitsBefore * swingSeconds),
          time_to_kill_s_buffed: r2(hitsAfter * swingSeconds),
          incoming_damage_per_hit: incoming,
          potion_wall_clock_s: r2(boostedSeconds),
          kills_per_hour_buffed: r2(kills),
          xp_per_hour_buffed: r2(kills * (target.xp ?? 0)),
          gold_per_hour_buffed: r2((kills * ((target.gold_min ?? 0) + (target.gold_max ?? 0))) / 2),
          potions_per_hour: r2(3600 / Math.max(boostedSeconds, 1)),
          one_hit_kill: hitsAfter === 1 && hitsBefore > 1,
        };
        combatRows.push(row);

        if (label === "same_tier" && uplift > MAX_SAME_TIER_UPLIFT_PCT) {
          violations.push(
            `tier ${tier} ${style} +${plus} same-tier uplift ${r2(uplift)}% exceeds ${MAX_SAME_TIER_UPLIFT_PCT}%`,
          );
        }
        if (row.one_hit_kill && label !== "low_defense") {
          violations.push(`tier ${tier} ${style} +${plus} vs ${label} introduces a one-hit kill`);
        }
      }
    }
  }
}

// ---- sensitivity -----------------------------------------------------------
const sensitivity = [];
for (const delta of [-2, 2]) {
  for (const tier of tiers) {
    const strength = strengthByTier.get(tier);
    const rows = combatRows.filter(
      (row) => row.tier === tier && row.target === "same_tier" && row.armour === "heavy",
    );
    for (const row of rows) {
      const shifted = row.base_attack + round((row.base_attack * (strength.strength_pct + delta)) / 100);
      const before = meanDamage(row.base_attack, row.target_defense);
      const after = meanDamage(shifted, row.target_defense);
      sensitivity.push({
        tier,
        plus: row.plus,
        strength_pct_delta: delta,
        strength_pct: strength.strength_pct + delta,
        post_defense_uplift_pct: r2(((after - before) / before) * 100),
      });
    }
  }
}
for (const delta of [-5, 5]) {
  for (const tier of tiers) {
    const strength = strengthByTier.get(tier);
    const hits = strength.boost_hits + delta;
    sensitivity.push({
      tier,
      boosted_hits_delta: delta,
      boost_hits: hits,
      heavy_wall_clock_s: r2(hits * 0.85),
      note: "hit-based duration: Heavy and Light receive the same number of boosted attacks",
    });
  }
}

const sameTierUplifts = combatRows
  .filter((row) => row.target === "same_tier")
  .map((row) => row.post_defense_uplift_pct);

const combat = {
  model: {
    grid_points: GRID,
    damage_roll: "uniform [0.6, 1.2)",
    base_attack_interval_s: BASE_ATTACK_INTERVAL_S,
    formula:
      "base_attack = round(3 + combat_level + weapon_attack*weapon_mult + armour_attack*light_mult); " +
      "strength_bonus = round(base_attack * strength_pct / 100); " +
      "damage = max(1, floor((base_attack + strength_bonus) * U[0.6,1.2) - defense * 0.4))",
    estimates: [
      "combat_level is modelled as the tier level requirement",
      "kills/hour, XP/hour and gold/hour assume uninterrupted combat with no travel or downtime",
      "incoming damage uses the monster's mean roll (0.85) against the player's defence",
      "no production combat telemetry was supplied; every rate is a model estimate",
    ],
  },
  approved_threshold_pct: MAX_SAME_TIER_UPLIFT_PCT,
  same_tier_uplift_pct: {
    min: Math.min(...sameTierUplifts),
    max: Math.max(...sameTierUplifts),
  },
  violations,
  sensitivity,
  rows: combatRows,
};

// ---- economy ---------------------------------------------------------------
const economyRows = runtime.recipes
  .filter((recipe) => POTIONS.some((potion) => potion.id === recipe.output_item_id))
  .map((recipe) => {
    const potion = POTIONS.find((entry) => entry.id === recipe.output_item_id);
    const output = items.get(recipe.output_item_id);
    const inputCost = recipe.inputs.reduce(
      (total, input) => total + (items.get(input.item_id)?.value ?? 0) * input.qty,
      0,
    );
    const strength = strengthByTier.get(potion.tier);
    const perHour = 3600 / recipe.time_s;
    const sameTier = combatRows.find(
      (row) => row.tier === potion.tier && row.target === "same_tier" && row.armour === "heavy" && row.plus === 0,
    );
    const killsPerPotion = sameTier ? strength.boost_hits / sameTier.hits_to_kill_buffed : null;
    return {
      tier: potion.tier,
      recipe_id: recipe.id,
      potion_id: potion.id,
      strength_pct: potion.strength_pct,
      boost_hits: strength.boost_hits,
      ingredient_intrinsic_cost: inputCost,
      output_intrinsic_value: output.value,
      output_input_multiple: inputCost > 0 ? r3(output.value / inputCost) : null,
      craft_time_s: recipe.time_s,
      crafts_per_hour: r2(perHour),
      alchemy_xp: recipe.xp,
      alchemy_xp_per_hour: r2(perHour * recipe.xp),
      value_per_hour: r2(perHour * output.value),
      ingredient_hours_per_potion: r3(recipe.time_s / 3600),
      kills_per_potion: killsPerPotion === null ? null : r2(killsPerPotion),
      potion_cost_per_kill: killsPerPotion ? r2(output.value / killsPerPotion) : null,
      expected_dpm_gain: sameTier
        ? r2(sameTier.damage_per_minute_buffed - sameTier.damage_per_minute_unbuffed)
        : null,
      market_median_price: null,
      market_volume: null,
    };
  })
  .sort((left, right) => left.tier - right.tier);

const economy = {
  unavailable_production_telemetry: [
    "potion consumption telemetry",
    "potion market median price and traded volume",
    "observed ingredient market prices",
    "observed kill rates per player per tier",
  ],
  notes: [
    "intrinsic item value is an NPC sale and market floor reference, not a guaranteed output/input multiple",
    "ingredient opportunity cost is modelled as intrinsic value; no production price feed was supplied",
    "kills_per_potion assumes Heavy armour at +0 against the same-tier target",
    "V6 changes no potion value, no boost_hits, no recipe and no craft duration",
  ],
  rows: economyRows,
};

const outputs = [
  [OUT.combat, prettyCanonicalJson(combat)],
  [OUT.economy, prettyCanonicalJson(economy)],
];
for (const [file, rendered] of outputs) {
  if (checkOnly) {
    const existing = await readFile(file, "utf8").catch(() => "");
    if (existing !== rendered) throw new Error(`V6 simulation drifted: ${file}; run bun run v6:build`);
  } else {
    await mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
    await writeFile(file, rendered);
  }
}

if (violations.length) {
  throw new Error(`V6 combat model rejected the curve:\n  ${violations.join("\n  ")}`);
}

console.log(
  `${checkOnly ? "Verified" : "Wrote"} V6 simulations: ${combatRows.length} combat cases, ` +
    `${economyRows.length} economy rows; same-tier uplift ` +
    `${combat.same_tier_uplift_pct.min}%..${combat.same_tier_uplift_pct.max}% (threshold ${MAX_SAME_TIER_UPLIFT_PCT}%)`,
);

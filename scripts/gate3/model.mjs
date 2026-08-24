import { createHash } from "node:crypto";

export const MODEL_VERSION = "tomlandia-v2-gate3-proposal-1";

export const APPROVAL = Object.freeze({
  status: "proposed_owner_approval_required",
  activationAllowed: false,
  approvedBy: null,
  approvedAt: null,
  gate4Blocked: true,
});

// Approval is intentionally a separate record from the immutable proposal.
// That lets the approved numeric hash remain unchanged and makes any future
// numeric regeneration visibly require a fresh approval record.
export const OWNER_APPROVAL_RECORD = Object.freeze({
  recordVersion: "tomlandia-v2-gate3-approval-1",
  status: "owner_approved",
  approvedModelHash: "e1fbe19aac61014b38885ce38cd16d9a12e3852f24858301a2588c65fba4a640",
  approvedBy: "project_owner",
  approvedOn: "2026-08-24",
  evidence: "The project owner explicitly replied ‘approved’ to the finished Gate 3 numeric-table approval requirement in the project conversation.",
  gate4ImplementationAllowed: true,
  runtimeActivationAllowed: false,
  productionDatabaseWritesAllowed: false,
  mergeToMainAllowed: false,
  publishingAllowed: false,
  lovableAgentCreditSpendingAllowed: false,
});

export const TIERS = Object.freeze([
  [1, 1, "Copper"],
  [2, 10, "Bronze"],
  [3, 20, "Iron"],
  [4, 30, "Steel"],
  [5, 40, "Mithril"],
  [6, 50, "Sunsteel"],
  [7, 60, "Runite"],
  [8, 70, "Shadowsteel"],
  [9, 80, "Froststeel"],
  [10, 90, "Wyrmsteel"],
  [11, 100, "Glacial"],
  [12, 110, "Starsteel"],
  [13, 120, "Voidsteel"],
  [14, 130, "Wyrmforged"],
  [15, 140, "Ancient"],
  [16, 150, "Ascendant"],
]);

// Proposed active-play targets. These are deliberately data, not prose, so the
// owner can approve or replace exact numbers before any dependent content work.
export const TIME_TARGETS = Object.freeze([
  [1, 0],
  [10, 0.5],
  [20, 1.5],
  [30, 3],
  [40, 5.5],
  [50, 9.5],
  [60, 14.5],
  [70, 21.5],
  [80, 31.5],
  [90, 44.5],
  [100, 60.5],
  [110, 80.5],
  [120, 104.5],
  [130, 132.5],
  [140, 164.5],
  [150, 200.5],
]);

// Existing regular-monster anchors. These values are read-only evidence from
// src/game/data.ts. Existing monsters are never rewritten by Gate 3.
const MONSTER_ANCHORS = Object.freeze([
  { level: 1, hp: 22, attack: 5, defense: 2, xp: 34, goldMin: 4, goldMax: 12, source: "goblin" },
  { level: 2, hp: 36, attack: 7, defense: 3, xp: 57, goldMin: 6, goldMax: 17, source: "forest_boar" },
  { level: 3, hp: 60, attack: 11, defense: 5, xp: 95, goldMin: 10, goldMax: 24, source: "wolf" },
  { level: 5, hp: 88, attack: 15, defense: 7, xp: 141, goldMin: 15, goldMax: 34, source: "forest_lynx" },
  { level: 7, hp: 130, attack: 20, defense: 10, xp: 210, goldMin: 22, goldMax: 48, source: "bear" },
  { level: 10, hp: 184, attack: 26, defense: 13, xp: 300, goldMin: 31, goldMax: 68, source: "dust_jackal" },
  { level: 14, hp: 260, attack: 34, defense: 18, xp: 430, goldMin: 45, goldMax: 95, source: "serpent" },
  { level: 15, hp: 288, attack: 38, defense: 20, xp: 473, goldMin: 56, goldMax: 123, source: "scorpion_stalker" },
  { level: 17, hp: 320, attack: 42, defense: 22, xp: 520, goldMin: 70, goldMax: 160, source: "bandit" },
  { level: 23, hp: 445, attack: 53, defense: 27, xp: 714, goldMin: 92, goldMax: 200, source: "withered_ghoul" },
  { level: 32, hp: 620, attack: 68, defense: 34, xp: 980, goldMin: 120, goldMax: 250, source: "wraith" },
  { level: 36, hp: 713, attack: 76, defense: 38, xp: 1129, goldMin: 139, goldMax: 283, source: "bone_reaper" },
  { level: 41, hp: 820, attack: 84, defense: 42, xp: 1300, goldMin: 160, goldMax: 320, source: "shadow_beast" },
  { level: 55, hp: 1109, attack: 105, defense: 51, xp: 1766, goldMin: 212, goldMax: 408, source: "frost_wolf" },
  { level: 73, hp: 1500, attack: 130, defense: 62, xp: 2400, goldMin: 280, goldMax: 520, source: "yeti" },
  { level: 88, hp: 1817, attack: 146, defense: 70, xp: 2857, goldMin: 335, goldMax: 637, source: "ice_wraith" },
  { level: 105, hp: 2200, attack: 165, defense: 80, xp: 3400, goldMin: 400, goldMax: 780, source: "frost_giant" },
  { level: 146, hp: 3080, attack: 210, defense: 95, xp: 4760, goldMin: 560, goldMax: 1092, source: "ancient_frost_wyrm" },
]);

const NEW_MONSTERS = Object.freeze({
  10: "goblin_brute",
  20: "ironback_boar",
  30: "mithril_stalker",
  50: "desert_raider",
  60: "dune_devourer",
  70: "cursed_knight",
  80: "frost_troll",
  90: "frost_revenant",
  110: "glacial_guardian",
  120: "wyrm_knight",
  130: "void_wraith",
  150: "ascendant_wyrm",
});

const LIVE_FLOORS = Object.freeze({
  weaponAttack: { 1: 6, 30: 9, 40: 16, 60: 26 },
  heavyDefense: { 30: 9, 50: 16, 80: 27, 110: 38, 120: 50 },
  lightDefense: { 1: 2, 10: 4, 20: 6, 70: 21 },
  lightAttack: { 1: 1, 10: 1, 20: 2, 70: 7 },
  foodHeal: { 1: 14, 10: 45, 20: 120, 80: 300, 100: 650 },
  potionBoost: { 1: 2, 20: 5, 40: 10, 70: 18, 100: 30 },
  potionHits: { 1: 5, 20: 8, 40: 10, 70: 12, 100: 15 },
  weaponValue: { 1: 70, 30: 150, 40: 380, 60: 900 },
  armorValue: { 1: 18, 10: 45, 20: 90, 30: 170, 50: 420, 70: 640, 80: 980, 110: 1600, 120: 2200 },
  foodValue: { 1: 12, 10: 34, 20: 90, 80: 180, 100: 700 },
  potionValue: { 1: 35, 20: 90, 40: 220, 70: 480, 100: 900 },
  rawValue: { 1: 6, 20: 16, 30: 20, 40: 40, 60: 110, 70: 70, 100: 100 },
});

function activityCadence(level) {
  const cadence = {
    mining: { actionSeconds: 3.2 + level * 0.028, overheadSeconds: 2.4 },
    woodcutting: { actionSeconds: 3 + level * 0.026, overheadSeconds: 2.4 },
    gathering: { actionSeconds: 2.4 + level * 0.022, overheadSeconds: 2.4 },
    fishing: { actionSeconds: 3.5, overheadSeconds: 2 },
    smithing: { actionSeconds: 1.6 + level * 0.018, overheadSeconds: 8 },
    skinning: { actionSeconds: 1.6 + level * 0.012, overheadSeconds: 6 },
    tailoring: { actionSeconds: 1.6 + level * 0.014, overheadSeconds: 7 },
    cooking: { actionSeconds: 1.6 + level * 0.014, overheadSeconds: 7 },
    alchemy: { actionSeconds: 1.8 + level * 0.014, overheadSeconds: 7 },
  };
  return Object.fromEntries(Object.entries(cadence).map(([skill, row]) => [skill, {
    actionSeconds: round(row.actionSeconds, 2),
    overheadSeconds: row.overheadSeconds,
    effectiveCycleSeconds: round(row.actionSeconds + row.overheadSeconds, 2),
  }]));
}

const round = (value, digits = 0) => {
  const power = 10 ** digits;
  return Math.round((value + Number.EPSILON) * power) / power;
};

const roundStep = (value, step) => Math.max(step, Math.round(value / step) * step);

const maxHp = (level) => 30 + (level - 1) * 6;
const weaponPlusMultiplier = (plus) => 1 + Math.min(plus, 50) * 0.02 + Math.max(0, plus - 50) * 0.005;
const armorAttackPlusMultiplier = (plus) => 1 + Math.min(plus, 20) * 0.05 + Math.max(0, plus - 20) * 0.01;
const defensePlusMultiplier = (plus) => 1 + plus * 0.001;
const weaponStatWithPlus = (base, plus) => round(base * weaponPlusMultiplier(plus), 1);
const armorAttackStatWithPlus = (base, plus) => round(base * armorAttackPlusMultiplier(plus), 1);
const defenseStatWithPlus = (base, plus) => round(base * defensePlusMultiplier(plus), 1);

export function legacyXpForLevel(level) {
  return Math.floor(100 * 1.15 ** level);
}

function segmentForLevel(level) {
  for (let index = 0; index < TIME_TARGETS.length - 1; index += 1) {
    const [startLevel, startHours] = TIME_TARGETS[index];
    const [endLevel, endHours] = TIME_TARGETS[index + 1];
    if (level >= startLevel && level < endLevel) {
      return { startLevel, startHours, endLevel, endHours };
    }
  }
  const [startLevel, startHours] = TIME_TARGETS.at(-2);
  const [endLevel, endHours] = TIME_TARGETS.at(-1);
  return { startLevel, startHours, endLevel, endHours };
}

export function targetHoursAtLevel(level) {
  const segment = segmentForLevel(Math.min(150, Math.max(1, level)));
  const fraction = (level - segment.startLevel) / (segment.endLevel - segment.startLevel);
  return round(segment.startHours + fraction * (segment.endHours - segment.startHours), 6);
}

export function targetMinutesPerLevel(level) {
  const segment = segmentForLevel(Math.min(149, Math.max(1, level)));
  return round(((segment.endHours - segment.startHours) * 60) / (segment.endLevel - segment.startLevel), 3);
}

function interpolationPair(level) {
  if (level <= MONSTER_ANCHORS[0].level) return [MONSTER_ANCHORS[0], MONSTER_ANCHORS[1]];
  for (let index = 0; index < MONSTER_ANCHORS.length - 1; index += 1) {
    const lower = MONSTER_ANCHORS[index];
    const upper = MONSTER_ANCHORS[index + 1];
    if (level >= lower.level && level <= upper.level) return [lower, upper];
  }
  return MONSTER_ANCHORS.slice(-2);
}

function logLinear(level, field) {
  const exact = MONSTER_ANCHORS.find((anchor) => anchor.level === level);
  if (exact) return exact[field];
  const [lower, upper] = interpolationPair(level);
  const position = (level - lower.level) / (upper.level - lower.level);
  return Math.round(Math.exp(Math.log(lower[field]) + position * (Math.log(upper[field]) - Math.log(lower[field]))));
}

export function monsterCurveAt(level) {
  return {
    level,
    hp: logLinear(level, "hp"),
    attack: logLinear(level, "attack"),
    defense: logLinear(level, "defense"),
    xp: logLinear(level, "xp"),
    goldMin: logLinear(level, "goldMin"),
    goldMax: logLinear(level, "goldMax"),
    method: "log_linear_between_nearest_existing_level_anchors_round_integer; endpoint_extrapolation_uses_nearest_two_anchors",
  };
}

function expectedDamage(attack, defense, incoming = false) {
  const samples = 4096;
  const minimumRoll = incoming ? 0.5 : 0.6;
  const maximumRoll = 1.2;
  const defenseFactor = incoming ? 0.5 : 0.4;
  const minimumDamage = incoming ? 0 : 1;
  let total = 0;
  for (let index = 0; index < samples; index += 1) {
    const roll = minimumRoll + ((index + 0.5) / samples) * (maximumRoll - minimumRoll);
    total += Math.max(minimumDamage, Math.floor(attack * roll - defense * defenseFactor));
  }
  return total / samples;
}

function combatMetrics(level, monster, weaponAttack, armorDefense, armorAttack, speed, weaponPlus = 0, armorPlus = weaponPlus) {
  const effectiveWeapon = weaponStatWithPlus(weaponAttack, weaponPlus);
  const effectiveArmorDefense = defenseStatWithPlus(armorDefense, armorPlus);
  const effectiveArmorAttack = armorAttackStatWithPlus(armorAttack, armorPlus);
  const attackStat = Math.round(3 + level + effectiveWeapon + effectiveArmorAttack);
  const defenseStat = Math.round(Math.floor(level / 2) + effectiveArmorDefense);
  const interval = Math.max(0.5, 1 - speed);
  const dealt = expectedDamage(attackStat, monster.defense, false);
  const taken = expectedDamage(monster.attack, defenseStat, true);
  const hitsToKill = Math.max(1, Math.ceil(monster.hp / Math.max(dealt, 0.0001)));
  const hitsToDie = taken <= 0 ? null : Math.max(1, Math.ceil(maxHp(level) / taken));
  return {
    attackStat,
    defenseStat,
    attackIntervalSeconds: round(interval, 3),
    expectedDamageDealt: round(dealt, 3),
    expectedDamageTaken: round(taken, 3),
    expectedDps: round(dealt / interval, 3),
    hitsToKill,
    ttkSeconds: round(hitsToKill * interval, 3),
    hitsToDie,
    ttdSeconds: hitsToDie === null ? null : round(hitsToDie * interval, 3),
  };
}

const heavyTtkTarget = (level) => round(12 + level * 0.06, 2);
const heavyTtdTarget = (level) => round(18 + level * 0.08, 2);

function solveWeapon(level, monster, floor) {
  const target = heavyTtkTarget(level);
  for (let attack = Math.max(1, floor); attack < 2000; attack += 1) {
    if (combatMetrics(level, monster, attack, 0, 0, 0).ttkSeconds <= target) return attack;
  }
  throw new Error(`weapon solver failed at level ${level}`);
}

function solveHeavyDefense(level, monster, floor) {
  const target = heavyTtdTarget(level);
  for (let defense = Math.max(1, floor); defense < 4000; defense += 1) {
    const ttd = combatMetrics(level, monster, 0, defense, 0, 0).ttdSeconds;
    if (ttd === null || ttd >= target) return defense;
  }
  throw new Error(`heavy-defense solver failed at level ${level}`);
}

function lightStats(heavyDefense, tierIndex, defenseFloor = 0, attackFloor = 0) {
  let adjustedHeavy = heavyDefense;
  while (true) {
    const defense = round(adjustedHeavy * 0.65, 1);
    const attack = Math.round(defense * 0.35);
    if (defense >= defenseFloor && attack >= attackFloor) {
      return {
        adjustedHeavy,
        defense,
        attack,
        speed: Math.min(0.25, round(0.04 + 0.03 * (tierIndex - 1), 2)),
      };
    }
    adjustedHeavy += 1;
  }
}

function tierForLevel(tiers, level) {
  let selected = tiers[0];
  for (const tier of tiers) {
    if (tier.levelRequirement <= level) selected = tier;
  }
  return selected;
}

function progressionRows(tiers) {
  const rows = [];
  let cumulativeXp = 0;
  let previousNeed = 0;
  for (let level = 1; level <= 150; level += 1) {
    const targetMinutes = targetMinutesPerLevel(level);
    let xpToNext = null;
    let benchmarkCycleSeconds = null;
    let benchmarkXpPerHour = null;
    if (level < 150) {
      if (level <= 50) {
        xpToNext = legacyXpForLevel(level);
      } else {
        const tier = tierForLevel(tiers, level);
        const monster = monsterCurveAt(level);
        const metrics = combatMetrics(level, monster, tier.weaponAttack, 0, 0, 0);
        benchmarkCycleSeconds = metrics.ttkSeconds + 3;
        const rawNeed = monster.xp * ((targetMinutes * 60) / benchmarkCycleSeconds);
        xpToNext = Math.max(previousNeed + 1, Math.round(rawNeed));
      }
      previousNeed = xpToNext;
      const tier = tierForLevel(tiers, level);
      const monster = monsterCurveAt(level);
      const metrics = combatMetrics(level, monster, tier.weaponAttack, 0, 0, 0);
      benchmarkCycleSeconds ??= metrics.ttkSeconds + 3;
      benchmarkXpPerHour = round((monster.xp * 3600) / benchmarkCycleSeconds);
    }
    rows.push({
      level,
      xpToNext,
      cumulativeXpToLevel: cumulativeXp,
      targetCumulativeHours: targetHoursAtLevel(level),
      targetMinutesPerLevel: targetMinutes,
      benchmarkCombatCycleSeconds: benchmarkCycleSeconds === null ? null : round(benchmarkCycleSeconds, 3),
      benchmarkCombatXpPerHour: benchmarkXpPerHour,
    });
    if (xpToNext !== null) cumulativeXp += xpToNext;
  }
  return rows;
}

function actionReward(xpNeed, targetMinutes, cycleSeconds) {
  const actions = Math.max(1, Math.round((targetMinutes * 60) / cycleSeconds));
  const xp = Math.max(1, Math.round(xpNeed / actions));
  return {
    effectiveCycleSeconds: cycleSeconds,
    targetActionsPerLevel: actions,
    xpPerAction: xp,
    modeledMinutesPerLevel: round((xpNeed / xp) * cycleSeconds / 60, 2),
    modeledXpPerHour: round((xp * 3600) / cycleSeconds),
  };
}

function upgradeStepCost(itemValue, currentPlus) {
  const nextPlus = currentPlus + 1;
  return roundStep(Math.max(25, itemValue * (0.08 + 3.4 * Math.sqrt(nextPlus))), 5);
}

function upgradeSummary(itemValue) {
  const cumulative = [];
  let spent = 0;
  for (let plus = 0; plus < 100; plus += 1) {
    spent += upgradeStepCost(itemValue, plus);
    cumulative[plus + 1] = spent;
  }
  return {
    formula: "round_to_5(max(25, item_value * (0.08 + 3.4 * sqrt(next_plus))))",
    nextCostAtPlus: {
      0: upgradeStepCost(itemValue, 0),
      10: upgradeStepCost(itemValue, 10),
      31: upgradeStepCost(itemValue, 31),
      50: upgradeStepCost(itemValue, 50),
      99: upgradeStepCost(itemValue, 99),
    },
    cumulativeCostToPlus: {
      10: cumulative[10],
      31: cumulative[31],
      50: cumulative[50],
      100: cumulative[100],
    },
    npcResaleAtPlus: Object.fromEntries(
      [0, 10, 31, 50, 100].map((plus) => [plus, Math.floor(itemValue * 0.4 + (cumulative[plus] ?? 0) * 0.15)]),
    ),
    resaleRule: "floor(item_value * 0.40 + cumulative_upgrade_spend * 0.15)",
  };
}

function equivalentTier(tiers, stat, field) {
  let equivalent = tiers[0];
  for (const tier of tiers) {
    if (tier[field] <= stat) equivalent = tier;
  }
  return { tierIndex: equivalent.tierIndex, levelRequirement: equivalent.levelRequirement };
}

function buildTierSkeletons() {
  const tiers = [];
  let previousWeapon = 0;
  let previousHeavy = 0;
  for (const [tierIndex, levelRequirement, theme] of TIERS) {
    const monster = monsterCurveAt(levelRequirement);
    const weaponFloor = LIVE_FLOORS.weaponAttack[levelRequirement] ?? 0;
    const solvedWeapon = solveWeapon(levelRequirement, monster, weaponFloor);
    const weaponAttack = Math.max(previousWeapon ? Math.ceil(previousWeapon * 1.1) : 1, solvedWeapon);
    previousWeapon = weaponAttack;

    const heavyFloor = LIVE_FLOORS.heavyDefense[levelRequirement] ?? 0;
    const solvedHeavy = solveHeavyDefense(levelRequirement, monster, heavyFloor);
    const light = lightStats(
      Math.max(previousHeavy, solvedHeavy),
      tierIndex,
      LIVE_FLOORS.lightDefense[levelRequirement] ?? 0,
      LIVE_FLOORS.lightAttack[levelRequirement] ?? 0,
    );
    const heavyDefense = light.adjustedHeavy;
    previousHeavy = heavyDefense;

    tiers.push({
      tierIndex,
      levelRequirement,
      theme,
      proposedNewMonsterId: NEW_MONSTERS[levelRequirement] ?? null,
      monster,
      weaponAttack,
      heavyDefense,
      lightDefense: light.defense,
      lightAttack: light.attack,
      lightSpeed: light.speed,
      heavyTtkTargetSeconds: heavyTtkTarget(levelRequirement),
      heavyTtdTargetSeconds: heavyTtdTarget(levelRequirement),
    });
  }
  return tiers;
}

function finishTiers(tiers, progression) {
  let previousFoodHeal = 0;
  let previousPotionBoost = 0;
  let previousPotionHits = 0;
  let previousRawValue = 0;
  let previousFoodValue = 0;
  let previousPotionValue = 0;
  return tiers.map((tier) => {
    const level = tier.levelRequirement;
    const monster = tier.monster;
    const heavy = combatMetrics(level, monster, tier.weaponAttack, tier.heavyDefense, 0, 0);
    const light = combatMetrics(level, monster, tier.weaponAttack, tier.lightDefense, tier.lightAttack, tier.lightSpeed);
    const noGear = combatMetrics(level, monster, 0, 0, 0, 0);
    const heavyPlus31 = combatMetrics(level, monster, tier.weaponAttack, tier.heavyDefense, 0, 0, 31);
    const lightPlus31 = combatMetrics(level, monster, tier.weaponAttack, tier.lightDefense, tier.lightAttack, tier.lightSpeed, 31);

    const foodFloor = LIVE_FLOORS.foodHeal[level] ?? 0;
    const baseFood = roundStep(Math.max(maxHp(level) * 0.45, light.expectedDamageTaken * 5), 5);
    const minimumTierGain = previousFoodHeal ? roundStep(maxHp(level) * 0.075, 5) : 0;
    const foodHeal = Math.max(foodFloor, previousFoodHeal + minimumTierGain, baseFood);
    previousFoodHeal = foodHeal;

    const desiredPotionFraction = 0.12 + ((tier.tierIndex - 1) / 15) * 0.08;
    const boostFloor = LIVE_FLOORS.potionBoost[level] ?? 0;
    const calculatedBoost = Math.ceil((heavy.expectedDamageDealt * desiredPotionFraction) / 0.9);
    const potionBoost = Math.max(boostFloor, previousPotionBoost ? previousPotionBoost + 1 : 1, calculatedBoost);
    previousPotionBoost = potionBoost;
    const potionDamage = expectedDamage(heavy.attackStat + potionBoost, monster.defense, false);
    const potionHitsPerKill = Math.max(1, Math.ceil(monster.hp / potionDamage));
    const potionHits = Math.max(
      LIVE_FLOORS.potionHits[level] ?? 0,
      previousPotionHits,
      Math.ceil(potionHitsPerKill * 2.5),
    );
    previousPotionHits = potionHits;
    const potionDpsIncreasePct = round(((potionDamage - heavy.expectedDamageDealt) / heavy.expectedDamageDealt) * 100, 1);

    const referenceLevel = level === 150 ? 149 : level;
    const progress = progression[referenceLevel - 1];
    const xpNeed = progress.xpToNext;
    const targetMinutes = targetMinutesPerLevel(referenceLevel);
    const combatCycle = heavy.ttkSeconds + 3;
    const cadence = activityCadence(level);
    const skillRewards = {
      combat: {
        effectiveCycleSeconds: round(combatCycle, 3),
        targetActionsPerLevel: Math.max(1, Math.round(xpNeed / monster.xp)),
        xpPerAction: monster.xp,
        modeledMinutesPerLevel: round((xpNeed / monster.xp) * combatCycle / 60, 2),
        modeledXpPerHour: round((monster.xp * 3600) / combatCycle),
      },
      ...Object.fromEntries(Object.entries(cadence).map(([skill, row]) => [skill, actionReward(xpNeed, targetMinutes, row.effectiveCycleSeconds)])),
    };

    const averageGold = (monster.goldMin + monster.goldMax) / 2;
    const combatGoldPerHour = round((averageGold * 3600) / combatCycle);
    const gatheringActionsPerHour = 3600 / cadence.mining.effectiveCycleSeconds;
    const rawFloorDerived = roundStep((combatGoldPerHour * 0.75) / gatheringActionsPerHour, 5);
    const rawNpcFloor = Math.max(previousRawValue ? previousRawValue + 5 : 1, LIVE_FLOORS.rawValue[level] ?? 0, rawFloorDerived);
    previousRawValue = rawNpcFloor;
    const barNpcFloor = roundStep(rawNpcFloor * 2.4, 5);
    const weaponNpcValue = Math.max(
      LIVE_FLOORS.weaponValue[level] ?? 0,
      roundStep(barNpcFloor * 3.4 + rawNpcFloor * 2, 5),
    );
    const armorNpcValue = Math.max(
      LIVE_FLOORS.armorValue[level] ?? 0,
      roundStep(barNpcFloor * 4 + rawNpcFloor * 1.5, 5),
    );
    const foodNpcValue = Math.max(
      previousFoodValue ? previousFoodValue + 5 : 0,
      LIVE_FLOORS.foodValue[level] ?? 0,
      roundStep((foodHeal / maxHp(level)) * rawNpcFloor * 2.2, 5),
    );
    previousFoodValue = foodNpcValue;
    const potionNpcValue = Math.max(
      previousPotionValue ? previousPotionValue + 5 : 0,
      LIVE_FLOORS.potionValue[level] ?? 0,
      roundStep((potionDpsIncreasePct / 10) * rawNpcFloor * 2.5, 5),
    );
    previousPotionValue = potionNpcValue;
    const nodeNpcFloorPerHour = round(rawNpcFloor * gatheringActionsPerHour);
    const smeltingMargin = Math.max(0, barNpcFloor - rawNpcFloor * 2);
    const recipeNpcMarginPerHour = round(smeltingMargin * (3600 / cadence.smithing.effectiveCycleSeconds));

    const weaponUpgrade = upgradeSummary(weaponNpcValue);
    const armorUpgrade = upgradeSummary(armorNpcValue);
    const weaponPlus31 = weaponStatWithPlus(tier.weaponAttack, 31);
    const weaponPlus100 = weaponStatWithPlus(tier.weaponAttack, 100);
    const armorPlus31 = defenseStatWithPlus(tier.heavyDefense, 31);
    const armorPlus100 = defenseStatWithPlus(tier.heavyDefense, 100);

    return {
      ...tier,
      targetCumulativeHours: targetHoursAtLevel(level),
      targetMinutesPerLevel: targetMinutes,
      xpReferenceLevel: referenceLevel,
      xpToNextReference: xpNeed,
      cumulativeXpToLevel: progression[level - 1].cumulativeXpToLevel,
      playerMaxHp: maxHp(level),
      food: {
        heal: foodHeal,
        maxHpPct: round((foodHeal / maxHp(level)) * 100, 1),
        heavyHitsRestored: heavy.expectedDamageTaken <= 0 ? null : round(foodHeal / heavy.expectedDamageTaken, 2),
        lightHitsRestored: light.expectedDamageTaken <= 0 ? null : round(foodHeal / light.expectedDamageTaken, 2),
        npcValue: foodNpcValue,
      },
      potion: {
        damageBoost: potionBoost,
        boostHits: potionHits,
        dpsIncreasePct: potionDpsIncreasePct,
        expectedKillsPerDose: round(potionHits / potionHitsPerKill, 2),
        npcValue: potionNpcValue,
      },
      skillRewards,
      activityCadence: Object.fromEntries(Object.entries(cadence).map(([skill, row]) => {
        const respawn = skill === "mining"
          ? 32 + level * 0.38
          : skill === "woodcutting"
            ? 30 + level * 0.34
            : skill === "gathering"
              ? 26 + level * 0.3
              : null;
        return [skill, respawn === null ? row : {
          ...row,
          proposedRespawnSeconds: Math.round(respawn),
          minimumClusterNodesPerActivePlayer: Math.ceil(respawn / row.effectiveCycleSeconds),
        }];
      })),
      combat: { noGear, heavyPlus0: heavy, lightPlus0: light, heavyPlus31, lightPlus31 },
      economy: {
        monsterGoldPerHour: combatGoldPerHour,
        monsterGoldBandPerHour: [round(combatGoldPerHour * 0.8), round(combatGoldPerHour * 1.2)],
        rawNpcFloor,
        nodeNpcFloorPerHour,
        nodeNpcFloorBandPerHour: [round(nodeNpcFloorPerHour * 0.85), round(nodeNpcFloorPerHour * 1.15)],
        barNpcFloor,
        recipeNpcMarginPerHour,
        weaponNpcValue,
        armorNpcValue,
        marketFeePct: 5,
      },
      upgrades: {
        maxPlus: 100,
        weaponMultiplierRule: "1 + 2% × min(plus, 50) + 0.5% × max(plus - 50, 0)",
        lightAttackMultiplierRule: "1 + 5% × min(plus, 20) + 1% × max(plus - 20, 0)",
        defenseMultiplierRule: "1 + 0.1% × plus",
        weapon: weaponUpgrade,
        armor: armorUpgrade,
        crossTier: {
          weaponPlus31: equivalentTier(tiers, weaponPlus31, "weaponAttack"),
          weaponPlus100: equivalentTier(tiers, weaponPlus100, "weaponAttack"),
          heavyArmorPlus31: equivalentTier(tiers, armorPlus31, "heavyDefense"),
          heavyArmorPlus100: equivalentTier(tiers, armorPlus100, "heavyDefense"),
        },
        reachabilityHoursAtMonsterGoldRate: {
          weaponPlus31: round(weaponUpgrade.cumulativeCostToPlus[31] / Math.max(1, combatGoldPerHour), 2),
          weaponPlus100: round(weaponUpgrade.cumulativeCostToPlus[100] / Math.max(1, combatGoldPerHour), 2),
          armorPlus31: round(armorUpgrade.cumulativeCostToPlus[31] / Math.max(1, combatGoldPerHour), 2),
          armorPlus100: round(armorUpgrade.cumulativeCostToPlus[100] / Math.max(1, combatGoldPerHour), 2),
        },
      },
    };
  });
}

function observedLiveSensitivity(tiers) {
  const level = 40;
  const steelTier = tiers.find((tier) => tier.levelRequirement === 30);
  const monster = monsterCurveAt(level);
  const metrics = combatMetrics(level, monster, steelTier.weaponAttack, steelTier.heavyDefense, 0, 0, 31, 30);
  return {
    label: "observed_live_max_plus_snapshot",
    level,
    loadout: "migrated Steel Sword +31 and migrated Iron Mail +30",
    monster,
    metrics,
    provenance: "read-only aggregate snapshot in tomlandia-overhaul-read-only-audit.md",
  };
}

function migrationEffectiveStatChecks(tiers) {
  const byLevel = (level) => tiers.find((tier) => tier.levelRequirement === level);
  const legacy = (base, plus) => round(base * (1 + plus * 0.05), 1);
  const copper = byLevel(1);
  const steel = byLevel(30);
  return [
    {
      case: "equipped_wooden_club_plus1_to_copper_sword_plus1",
      stat: "weapon_attack",
      previousEffective: legacy(2, 1),
      proposedEffective: weaponStatWithPlus(copper.weaponAttack, 1),
    },
    {
      case: "observed_steel_sword_plus31_migrates_in_place",
      stat: "weapon_attack",
      previousEffective: legacy(9, 31),
      proposedEffective: weaponStatWithPlus(steel.weaponAttack, 31),
    },
    {
      case: "observed_cloth_tunic_plus13_migrates_in_place",
      stat: "armor_defense",
      previousEffective: legacy(2, 13),
      proposedEffective: defenseStatWithPlus(copper.lightDefense, 13),
    },
    {
      case: "observed_cloth_tunic_plus13_migrates_in_place",
      stat: "armor_attack",
      previousEffective: legacy(1, 13),
      proposedEffective: armorAttackStatWithPlus(copper.lightAttack, 13),
    },
    {
      case: "observed_iron_mail_plus30_migrates_in_place",
      stat: "armor_defense",
      previousEffective: legacy(9, 30),
      proposedEffective: defenseStatWithPlus(steel.heavyDefense, 30),
    },
  ];
}

function bossModel(tiers, progression) {
  const tier = tiers.at(-1);
  const level = 150;
  const bossDefense = Math.round(tier.monster.defense * 1.3);
  const bossAttack = Math.round(tier.monster.attack * 1.12);
  const potionBoost = tier.potion.damageBoost;
  const dps = (armor, plus) => {
    const weapon = weaponStatWithPlus(tier.weaponAttack, plus);
    const armorAttack = armorAttackStatWithPlus(armor.attack, plus);
    const attackStat = Math.round(3 + level + weapon + armorAttack + potionBoost);
    return expectedDamage(attackStat, bossDefense, false) / Math.max(0.5, 1 - armor.speed);
  };
  const heavyDps = dps({ attack: 0, speed: 0 }, 0);
  const lightDps = dps({ attack: tier.lightAttack, speed: tier.lightSpeed }, 0);
  const groupDps = heavyDps + lightDps * 3;
  const targetGroupSeconds = 150;
  const hp = Math.max(45000, roundStep(groupDps * targetGroupSeconds, 1000));
  const soloPlus31Dps = dps({ attack: tier.lightAttack, speed: tier.lightSpeed }, 31);
  const heavyIncoming = expectedDamage(bossAttack, Math.floor(level / 2) + tier.heavyDefense, true);
  const lightIncoming = expectedDamage(bossAttack, Math.floor(level / 2) + tier.lightDefense, true);
  const reference = progression[148];
  const xpPerHour = (reference.xpToNext * 60) / reference.targetMinutesPerLevel;
  const premiumMinutes = 5;
  const goldPerHour = tier.economy.monsterGoldPerHour;
  const xpPerPlayerCap = roundStep((xpPerHour * premiumMinutes) / 60, 100);
  const goldPerPlayerCap = [
    roundStep((goldPerHour * premiumMinutes * 1.25) / 60, 100),
    roundStep((goldPerHour * premiumMinutes * 1.75) / 60, 100),
  ];
  const foodUnits = (incoming, interval, duration) => {
    const damage = (incoming / interval) * duration;
    return Math.max(0, Math.ceil((damage - maxHp(level)) / tier.food.heal));
  };
  return {
    name: "DESOLATUS",
    hp,
    attack: bossAttack,
    defense: bossDefense,
    respawnMinutes: 10,
    rewardMode: "fixed_pool_proportional_damage_with_per_player_cap",
    itemDrop: null,
    rewardBudget: {
      targetContributors: 4,
      minimumDamagePctOfMaxHp: 1,
      minimumDamage: Math.ceil(hp * 0.01),
      allocation: "proportional_to_eligible_damage; cap_each_player; do_not_redistribute_capped_remainder",
      xpPool: xpPerPlayerCap * 4,
      xpPerPlayerCap,
      goldPool: goldPerPlayerCap.map((value) => value * 4),
      goldPerPlayerCap,
    },
    targets: {
      groupSize: 4,
      groupComposition: "1 Heavy +0, 3 Light +0, current-tier potion",
      groupKillSeconds: targetGroupSeconds,
      modeledGroupKillSeconds: round(hp / groupDps, 1),
      soloComposition: "Light +31, current-tier potion",
      soloKillSecondsBand: [300, 480],
      modeledSoloKillSeconds: round(hp / soloPlus31Dps, 1),
    },
    survivability: {
      heavyExpectedDamagePerHit: round(heavyIncoming, 2),
      lightExpectedDamagePerHit: round(lightIncoming, 2),
      heavyFoodUnitsForGroupTarget: foodUnits(heavyIncoming, 1, targetGroupSeconds),
      lightFoodUnitsForGroupTarget: foodUnits(lightIncoming, 1 - tier.lightSpeed, targetGroupSeconds),
    },
  };
}

function sensitivityRows(tiers) {
  return tiers.flatMap((tier) => {
    const rows = [];
    for (const [scenario, metrics] of Object.entries(tier.combat)) {
      rows.push({
        tierIndex: tier.tierIndex,
        levelRequirement: tier.levelRequirement,
        scenario,
        ttkSeconds: metrics.ttkSeconds,
        ttdSeconds: metrics.ttdSeconds,
        expectedDamageDealt: metrics.expectedDamageDealt,
        expectedDamageTaken: metrics.expectedDamageTaken,
        attackIntervalSeconds: metrics.attackIntervalSeconds,
      });
    }
    rows.push({
      tierIndex: tier.tierIndex,
      levelRequirement: tier.levelRequirement,
      scenario: "light_plus0_with_food_and_potion",
      ttkSeconds: round(tier.combat.lightPlus0.ttkSeconds / (1 + tier.potion.dpsIncreasePct / 100), 3),
      ttdSeconds: round(
        tier.combat.lightPlus0.ttdSeconds
          + (tier.food.heal / Math.max(0.0001, tier.combat.lightPlus0.expectedDamageTaken)) * (1 - tier.lightSpeed),
        3,
      ),
      expectedDamageDealt: tier.combat.lightPlus0.expectedDamageDealt,
      expectedDamageTaken: tier.combat.lightPlus0.expectedDamageTaken,
      attackIntervalSeconds: tier.combat.lightPlus0.attackIntervalSeconds,
    });
    return rows;
  });
}

export function buildBalanceModel() {
  const skeletons = buildTierSkeletons();
  const progression = progressionRows(skeletons);
  const tiers = finishTiers(skeletons, progression);
  const sensitivities = sensitivityRows(tiers);
  const core = {
    modelVersion: MODEL_VERSION,
    approval: APPROVAL,
    provenance: {
      decisionRegister: "docs/overhaul/gate-0/decisions.md",
      tierRegistry: "docs/overhaul/gate-0/id-registry.json",
      liveData: "src/game/data.ts",
      combatAuthority: "supabase/migrations/20260823234700_gate2_world_actions.sql",
      rounding: "integers use Math.round unless a field states round_to_5; Light defense uses one decimal; damage expectations use 4096 fixed midpoint samples",
      legacyConstraint: "existing regular-monster rewards remain unchanged, so pre-51 combat can beat the cross-skill target; Gate 3 reports that sensitivity instead of rewriting protected live monsters",
    },
    formulas: {
      xpLevels1Through50: "floor(100 * 1.15^level), byte-for-byte legacy behavior",
      xpLevels51Through149: "round(monster_xp_curve * target_seconds / (Heavy +0 TTK + 3s retarget)), monotonically nondecreasing",
      monsterCurve: "log-linear interpolation between nearest existing level anchors; integer rounding; endpoint extrapolation uses nearest two anchors",
      heavyArmor: "minimum integer defense meeting Heavy +0 TTD target against final monster curve",
      lightArmor: "round1(Heavy defense * 0.65); attack=round(Light defense * 0.35)",
      lightSpeed: "min(0.25, round2(0.04 + 0.03 * (tier_index - 1)))",
      food: "round_to_5(max(45% max HP, five Light incoming hits, migrated live floor, prior tier + 7.5% current max HP))",
      potion: "12%-20% target incremental Heavy DPS; 2.5 expected kills per dose; migrated live floors preserved",
      upgradeWeaponMultiplier: "1 + 2% * min(plus, 50) + 0.5% * max(plus - 50, 0)",
      upgradeLightAttackMultiplier: "1 + 5% * min(plus, 20) + 1% * max(plus - 20, 0)",
      upgradeDefenseMultiplier: "1 + 0.1% * plus",
      upgradeCost: "round_to_5(max(25, item_value * (0.08 + 3.4 * sqrt(next_plus))))",
      gearResale: "floor(item_value * 0.40 + cumulative_upgrade_spend * 0.15)",
    },
    targets: TIME_TARGETS.map(([level, cumulativeActiveHours]) => ({ level, cumulativeActiveHours })),
    legacyMonsterAnchors: MONSTER_ANCHORS,
    progression,
    tiers,
    proposedNewMonsters: tiers.filter((tier) => tier.proposedNewMonsterId).map((tier) => ({
      id: tier.proposedNewMonsterId,
      level: tier.levelRequirement,
      ...tier.monster,
    })),
    sensitivities,
    observedLiveSensitivity: observedLiveSensitivity(tiers),
    migrationEffectiveStatChecks: migrationEffectiveStatChecks(tiers),
    boss: bossModel(tiers, progression),
  };
  const modelHash = createHash("sha256").update(JSON.stringify(core)).digest("hex");
  return { ...core, modelHash };
}

export function validateBalance(model) {
  const failures = [];
  const fail = (condition, message) => { if (!condition) failures.push(message); };
  fail(model.approval.status === "proposed_owner_approval_required", "model must remain explicitly proposed");
  fail(model.approval.activationAllowed === false, "proposal must not be activatable");
  fail(model.approval.gate4Blocked === true, "Gate 4 must remain blocked before owner table approval");
  fail(model.tiers.length === 16, "exactly 16 tiers are required");
  fail(model.proposedNewMonsters.length === 12, "exactly 12 new-monster proposals are required");
  fail(model.progression.length === 150, "progression must cover levels 1-150");
  const inspectNumbers = (value, path = "model") => {
    if (typeof value === "number") {
      fail(Number.isFinite(value), `non-finite number at ${path}`);
      if (Number.isInteger(value)) fail(Number.isSafeInteger(value), `unsafe integer at ${path}`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => inspectNumbers(entry, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, entry]) => inspectNumbers(entry, `${path}.${key}`));
    }
  };
  inspectNumbers(model);
  for (let level = 1; level <= 50; level += 1) {
    fail(model.progression[level - 1].xpToNext === legacyXpForLevel(level), `legacy XP changed at level ${level}`);
  }
  for (let level = 51; level < 150; level += 1) {
    const row = model.progression[level - 1];
    const current = row.xpToNext;
    const previous = model.progression[level - 2].xpToNext;
    fail(Number.isSafeInteger(current) && current > previous, `post-50 XP must be finite and increasing at level ${level}`);
    const modeledMinutes = (current / row.benchmarkCombatXpPerHour) * 60;
    const errorPct = Math.abs(modeledMinutes - row.targetMinutesPerLevel) / row.targetMinutesPerLevel;
    fail(errorPct <= 0.05, `post-50 combat pace exceeds 5% tolerance at level ${level}`);
  }
  for (const tier of model.tiers) {
    fail(tier.heavyDefense > tier.lightDefense, `Heavy defense must exceed Light at level ${tier.levelRequirement}`);
    fail(tier.lightDefense === round(tier.heavyDefense * 0.65, 1), `Light defense formula drift at level ${tier.levelRequirement}`);
    fail(tier.lightAttack === Math.round(tier.lightDefense * 0.35), `Light attack formula drift at level ${tier.levelRequirement}`);
    fail(tier.lightSpeed === Math.min(0.25, round(0.04 + 0.03 * (tier.tierIndex - 1), 2)), `Light speed formula drift at tier ${tier.tierIndex}`);
    fail(tier.combat.heavyPlus0.ttkSeconds <= tier.heavyTtkTargetSeconds, `Heavy TTK misses target at level ${tier.levelRequirement}`);
    fail(tier.combat.heavyPlus0.ttdSeconds === null || tier.combat.heavyPlus0.ttdSeconds >= tier.heavyTtdTargetSeconds, `Heavy TTD misses target at level ${tier.levelRequirement}`);
    fail(tier.combat.lightPlus0.ttkSeconds < tier.combat.heavyPlus0.ttkSeconds, `Light must kill faster at level ${tier.levelRequirement}`);
    fail(tier.combat.lightPlus0.ttdSeconds < tier.combat.heavyPlus0.ttdSeconds, `Light must be less durable at level ${tier.levelRequirement}`);
    fail(tier.food.maxHpPct >= 45, `food must heal at least 45% max HP at level ${tier.levelRequirement}`);
    fail(tier.food.maxHpPct <= 110, `food exceeds 110% max HP at level ${tier.levelRequirement}`);
    fail(tier.potion.dpsIncreasePct >= 10, `potion DPS increase is too small at level ${tier.levelRequirement}`);
    fail(tier.potion.dpsIncreasePct <= 25, `potion DPS increase is too large at level ${tier.levelRequirement}`);
    fail(tier.potion.expectedKillsPerDose >= 2.5, `potion duration misses 2.5 kills at level ${tier.levelRequirement}`);
    fail(tier.economy.marketFeePct === 5, `market fee drift at level ${tier.levelRequirement}`);
    fail(tier.upgrades.weapon.cumulativeCostToPlus[100] > tier.upgrades.weapon.cumulativeCostToPlus[50], `upgrade sink is not increasing at level ${tier.levelRequirement}`);
    fail(tier.upgrades.reachabilityHoursAtMonsterGoldRate.weaponPlus31 >= 4, `+31 weapon is too cheap at level ${tier.levelRequirement}`);
    fail(tier.upgrades.reachabilityHoursAtMonsterGoldRate.weaponPlus31 <= 12, `+31 weapon is not realistically reachable at level ${tier.levelRequirement}`);
    fail(tier.upgrades.reachabilityHoursAtMonsterGoldRate.weaponPlus100 >= 20, `+100 weapon is too cheap at level ${tier.levelRequirement}`);
    fail(tier.upgrades.reachabilityHoursAtMonsterGoldRate.weaponPlus100 <= 80, `+100 weapon is not realistically reachable at level ${tier.levelRequirement}`);
    fail(tier.upgrades.reachabilityHoursAtMonsterGoldRate.armorPlus31 >= 4, `+31 armour is too cheap at level ${tier.levelRequirement}`);
    fail(tier.upgrades.reachabilityHoursAtMonsterGoldRate.armorPlus31 <= 12, `+31 armour is not realistically reachable at level ${tier.levelRequirement}`);
    fail(tier.upgrades.reachabilityHoursAtMonsterGoldRate.armorPlus100 >= 20, `+100 armour is too cheap at level ${tier.levelRequirement}`);
    fail(tier.upgrades.reachabilityHoursAtMonsterGoldRate.armorPlus100 <= 80, `+100 armour is not realistically reachable at level ${tier.levelRequirement}`);
    fail(tier.combat.heavyPlus31.ttdSeconds !== null, `+31 Heavy becomes immune at level ${tier.levelRequirement}`);
    fail(tier.upgrades.crossTier.weaponPlus31.tierIndex <= Math.min(16, tier.tierIndex + 5), `+31 weapon skips too many tiers at level ${tier.levelRequirement}`);
    for (const [skill, reward] of Object.entries(tier.skillRewards)) {
      fail(Number.isFinite(reward.modeledXpPerHour) && reward.modeledXpPerHour > 0, `invalid skill reward at level ${tier.levelRequirement}`);
      fail(Number.isSafeInteger(reward.targetActionsPerLevel) && reward.targetActionsPerLevel > 0, `invalid ${skill} action target at level ${tier.levelRequirement}`);
      fail(Number.isSafeInteger(reward.xpPerAction) && reward.xpPerAction > 0, `invalid ${skill} XP/action at level ${tier.levelRequirement}`);
      if (skill !== "combat") {
        const errorPct = Math.abs(reward.modeledMinutesPerLevel - tier.targetMinutesPerLevel) / tier.targetMinutesPerLevel;
        fail(errorPct <= 0.10, `${skill} pace exceeds 10% integer-rounding tolerance at level ${tier.levelRequirement}`);
      } else if (tier.levelRequirement >= 60) {
        const errorPct = Math.abs(reward.modeledMinutesPerLevel - tier.targetMinutesPerLevel) / tier.targetMinutesPerLevel;
        fail(errorPct <= 0.07, `combat pace exceeds 7% tolerance at level ${tier.levelRequirement}`);
      }
    }
    for (const skill of ["mining", "woodcutting", "gathering"]) {
      const cadence = tier.activityCadence[skill];
      fail(Number.isSafeInteger(cadence.proposedRespawnSeconds) && cadence.proposedRespawnSeconds > 0, `invalid ${skill} respawn at level ${tier.levelRequirement}`);
      fail(Number.isSafeInteger(cadence.minimumClusterNodesPerActivePlayer) && cadence.minimumClusterNodesPerActivePlayer > 0, `invalid ${skill} cluster at level ${tier.levelRequirement}`);
    }
  }
  const targetMinutes = model.targets.slice(1).map((row, index) => {
    const previous = model.targets[index];
    return ((row.cumulativeActiveHours - previous.cumulativeActiveHours) * 60) / (row.level - previous.level);
  });
  for (let index = 1; index < targetMinutes.length; index += 1) {
    fail(targetMinutes[index] >= targetMinutes[index - 1], `target pace decreases before level ${model.targets[index + 1].level}`);
  }
  for (const field of [
    (tier) => tier.weaponAttack,
    (tier) => tier.heavyDefense,
    (tier) => tier.lightDefense,
    (tier) => tier.lightAttack,
    (tier) => tier.food.heal,
    (tier) => tier.potion.damageBoost,
    (tier) => tier.potion.boostHits,
    (tier) => tier.economy.rawNpcFloor,
    (tier) => tier.economy.weaponNpcValue,
    (tier) => tier.economy.armorNpcValue,
    (tier) => tier.economy.barNpcFloor,
    (tier) => tier.economy.nodeNpcFloorPerHour,
    (tier) => tier.food.npcValue,
    (tier) => tier.potion.npcValue,
  ]) {
    const values = model.tiers.map(field);
    for (let index = 1; index < values.length; index += 1) {
      fail(values[index] >= values[index - 1], `tier reward/stat series decreases at tier ${index + 1}`);
    }
  }
  for (const skill of Object.keys(model.tiers[0].skillRewards)) {
    const values = model.tiers.map((tier) => tier.skillRewards[skill].xpPerAction);
    for (let index = 1; index < values.length; index += 1) {
      fail(values[index] >= values[index - 1], `${skill} XP/action decreases at tier ${index + 1}`);
    }
  }
  for (const check of model.migrationEffectiveStatChecks) {
    fail(check.proposedEffective >= check.previousEffective, `migration loses ${check.stat}: ${check.case}`);
  }
  fail(model.boss.itemDrop === null, "DESOLATUS must not regain a guessed or retired item drop");
  fail(model.boss.rewardMode === "fixed_pool_proportional_damage_with_per_player_cap", "DESOLATUS reward mode is not inflation-bounded");
  fail(model.boss.rewardBudget.targetContributors === 4, "DESOLATUS reward budget must use the modeled four-player group");
  fail(model.boss.rewardBudget.minimumDamage === Math.ceil(model.boss.hp * 0.01), "DESOLATUS contribution threshold drifted");
  fail(model.boss.rewardBudget.xpPool === model.boss.rewardBudget.xpPerPlayerCap * 4, "DESOLATUS XP pool does not reconcile");
  fail(model.boss.rewardBudget.goldPool.every((value, index) => value === model.boss.rewardBudget.goldPerPlayerCap[index] * 4), "DESOLATUS gold pool does not reconcile");
  fail(Math.abs(model.boss.targets.modeledGroupKillSeconds - model.boss.targets.groupKillSeconds) <= 2, "boss group target is outside tolerance");
  fail(
    model.boss.targets.modeledSoloKillSeconds >= model.boss.targets.soloKillSecondsBand[0]
      && model.boss.targets.modeledSoloKillSeconds <= model.boss.targets.soloKillSecondsBand[1],
    "boss +31 solo target is outside the proposed band",
  );
  return failures;
}

const csvCell = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const csv = (headers, rows) => [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";

export function renderArtifacts(model) {
  const approvalMatches = OWNER_APPROVAL_RECORD.status === "owner_approved"
    && OWNER_APPROVAL_RECORD.approvedModelHash === model.modelHash;
  const targetTable = model.targets.map((row, index) => {
    const previous = index === 0 ? row : model.targets[index - 1];
    const span = Math.max(1, row.level - previous.level);
    const minutes = index === 0 ? 0 : ((row.cumulativeActiveHours - previous.cumulativeActiveHours) * 60) / span;
    return `| ${row.level} | ${row.cumulativeActiveHours.toFixed(2)} | ${minutes.toFixed(1)} |`;
  }).join("\n");
  const tierTable = model.tiers.map((tier) =>
    `| ${tier.tierIndex} | ${tier.levelRequirement} | ${tier.theme} | ${tier.xpToNextReference.toLocaleString("en-GB")} | ${tier.weaponAttack} | ${tier.heavyDefense} | ${tier.lightDefense} / ${tier.lightAttack} / ${(tier.lightSpeed * 100).toFixed(0)}% | ${tier.combat.heavyPlus0.ttkSeconds.toFixed(1)}s | ${tier.combat.heavyPlus0.ttdSeconds?.toFixed(1) ?? "∞"}s | ${tier.food.heal} | +${tier.potion.damageBoost} × ${tier.potion.boostHits} |`,
  ).join("\n");
  const monsterTable = model.tiers.map((tier) =>
    `| ${tier.tierIndex} | ${tier.levelRequirement} | ${tier.proposedNewMonsterId ?? "benchmark only"} | ${tier.monster.hp.toLocaleString("en-GB")} | ${tier.monster.attack} | ${tier.monster.defense} | ${tier.monster.xp.toLocaleString("en-GB")} | ${tier.monster.goldMin.toLocaleString("en-GB")}–${tier.monster.goldMax.toLocaleString("en-GB")} |`,
  ).join("\n");
  const economyTable = model.tiers.map((tier) =>
    `| ${tier.tierIndex} | ${tier.levelRequirement} | ${tier.economy.monsterGoldPerHour.toLocaleString("en-GB")} | ${tier.economy.nodeNpcFloorPerHour.toLocaleString("en-GB")} | ${tier.economy.rawNpcFloor}/${tier.economy.barNpcFloor} | ${tier.economy.weaponNpcValue}/${tier.economy.armorNpcValue}/${tier.food.npcValue}/${tier.potion.npcValue} | ${tier.upgrades.weapon.cumulativeCostToPlus[31].toLocaleString("en-GB")} / ${tier.upgrades.weapon.cumulativeCostToPlus[100].toLocaleString("en-GB")} | ${tier.upgrades.reachabilityHoursAtMonsterGoldRate.weaponPlus31.toFixed(2)}h / ${tier.upgrades.reachabilityHoursAtMonsterGoldRate.weaponPlus100.toFixed(2)}h |`,
  ).join("\n");

  const readme = `# Gate 3 — deterministic balance proposal\n\n` +
    `- Status: **${approvalMatches ? "OWNER APPROVED FOR GATE 4 — RUNTIME NOT ACTIVE" : "OWNER APPROVAL REQUIRED — NOT ACTIVE"}**\n` +
    `- Model: \`${model.modelVersion}\`\n` +
    `- Hash: \`${model.modelHash}\`\n\n` +
    `This gate contains balance data and deterministic evidence only. It changes no client content, SQL migration, production row, deployment, or Lovable project. The immutable proposal snapshot retains its pre-approval guard; \`approval-record.json\` separately approves this exact hash for Gate 4 implementation only. Runtime activation remains forbidden.\n\n` +
    `## Proposed active-play targets\n\n` +
    `Targets apply to each benchmark skill independently; effective action cycles include the modeled travel, respawn, retarget, menu, and material overhead recorded in the JSON.\n\n` +
    `| Level reached | Cumulative active hours | Minutes per level in preceding band |\n|---:|---:|---:|\n${targetTable}\n\n` +
    `## Proposed tier table\n\n` +
    `Light cells are \`defense / attack / speed\`. Level 150 uses level 149's XP requirement as its reward reference because 150 is the cap.\n\n` +
    `| Tier index | Level | Theme | XP reference | Weapon atk | Heavy def | Light def/atk/speed | Heavy TTK | Heavy TTD | Food heal | Potion |\n|---:|---:|---|---:|---:|---:|---|---:|---:|---:|---|\n${tierTable}\n\n` +
    `## Benchmark and new-monster values\n\n` +
    `Rows marked \`benchmark only\` constrain the curve without creating another monster.\n\n` +
    `| Tier index | Level | New monster ID | HP | Attack | Defense | XP | Gold |\n|---:|---:|---|---:|---:|---:|---:|---:|\n${monsterTable}\n\n` +
    `## Economy and upgrade sinks\n\n` +
    `Item-value cells are \`weapon/armour/food/potion\`; upgrade cells show weapon \`+31/+100\`. The complete weapon and armour schedules are in the JSON and tier CSV.\n\n` +
    `| Tier index | Level | Monster gold/h | Node floor/h | Raw/bar floor | Item values W/A/F/P | Weapon spend +31/+100 | Reach +31/+100 |\n|---:|---:|---:|---:|---|---|---|---|\n${economyTable}\n\n` +
    `## Locked mechanics and rounding\n\n` +
    `- Levels 1–50 retain \`floor(100 × 1.15^level)\` exactly. Levels 51–149 derive from the proposed time table, the audited combat formula, a three-second retarget allowance, and the exact monster curve.\n` +
    `- New-monster values use log-linear interpolation between nearest existing level anchors. Values are rounded to integers; levels beyond the final anchor use the final two anchors for extrapolation. Existing monster values are evidence and remain untouched.\n` +
    `- Heavy is solved against the final monster attack curve. Light defense is Heavy × 0.65 rounded to one decimal; attack is rounded Light defense × 0.35; speed uses locked decision D-11.\n` +
    `- Damage expectations use 4,096 fixed midpoint samples of the exact server roll ranges and floor rules, making every run deterministic.\n` +
    `- The +100 cap remains. Weapon upgrades grant 2% per step through +50 then 0.5%; Light armour attack grants 5% per step through +20 then 1%; defense grants 0.1% per step. These rules preserve every observed migrated effective stat without allowing ordinary +31 armour to nullify same-level damage. The cost curve uses a square-root step schedule, not the live exponential doubling formula. NPC resale recovers 40% of base value and 15% of upgrade spend.\n` +
    `- DESOLATUS has no guessed item drop. Its four-player reward budget is a fixed pool split by eligible damage, with a 1% max-HP contribution threshold and per-player caps; Tungsten remains absent.\n\n` +
    `## Evidence files\n\n` +
    `- \`balance-model.proposed.json\`: full machine-readable model, formulas, skill rewards, economy, upgrade sinks, boss, and provenance.\n` +
    `- \`progression.proposed.csv\`: all 150 level rows.\n` +
    `- \`tier-balance.proposed.csv\`: exact 16-tier owner approval surface.\n` +
    `- \`skill-rewards.proposed.csv\`: every skill's actions, XP/action, modeled minutes, and XP/hour at every tier.\n` +
    `- \`activity-cadence.proposed.csv\`: action overhead plus gathering-node respawn and cluster requirements.\n` +
    `- \`sensitivities.proposed.csv\`: no-gear, Heavy/Light +0, +31, food, and potion cases.\n` +
    `- \`owner-approval-table.md\`: compact sign-off table and explicit activation guard.\n\n` +
    `Run \`bun run gate3:check\` to rebuild the model in memory, verify invariants, and byte-compare every generated artifact.\n`;

  const approval = `# Gate 3 owner approval table\n\n` +
    `**Decision state: ${approvalMatches ? "OWNER APPROVED FOR GATE 4. Runtime activation remains blocked." : "NOT APPROVED. Gate 4 and all activation work remain blocked."}**\n\n` +
    `Model hash: \`${model.modelHash}\`\n\n` +
    `## Active-play targets\n\n| Level reached | Cumulative active hours | Minutes per level in preceding band |\n|---:|---:|---:|\n${targetTable}\n\n` +
    `## Exact tier values\n\n| Tier index | Level | Theme | XP reference | Weapon atk | Heavy def | Light def/atk/speed | Heavy TTK | Heavy TTD | Food heal | Potion |\n|---:|---:|---|---:|---:|---:|---|---:|---:|---:|---|\n${tierTable}\n\n` +
    `## Benchmark and new-monster values\n\n| Tier index | Level | New monster ID | HP | Attack | Defense | XP | Gold |\n|---:|---:|---|---:|---:|---:|---:|---:|\n${monsterTable}\n\n` +
    `## Economy and upgrade sinks\n\nItem values are \`weapon/armour/food/potion\`; upgrade values are weapon \`+31/+100\`. Exact per-skill rewards, armour sinks, cadence and cluster requirements are in the accompanying CSV tables and hash-covered JSON.\n\n` +
    `| Tier index | Level | Monster gold/h | Node floor/h | Raw/bar floor | Item values W/A/F/P | Weapon spend +31/+100 | Reach +31/+100 |\n|---:|---:|---:|---:|---|---|---|---|\n${economyTable}\n\n` +
    `## DESOLATUS\n\n` +
    `| HP | Attack | Defense | Group target | +31 solo model | XP cap/player | Gold cap/player | Eligibility | Item drop |\n|---:|---:|---:|---:|---:|---:|---:|---:|---|\n` +
    `| ${model.boss.hp.toLocaleString("en-GB")} | ${model.boss.attack} | ${model.boss.defense} | ${model.boss.targets.modeledGroupKillSeconds.toFixed(1)}s (${model.boss.targets.groupComposition}) | ${model.boss.targets.modeledSoloKillSeconds.toFixed(1)}s | ${model.boss.rewardBudget.xpPerPlayerCap.toLocaleString("en-GB")} | ${model.boss.rewardBudget.goldPerPlayerCap[0].toLocaleString("en-GB")}–${model.boss.rewardBudget.goldPerPlayerCap[1].toLocaleString("en-GB")} | ≥${model.boss.rewardBudget.minimumDamagePctOfMaxHp}% HP damage | none |\n\n` +
    `The fixed pools are ${model.boss.rewardBudget.xpPool.toLocaleString("en-GB")} XP and ${model.boss.rewardBudget.goldPool[0].toLocaleString("en-GB")}–${model.boss.rewardBudget.goldPool[1].toLocaleString("en-GB")} gold. Eligible players receive a damage-proportional share subject to the per-player caps; capped remainder is not redistributed. This prevents one-hit alternate accounts or oversized groups from multiplying the reward budget.\n\n` +
    `Approval identifies this exact model hash. Any numeric edit creates a new hash and requires a new approval. The approval does not authorize production writes, merging to main, publishing, runtime activation, or Lovable-agent credit spending.\n`;

  const progression = csv(
    ["level", "xp_to_next", "cumulative_xp", "target_cumulative_hours", "target_minutes_per_level", "benchmark_combat_cycle_seconds", "benchmark_combat_xp_per_hour"],
    model.progression.map((row) => [row.level, row.xpToNext, row.cumulativeXpToLevel, row.targetCumulativeHours, row.targetMinutesPerLevel, row.benchmarkCombatCycleSeconds, row.benchmarkCombatXpPerHour]),
  );
  const tierCsv = csv(
    ["tier_index", "level_requirement", "theme", "new_monster_id", "monster_hp", "monster_attack", "monster_defense", "monster_xp", "gold_min", "gold_max", "weapon_attack", "heavy_defense", "light_defense", "light_attack", "light_speed", "food_heal", "food_npc_value", "potion_damage_boost", "potion_hits", "potion_npc_value", "monster_gold_per_hour", "raw_npc_floor", "node_npc_floor_per_hour", "bar_npc_floor", "recipe_npc_margin_per_hour", "weapon_npc_value", "armor_npc_value", "market_fee_pct", "weapon_upgrade_to_31", "weapon_upgrade_to_100", "armor_upgrade_to_31", "armor_upgrade_to_100", "weapon_plus31_reach_hours", "weapon_plus100_reach_hours", "armor_plus31_reach_hours", "armor_plus100_reach_hours"],
    model.tiers.map((tier) => [tier.tierIndex, tier.levelRequirement, tier.theme, tier.proposedNewMonsterId, tier.monster.hp, tier.monster.attack, tier.monster.defense, tier.monster.xp, tier.monster.goldMin, tier.monster.goldMax, tier.weaponAttack, tier.heavyDefense, tier.lightDefense, tier.lightAttack, tier.lightSpeed, tier.food.heal, tier.food.npcValue, tier.potion.damageBoost, tier.potion.boostHits, tier.potion.npcValue, tier.economy.monsterGoldPerHour, tier.economy.rawNpcFloor, tier.economy.nodeNpcFloorPerHour, tier.economy.barNpcFloor, tier.economy.recipeNpcMarginPerHour, tier.economy.weaponNpcValue, tier.economy.armorNpcValue, tier.economy.marketFeePct, tier.upgrades.weapon.cumulativeCostToPlus[31], tier.upgrades.weapon.cumulativeCostToPlus[100], tier.upgrades.armor.cumulativeCostToPlus[31], tier.upgrades.armor.cumulativeCostToPlus[100], tier.upgrades.reachabilityHoursAtMonsterGoldRate.weaponPlus31, tier.upgrades.reachabilityHoursAtMonsterGoldRate.weaponPlus100, tier.upgrades.reachabilityHoursAtMonsterGoldRate.armorPlus31, tier.upgrades.reachabilityHoursAtMonsterGoldRate.armorPlus100]),
  );
  const skillRewardsCsv = csv(
    ["tier_index", "level_requirement", "skill", "target_minutes_per_level", "effective_cycle_seconds", "target_actions_per_level", "xp_per_action", "modeled_minutes_per_level", "modeled_xp_per_hour"],
    model.tiers.flatMap((tier) => Object.entries(tier.skillRewards).map(([skill, reward]) => [tier.tierIndex, tier.levelRequirement, skill, tier.targetMinutesPerLevel, reward.effectiveCycleSeconds, reward.targetActionsPerLevel, reward.xpPerAction, reward.modeledMinutesPerLevel, reward.modeledXpPerHour])),
  );
  const cadenceCsv = csv(
    ["tier_index", "level_requirement", "skill", "action_seconds", "overhead_seconds", "effective_cycle_seconds", "proposed_respawn_seconds", "minimum_cluster_nodes_per_active_player"],
    model.tiers.flatMap((tier) => Object.entries(tier.activityCadence).map(([skill, cadence]) => [tier.tierIndex, tier.levelRequirement, skill, cadence.actionSeconds, cadence.overheadSeconds, cadence.effectiveCycleSeconds, cadence.proposedRespawnSeconds, cadence.minimumClusterNodesPerActivePlayer])),
  );
  const sensitivityCsv = csv(
    ["tier_index", "level_requirement", "scenario", "ttk_seconds", "ttd_seconds", "expected_damage_dealt", "expected_damage_taken", "attack_interval_seconds"],
    model.sensitivities.map((row) => [row.tierIndex, row.levelRequirement, row.scenario, row.ttkSeconds, row.ttdSeconds, row.expectedDamageDealt, row.expectedDamageTaken, row.attackIntervalSeconds]),
  );

  return new Map([
    ["docs/overhaul/gate-3/README.md", readme],
    ["docs/overhaul/gate-3/owner-approval-table.md", approval],
    ["docs/overhaul/gate-3/approval-record.json", JSON.stringify(OWNER_APPROVAL_RECORD, null, 2) + "\n"],
    ["docs/overhaul/gate-3/balance-model.proposed.json", JSON.stringify(model, null, 2) + "\n"],
    ["docs/overhaul/gate-3/progression.proposed.csv", progression],
    ["docs/overhaul/gate-3/tier-balance.proposed.csv", tierCsv],
    ["docs/overhaul/gate-3/skill-rewards.proposed.csv", skillRewardsCsv],
    ["docs/overhaul/gate-3/activity-cadence.proposed.csv", cadenceCsv],
    ["docs/overhaul/gate-3/sensitivities.proposed.csv", sensitivityCsv],
  ]);
}

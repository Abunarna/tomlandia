import assert from "node:assert/strict";
import { test } from "node:test";
import { OWNER_APPROVAL_RECORD, buildBalanceModel, legacyXpForLevel, validateBalance } from "../../scripts/gate3/model.mjs";

test("Gate 3 numeric proposal is deterministic and approval is hash-bound", () => {
  const first = buildBalanceModel();
  const second = buildBalanceModel();
  assert.equal(first.modelHash, second.modelHash);
  assert.deepEqual(first, second);
  assert.equal(first.approval.activationAllowed, false);
  assert.equal(first.approval.gate4Blocked, true);
  assert.equal(OWNER_APPROVAL_RECORD.status, "owner_approved");
  assert.equal(OWNER_APPROVAL_RECORD.approvedModelHash, first.modelHash);
  assert.equal(OWNER_APPROVAL_RECORD.gate4ImplementationAllowed, true);
  assert.equal(OWNER_APPROVAL_RECORD.runtimeActivationAllowed, false);
  assert.deepEqual(validateBalance(first), []);
});

test("legacy XP is exact through 50 and post-50 XP is monotone", () => {
  const model = buildBalanceModel();
  for (let level = 1; level <= 50; level += 1) {
    assert.equal(model.progression[level - 1].xpToNext, legacyXpForLevel(level));
  }
  for (let level = 51; level < 150; level += 1) {
    assert.ok(model.progression[level - 1].xpToNext > model.progression[level - 2].xpToNext);
  }
  assert.equal(model.progression[149].xpToNext, null);
  assert.ok(model.progression[149].cumulativeXpToLevel < Number.MAX_SAFE_INTEGER);
});

test("all 16 tiers obey Heavy, Light, food, potion and upgrade invariants", () => {
  const model = buildBalanceModel();
  assert.equal(model.tiers.length, 16);
  let previousFoodValue = 0;
  let previousPotionValue = 0;
  for (const tier of model.tiers) {
    assert.ok(tier.heavyDefense > tier.lightDefense);
    assert.ok(tier.combat.lightPlus0.ttkSeconds < tier.combat.heavyPlus0.ttkSeconds);
    assert.ok(tier.combat.lightPlus0.ttdSeconds < tier.combat.heavyPlus0.ttdSeconds);
    assert.ok(tier.food.maxHpPct >= 45);
    assert.ok(tier.potion.dpsIncreasePct >= 10);
    assert.ok(tier.potion.expectedKillsPerDose >= 2.5);
    assert.ok(tier.food.npcValue > previousFoodValue);
    assert.ok(tier.potion.npcValue > previousPotionValue);
    previousFoodValue = tier.food.npcValue;
    previousPotionValue = tier.potion.npcValue;
    assert.ok(tier.upgrades.weapon.cumulativeCostToPlus[100] > tier.upgrades.weapon.cumulativeCostToPlus[50]);
    assert.ok(tier.upgrades.reachabilityHoursAtMonsterGoldRate.weaponPlus100 >= 20);
    assert.ok(tier.upgrades.reachabilityHoursAtMonsterGoldRate.weaponPlus100 <= 80);
    assert.ok(tier.combat.heavyPlus31.ttdSeconds !== null);
    assert.ok(tier.upgrades.crossTier.weaponPlus31.tierIndex <= Math.min(16, tier.tierIndex + 5));
  }
  for (const check of model.migrationEffectiveStatChecks) {
    assert.ok(check.proposedEffective >= check.previousEffective, `${check.case} loses ${check.stat}`);
  }
});

test("required sensitivities and DESOLATUS group economics are present", () => {
  const model = buildBalanceModel();
  const scenarios = new Set(model.sensitivities.map((row) => row.scenario));
  for (const required of ["noGear", "heavyPlus0", "lightPlus0", "heavyPlus31", "lightPlus31", "light_plus0_with_food_and_potion"]) {
    assert.ok(scenarios.has(required), `missing ${required}`);
  }
  assert.match(model.observedLiveSensitivity.loadout, /Steel Sword \+31/);
  assert.equal(model.boss.targets.groupSize, 4);
  assert.ok(Math.abs(model.boss.targets.modeledGroupKillSeconds - 150) <= 2);
  assert.ok(model.boss.targets.modeledSoloKillSeconds >= model.boss.targets.soloKillSecondsBand[0]);
  assert.ok(model.boss.targets.modeledSoloKillSeconds <= model.boss.targets.soloKillSecondsBand[1]);
  assert.equal(model.boss.itemDrop, null);
  assert.equal(model.boss.rewardMode, "fixed_pool_proportional_damage_with_per_player_cap");
  assert.equal(model.boss.rewardBudget.minimumDamage, Math.ceil(model.boss.hp * 0.01));
  assert.equal(model.boss.rewardBudget.xpPool, model.boss.rewardBudget.xpPerPlayerCap * 4);
  assert.deepEqual(
    model.boss.rewardBudget.goldPool,
    model.boss.rewardBudget.goldPerPlayerCap.map((value) => value * 4),
  );
});

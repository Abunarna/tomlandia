import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OWNER_APPROVAL_RECORD, buildBalanceModel, renderArtifacts, validateBalance } from "./model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const model = buildBalanceModel();
const failures = validateBalance(model);

const core = { ...model };
delete core.modelHash;
const recomputedHash = createHash("sha256").update(JSON.stringify(core)).digest("hex");
if (recomputedHash !== model.modelHash) failures.push("model hash does not cover the complete deterministic core");

const registry = JSON.parse(read("docs/overhaul/gate-0/id-registry.json"));
const expectedPairs = model.tiers.map(({ tierIndex, levelRequirement, theme }) => ({
  tier_index: tierIndex,
  level_requirement: levelRequirement,
  theme,
}));
if (JSON.stringify(registry.tiers) !== JSON.stringify(expectedPairs)) {
  failures.push("Gate 3 tier pairs drifted from the locked Gate 0 registry");
}
const proposedMonsterIds = model.proposedNewMonsters.map(({ id }) => id);
if (JSON.stringify(registry.new_ids.monster_kinds) !== JSON.stringify(proposedMonsterIds)) {
  failures.push("Gate 3 monster IDs drifted from the locked Gate 0 registry");
}

const progressionSource = read("src/game/progression.ts");
if (!/Math\.floor\(100 \* Math\.pow\(1\.15, level\)\)/.test(progressionSource)) {
  failures.push("the audited legacy XP implementation changed; refresh Gate 3 evidence before proceeding");
}

const dataSource = read("src/game/data.ts");
const monsterPattern = /^\s{2}([a-z_]+): \{ name: "[^"]+", hp: (\d+), attack: (\d+), defense: (\d+), xp: (\d+), gold: \[(\d+), (\d+)\]/gm;
const liveMonsters = Object.fromEntries([...dataSource.matchAll(monsterPattern)].map((match) => [match[1], {
  hp: Number(match[2]),
  attack: Number(match[3]),
  defense: Number(match[4]),
  xp: Number(match[5]),
  goldMin: Number(match[6]),
  goldMax: Number(match[7]),
}]));
for (const anchor of model.legacyMonsterAnchors) {
  const live = liveMonsters[anchor.source];
  if (!live) {
    failures.push(`missing live monster anchor ${anchor.source}`);
    continue;
  }
  for (const field of ["hp", "attack", "defense", "xp", "goldMin", "goldMax"]) {
    if (live[field] !== anchor[field]) failures.push(`live anchor drift: ${anchor.source}.${field}`);
  }
}

for (const [relativePath, expected] of renderArtifacts(model)) {
  let actual;
  try {
    actual = read(relativePath);
  } catch {
    failures.push(`missing generated artifact ${relativePath}`);
    continue;
  }
  if (actual !== expected) failures.push(`stale generated artifact ${relativePath}`);
}

if (OWNER_APPROVAL_RECORD.status !== "owner_approved") failures.push("Gate 3 has no owner approval record");
if (OWNER_APPROVAL_RECORD.approvedModelHash !== model.modelHash) {
  failures.push("owner approval does not match the generated numeric model hash");
}
if (OWNER_APPROVAL_RECORD.gate4ImplementationAllowed !== true) failures.push("approval record does not release Gate 4");
for (const field of [
  "runtimeActivationAllowed",
  "productionDatabaseWritesAllowed",
  "mergeToMainAllowed",
  "publishingAllowed",
  "lovableAgentCreditSpendingAllowed",
]) {
  if (OWNER_APPROVAL_RECORD[field] !== false) failures.push(`approval record must keep ${field} false`);
}

for (const path of [
  "src/game/data.ts",
  "src/game/progression.ts",
  "supabase/migrations/20260823234700_gate2_world_actions.sql",
]) {
  if (read(path).includes(model.modelHash)) failures.push(`proposal hash must not activate runtime content in ${path}`);
}

if (failures.length) {
  console.error(`Gate 3 balance check failed:\n- ${[...new Set(failures)].join("\n- ")}`);
  process.exit(1);
}

console.log(
  `Gate 3 balance check passed: ${model.progression.length} levels, ${model.tiers.length} tiers, `
    + `${model.proposedNewMonsters.length} new-monster proposals, hash ${model.modelHash}.`,
);
console.log("Approval guard passed: the owner-approved hash releases Gate 4 only; runtime and production permissions remain false.");

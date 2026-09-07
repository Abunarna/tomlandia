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
// Monsters are prettier-formatted across multiple lines, so match the block and
// pull each numeric field out of it rather than assuming a single-line literal.
const monsterPattern = /^ {2}([a-z_]+): \{\s*\n\s*name: "[^"]+",([\s\S]*?)\n {2}\},/gm;
const num = (block, field) => {
  const m = new RegExp(`\\b${field}:\\s*(\\d+)`).exec(block);
  return m ? Number(m[1]) : undefined;
};
const liveMonsters = Object.fromEntries(
  [...dataSource.matchAll(monsterPattern)].map((match) => {
    const block = match[2];
    const gold = /\bgold:\s*\[(\d+),\s*(\d+)\]/.exec(block);
    return [
      match[1],
      {
        hp: num(block, "hp"),
        attack: num(block, "attack"),
        defense: num(block, "defense"),
        xp: num(block, "xp"),
        goldMin: gold ? Number(gold[1]) : undefined,
        goldMax: gold ? Number(gold[2]) : undefined,
      },
    ];
  }),
);

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

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBalanceModel, renderArtifacts, validateBalance } from "./model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const model = buildBalanceModel();
const failures = validateBalance(model);

if (failures.length) {
  console.error(`Gate 3 generation refused:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

for (const [relativePath, contents] of renderArtifacts(model)) {
  const path = resolve(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
  console.log(`wrote ${relativePath}`);
}

console.log(`Gate 3 proposal generated with model hash ${model.modelHash}`);

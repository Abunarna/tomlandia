import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateOutputs } from "./model.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv) {
  const args = {
    input: "content/v2/manifest.authoring.json",
    registry: "docs/overhaul/gate-0/id-registry.json",
    outRoot: ".",
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--input") args.input = argv[++index];
    else if (arg === "--registry") args.registry = argv[++index];
    else if (arg === "--out-root") args.outRoot = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

const args = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(repoRoot, args.input);
const registryPath = path.resolve(repoRoot, args.registry);
const outRoot = path.resolve(repoRoot, args.outRoot);
const manifest = await readJson(inputPath);
const registry = await readJson(registryPath);
const generated = generateOutputs(manifest, registry);
const drift = [];

for (const [relativePath, expected] of Object.entries(generated.files)) {
  const destination = path.resolve(outRoot, relativePath);
  if (!destination.startsWith(`${outRoot}${path.sep}`)) throw new Error(`Output escapes root: ${relativePath}`);
  if (args.check) {
    let actual = null;
    try {
      actual = await readFile(destination, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (actual !== expected) drift.push(relativePath);
  } else {
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, expected, "utf8");
  }
}

if (drift.length) {
  throw new Error(`Generated content drift detected:\n- ${drift.join("\n- ")}\nRun: node scripts/content/generate.mjs`);
}

console.log(`${args.check ? "Verified" : "Generated"} ${Object.keys(generated.files).length} content artifacts (${generated.hash})`);

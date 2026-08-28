import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { WORLD_SOURCE_FILE } from "../world-source/path.mjs";

const SOURCE = WORLD_SOURCE_FILE;
const OUTPUT = "docs/overhaul/gate-5/live-v1-snapshot.json";

function between(source, start, end) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`Missing snapshot marker: ${start}`);
  const bodyStart = from + start.length;
  const to = source.indexOf(end, bodyStart);
  if (to < 0) throw new Error(`Missing snapshot marker: ${end}`);
  return source.slice(bodyStart, to);
}

function evaluate(expression, label, bindings = {}) {
  try {
    const names = Object.keys(bindings);
    const values = Object.values(bindings);
    return Function(...names, `"use strict"; return (${expression});`)(...values);
  } catch (error) {
    throw new Error(`Could not parse ${label}: ${error.message}`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function lakeFishingSpots(specs) {
  let nextId = 0;
  const point = (spec, angle, scale) => {
    const localX = Math.cos(angle) * spec.rx * scale;
    const localY = Math.sin(angle) * spec.ry * scale;
    return {
      x: spec.cx + localX * Math.cos(spec.rot) - localY * Math.sin(spec.rot),
      y: spec.cy + localX * Math.sin(spec.rot) + localY * Math.cos(spec.rot),
    };
  };
  return specs.flatMap((spec) => spec.jettyAngles.map((angle) => ({
    id: ++nextId,
    lake: spec.key,
    ...point(spec, angle, 0.42),
  })));
}

export async function buildLiveSnapshot() {
  const source = await readFile(SOURCE, "utf8");
  const familyGroups = evaluate(
    `{${between(source, "const FAMILY_GROUPS: Record<string, string[]> = {", "\n};\n\nconst FAMILY_BY_ID")}}`,
    "FAMILY_GROUPS",
  );
  const familyById = Object.fromEntries(
    Object.entries(familyGroups).flatMap(([family, ids]) => ids.map((id) => [id, family])),
  );
  const def = (id, name, value, color, kind, extra = {}) => ({
    id,
    name,
    value,
    color,
    kind,
    family: kind === "weapon" ? "weapon" : kind === "armor" ? "armor" : (familyById[id] ?? "ore"),
    stackable: kind !== "weapon" && kind !== "armor",
    ...extra,
  });
  const items = evaluate(
    `[${between(source, "export const ITEMS: Record<string, ItemDef> = Object.fromEntries(\n  [", "\n  ].map((d) => [d.id, d]),")}]`,
    "ITEMS",
    { def },
  );
  const nodes = evaluate(
    `{${between(source, "export const NODE_DEFS: Record<NodeKind, NodeDefT> = {", "\n};\n\nexport interface NodeSpawn")}}`,
    "NODE_DEFS",
  );
  const monsters = evaluate(
    `{${between(source, "export const MONSTER_DEFS: Record<MonsterKind, MonsterDefT> = {", "\n};\n\n/** Approximate combat level")}}`,
    "MONSTER_DEFS",
  );
  const recipes = evaluate(
    `[${between(source, "export const RECIPES: Recipe[] = [", "\n];\n\n/* ------------------------------------------------------------------ */\n/* Equipment upgrading")}]`,
    "RECIPES",
  );
  const quests = evaluate(
    `[${between(source, "export const QUESTS: QuestDef[] = [", "\n];\n\n/* ------------------------------------------------------------------ */\n/* Merchant icons")}]`,
    "QUESTS",
  );
  const fish = evaluate(
    `[${between(source, "export const FISH_TABLE: FishTier[] = [", "\n];\n\n/** drop chance in % at level 1")}]`,
    "FISH_TABLE",
  );
  const lakeSpecs = evaluate(
    `[${between(source, "const LAKE_SPECS: LakeSpec[] = [", "\n];\n\n/** the same jittered-outline")}]`,
    "LAKE_SPECS",
  );

  return stable({
    snapshot_version: "tomlandia-v1-definition-snapshot/1",
    source_file: SOURCE,
    source_sha256: createHash("sha256").update(source).digest("hex"),
    captured_fields: {
      items,
      nodes,
      monsters,
      recipes,
      fish,
      fishing_spots: lakeFishingSpots(lakeSpecs),
      quests,
    },
  });
}

const expected = `${JSON.stringify(await buildLiveSnapshot(), null, 2)}\n`;
const check = process.argv.includes("--check");
if (check) {
  const current = await readFile(OUTPUT, "utf8").catch(() => "");
  if (current !== expected) {
    console.error(`Gate 5 live snapshot drift detected: ${OUTPUT}`);
    process.exitCode = 1;
  } else {
    console.log(`Verified ${OUTPUT}`);
  }
} else {
  await mkdir("docs/overhaul/gate-5", { recursive: true });
  await writeFile(OUTPUT, expected, "utf8");
  console.log(`Wrote ${OUTPUT}`);
}

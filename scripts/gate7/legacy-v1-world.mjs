import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const RESET_MIGRATION = "supabase/migrations/20260815110123_d1d67ca3-8ff2-4449-b1e6-08f167a47eb6.sql";
const SOUTHERN_EXTENSION_MIGRATION = "supabase/migrations/20260820065717_acd50da9-1a3b-4855-bd32-da89b5a1d9a9.sql";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function requireMatch(value, pattern, message) {
  const match = value.match(pattern);
  if (!match) throw new Error(message);
  return match[1];
}

function parseResetRows(sql, tableName) {
  if (!new RegExp(`delete\\s+from\\s+public\\.${tableName}\\s*;`, "i").test(sql)) {
    throw new Error(`Legacy v1 reset no longer clears ${tableName}`);
  }

  const values = requireMatch(
    sql,
    new RegExp(
      `insert\\s+into\\s+public\\.${tableName}\\s*\\([^)]*\\)\\s*` +
        `select[\\s\\S]*?from\\s*\\(values\\s*([\\s\\S]*?)\\)\\s*as\\s+v\\(id,kind`,
      "i",
    ),
    `Could not parse legacy v1 reset rows for ${tableName}`,
  );

  return [...values.matchAll(/\((\d+),'([^']+)'(?:,[^()]*)\)/g)].map((match) => ({
    id: Number(match[1]),
    kind: match[2],
  }));
}

function parseSouthernExtensionRows(sql, tableName) {
  const values = requireMatch(
    sql,
    new RegExp(
      `insert\\s+into\\s+public\\.${tableName}\\s*\\([^)]*\\)\\s*values\\s*` +
        `([\\s\\S]*?)\\s*on\\s+conflict\\s*\\(id\\)\\s*do\\s+nothing\\s*;`,
      "i",
    ),
    `Could not parse southern extension rows for ${tableName}`,
  );

  return [...values.matchAll(/\((\d+),'[^']*','([^']+)'(?:,[^()]*)\)/g)].map((match) => ({
    id: Number(match[1]),
    kind: match[2],
  }));
}

function applyInsertRows(resetRows, extensionRows, tableName) {
  const rows = new Map();
  for (const row of resetRows) {
    if (rows.has(row.id)) throw new Error(`Duplicate ${tableName} id ${row.id} in legacy v1 reset`);
    rows.set(row.id, row);
  }
  for (const row of extensionRows) {
    if (!rows.has(row.id)) rows.set(row.id, row);
  }
  return [...rows.values()].sort((left, right) => left.id - right.id);
}

export async function auditLegacyV1World(root) {
  const [resetSql, southernSql] = await Promise.all([
    readFile(resolve(root, RESET_MIGRATION), "utf8"),
    readFile(resolve(root, SOUTHERN_EXTENSION_MIGRATION), "utf8"),
  ]);

  const nodes = applyInsertRows(
    parseResetRows(resetSql, "world_nodes"),
    parseSouthernExtensionRows(southernSql, "world_nodes"),
    "world_nodes",
  );
  const monsters = applyInsertRows(
    parseResetRows(resetSql, "world_monsters"),
    parseSouthernExtensionRows(southernSql, "world_monsters"),
    "world_monsters",
  );

  return {
    node_count: nodes.length,
    monster_count: monsters.length,
    tungsten_node_count: nodes.filter((row) => row.kind === "tungsten").length,
    reset_migration: RESET_MIGRATION,
    reset_migration_hash: sha256(resetSql),
    southern_extension_migration: SOUTHERN_EXTENSION_MIGRATION,
    southern_extension_migration_hash: sha256(southernSql),
  };
}

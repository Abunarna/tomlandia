/**
 * Static V3 release checks: identity, count freeze, hash consistency across
 * every artifact that ships, and rollback readiness of the v2 artifacts.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => readFile(resolve(root, relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await read(relativePath));

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const [v2Content, v2World, v3Content, v3World, report, reachability] = await Promise.all([
  readJson("content/v2/manifest.authoring.json"),
  readJson("content/v2/world-spawn-manifest.json"),
  readJson("content/v3/manifest.authoring.json"),
  readJson("content/v3/world-spawn-manifest.json"),
  readJson("docs/overhaul/v3/world-change-report.json"),
  readJson("docs/overhaul/v3/reachability-report.json"),
]);
const [clientManifest, clientWorld, contentSql, stageContent, stageWorld, activate, v2Sql] = await Promise.all([
  read("src/generated/content-manifest.ts"),
  read("src/generated/world-manifest.ts"),
  read("supabase/generated/content-manifest.sql"),
  read("supabase/migrations/20260828120000_v3_stage_content.sql"),
  read("supabase/migrations/20260828120100_v3_stage_world.sql"),
  read("supabase/migrations/20260828120200_v3_activate.sql"),
  read("artifacts/v2/supabase/generated/content-manifest.sql"),
]);

// --- identity ---------------------------------------------------------------
expect(v3Content.content_version === "v3" && v3Content.spawn_set_version === "v3", "v3 manifest is not versioned v3");
expect(v3World.content_version === "v3" && v3World.spawn_set_version === "v3", "v3 world manifest is not versioned v3");
expect(v3World.derived_from.spawn_hash === v2World.spawn_hash, "v3 is not derived from the reconciled live v2 spawn set");

// --- gameplay content is unchanged from v2 ----------------------------------
const gameplayKeys = ["bosses", "fish", "fishing_spots", "items", "mechanics", "migration_rules", "monsters", "nodes", "quests", "recipes", "starter_loadout", "player_notice"];
for (const key of gameplayKeys) {
  expect(
    JSON.stringify(v3Content.runtime[key]) === JSON.stringify(v2Content.runtime[key]),
    `v3 changed gameplay content: runtime.${key}`,
  );
}
expect(JSON.stringify(v3Content.tiers) === JSON.stringify(v2Content.tiers), "v3 changed the tier registry");
expect(v3Content.uuid_namespace === v2Content.uuid_namespace, "v3 changed the UUID namespace");

// --- spawn counts are frozen -------------------------------------------------
expect(v3World.counts.nodes === v2World.counts.nodes, `node count drifted: ${v3World.counts.nodes} vs ${v2World.counts.nodes}`);
expect(v3World.counts.monsters === v2World.counts.monsters, `monster count drifted: ${v3World.counts.monsters} vs ${v2World.counts.monsters}`);
expect(v3World.spawns.length === v2World.spawns.length, "v3 added or removed spawns");

const identity = (spawn) => `${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`;
const v2ById = new Map(v2World.spawns.map((spawn) => [identity(spawn), spawn]));
let moved = 0;
for (const spawn of v3World.spawns) {
  const previous = v2ById.get(identity(spawn));
  if (!previous) {
    failures.push(`v3 introduced an unknown spawn identity: ${identity(spawn)}`);
    continue;
  }
  expect(previous.biome === spawn.biome, `${identity(spawn)} changed biome`);
  expect(previous.subzone === spawn.subzone, `${identity(spawn)} changed subzone`);
  expect(previous.active === spawn.active, `${identity(spawn)} changed active flag`);
  if (previous.x !== spawn.x || previous.y !== spawn.y) moved += 1;
}
expect(v2ById.size === v3World.spawns.length, "v3 dropped a v2 spawn identity");
expect(moved === v3World.relocation.relocated_rows, "relocation count does not match the moved rows");
expect(moved === report.relocated_rows, "world change report disagrees with the spawn set");

// --- hash consistency across shipped artifacts ------------------------------
const contentHash = v3World.source_content_manifest_hash;
const spawnHash = v3World.spawn_hash;
expect(clientManifest.includes(`CONTENT_MANIFEST_HASH = "${contentHash}"`), "client manifest hash mismatch");
expect(clientManifest.includes('CONTENT_VERSION = "v3"'), "client is not pinned to v3 content");
expect(clientWorld.includes(`WORLD_SPAWN_HASH = "${spawnHash}"`), "client world spawn hash mismatch");
expect(clientWorld.includes('SPAWN_SET_VERSION = "v3"'), "client is not pinned to the v3 spawn set");
expect(contentSql.includes(`Manifest SHA-256: ${contentHash}`), "generated SQL hash mismatch");
expect(reachability.spawn_hash === spawnHash, "reachability report hash mismatch");
expect(
  !reachability.summary.spawn_issues && !reachability.summary.unreachable_clusters && !reachability.summary.failed_tiers,
  "v3 reachability report is not clean",
);
expect(report.content_manifest_hash === contentHash && report.spawn_hash === spawnHash, "change report hash mismatch");

// --- migrations are forward-only and non-destructive ------------------------
for (const [name, sql] of [["stage content", stageContent], ["stage world", stageWorld], ["activate", activate]]) {
  expect(sql.startsWith("--") && sql.includes("BEGIN;") && sql.trimEnd().endsWith("COMMIT;"), `${name} migration is not a single transaction`);
  expect(!/\bDROP\s+(TABLE|SCHEMA|FUNCTION)\b/i.test(sql), `${name} migration drops objects`);
  // Only v3 rows may ever be removed, and only by their own idempotent re-stage.
  for (const statement of sql.match(/DELETE\s+FROM[^;]*;/gi) ?? []) {
    expect(/content_version\s*=\s*(?:'v3'|%L', target, 'v3')/i.test(statement), `${name} migration deletes rows outside v3: ${statement.split("\n")[0]}`);
  }
  // Reading v2 rows is the whole point (v3 content is a copy); writing them is not,
  // apart from retiring the v2 marker on activation, which keeps every v2 row.
  for (const statement of sql.match(/UPDATE\s+[^;]*;/gi) ?? []) {
    if (!/'v[12]'/.test(statement)) continue;
    expect(
      /SET status = 'retired'/.test(statement),
      `${name} migration writes to v1/v2 rows: ${statement.split("\n")[0]}`,
    );
  }
  expect(!/\b(player_saves|market_listings|player_bank|bank_items)\b/i.test(sql), `${name} migration touches player data`);
}
expect(stageContent.includes("status = 'staged'") || stageContent.includes("'staged'"), "content staging must insert staged rows");
expect(activate.includes("game_validate_content_version('v3')"), "activation must validate v3 before flipping");
expect(activate.includes("rollback"), "activation must document rollback");
expect(!/DELETE\s+FROM[^;]*'v2'/i.test(activate), "activation must not delete v2 rollback data");
expect(/status = 'retired'[\s\S]{0,120}content_version = 'v2'/.test(activate), "activation must retire v2 rather than drop it");
expect(stageWorld.includes(`'${spawnHash}'`), "world staging does not carry the v3 spawn hash");

// --- rollback readiness ------------------------------------------------------
expect(v2Sql.includes(`Manifest SHA-256: ${v2World.source_content_manifest_hash}`), "preserved v2 artifacts drifted");
expect(v2World.spawn_hash === "24130e8725da5f6e339d5037a40e81f5bcc1052a47fc29b056b36b8d8b2d31fa", "v2 rollback spawn hash changed");
expect(
  v2World.source_content_manifest_hash === "8b2b3877e7ae3e7f5202ddfbf703c9f29ccd663d36baf38e5ed4c56352f76ee9",
  "v2 rollback content hash changed",
);

if (failures.length) {
  throw new Error(`V3 release checks failed:\n- ${failures.join("\n- ")}`);
}
console.log(
  `V3 release checks passed: ${v3World.counts.nodes} nodes, ${v3World.counts.monsters} monsters, ` +
  `${moved} relocated, content ${contentHash.slice(0, 8)}, spawns ${spawnHash.slice(0, 8)}.`,
);

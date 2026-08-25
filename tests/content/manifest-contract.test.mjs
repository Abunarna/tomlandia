import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  assertKnownId,
  generateOutputs,
  generateRuntimeOutputs,
  ManifestValidationError,
  UnknownContentIdError,
  uuidV5,
  validateManifest,
} from "../../scripts/content/model.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const registry = await readJson("docs/overhaul/gate-0/id-registry.json");
const canonical = await readJson("content/v2/manifest.authoring.json");
const valid = await readJson("tests/content/fixtures/gate4-valid-runtime.json");
const draft = {
  schema_version: "tomlandia-content-manifest/v1",
  content_version: "v2_draft_contract_test",
  lifecycle: "draft",
  spawn_set_version: "v2_draft_contract_test",
  uuid_namespace: "bf50882c-ad8a-57ab-bb73-3ea3dd8fcb5c",
  tier_registry_version: registry.registry_version,
  tiers: structuredClone(registry.tiers),
  id_inventory: {
    in_place_ids: structuredClone(registry.in_place_ids),
    retired_ids: structuredClone(registry.retired_ids),
    new_ids: structuredClone(registry.new_ids),
    sprite_kinds: structuredClone(registry.sprite_kinds),
  },
};

const clone = (value) => structuredClone(value);

function expectInvalid(manifest, pattern) {
  assert.throws(
    () => validateManifest(manifest, registry),
    (error) => error instanceof ManifestValidationError && pattern.test(error.message),
  );
}

test("canonical Gate 5 manifest is complete, runnable and stages without activation", () => {
  const result = validateManifest(canonical, registry);
  assert.equal(result.lifecycle, "runtime");
  assert.match(result.hash, /^[0-9a-f]{64}$/);
  const generated = generateRuntimeOutputs(canonical, registry);
  assert.match(generated.files["supabase/generated/content-manifest.sql"], /status = 'staged'/);
  assert.doesNotMatch(generated.files["supabase/generated/content-manifest.sql"], /VALUES \([^\n]*'active'/);
  assert.match(generated.files["src/generated/content-manifest.ts"], /CONTENT_RUNNABLE = true/);
  assert.doesNotMatch(generated.files["src/generated/content-manifest.ts"], /^\+/m);
});

test("complete runtime fixture generates byte-identical artifacts", () => {
  const first = generateRuntimeOutputs(valid, registry);
  const second = generateRuntimeOutputs(clone(valid), registry);
  assert.deepEqual(second, first);
  assert.match(first.hash, /^[0-9a-f]{64}$/);
  for (const output of Object.values(first.files)) assert.match(output, new RegExp(first.hash));
  assert.match(first.files["src/generated/content-manifest.ts"], /CONTENT_RUNNABLE = true/);
  assert.doesNotMatch(first.files["src/generated/content-manifest.ts"], /^\+/m);
  assert.match(first.files["supabase/generated/content-manifest.sql"], /status = 'staged'/);
  assert.doesNotMatch(first.files["supabase/generated/content-manifest.sql"], /VALUES \([^\n]*'active'/);
});

test("checked-in output verification detects a manual edit", async () => {
  const outRoot = await mkdtemp(path.join(tmpdir(), "tomlandia-gate4-drift-"));
  try {
    const generated = generateOutputs(canonical, registry);
    for (const [relativePath, content] of Object.entries(generated.files)) {
      const destination = path.join(outRoot, relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, content, "utf8");
    }
    await writeFile(
      path.join(outRoot, "src/generated/content-manifest.ts"),
      `${generated.files["src/generated/content-manifest.ts"]}\n// manual edit\n`,
      "utf8",
    );
    const result = spawnSync(
      process.execPath,
      ["scripts/content/generate.mjs", "--check", "--out-root", outRoot],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Generated content drift detected/);
    assert.match(result.stderr, /src\/generated\/content-manifest\.ts/);
  } finally {
    await rm(outRoot, { recursive: true, force: true });
  }
});

test("spawn IDs are deterministic RFC 4122 UUIDv5 values", () => {
  const namespace = "bf50882c-ad8a-57ab-bb73-3ea3dd8fcb5c";
  assert.equal(
    uuidV5(namespace, "gate4_test_spawns_v1:node:copper_rock:0"),
    "23f4f507-571e-5d66-88c5-cf96b740fb50",
  );
  assert.equal(
    uuidV5(namespace, "gate4_test_spawns_v1:monster:goblin:0"),
    "dd069d6c-9024-5afe-b5e6-b78956d0dda1",
  );
});

test("unknown IDs fail visibly instead of substituting a fallback", () => {
  assert.equal(assertKnownId("item", ["copper_ore"], "copper_ore"), "copper_ore");
  assert.throws(
    () => assertKnownId("item", ["copper_ore"], "definitely_not_an_item"),
    (error) => error instanceof UnknownContentIdError && error.message === "Unknown item ID: definitely_not_an_item",
  );
});

test("runtime validation rejects null required values", () => {
  const broken = clone(valid);
  broken.runtime.items[0].stats.attack = null;
  expectInvalid(broken, /runtime manifests may not contain null/);
});

test("runtime validation rejects placeholder text", () => {
  const broken = clone(valid);
  broken.runtime.items[0].name = "TBD";
  expectInvalid(broken, /runtime placeholder text is forbidden/);
});

test("runtime validation rejects duplicate IDs", () => {
  const broken = clone(valid);
  broken.runtime.items.push(clone(broken.runtime.items[0]));
  expectInvalid(broken, /duplicates .*copper_ore/);
});

test("runtime validation rejects dangling references", () => {
  const broken = clone(valid);
  broken.runtime.recipes[0].inputs[0].item_id = "missing_ore";
  expectInvalid(broken, /dangling item reference: missing_ore/);
});

test("runtime validation rejects inactive references", () => {
  const broken = clone(valid);
  broken.runtime.items[0].active = false;
  expectInvalid(broken, /references inactive item: copper_ore/);
});

test("runtime validation rejects mismatched tier index and gameplay level", () => {
  const broken = clone(valid);
  broken.runtime.items[0].tier_index = 10;
  expectInvalid(broken, /must be tier 1 for level_requirement 1/);
});

test("runtime validation accepts an intermediate requirement in its locked tier band", () => {
  const intermediate = clone(valid);
  intermediate.runtime.items[0].level_requirement = 9;
  assert.equal(validateManifest(intermediate, registry).lifecycle, "runtime");
});

test("runtime validation rejects fish distributions that do not sum to one", () => {
  const broken = clone(valid);
  broken.runtime.fish[0].weights[1].weight = 0.9;
  expectInvalid(broken, /weights at level 150 must sum to 1/);
});

test("runtime validation rejects sprite geometry outside its padded canvas", () => {
  const broken = clone(valid);
  broken.runtime.monsters[0].visual.click_bounds.right = 999;
  expectInvalid(broken, /click_bounds\.right: must be between 0 and 108/);
});

test("runtime validation rejects a renamed locked tier", () => {
  const broken = clone(valid);
  broken.tiers[9].theme = "Tier Ten";
  expectInvalid(broken, /theme: does not match locked tier_index 10/);
});

test("runtime validation enforces canonical recipe IDs and stations", () => {
  const broken = clone(valid);
  broken.runtime.recipes[0].id = "copper_bar";
  expectInvalid(broken, /must follow \{station\}_\{output_id\}: smelt_copper_bar/);
});

test("runtime validation rejects duplicate spawn identities", () => {
  const broken = clone(valid);
  broken.runtime.node_spawns.push(clone(broken.runtime.node_spawns[0]));
  expectInvalid(broken, /duplicate spawn identity: node:copper_rock:0/);
});

test("runtime validation rejects invalid numeric ranges", () => {
  const broken = clone(valid);
  broken.runtime.items[2].stats.speed = 0.5;
  expectInvalid(broken, /stats\.speed: must be between 0 and 0\.25/);
});

test("draft ID inventory cannot drift from Gate 0", () => {
  const broken = clone(draft);
  broken.id_inventory.retired_ids.pop();
  expectInvalid(broken, /must exactly match the locked Gate 0 ID registry/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const manifest = await readFile(new URL("../../src/generated/content-manifest.ts", import.meta.url), "utf8");
const version = manifest.match(/CONTENT_VERSION = "([^"]+)"/)?.[1];
const hash = manifest.match(/CONTENT_MANIFEST_HASH = "([^"]+)"/)?.[1];
const runtime = await readFile(new URL("../../src/game/world-runtime.ts", import.meta.url), "utf8");

test("Gate 8 world runtime keeps v1 safe and gates UUID V2 on version plus locked spawn hash", () => {
  assert.equal(version, "v2");
  assert.match(hash ?? "", /^[a-f0-9]{64}$/);
  assert.match(runtime, /legacy_integer_v1/);
  assert.match(runtime, /V2_WORLD_SPAWN_HASH/);
  assert.match(runtime, /supportsUuidV2 = false/);
  assert.match(runtime, /mode: "maintenance"/);
  assert.match(runtime, /mode: "uuid_v2"/);
});

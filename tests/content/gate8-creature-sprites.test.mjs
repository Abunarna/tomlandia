import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const metadataPath = new URL("../../content/v2/sprite-metadata.json", import.meta.url);
const generatedPath = new URL("../../src/generated/creature-sprites.ts", import.meta.url);
const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
const generated = await readFile(generatedPath, "utf8");

test("Gate 8 creature registry is complete, canonical, and asset-backed", async () => {
  assert.equal(metadata.sprites.length, 32);
  assert.equal(new Set(metadata.sprites.map((sprite) => sprite.kind)).size, 32);
  assert.match(generated, /preloadCreatureSprites/);
  assert.match(generated, /creaturePointerHit/);
  assert.match(generated, /drawCreatureSprite/);
  for (const sprite of metadata.sprites) {
    assert.match(sprite.kind, /^[a-z][a-z0-9_]*$/);
    assert.match(generated, new RegExp(`"kind": "${sprite.kind}"`));
    assert.ok(sprite.click_bounds.left < sprite.click_bounds.right);
    assert.ok(sprite.click_bounds.top < sprite.click_bounds.bottom);
    await access(new URL(`../../public/${sprite.asset_path}`, import.meta.url), constants.R_OK);
  }
});

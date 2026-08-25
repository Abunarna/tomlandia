import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const market = await readFile(new URL("../../src/game/market.ts", import.meta.url), "utf8");
const manifest = await readFile(new URL("../../src/generated/content-manifest.ts", import.meta.url), "utf8");

test("Gate 8 market suggestion curve covers all generated tiers", () => {
  const tiers = [...manifest.matchAll(/"tier_index": (\d+)/g)].map((match) => Number(match[1]));
  const highestTier = Math.max(...tiers);
  assert.equal(highestTier, 16);
  for (let tier = 1; tier <= highestTier; tier++) {
    assert.match(market, new RegExp(`\\b${tier}:`));
  }
  assert.match(market, /5: 30/); // existing v1 curve remains stable
  assert.match(market, /16: 67_200/);
});

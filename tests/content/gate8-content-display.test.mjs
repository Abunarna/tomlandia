import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const display = await readFile(new URL("../../src/game/content-display.ts", import.meta.url), "utf8");
const catalog = await readFile(new URL("../../src/generated/content-catalog.ts", import.meta.url), "utf8");
const market = await readFile(new URL("../../src/game/market.ts", import.meta.url), "utf8");
const inventoryTool = await readFile(new URL("../../src/lib/mcp/tools/list-inventory.ts", import.meta.url), "utf8");
const marketTool = await readFile(new URL("../../src/lib/mcp/tools/browse-market.ts", import.meta.url), "utf8");

test("Gate 8 surfaces generated and unknown IDs without legacy substitution", () => {
  assert.match(display, /status: "generated"/);
  assert.match(display, /V2_ITEM_BY_ID/);
  assert.match(catalog, /"name": "Bronze Dagger"/);
  assert.match(catalog, /"name": "Ancient Frost Wyrm"/);
  assert.match(display, /status: "unknown"/);
  assert.match(display, /\[unknown content: \$\{id\}\]/);
  assert.match(market, /displayContentItem/);
  assert.match(inventoryTool, /contentStatus: display.status/);
  assert.match(marketTool, /contentStatus: display.status/);
});

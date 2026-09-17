import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { inspectJpeg, inspectPng } from "../../scripts/avatar/png-inspection.mjs";

describe("style-reference PNG inspection", () => {
  test("measures checked-in RGBA geometry proofs", async () => {
    const bytes = await readFile("public/assets/avatar/reference/body-skin-male.png");
    const result = inspectPng(bytes);
    expect(result.width).toBe(384);
    expect(result.height).toBe(384);
    expect(result.colorType).toBe(6);
    expect(result.hasAlpha).toBe(true);
    expect(result.visiblePixels).toBeGreaterThan(0);
    expect(result.transparentPixels).toBeGreaterThan(0);
    expect(result.visibleBounds).not.toBeNull();
  });

  test("rejects transformed non-PNG input", () => {
    expect(() => inspectPng(Buffer.from("not a png"))).toThrow("signature missing");
  });

  test("measures lossless JPEG style references without requiring alpha", async () => {
    const bytes = await readFile("public/assets/avatar/style-references/image_1.jpg");
    const result = inspectJpeg(bytes);
    expect(result.width).toBe(110);
    expect(result.height).toBe(158);
    expect(result.hasAlpha).toBe(false);
  });
});

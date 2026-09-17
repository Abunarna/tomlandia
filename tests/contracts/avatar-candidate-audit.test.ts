import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  auditAvatarCandidateFiles,
  avatarUrlToPublicPath,
  inspectCandidatePngHeader,
} from "../../src/game/avatar-candidate-audit";
import { referenceAvatarManifest } from "../../src/game/avatar-reference-manifest";

describe("offline avatar candidate file audit", () => {
  test("validates every deduplicated reference file as a candidate-pack fixture", async () => {
    const issues = await auditAvatarCandidateFiles(referenceAvatarManifest, (url) =>
      readFile(avatarUrlToPublicPath(url)),
    );
    expect(issues).toEqual([]);
  });

  test("reports missing files without stopping the remaining audit", async () => {
    const issues = await auditAvatarCandidateFiles(referenceAvatarManifest, async (url) => {
      if (url.endsWith("body-skin-male.png")) throw new Error("fixture missing");
      return readFile(avatarUrlToPublicPath(url));
    });
    expect(issues).toContainEqual({
      field: "/assets/avatar/reference/body-skin-male.png",
      message: "Could not read asset: fixture missing",
    });
  });

  test("rejects unsafe paths and invalid PNG headers", () => {
    expect(() => avatarUrlToPublicPath("https://example.com/asset.png")).toThrow("Unsafe");
    expect(inspectCandidatePngHeader(new Uint8Array([1, 2, 3]))).toEqual([
      { field: "signature", message: "Asset is not a valid PNG file." },
    ]);
  });
});

import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import report from "../../public/assets/avatar/candidate-v1/review/normalization-report.json";
import neutralReport from "../../public/assets/avatar/candidate-v1/review/face-neutral-normalization-report.json";
import femaleSkinReport from "../../public/assets/avatar/candidate-v1/review/female-skin-normalization-report.json";
import maleSkinReport from "../../public/assets/avatar/candidate-v1/review/male-skin-normalization-report.json";
import correctedMaleSkinReport from "../../public/assets/avatar/candidate-v1/review/male-skin-corrected-normalization-report.json";
import correctedMaleSkinV2Report from "../../public/assets/avatar/candidate-v1/review/male-skin-corrected-v2-normalization-report.json";
import femaleFaceOneReport from "../../public/assets/avatar/candidate-v1/review/face-female-01-warm-report.json";
import registeredFemaleFaceOneReport from "../../public/assets/avatar/candidate-v1/review/face-female-01-warm-registered-report.json";
import fittedFemaleFacesReport from "../../public/assets/avatar/candidate-v1/review/female-fitted-faces-report.json";
import fittedMaleFacesReport from "../../public/assets/avatar/candidate-v1/review/male-fitted-faces-report.json";
import adventurerCropReport from "../../public/assets/avatar/candidate-v1/review/hair-01-adventurer-crop-report.json";
import rangerLayersReport from "../../public/assets/avatar/candidate-v1/review/hair-02-ranger-layers-report.json";
import wayfarerTailReport from "../../public/assets/avatar/candidate-v1/review/hair-03-wayfarer-tail-report.json";
import wardenTopknotReport from "../../public/assets/avatar/candidate-v1/review/hair-04-warden-topknot-report.json";
import scholarSweepReport from "../../public/assets/avatar/candidate-v1/review/hair-05-scholar-sweep-report.json";
import nomadBraidsReport from "../../public/assets/avatar/candidate-v1/review/hair-06-nomad-braids-report.json";
import vanguardCoilsReport from "../../public/assets/avatar/candidate-v1/review/hair-07-vanguard-coils-report.json";
import seafarerWavesReport from "../../public/assets/avatar/candidate-v1/review/hair-08-seafarer-waves-report.json";
import sentinelUndercutReport from "../../public/assets/avatar/candidate-v1/review/hair-09-sentinel-undercut-report.json";
import artisanBobReport from "../../public/assets/avatar/candidate-v1/review/hair-10-artisan-bob-report.json";
import { inspectPng } from "../../scripts/avatar/png-inspection.mjs";

describe("normalized body candidates", () => {
  test("preserves one shared registration without claiming production status", async () => {
    expect(report.registration).toEqual({ width: 384, height: 384, pivotX: 192, footY: 300 });
    expect(report.results.map(({ model }) => model)).toEqual(["female", "male"]);
    for (const candidate of report.results) {
      expect(candidate.status).toBe("review-only");
      expect(candidate.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(candidate.outputSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(candidate.targetBounds.minY).toBe(63);
      expect(candidate.targetBounds.maxY).toBe(300);
      expect(candidate.blockers).toHaveLength(3);
      const image = inspectPng(await readFile(candidate.output));
      expect(image.width).toBe(384);
      expect(image.height).toBe(384);
      expect(image.colorType).toBe(6);
      expect(image.transparentPixels).toBeGreaterThan(0);
      expect(image.visiblePixels).toBeGreaterThan(0);
    }
  });

  test("keeps face-neutral revisions registered and measures silhouette drift", async () => {
    expect(neutralReport.variant).toBe("face-neutral");
    for (const candidate of neutralReport.results) {
      expect(candidate.targetBounds.minY).toBe(63);
      expect(candidate.targetBounds.maxY).toBe(300);
      expect(candidate.silhouetteComparison.whole.intersectionOverUnion).toBeGreaterThan(0.98);
      expect(candidate.blockers).not.toContain("face is baked into body source");
      expect(candidate.blockers).toContain("skin and modesty clothing are not separate layers");
      const image = inspectPng(await readFile(candidate.output));
      expect(image.colorType).toBe(6);
      expect(image.hasAlpha).toBe(true);
    }
  });

  test("accepts the registered female grayscale skin candidate", async () => {
    const [candidate] = femaleSkinReport.results;
    expect(candidate.model).toBe("female");
    expect(candidate.targetBounds).toEqual({ minX: 140, minY: 63, maxX: 244, maxY: 300 });
    expect(candidate.silhouetteComparison.whole.intersectionOverUnion).toBeGreaterThan(0.99);
    expect(candidate.silhouetteComparison.head.intersectionOverUnion).toBeGreaterThan(0.99);
    expect(candidate.silhouetteComparison.hands.intersectionOverUnion).toBeGreaterThan(0.99);
    expect(candidate.silhouetteComparison.feet.intersectionOverUnion).toBeGreaterThan(0.98);
    expect(candidate.grayscale.colouredFraction).toBeLessThan(0.01);
    const image = inspectPng(await readFile(candidate.output));
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("rejects the male skin candidate when its hand silhouette drifts", async () => {
    const [candidate] = maleSkinReport.results;
    expect(candidate.model).toBe("male");
    expect(candidate.status).toBe("rejected");
    expect(candidate.targetBounds).toEqual({ minX: 137, minY: 63, maxX: 247, maxY: 300 });
    expect(candidate.silhouetteComparison.whole.intersectionOverUnion).toBeLessThan(0.99);
    expect(candidate.silhouetteComparison.head.intersectionOverUnion).toBeGreaterThan(0.99);
    expect(candidate.silhouetteComparison.hands.intersectionOverUnion).toBeLessThan(0.99);
    expect(candidate.silhouetteComparison.feet.intersectionOverUnion).toBeGreaterThan(0.98);
    expect(candidate.grayscale.colouredFraction).toBe(0);
    const image = inspectPng(await readFile(candidate.output));
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("rejects the corrected male skin candidate while whole and hand regions still drift", async () => {
    const [candidate] = correctedMaleSkinReport.results;
    expect(candidate.model).toBe("male");
    expect(candidate.status).toBe("rejected");
    expect(candidate.targetBounds).toEqual({ minX: 137, minY: 63, maxX: 247, maxY: 300 });
    expect(candidate.targetCenterX).toBe(192);
    expect(candidate.centerDeltaFromPivot).toBe(0);
    expect(candidate.silhouetteComparison.whole.intersectionOverUnion).toBeLessThan(0.99);
    expect(candidate.silhouetteComparison.head.intersectionOverUnion).toBeGreaterThan(0.99);
    expect(candidate.silhouetteComparison.hands.intersectionOverUnion).toBeLessThan(0.99);
    expect(candidate.silhouetteComparison.feet.intersectionOverUnion).toBeLessThan(0.98);
    expect(candidate.blockers).toContain(
      "hand-region silhouette changed beyond the acceptance threshold",
    );
    expect(candidate.grayscale.colouredFraction).toBe(0);
    const image = inspectPng(await readFile(candidate.output));
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("rejects corrected male skin v2 when every protected region regresses", async () => {
    const [candidate] = correctedMaleSkinV2Report.results;
    expect(candidate.status).toBe("rejected");
    expect(candidate.targetCenterX).toBe(192);
    expect(candidate.centerDeltaFromPivot).toBe(0);
    for (const region of ["whole", "head", "hands", "feet"]) {
      const threshold = region === "feet" ? 0.98 : 0.99;
      expect(candidate.silhouetteComparison[region].intersectionOverUnion).toBeLessThan(threshold);
    }
    expect(candidate.grayscale.colouredFraction).toBe(0);
    const image = inspectPng(await readFile(candidate.output));
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("rejects a face candidate placed outside the registered head region", async () => {
    expect(femaleFaceOneReport.status).toBe("rejected");
    expect(femaleFaceOneReport.visibleBounds).toEqual({
      minX: 162,
      minY: 128,
      maxX: 223,
      maxY: 178,
    });
    expect(femaleFaceOneReport.visiblePixels).toBeGreaterThan(0);
    expect(femaleFaceOneReport.pixelsOutsideFaceBoundary).toBeGreaterThan(0);
    const image = inspectPng(await readFile(femaleFaceOneReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("rejects a registered face edit that redraws the body", async () => {
    expect(registeredFemaleFaceOneReport.status).toBe("rejected");
    expect(registeredFemaleFaceOneReport.silhouetteComparison.intersectionOverUnion).toBeLessThan(
      0.99,
    );
    expect(registeredFemaleFaceOneReport.changedPixelsOutsideFaceBoundary).toBeGreaterThan(0);
    expect(registeredFemaleFaceOneReport.blockers).toContain(
      "the authoritative body and clothing were redrawn outside the face boundary",
    );
    const image = inspectPng(await readFile(registeredFemaleFaceOneReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("fits isolated female faces into one canonical face box", async () => {
    expect(fittedFemaleFacesReport.fitBox).toEqual({
      centerX: 192,
      centerY: 94,
      maxWidth: 32,
      maxHeight: 28,
    });
    expect(fittedFemaleFacesReport.results.map(({ id }) => id)).toEqual([
      "female-face-01-warm-fitted",
      "female-face-02-resolute",
      "female-face-03-clever",
      "female-face-04-serene",
    ]);
    expect(
      new Set(fittedFemaleFacesReport.results.map(({ outputSha256 }) => outputSha256)).size,
    ).toBe(4);
    for (const face of fittedFemaleFacesReport.results) {
      expect(face.status).toBe("review-only");
      expect(face.pixelsOutsideFaceBoundary).toBe(0);
      expect(face.targetBounds.minX).toBeGreaterThanOrEqual(158);
      expect(face.targetBounds.maxX).toBeLessThanOrEqual(226);
      expect(face.targetBounds.minY).toBeGreaterThanOrEqual(75);
      expect(face.targetBounds.maxY).toBeLessThanOrEqual(136);
      const image = inspectPng(await readFile(face.output));
      expect(image.width).toBe(384);
      expect(image.height).toBe(384);
      expect(image.colorType).toBe(6);
      expect(image.hasAlpha).toBe(true);
    }
  });

  test("fits isolated male faces without changing registration", async () => {
    expect(fittedMaleFacesReport.variant).toBe("male-fitted-faces");
    expect(fittedMaleFacesReport.fitBox).toEqual(fittedFemaleFacesReport.fitBox);
    expect(fittedMaleFacesReport.results.map(({ id }) => id)).toEqual([
      "male-face-01-steadfast",
      "male-face-02-rugged",
      "male-face-03-shrewd",
      "male-face-04-wise",
    ]);
    expect(
      new Set(fittedMaleFacesReport.results.map(({ outputSha256 }) => outputSha256)).size,
    ).toBe(4);
    for (const face of fittedMaleFacesReport.results) {
      expect(face.status).toBe("review-only");
      expect(face.pixelsOutsideFaceBoundary).toBe(0);
      expect(face.targetBounds.minX).toBe(176);
      expect(face.targetBounds.maxX).toBe(207);
      expect(face.targetBounds.minY).toBeGreaterThanOrEqual(75);
      expect(face.targetBounds.maxY).toBeLessThanOrEqual(136);
      const image = inspectPng(await readFile(face.output));
      expect(image.width).toBe(384);
      expect(image.height).toBe(384);
      expect(image.colorType).toBe(6);
      expect(image.hasAlpha).toBe(true);
    }
  });

  test("fits the grayscale adventurer crop inside the registered hair region", async () => {
    expect(adventurerCropReport.variant).toBe("hair-01-adventurer-crop");
    expect(adventurerCropReport.registration).toEqual({
      width: 384,
      height: 384,
      pivotX: 192,
      footY: 300,
    });
    expect(adventurerCropReport.fitBox).toEqual({
      centerX: 192,
      centerY: 78,
      maxWidth: 60,
      maxHeight: 50,
    });
    expect(adventurerCropReport.targetBounds).toEqual({
      minX: 162,
      minY: 54,
      maxX: 221,
      maxY: 101,
    });
    expect(adventurerCropReport.status).toBe("review-only");
    expect(adventurerCropReport.pixelsOutsideHairBoundary).toBe(0);
    expect(adventurerCropReport.grayscale.maximumChannelSpread).toBe(0);
    expect(adventurerCropReport.grayscale.colouredFraction).toBe(0);
    const image = inspectPng(await readFile(adventurerCropReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("fits the grayscale ranger layers inside the registered hair region", async () => {
    expect(rangerLayersReport.variant).toBe("hair-02-ranger-layers");
    expect(rangerLayersReport.registration).toEqual(adventurerCropReport.registration);
    expect(rangerLayersReport.fitBox).toEqual({
      centerX: 192,
      centerY: 88,
      maxWidth: 66,
      maxHeight: 72,
    });
    expect(rangerLayersReport.targetBounds).toEqual({
      minX: 159,
      minY: 54,
      maxX: 224,
      maxY: 121,
    });
    expect(rangerLayersReport.status).toBe("review-only");
    expect(rangerLayersReport.pixelsOutsideHairBoundary).toBe(0);
    expect(rangerLayersReport.grayscale.maximumChannelSpread).toBe(0);
    expect(rangerLayersReport.grayscale.colouredFraction).toBe(0);
    expect(rangerLayersReport.outputSha256).not.toBe(adventurerCropReport.outputSha256);
    const image = inspectPng(await readFile(rangerLayersReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("fits the grayscale wayfarer tail inside the registered hair region", async () => {
    expect(wayfarerTailReport.variant).toBe("hair-03-wayfarer-tail");
    expect(wayfarerTailReport.registration).toEqual(adventurerCropReport.registration);
    expect(wayfarerTailReport.fitBox).toEqual({
      centerX: 192,
      centerY: 84,
      maxWidth: 72,
      maxHeight: 64,
    });
    expect(wayfarerTailReport.targetBounds).toEqual({
      minX: 157,
      minY: 52,
      maxX: 226,
      maxY: 115,
    });
    expect(wayfarerTailReport.status).toBe("review-only");
    expect(wayfarerTailReport.pixelsOutsideHairBoundary).toBe(0);
    expect(wayfarerTailReport.grayscale.maximumChannelSpread).toBe(0);
    expect(wayfarerTailReport.grayscale.colouredFraction).toBe(0);
    expect(
      new Set([
        adventurerCropReport.outputSha256,
        rangerLayersReport.outputSha256,
        wayfarerTailReport.outputSha256,
      ]).size,
    ).toBe(3);
    const image = inspectPng(await readFile(wayfarerTailReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("fits the grayscale warden topknot inside the registered hair region", async () => {
    expect(wardenTopknotReport.variant).toBe("hair-04-warden-topknot");
    expect(wardenTopknotReport.registration).toEqual(adventurerCropReport.registration);
    expect(wardenTopknotReport.fitBox).toEqual({
      centerX: 192,
      centerY: 83,
      maxWidth: 66,
      maxHeight: 72,
    });
    expect(wardenTopknotReport.targetBounds).toEqual({
      minX: 160,
      minY: 47,
      maxX: 223,
      maxY: 118,
    });
    expect(wardenTopknotReport.status).toBe("review-only");
    expect(wardenTopknotReport.pixelsOutsideHairBoundary).toBe(0);
    expect(wardenTopknotReport.grayscale.maximumChannelSpread).toBe(0);
    expect(wardenTopknotReport.grayscale.colouredFraction).toBe(0);
    expect(
      new Set([
        adventurerCropReport.outputSha256,
        rangerLayersReport.outputSha256,
        wayfarerTailReport.outputSha256,
        wardenTopknotReport.outputSha256,
      ]).size,
    ).toBe(4);
    const image = inspectPng(await readFile(wardenTopknotReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("fits the grayscale scholar sweep inside the registered hair region", async () => {
    expect(scholarSweepReport.variant).toBe("hair-05-scholar-sweep");
    expect(scholarSweepReport.registration).toEqual(adventurerCropReport.registration);
    expect(scholarSweepReport.fitBox).toEqual({
      centerX: 192,
      centerY: 80,
      maxWidth: 64,
      maxHeight: 56,
    });
    expect(scholarSweepReport.targetBounds).toEqual({
      minX: 160,
      minY: 54,
      maxX: 223,
      maxY: 105,
    });
    expect(scholarSweepReport.status).toBe("review-only");
    expect(scholarSweepReport.pixelsOutsideHairBoundary).toBe(0);
    expect(scholarSweepReport.grayscale.maximumChannelSpread).toBe(0);
    expect(scholarSweepReport.grayscale.colouredFraction).toBe(0);
    expect(
      new Set([
        adventurerCropReport.outputSha256,
        rangerLayersReport.outputSha256,
        wayfarerTailReport.outputSha256,
        wardenTopknotReport.outputSha256,
        scholarSweepReport.outputSha256,
      ]).size,
    ).toBe(5);
    const image = inspectPng(await readFile(scholarSweepReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("fits the grayscale nomad braids inside the registered hair region", async () => {
    expect(nomadBraidsReport.variant).toBe("hair-06-nomad-braids");
    expect(nomadBraidsReport.registration).toEqual(adventurerCropReport.registration);
    expect(nomadBraidsReport.fitBox).toEqual({
      centerX: 192,
      centerY: 87,
      maxWidth: 64,
      maxHeight: 72,
    });
    expect(nomadBraidsReport.targetBounds).toEqual({
      minX: 164,
      minY: 51,
      maxX: 219,
      maxY: 122,
    });
    expect(nomadBraidsReport.status).toBe("review-only");
    expect(nomadBraidsReport.pixelsOutsideHairBoundary).toBe(0);
    expect(nomadBraidsReport.grayscale.maximumChannelSpread).toBe(0);
    expect(nomadBraidsReport.grayscale.colouredFraction).toBe(0);
    expect(
      new Set([
        adventurerCropReport.outputSha256,
        rangerLayersReport.outputSha256,
        wayfarerTailReport.outputSha256,
        wardenTopknotReport.outputSha256,
        scholarSweepReport.outputSha256,
        nomadBraidsReport.outputSha256,
      ]).size,
    ).toBe(6);
    const image = inspectPng(await readFile(nomadBraidsReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("fits the grayscale vanguard coils inside the registered hair region", async () => {
    expect(vanguardCoilsReport.variant).toBe("hair-07-vanguard-coils");
    expect(vanguardCoilsReport.registration).toEqual(adventurerCropReport.registration);
    expect(vanguardCoilsReport.fitBox).toEqual({
      centerX: 192,
      centerY: 79,
      maxWidth: 68,
      maxHeight: 58,
    });
    expect(vanguardCoilsReport.targetBounds).toEqual({
      minX: 158,
      minY: 53,
      maxX: 225,
      maxY: 105,
    });
    expect(vanguardCoilsReport.status).toBe("review-only");
    expect(vanguardCoilsReport.pixelsOutsideHairBoundary).toBe(0);
    expect(vanguardCoilsReport.grayscale.maximumChannelSpread).toBe(0);
    expect(vanguardCoilsReport.grayscale.colouredFraction).toBe(0);
    expect(
      new Set([
        adventurerCropReport.outputSha256,
        rangerLayersReport.outputSha256,
        wayfarerTailReport.outputSha256,
        wardenTopknotReport.outputSha256,
        scholarSweepReport.outputSha256,
        nomadBraidsReport.outputSha256,
        vanguardCoilsReport.outputSha256,
      ]).size,
    ).toBe(7);
    const image = inspectPng(await readFile(vanguardCoilsReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("fits the grayscale seafarer waves inside the registered hair region", async () => {
    expect(seafarerWavesReport.variant).toBe("hair-08-seafarer-waves");
    expect(seafarerWavesReport.registration).toEqual(adventurerCropReport.registration);
    expect(seafarerWavesReport.fitBox).toEqual({
      centerX: 192,
      centerY: 87,
      maxWidth: 76,
      maxHeight: 78,
    });
    expect(seafarerWavesReport.targetBounds).toEqual({
      minX: 154,
      minY: 51,
      maxX: 229,
      maxY: 122,
    });
    expect(seafarerWavesReport.status).toBe("review-only");
    expect(seafarerWavesReport.pixelsOutsideHairBoundary).toBe(0);
    expect(seafarerWavesReport.grayscale.maximumChannelSpread).toBe(0);
    expect(seafarerWavesReport.grayscale.colouredFraction).toBe(0);
    expect(
      new Set([
        adventurerCropReport.outputSha256,
        rangerLayersReport.outputSha256,
        wayfarerTailReport.outputSha256,
        wardenTopknotReport.outputSha256,
        scholarSweepReport.outputSha256,
        nomadBraidsReport.outputSha256,
        vanguardCoilsReport.outputSha256,
        seafarerWavesReport.outputSha256,
      ]).size,
    ).toBe(8);
    const image = inspectPng(await readFile(seafarerWavesReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("fits the grayscale sentinel undercut inside the registered hair region", async () => {
    expect(sentinelUndercutReport.variant).toBe("hair-09-sentinel-undercut");
    expect(sentinelUndercutReport.registration).toEqual(adventurerCropReport.registration);
    expect(sentinelUndercutReport.fitBox).toEqual({
      centerX: 192,
      centerY: 78,
      maxWidth: 60,
      maxHeight: 52,
    });
    expect(sentinelUndercutReport.targetBounds).toEqual({
      minX: 162,
      minY: 53,
      maxX: 221,
      maxY: 102,
    });
    expect(sentinelUndercutReport.status).toBe("review-only");
    expect(sentinelUndercutReport.pixelsOutsideHairBoundary).toBe(0);
    expect(sentinelUndercutReport.grayscale.maximumChannelSpread).toBe(0);
    expect(sentinelUndercutReport.grayscale.colouredFraction).toBe(0);
    expect(
      new Set([
        adventurerCropReport.outputSha256,
        rangerLayersReport.outputSha256,
        wayfarerTailReport.outputSha256,
        wardenTopknotReport.outputSha256,
        scholarSweepReport.outputSha256,
        nomadBraidsReport.outputSha256,
        vanguardCoilsReport.outputSha256,
        seafarerWavesReport.outputSha256,
        sentinelUndercutReport.outputSha256,
      ]).size,
    ).toBe(9);
    const image = inspectPng(await readFile(sentinelUndercutReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });

  test("fits the grayscale artisan bob and completes ten distinct hairstyles", async () => {
    expect(artisanBobReport.variant).toBe("hair-10-artisan-bob");
    expect(artisanBobReport.registration).toEqual(adventurerCropReport.registration);
    expect(artisanBobReport.fitBox).toEqual({
      centerX: 192,
      centerY: 84,
      maxWidth: 68,
      maxHeight: 66,
    });
    expect(artisanBobReport.targetBounds).toEqual({
      minX: 158,
      minY: 53,
      maxX: 225,
      maxY: 115,
    });
    expect(artisanBobReport.status).toBe("review-only");
    expect(artisanBobReport.pixelsOutsideHairBoundary).toBe(0);
    expect(artisanBobReport.grayscale.maximumChannelSpread).toBe(0);
    expect(artisanBobReport.grayscale.colouredFraction).toBe(0);
    expect(
      new Set([
        adventurerCropReport.outputSha256,
        rangerLayersReport.outputSha256,
        wayfarerTailReport.outputSha256,
        wardenTopknotReport.outputSha256,
        scholarSweepReport.outputSha256,
        nomadBraidsReport.outputSha256,
        vanguardCoilsReport.outputSha256,
        seafarerWavesReport.outputSha256,
        sentinelUndercutReport.outputSha256,
        artisanBobReport.outputSha256,
      ]).size,
    ).toBe(10);
    const image = inspectPng(await readFile(artisanBobReport.output));
    expect(image.width).toBe(384);
    expect(image.height).toBe(384);
    expect(image.colorType).toBe(6);
    expect(image.hasAlpha).toBe(true);
  });
});

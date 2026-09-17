import { describe, expect, test } from "bun:test";
import brief from "../../content/avatar/candidate-generation-briefs.json";

describe("first avatar candidate generation briefs", () => {
  test("lock both body models to one registration and isolated bald-body scope", () => {
    expect(brief.registration).toEqual({ width: 384, height: 384, pivotX: 192, footY: 300 });
    expect(brief.jobs.map((job) => job.model)).toEqual(["male", "female"]);
    expect(new Set(brief.jobs.map((job) => job.id)).size).toBe(2);
    for (const job of brief.jobs) {
      expect(job.layer).toBe("body");
      expect(job.keywords).toContain("bald");
      expect(job.keywords).toContain("lightly dressed");
      expect(job.output).toMatch(/^public\/assets\/avatar\/candidate-v1\/body\/.+\.png$/);
    }
    expect(brief.acceptance.length).toBeGreaterThanOrEqual(8);
  });
});

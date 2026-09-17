import { readFile } from "node:fs/promises";
import path from "node:path";

const file = path.resolve("content/avatar/candidate-generation-briefs.json");
const brief = JSON.parse(await readFile(file, "utf8"));
const fail = (message) => {
  throw new Error(`Avatar generation brief: ${message}`);
};

if (brief.version !== 1) fail("version must be 1");
const registration = brief.registration ?? {};
if (
  registration.width !== 384 ||
  registration.height !== 384 ||
  registration.pivotX !== 192 ||
  registration.footY !== 300
)
  fail("registration must remain 384x384 at pivot 192 and foot line 300");
if (!Array.isArray(brief.sharedPrompt) || brief.sharedPrompt.length < 5)
  fail("sharedPrompt must contain the reusable generation constraints");
if (!Array.isArray(brief.acceptance) || brief.acceptance.length < 8)
  fail("acceptance must contain the candidate review gates");

const ids = new Set();
for (const job of brief.jobs ?? []) {
  if (!job.id || ids.has(job.id)) fail(`missing or duplicate job ID ${job.id ?? "<empty>"}`);
  ids.add(job.id);
  if (job.layer !== "body" || !["male", "female"].includes(job.model))
    fail(`${job.id} must be a male or female body job`);
  if (
    !job.output.startsWith("public/assets/avatar/candidate-v1/body/") ||
    !job.output.endsWith(".png")
  )
    fail(`${job.id} has an unsafe candidate output path`);
  if (!Array.isArray(job.referenceIds) || job.referenceIds.length < 1)
    fail(`${job.id} must name its style references`);
  for (const term of ["bald", "lightly dressed", "neutral stance"])
    if (!job.keywords.includes(term)) fail(`${job.id} is missing the '${term}' constraint`);
  for (const forbidden of ["weapon", "armour", "hair"])
    if (!brief.sharedPrompt.join(" ").includes(forbidden))
      fail(`sharedPrompt must explicitly exclude ${forbidden}`);
}
if (ids.size !== 2) fail("the first gate must contain exactly the male and female body jobs");
console.log("Validated 2 locked bald-body generation briefs and 9 acceptance gates.");

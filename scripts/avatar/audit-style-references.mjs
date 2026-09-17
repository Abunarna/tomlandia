import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectReferenceImage } from "./png-inspection.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const directory = path.join(root, "public/assets/avatar/style-references");
const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
if (manifest.version !== 1 || !Array.isArray(manifest.references))
  throw new Error("Style-reference manifest must be version 1 with a references array");

const ids = new Set();
const report = [];
for (const entry of manifest.references) {
  if (
    !entry.id ||
    !entry.filename ||
    path.basename(entry.filename) !== entry.filename ||
    !/\.(png|jpe?g)$/i.test(entry.filename)
  )
    throw new Error(`Invalid style reference entry: ${JSON.stringify(entry)}`);
  if (ids.has(entry.id)) throw new Error(`Duplicate style reference ID: ${entry.id}`);
  ids.add(entry.id);
  const bytes = await readFile(path.join(directory, entry.filename));
  report.push({
    ...entry,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    ...inspectReferenceImage(bytes, entry.filename),
  });
}

console.log(JSON.stringify({ version: 1, count: report.length, references: report }, null, 2));
if (report.length === 0)
  console.error("No references registered yet; intake is ready for the forthcoming source images.");

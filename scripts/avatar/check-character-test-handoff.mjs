import { access, readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const requiredFiles = [
  ...["steadfast", "rugged", "shrewd", "wise"].map(
    (name, index) => `public/assets/avatar/candidate-v1/review/male-face-0${index + 1}-${name}.png`,
  ),
  "public/assets/avatar/candidate-v1/review/female-face-01-warm-fitted.png",
  ...["resolute", "clever", "serene"].map(
    (name, index) =>
      `public/assets/avatar/candidate-v1/review/female-face-0${index + 2}-${name}.png`,
  ),
  ...[
    "adventurer-crop",
    "ranger-layers",
    "wayfarer-tail",
    "warden-topknot",
    "scholar-sweep",
    "nomad-braids",
    "vanguard-coils",
    "seafarer-waves",
    "sentinel-undercut",
    "artisan-bob",
  ].map(
    (name, index) =>
      `public/assets/avatar/candidate-v1/review/hair-${String(index + 1).padStart(2, "0")}-${name}-grayscale.png`,
  ),
];

for (const path of requiredFiles) await access(new URL(path, root));

const route = await readFile(new URL("src/routes/character-test.tsx", root), "utf8");
const manifest = await readFile(
  new URL("src/game/avatar-character-test-manifest.ts", root),
  "utf8",
);

for (const marker of [
  "CandidateAssetGallery",
  "src={entry.url}",
  "Candidate pixel-art source layers",
])
  if (!route.includes(marker)) throw new Error(`Character test route is missing ${marker}`);

for (const marker of ["male-face-steadfast", "female-face-warm", "hair-artisan-bob"])
  if (!manifest.includes(marker)) throw new Error(`Character test manifest is missing ${marker}`);

console.log(
  `Character test handoff OK: ${requiredFiles.length} candidate PNGs and manifest UI present.`,
);

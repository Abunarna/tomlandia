import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  auditAvatarCandidateFiles,
  avatarUrlToPublicPath,
} from "../../src/game/avatar-candidate-audit";
import { parseAvatarManifest } from "../../src/game/avatar-manifest-loader";
import { avatarManifestUrls } from "../../src/game/player-avatar";

const manifestArgument = process.argv[2];
if (!manifestArgument) {
  console.error(
    "Usage: bun run avatar:candidate-check -- public/assets/avatar/candidate/manifest.json",
  );
  process.exit(2);
}

const manifestPath = path.resolve(manifestArgument);
const manifest = parseAvatarManifest(JSON.parse(await readFile(manifestPath, "utf8")));
const issues = await auditAvatarCandidateFiles(manifest, (url) =>
  readFile(avatarUrlToPublicPath(url)),
);
if (issues.length) {
  console.error(issues.map(({ field, message }) => `${field}: ${message}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${new Set(avatarManifestUrls(manifest)).size} candidate PNG files.`);
}

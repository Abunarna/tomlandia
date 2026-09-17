import path from "node:path";
import {
  avatarManifestUrls,
  type AvatarAssetManifest,
  type AvatarValidationIssue,
} from "./player-avatar";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

export function avatarUrlToPublicPath(url: string, root = process.cwd()): string {
  const parsed = new URL(url, "http://avatar.local");
  if (parsed.origin !== "http://avatar.local" || !parsed.pathname.startsWith("/assets/avatar/")) {
    throw new Error(`Unsafe avatar asset URL: ${url}`);
  }
  return path.join(root, "public", parsed.pathname);
}

export function inspectCandidatePngHeader(bytes: Uint8Array): AvatarValidationIssue[] {
  const issues: AvatarValidationIssue[] = [];
  if (bytes.length < 33 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    return [{ field: "signature", message: "Asset is not a valid PNG file." }];
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const bitDepth = bytes[24];
  const colourType = bytes[25];
  if (width !== 384 || height !== 384) {
    issues.push({ field: "dimensions", message: `Expected 384×384, found ${width}×${height}.` });
  }
  if (bitDepth !== 8 || colourType !== 6) {
    issues.push({
      field: "format",
      message: `Expected 8-bit RGBA PNG (colour type 6), found bit depth ${bitDepth}, type ${colourType}.`,
    });
  }
  return issues;
}

export async function auditAvatarCandidateFiles(
  manifest: AvatarAssetManifest,
  readAsset: (url: string) => Promise<Uint8Array>,
): Promise<AvatarValidationIssue[]> {
  const issues: AvatarValidationIssue[] = [];
  for (const url of [...new Set(avatarManifestUrls(manifest))]) {
    try {
      const bytes = await readAsset(url);
      for (const issue of inspectCandidatePngHeader(bytes)) {
        issues.push({ field: url, message: `${issue.field}: ${issue.message}` });
      }
    } catch (error) {
      issues.push({
        field: url,
        message: `Could not read asset: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  return issues;
}

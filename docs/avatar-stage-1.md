# Avatar Stage 1 status

Stage 1 has begun with a working renderer foundation and development lab. Run
`bun run dev`, then open `/avatar-lab`. The route is disabled in production
unless `VITE_AVATAR_LAB=true` is explicitly set.

## Included in this slice

- a release-catalogue-backed reference manifest containing both models, eight
  faces, ten hairstyles, all 32 armour IDs, all 16 sword IDs, and activities;
- `PlayerAvatarRenderer`, with one registered transform, disabled smoothing,
  grayscale tinting, model compatibility, split rear/front sword layers, and
  isolated Canvas state;
- manifest checks for duplicate IDs, registration drift, absent model bodies or
  faces, empty hairstyle compatibility, and missing selected visuals;
- browser image checks for 384×384 dimensions, transparent canvas space, visible
  pixels, and failed URLs;
- deterministic geometry-proof PNGs and a repository checker; and
- interactive source/game-scale previews with catalogue controls, four
  backgrounds, activity indicators, registration guides, loading state, and
  visible errors;
- a versioned first-pass boundary schema for body envelopes, face, hair, neck,
  grip, and weapon regions, plus a pixel-boundary test helper;
- per-layer visibility controls and a male/female compatibility sheet; and
- an in-lab reference board using the armourer, weaponsmith, smith, and tanner
  assets as the first Tomlandia style-calibration set;
- a live boundary scan with a red illegal-pixel heat map for the selected body,
  face, hair, armour, and both weapon slices; and
- a fixed-scale 16-tier contact sheet for reviewing catalogue order and visual
  progression from Copper to Ascendant, switchable between heavy and light
  armour; and
- seven generated RGBA boundary masks loaded through the same checked asset path
  as artwork. Pixel validation uses mask alpha when available and retains polygon
  geometry only as a visual guide and fallback; and
- an independently rendered visual-audit sheet plus a contact-sheet silhouette
  mode for judging outlines without material colour; and
- an exact release-coverage audit that rejects missing or invented equipment IDs,
  wrong face/hair counts, incomplete model variants, and broken tier pairs. The
  Avatar Lab exposes this audit beside a production-readiness checklist; and
- split grayscale skin and independent modesty layers for each base model, with
  live runtime skin-tone selection. Clothing therefore stays unchanged when the
  skin tone changes and remains independently replaceable beneath armour.

The generated files under `public/assets/avatar/reference/` are intentionally
simple geometry proofs. They are not proposed character art and must not be
promoted to `production` status. Rebuild and validate them with:

```sh
bun run avatar:reference
bun run avatar:check
```

## Remaining Stage 1 work

The next slice replaces the generated rectangular masks with approved per-model
masks traced from candidate body masters and records measured style traits from
locally available NPC source artwork. Stage 1 is complete only when those checks
work with a replaceable candidate-art pack; gameplay continues using `KnightRig`
throughout.

The engineering foundation is therefore ready for a candidate pack, but the art
gate is intentionally closed: `reference` status cannot be promoted until the
NPC reference pixels are available and the first bald male/female body pair is
approved.

Candidate packs can now be loaded into the lab from a same-origin JSON manifest
without rebuilding the app. Runtime parsing, exact catalogue coverage, asset
preloading, alpha inspection, and candidate-owned mask URLs all pass before the
active reference pack is replaced. See `docs/avatar-candidate-pack.md`.

Style-source intake is also ready while reference images are gathered. Originals
remain byte-for-byte evidence outside the runtime manifest, and
`bun run avatar:style-audit` records their dimensions, alpha mode, visible bounds,
coverage, and SHA-256 checksum. See `docs/avatar-style-reference-intake.md`.

The first male/female candidate prompts and acceptance gates are now locked in
`content/avatar/candidate-generation-briefs.json`; execution and review continue
under `docs/avatar-stage-2.md`.

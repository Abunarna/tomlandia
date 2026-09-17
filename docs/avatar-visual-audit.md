# Avatar Stage 1 visual audit

The Stage 1 reference composite was rendered independently of the Avatar Lab and
inspected at native resolution on checkerboard. The audit image is
[`images/avatar-stage-1-composite-audit.png`](images/avatar-stage-1-composite-audit.png).
It covers both models, four hairstyles, four faces, heavy/light armour, multiple
tints, and both sword slices.

## Passes

- Both models share the x=192 centre and y=300 foot baseline.
- Faces remain inside the bald head and change without moving the head silhouette.
- Hair layers register to the scalp; long, cropped, topknot, and high styles stay
  inside the current hair envelope.
- Heavy and light reference armour remain centred and preserve the same stance.
- Rear blade and front guard/pommel meet at the fixed right-hand grip without a
  per-item offset.
- The sword remains inside the current weapon envelope and does not collide with
  the top-of-canvas activity area.
- Dark, light, warm, and cool tint examples preserve the reference value bands.
- Re-rendering after the body split confirms that runtime skin tint and the
  untinted modesty layer preserve the same registration and composite silhouette.

These results are sufficient to continue Stage 1 tooling and candidate-art
preparation. They do **not** approve the geometry proofs as final artwork.

## Expected reference-only limitations

- Armour and swords currently change only by catalogue tint; material-specific
  Copper-to-Ascendant silhouettes and ornament have not been produced.
- The simple armour proofs leave some skin visible on the forearms and hands.
  Production full-body armour must explicitly decide glove/gauntlet coverage and
  pass the neck, wrist, and grip masks.
- Hair and faces are deliberately low-detail geometry tests, not NPC-style art.
- The circular reference pommel is intentionally exaggerated so front/back sword
  ordering is obvious; production pommels must follow each item brief.
- Four user-supplied style sprites are now checked in as local, checksummed JPEG
  references. Their proportions and material language can guide candidate art,
  but their black backgrounds and small canvases mean they are not registration
  templates or production layers. See `docs/avatar-style-study.md`.

## Continue decision

Create and review the first NPC-style bald-body pair next, then test one low-tier
and one high-tier armour/sword extreme before scaling production. Do not start
the complete 64-armour-layer and 16-sword run from the geometry-proof art.

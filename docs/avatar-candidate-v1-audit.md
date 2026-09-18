# Candidate v1 body audit

The two user-supplied 1254×1254 RGB chroma-key sources are preserved unchanged under `public/assets/avatar/candidate-v1/source/`. Normalization removes green pixels, scales each whole figure uniformly, centres it at x=192, places its feet at y=300, and writes transparent 384×384 RGBA review PNGs without moving individual body parts.

The side-by-side review sheet is [`images/avatar-candidate-v1-body-review.png`](images/avatar-candidate-v1-body-review.png). Female is left; male is right.

## Mechanical passes

- Both sources decode as 1254×1254 8-bit RGB PNGs.
- Both review outputs are 384×384 8-bit RGBA PNGs with transparent canvas space.
- Both figures share a y=63 top and y=300 foot baseline.
- Female visible registration bounds are x=140–244; male bounds are x=137–247.
- Whole-figure uniform scaling was used; no head, hand, leg, or clothing element was shifted separately.

## Visual assessment

- The overall direction is substantially closer to the supplied NPC references than the geometry proofs: strong dark contours, stepped shading, readable anatomy, bald heads, and restrained underclothes.
- The male and female head, shoulder, hip, and clothing silhouettes are meaningfully distinct while remaining compatible with one registered Canvas renderer.
- At game scale, facial and muscular details become very small; that is acceptable for a body review but means separate face overlays must be tested carefully.
- Small chroma remnants are removed with a hard dominance key because these are deliberately pixel-edged characters. The untouched sources remain available if the matte needs revisiting.

## Blocking issues before renderer promotion

These normalized files are **review-only combined composites**, not production body layers:

1. Eyes, eyebrows, noses, and mouths are baked into the source. The production bald body must not contain a selected face because four interchangeable face layers are required per model.
2. Skin and modesty clothing are baked together. Runtime skin tinting requires separate grayscale skin and untinted modesty PNGs.
3. The fist holes show the intended weapon grip area, but both grip sockets still need pixel-coordinate comparison against the weapon mask.
4. The female and male figures have different arm widths. Armour production therefore correctly remains two artwork variants per item.

Do not wire these combined files into `PlayerAvatarRenderer`. Use them to approve proportions and style, then regenerate or carefully derive separate skin, modesty, and face-neutral layers before creating armour.

## Face-neutral revision

The revised sources are preserved beside the originals and normalized with the
same whole-figure transform. See
[`images/avatar-candidate-v1-face-neutral-review.png`](images/avatar-candidate-v1-face-neutral-review.png).
The female revision retains a silhouette intersection-over-union score of
0.988745 with 144 changed edge pixels; the male scores 0.995898 with 56 changed
edge pixels. Both retain the exact normalized top, centre, and foot registration.

Visual inspection confirms that the facial features were removed cleanly and no
hair, armour, weapon, or new pose was introduced. The small silhouette deltas are
edge/matte differences rather than meaningful limb repositioning.

**Split decision: suitable for a controlled split proof, not automatic production
promotion.** The neutral clothing is chromatically distinct enough to derive a
modesty mask, and the remaining full silhouette can become a grayscale tintable
skin master. The split must be visually compared back to the combined revision,
especially at the neckline, armholes, waistband, shorts hems, and dark outline.
Grip sockets remain a separate approval gate.

## Female grayscale skin-master decision

The female grayscale edit is normalized at
[`images/avatar-candidate-v1-female-skin-comparison.png`](images/avatar-candidate-v1-female-skin-comparison.png),
with the face-neutral clothed reference on the left and grayscale skin master on
the right. It retains a whole-silhouette IoU of 0.994982, head IoU of 0.996995,
hand-region IoU of 0.996071, and foot-region IoU of 0.987102. All registration
bounds remain x=140–244 and y=63–300.

**Accepted as the female skin-layer candidate.** Visual inspection shows the
pose, bald head, hands, fist holes, feet, and centre line remain stable. Removing
clothing appropriately changes internal contours and the covered waist/hip
surface; those are intended layer changes, not registration drift. The image is
grayscale and suitable for runtime tint testing.

It is not yet a complete body set. The matching female modesty layer must be
derived and recomposed over this skin master. That composite must be checked at
the neckline, armholes, waistband, hems, and grip holes before the candidate is
connected to the renderer.

## Male grayscale skin-master decision

The equivalent male comparison is
[`images/avatar-candidate-v1-male-skin-comparison.png`](images/avatar-candidate-v1-male-skin-comparison.png),
with the face-neutral clothed reference on the left and grayscale skin master on
the right. Regional silhouette measurements are recorded in
`public/assets/avatar/candidate-v1/review/male-skin-normalization-report.json`.

The male candidate uses the same hard chroma removal, uniform whole-figure
scale, exact grayscale conversion, x=192 centre, and y=300 foot registration as
the accepted female skin candidate. Acceptance requires whole, head, hand, and
foot IoU thresholds to pass independently; this prevents clothing removal from
hiding movement at the grip or feet.

**Rejected.** Although the head (0.992709) and feet (0.984917) remain close, the
whole silhouette falls to 0.988466 and the critical hand/grip region falls to
0.983646 with 95 changed pixels. Visual inspection shows a broadly similar pose,
but the request explicitly forbids hand or grip changes, so similarity is not
enough. Preserve this source as rejection evidence and request a precision edit
that restores both hands and fist holes exactly from the face-neutral male.

## Corrected male grayscale skin-master decision

The submitted correction is preserved separately from the first rejected source.
Its comparison sheet is
[`images/avatar-candidate-v1-male-skin-corrected-comparison.png`](images/avatar-candidate-v1-male-skin-corrected-comparison.png),
and its machine-readable measurements are in
`public/assets/avatar/candidate-v1/review/male-skin-corrected-normalization-report.json`.

The normalization still places the figure at x=192 with bounds x=137–247 and
y=63–300, so the canvas centre and foot registration are correct. Its head-region
IoU is 0.990460, but the whole silhouette is 0.981484, the critical hand/grip
region is 0.979142, and the feet are 0.967213. The whole figure, hands, and feet
therefore remain below their required thresholds.

**Rejected.** Visual review confirms that the corrected figure is centred and
recognizably follows the authoritative pose, but its outer shoulders, arms,
hands, fist holes, legs, and feet do not reproduce the face-neutral male closely
enough for exact paper-doll overlays. It must not replace the accepted reference
or enter the runtime manifest. A further correction should recolour the exact
authoritative pixels rather than redraw the anatomy or silhouette.

## Corrected male grayscale skin-master v2 decision

The second precision attempt is preserved and shown in
[`images/avatar-candidate-v1-male-skin-corrected-v2-comparison.png`](images/avatar-candidate-v1-male-skin-corrected-v2-comparison.png).
It remains exactly centred at x=192 with a y=300 foot anchor, but all protected
regional comparisons fail: whole 0.973368, head 0.988802, hands/grips 0.970614,
and feet 0.948110.

**Rejected.** This attempt drifts farther than the first correction and must not
enter the runtime manifest. Repeated generative editing is not reliably
preserving the pixel silhouette. The next pass should use deterministic image
editing: retain the authoritative alpha mask and exterior pixels, then replace
only pixels inside the clothing masks. This changes the workflow, not the avatar
architecture, and guarantees that hands, fist holes, feet, head, centre, and
registration cannot move.

## Precision male grayscale skin-master v3 decision

The precision-edit source is preserved at
`public/assets/avatar/candidate-v1/source/body-male-grayscale-skin-precision-v3-source.png`.
Its normalized comparison is
[`images/avatar-candidate-v1-male-skin-precision-v3-comparison.png`](images/avatar-candidate-v1-male-skin-precision-v3-comparison.png),
with measurements in
`public/assets/avatar/candidate-v1/review/male-skin-precision-v3-normalization-report.json`.

The candidate is correctly grayscale, centred at x=192, and registered to the
y=300 foot line. It nevertheless fails every protected silhouette comparison:
whole 0.967960, head 0.978127, hands/grips 0.963293, and feet 0.961510.

**Rejected.** The generator produced a close visual recreation rather than a
pixel-preserving interior edit. The shoulders, arms, hands and grip openings,
head contour, inner legs, and feet all drift from the authoritative face-neutral
male. This source remains audit evidence and must not enter a runtime manifest.
Another generative correction should not be requested: the male skin master now
requires a deterministic edit that locks the authoritative alpha silhouette and
protected exterior pixels by construction.

## Deterministic male grayscale skin-master v4 decision

The v3 grayscale treatment has now been processed through a deterministic
geometry lock rather than another generation pass. The lock uses the normalized
face-neutral male as the alpha authority: it removes 139 pixels introduced by
the generated revision and restores 302 authoritative pixels that the revision
omitted. The resulting registered layer is
`public/assets/avatar/candidate-v1/review/body-male-grayscale-skin-deterministic-v4.png`,
and its comparison sheet is
[`images/avatar-candidate-v1-male-skin-deterministic-v4-comparison.png`](images/avatar-candidate-v1-male-skin-deterministic-v4-comparison.png).

The deterministic candidate is centred at x=192 on the y=300 foot line and is
strictly grayscale. Its whole, head, hands/grips, and feet silhouette comparisons
all have zero changed pixels and an intersection-over-union score of exactly
1.000000.

**Accepted through the automated silhouette gate as a review-only male skin-layer
candidate.** This does not independently promote either body. The matching male
modesty layer must still be derived and recomposed, grip parity with the female
candidate must be approved, and the male/female body pair must pass the shared
visual gate before either body enters a runtime manifest.

## Deterministic modesty-layer split decision

Model-specific modesty layers are now derived from the face-neutral combined
bodies by retaining neutral clothing pixels only inside a locked garment region
and the corresponding skin alpha mask. The derivation emits separate male and
female 384×384 transparent PNGs and never expands either body silhouette. Thirteen
female source pixels that fell outside the accepted female skin mask were
discarded; both final modesty layers contain zero pixels outside their matching
skin layers.

The source/recomposition pairs are shown in
[`images/avatar-candidate-v1-modesty-recomposition.png`](images/avatar-candidate-v1-modesty-recomposition.png),
and the machine-readable counts and checksums are in
`public/assets/avatar/candidate-v1/review/modesty-split-report.json`.

**Accepted as review-only split proofs.** The layers are model-specific, preserve
transparent canvas space, and do not protrude beyond their skin silhouettes. The
pair still requires final visual approval of the neckline, armholes, waistband,
short hems, grip openings, and game-scale tint composites before body-master
promotion.

## Character-test body-pair activation

The review-only character-test manifest now uses the accepted female grayscale
skin candidate, deterministic male v4 skin candidate, and their model-specific
modesty layers. This activation is deliberately limited to `/character-test`:
the production/reference manifest is unchanged, and the candidates remain
subject to the shared body-pair visual gate.

The route renders these body layers through the same `PlayerAvatarRenderer` used
for the fitted faces, all ten hairstyles, and runtime skin and hair tinting. Its
direct checked-in PNG gallery also exposes all four body-layer URLs so a generic
or stale fallback cannot silently replace the reviewed artwork.

The Avatar Lab now also defaults to this candidate manifest. Previously, its
initial state explicitly loaded `referenceAvatarManifest`, so opening the Lab
from Character Test showed the old boxy geometry proof even though the Character
Test itself had the new body URLs. Model switching and comparison sheets now
resolve registered face and compatible hairstyle IDs from the active manifest
instead of reconstructing `${model}-face-1` names.

## Female face 01 warm decision

The first isolated face submission was transformed with the exact same source
scale and registration used by the face-neutral female body. Its normalized
visible bounds are x=162–223 and y=128–178. The registered face envelope is
x=158–226 and y=75–136, leaving 635 of its 764 visible pixels outside the legal
region.

**Rejected.** The source contains an isolated, cleanly chroma-keyed face, but it
was generated near the centre of the source canvas rather than inside the
authoritative head. When composed without an independent offset, the eyes land
across the shoulders and the mouth lands on the torso. The renderer must not
compensate with a per-face offset. The next generation prompt must include the
complete face-neutral female as an unchanged registration plate and request that
features be painted directly into its existing blank head; isolation can happen
deterministically after registration is proven.

## Female face 01 registered-edit decision

The full-body edit is preserved and compared beside the authoritative
face-neutral female in
[`images/avatar-candidate-v1-face-female-01-warm-registered-review.png`](images/avatar-candidate-v1-face-female-01-warm-registered-review.png).
The face now appears in a plausible head position, but the generator replaced
the entire registration plate: body proportions, silhouette, arms, hands,
clothing, legs, feet, and boots all differ.

**Rejected.** The normalized silhouette IoU is only 0.785373, with 2,832 changed
silhouette pixels. There are 13,184 changed RGBA pixels overall, including 10,353
outside the permitted face boundary. These figures prove this is a redraw rather
than a localized face edit. It must not be isolated or promoted because doing so
would conceal that its placement was established against a different head and
body. The next face workflow should place features deterministically on the
canonical 384×384 head region instead of asking a generative model to preserve
the full registration plate.

## Deterministically fitted female faces

The two isolated face designs are now normalized into the same fixed fitting box
(centre x=192/y=94, maximum 32×28 pixels) and previewed on the unchanged
face-neutral female in
[`images/avatar-candidate-v1-female-fitted-faces-review.png`](images/avatar-candidate-v1-female-fitted-faces-review.png).
No renderer offset is involved: the resulting files are complete transparent
384×384 layers already registered to the shared canvas.

Both candidates remain wholly inside the legal face envelope with zero boundary
violations. Face 01 occupies x=176–207/y=81–106; Face 02 occupies
x=176–207/y=82–105. Visual inspection shows both are aligned and legible. Face
01 reads as calm and approachable. Face 02 is clearly distinct and resolute, but
its strongly angled eyebrows make it read somewhat stern; it should remain
review-only until the expression is approved. Neither candidate is connected to
the production manifest yet.

Face 03 is fitted by the same deterministic transform at
x=176–207/y=81–106, with zero pixels outside the legal face boundary. Visual
inspection confirms that its raised brows, alert eyes, and slight asymmetric
smile read as clever and subtly playful. It remains clearly distinct from the
warm first face and stern second face while retaining the same scale and forward
view. It is also review-only pending approval; the source and registered layer
are preserved separately.

Face 04 uses the same x=176–207/y=81–106 registration and also has zero illegal
pixels. Its relaxed brows, softer eyes, and composed mouth read as serene and
experienced without appearing elderly. In the four-face sheet it is most similar
to Face 01, but remains distinguishable through its narrower eyes and more
reserved expression. All four requested female identities are now present as
technically valid, review-only layers; the next review gate is approval of the
set together before it is added to a candidate manifest.

## Deterministically fitted male faces

Male Face 01 is processed through the same fixed 32×28 fitting box as the female
set and previewed on the unchanged face-neutral male in
[`images/avatar-candidate-v1-male-fitted-faces-review.png`](images/avatar-candidate-v1-male-fitted-faces-review.png).
It occupies x=176–207/y=81–107 with zero pixels outside the registered face
boundary.

The face is crisp, centred, forward-facing, and readable at the source preview
scale. Its level mouth reads calm, but the heavy low eyebrows make the overall
expression more focused than friendly. It remains a technically valid,
review-only candidate; its identity should be judged beside the next three male
faces before promotion.

Male Face 02 is registered at the identical x=176–207/y=81–107 bounds with no
illegal pixels. Its heavier angled brows, broader nose, and firmer mouth read as
rugged and determined without becoming an exaggerated scowl. The two male faces
are visually distinct at the review scale and share the same crisp outline and
forward view. Face 02 remains review-only until the four-face male set can be
assessed together.

Male Face 03 occupies x=176–207/y=80–107 and has zero boundary violations. Its
raised asymmetric brow, narrower eyes, and subtly curved mouth read as shrewd and
observant without looking villainous. It is clearly distinguishable from the
level steadfast face and the square, rugged face at the review scale. The asset
remains review-only pending the fourth male candidate and a complete-set review.

Male Face 04 is fitted at x=176–207/y=81–106 with zero illegal pixels. Its softer
level brows, open eyes, and restrained smile read as patient and kind, providing
a calmer alternative to the focused, rugged, and shrewd options. Visual
inspection confirms all four male faces are distinct and consistently scaled.
The requested eight-face set is now complete as technically valid, review-only
artwork; none should enter the candidate manifest until the full male and female
contact sheets are approved together.

## Hairstyle 01: Adventurer Crop

The supplied grayscale crop has been chroma-keyed and fitted deterministically
into a 60×50 maximum box centred at x=192/y=78. The registered layer occupies
x=162–221/y=54–101 on the shared 384×384 canvas and has zero visible pixels
outside the legal hair boundary. Its normalized pixels are strictly grayscale,
with a maximum RGB channel spread and coloured-pixel fraction of zero.

The unchanged male and female base previews are shown together in
[`images/avatar-candidate-v1-hair-01-adventurer-crop-review.png`](images/avatar-candidate-v1-hair-01-adventurer-crop-review.png).
Visual inspection confirms that the fringe follows both scalp lines, leaves the
ears and face readable, and remains centred at game scale. The slightly tousled,
asymmetric silhouette reads clearly on both bodies without changing either base
registration.

The hairstyle is technically suitable as the first shared hair candidate, but
remains **review-only**. It must not enter the candidate manifest until its fit
on both models, runtime tint behaviour, and readability alongside all remaining
hairstyles are approved as a set.

## Hairstyle 02: Ranger Layers

The supplied medium-length grayscale hairstyle has been chroma-keyed and fitted
into a 66×72 maximum box centred at x=192/y=88. Its registered layer occupies
x=159–224/y=54–121, remains inside the shared hair boundary with zero violations,
and contains only exact grayscale pixels.

The unchanged male and female overlays are shown in
[`images/avatar-candidate-v1-hair-02-ranger-layers-review.png`](images/avatar-candidate-v1-hair-02-ranger-layers-review.png).
The crown follows both scalp lines and the open centre leaves the face readable.
The layered side locks partly cover the ears, but do not reach the neck or
shoulders. Its longer, fuller silhouette is clearly distinguishable from the
Adventurer Crop at game scale.

This candidate is technically valid but remains **review-only**. The partial ear
coverage should be considered during set review, and runtime tinting must still
be checked before the hairstyle is eligible for the candidate manifest.

## Hairstyle 03: Wayfarer Tail

The tied-back grayscale source has been chroma-keyed and fitted into a 72×64
maximum box centred at x=192/y=84. The resulting layer occupies
x=157–226/y=52–115, has zero pixels outside the legal hair envelope, and retains
an exact neutral grayscale palette.

The registered male and female previews appear in
[`images/avatar-candidate-v1-hair-03-wayfarer-tail-review.png`](images/avatar-candidate-v1-hair-03-wayfarer-tail-review.png).
The swept crown follows both unchanged scalps, preserves a broad face opening,
and keeps clear of the neck and shoulders. Its compact side tail remains visible
at game scale and differentiates it from both the cropped and loose layered
styles without dominating the silhouette.

The hairstyle is technically valid but remains **review-only** until the shared
fit, runtime tint response, and full ten-style contact sheet receive approval.

## Hairstyle 04: Warden Topknot

The supplied grayscale topknot has been chroma-keyed and registered in a 66×72
maximum fit box centred at x=192/y=83. Its normalized bounds are
x=160–223/y=47–118, with no visible pixels outside the legal hair envelope and
no residual colour pixels.

The unchanged two-model comparison is available in
[`images/avatar-candidate-v1-hair-04-warden-topknot-review.png`](images/avatar-candidate-v1-hair-04-warden-topknot-review.png).
The gathered crown follows both scalp shapes, the face opening remains clear,
and the side locks stop above the neck and shoulders. The high central knot is
connected by a narrow stem and stays recognizable at game scale, providing a
strong vertical silhouette distinct from the crop, loose layers, and low tail.

The candidate is technically valid and remains **review-only**. Its narrow knot
connection and runtime tint readability should be checked with the complete
hairstyle set before manifest promotion.

## Hairstyle 05: Scholar Sweep

The side-parted grayscale source has been chroma-keyed and fitted into a 64×56
maximum box centred at x=192/y=80. The registered output occupies
x=160–223/y=54–105, stays wholly inside the legal hair envelope, and contains no
residual colour pixels.

The unchanged male and female previews are available in
[`images/avatar-candidate-v1-hair-05-scholar-sweep-review.png`](images/avatar-candidate-v1-hair-05-scholar-sweep-review.png).
The rounded crown aligns with both scalps, while the diagonal fringe remains
above the facial-feature region and the compact sides avoid the neck and
shoulders. Its smooth asymmetrical sweep is distinct from the tousled crop,
loose ranger layers, tied tail, and topknot at game scale.

The candidate is technically valid and remains **review-only** pending runtime
tint testing and evaluation beside the complete ten-hairstyle set.

## Hairstyle 06: Nomad Braids

The paired-braid grayscale source has been chroma-keyed and fitted into a 64×72
maximum box centred at x=192/y=87. The registered output occupies
x=164–219/y=51–122, remains wholly inside the legal hair envelope, and contains
only neutral grayscale pixels.

The unchanged male and female comparison is available in
[`images/avatar-candidate-v1-hair-06-nomad-braids-review.png`](images/avatar-candidate-v1-hair-06-nomad-braids-review.png).
The crown follows both scalp shapes, the central face opening remains clear, and
the paired braids stop above the shoulder line. Their large alternating clusters
remain readable at game scale and provide a balanced silhouette distinct from
the five earlier styles.

The candidate is technically valid and remains **review-only** until its runtime
tint response and appearance within the complete hairstyle set are approved.

## Hairstyle 07: Vanguard Coils

The compact coiled source has been chroma-keyed and fitted into a 68×58 maximum
box centred at x=192/y=79. The registered grayscale layer occupies
x=158–225/y=53–105 and has zero visible pixels outside the legal hair envelope.

The unchanged male and female overlays appear in
[`images/avatar-candidate-v1-hair-07-vanguard-coils-review.png`](images/avatar-candidate-v1-hair-07-vanguard-coils-review.png).
The clustered crown follows both scalp shapes, leaves a broad face opening, and
keeps the ears, neck, and shoulders readable. Its rounded, irregular coil groups
remain cohesive at game scale and provide a distinctly wider crown silhouette
without reading as a helmet or oversized sphere.

The candidate is technically valid and remains **review-only** pending runtime
tint testing and complete-set approval.

## Hairstyle 08: Seafarer Waves

The long wavy source has been chroma-keyed and fitted into a 76×78 maximum box
centred at x=192/y=87. Its registered grayscale output occupies
x=154–229/y=51–122 and stays entirely inside the legal hair envelope.

The unchanged two-model review is available in
[`images/avatar-candidate-v1-hair-08-seafarer-waves-review.png`](images/avatar-candidate-v1-hair-08-seafarer-waves-review.png).
The open crown frames both faces without obscuring their feature region. The
large wave groups remain readable at game scale, and their ends sit beside the
upper shoulders without extending into the torso or neckline. This creates the
set's first clearly long, loose silhouette while remaining distinct from Ranger
Layers.

The candidate is technically valid and remains **review-only** pending runtime
tint testing and complete-set approval.

## Hairstyle 09: Sentinel Undercut

The compact undercut source has been chroma-keyed and fitted into a 60×52
maximum box centred at x=192/y=78. Its registered grayscale output occupies
x=162–221/y=53–102 and has zero pixels outside the legal hair envelope.

The unchanged male and female overlays are shown in
[`images/avatar-candidate-v1-hair-09-sentinel-undercut-review.png`](images/avatar-candidate-v1-hair-09-sentinel-undercut-review.png).
The angular upper ridge follows both scalp shapes, the darker compact sides leave
the ears exposed, and the face and neck remain unobstructed. At game scale it
reads as a restrained martial ridge rather than a tall mohawk and remains
distinct from the Adventurer Crop.

The candidate is technically valid and remains **review-only** pending runtime
tint testing and evaluation with the completed hairstyle set.

## Hairstyle 10: Artisan Bob

The jaw-length grayscale source has been chroma-keyed and fitted into a 68×66
maximum box centred at x=192/y=84. Its registered output occupies
x=158–225/y=53–115, stays inside the legal hair envelope with zero violations,
and contains no residual colour pixels.

The unchanged male and female review appears in
[`images/avatar-candidate-v1-hair-10-artisan-bob-review.png`](images/avatar-candidate-v1-hair-10-artisan-bob-review.png).
The rounded crown aligns with both scalps, the jaw-length panels preserve the
central face and neck opening, and the tapered ends stop above the shoulders.
The compact curved silhouette remains distinct from both Scholar Sweep and the
long Seafarer Waves at game scale.

The candidate is technically valid and remains **review-only** pending runtime
tint testing. All ten requested grayscale hairstyle identities are now present;
the next gate is a complete-set contact-sheet review before manifest promotion.

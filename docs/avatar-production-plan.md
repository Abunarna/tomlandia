# Player avatar production plan

## Decision and scope

Tomlandia can restart the avatar artwork from scratch. The Replit work is visual
inspiration only, not an authoritative production input. The animated
`KnightRig` remains the default until a feature-flagged replacement is proven.

The replacement is a simple, forward-facing paper doll. Players still move in
all directions, but the avatar does not turn or use animation strips. An icon
above the head communicates fighting, mining, chopping, fishing, or another
activity.

The target production set is:

- two bald base models: male and female, nude except for a close-fitting,
  non-sexual modesty layer that cannot protrude through armour;
- four face layers per model (eight total);
- ten grayscale hairstyles, with compatible model(s) declared in the manifest;
- every current gameplay armour fitted to both models; the current release has
  32 armour items, so this means 64 armour PNGs; and
- a large held sword for each of the 16 current weapon tiers, built against one
  fixed grip socket (shared between models where the approved geometry permits);
- a small procedural or code-native activity-icon set.

This supersedes the old shared-body, 12-head, 12-hair, and Replit-manifest
assumptions. Gameplay equipment IDs stay authoritative; visual records map to
those IDs rather than forming a second armour catalogue.

## Tomlandia art-direction reference

The existing Tomlandia NPC cast is the primary style reference—not generic
fantasy concept art and not the discarded Replit avatars. Before generating the
first body concepts, build a reference board from the checked-in Lovable assets
for the armourer, weaponsmith, smith, smelter, gear upgrader, tanner, merchant,
banker, exchange trader, chef, and both elder versions. The armourer and
weaponsmith are the leading references for equipment; the wider cast establishes
how Tomlandia handles faces, hands, outlines, proportions, cloth, and readability.

The reference board records measurable traits rather than relying on “match this
style” in a prompt: head-to-body ratio, shoulder width, hand and foot size,
outline colour/weight, number of value bands, saturation range, highlight
direction, typical facial detail, edge hardness, and the size of the smallest
detail that remains visible at game scale. It includes each NPC at native size
and at the player's actual rendered height. The board and an extracted palette
become versioned inputs to every generation prompt.

NPCs guide visual language but are not registration masters. Player layers still
use the approved bald bodies, masks, anchors, and grip socket. No NPC is traced,
rescaled, or used to introduce a competing body silhouette. If an NPC source
image is only available through Lovable's asset URL, Phase 0 must first make a
lossless local reference copy or render a reference-board screenshot; generation
does not proceed from tiny in-game screenshots alone.

## Fixed technical contract

Every raster layer is an RGBA PNG on the same transparent 384×384 canvas. The
character is centred at x=192 with a common foot baseline at y=300. Approved
layers are never cropped, stretched, or independently shifted. One transform
composites the avatar at the current player footprint (requested as 72 world
pixels today), with Canvas smoothing disabled.

Both bases are bald so the scalp never competes with a hairstyle. Their modesty
garment must be skin-tight in silhouette: no collar, sleeve, cuff, hem, belt, or
shoe pixel may extend beyond the naked body mask. Faces alter features without
moving the skull, ears, neck, body, or anchor. Hair is neutral grayscale with
preserved highlights and shadows for runtime multiply-and-mask tinting. Each
full-body armour is fitted separately to the male and female silhouettes,
excludes face and hair, and covers the modesty garment below an approved neck
boundary.

The sword is not baked into a body or armour. A large diagonal weapon crosses
several body regions, so each sword is exported as two registered images:
`weaponBack` (the portion behind the gripping hand/forearm) and `weaponFront`
(only the portion that genuinely passes in front). Body and armour keep the same
hand pose and grip opening. This explicit occlusion split avoids trying to solve
a three-dimensional overlap with one flat layer. A sword whose silhouette stays
entirely outside the body may use only `weaponFront`.

Activity icons sit outside the 384×384 paper doll and are drawn above the head in
world/screen space. They can be SVG or Canvas symbols: they are UI indicators,
not generated character layers.

## Registration map and hard boundaries

The main lesson from the Replit trial is that verbal instructions such as
“roughly in the same place” are not an alignment system. Generation must not be
allowed to choose coordinates independently. Before production art, commit a
registration map containing machine-readable geometry plus a visible template:

- canvas: 384×384, centre line x=192, feet baseline y=300;
- `bodyMaskMale` and `bodyMaskFemale`: the only legal exposed-body silhouettes;
- `faceBox` and per-model scalp/ear landmarks: faces may draw only here;
- `hairEnvelope`: hair may exceed the scalp only within this reviewed region;
- `neckSeam`: armour must overlap below this curve, never leave a chin gap, and
  must not cross into face pixels unless the item intentionally includes a helm;
- `leftHandSocket` and `rightHandSocket`: fixed wrist, palm, and finger masks;
- `weaponGrip`: fixed pivot, angle, and depth transition used by every sword;
- `weaponEnvelope`: maximum legal sword extent with safety padding from canvas
  edges and the activity/nameplate region; and
- `groundZone`: boots may touch the baseline but no visible pixel may fall below
  it (the procedural ground shadow is rendered separately).

Exact face, hair, neck, hand, and weapon coordinates are deliberately finalized
from the approved body masters rather than guessed now. Once frozen, they are
versioned data—not prompt prose—and changing them invalidates every dependent
asset. Alpha-mask intersection tests enforce “must be inside,” “must cover,” and
“must not touch” rules. Bounding boxes alone are insufficient around the curved
neck, fingers, ears, and hairline.

The production layer order is:

1. procedural ground shadow;
2. `weaponBack`;
3. bald body plus modesty layer;
4. selected face;
5. model-specific full-body armour;
6. grayscale hairstyle tinted at runtime;
7. `weaponFront`;
8. procedural activity icon; and
9. existing nameplate/emote UI.

Every layer is drawn from the complete 384×384 source canvas using one destination
rectangle. The renderer must never crop to an asset's visible bounds or maintain
per-item offsets. Canvas state is bracketed with `save()`/`restore()` so tinting,
clipping, alpha, and compositing cannot leak into later world rendering.

## Technical research applied

The plan follows the browser Canvas model rather than relying on editor-specific
layer behavior:

- [`drawImage()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)
  accepts explicit source and destination rectangles. The renderer therefore
  always uses the full registered source canvas and one destination rectangle.
- [`save()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/save)
  and [`restore()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/restore)
  preserve and restore drawing state. Every composite is isolated so transforms,
  clips, alpha, and blend modes do not leak.
- [`globalCompositeOperation`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation)
  supplies the multiply and destination-mask operations needed for shaded hair
  tinting, while the original hair alpha is reapplied after tinting.
- [`clip()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/clip)
  intersects the current clip region. Repeated ad hoc clipping would therefore
  be fragile; named masks and a fresh saved state are used for each layer.
- [`imageSmoothingEnabled`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled)
  controls scaling interpolation. It remains disabled for the pixel-art result.
- The [HTML Canvas 2D specification](https://html.spec.whatwg.org/multipage/canvas.html)
  defines drawing-state, clipping, compositing, and image-source behavior; the
  registration contract is designed around those deterministic primitives.

The practical production conclusion is equally important: generative image
models are good at proposing designs but are not registration tools. Coordinates,
coverage, and occlusion are supplied by checked-in masks and templates, corrected
locally, and tested after generation. Dependent layers are generated or edited
against the locked base reference, never independently from text prompts.

## Equipment design language and tier progression

Every armour and sword is designed from its exact gameplay name, material tier,
family, rarity, and catalogue colour. Colour alone is not enough: silhouettes,
surface response, construction, and ornament must make adjacent tiers distinct.
Heavy armour consistently emphasizes plate, mass, broad shoulders, and protection;
light armour uses fitted panels, leather/cloth joins, mobility, and a narrower
silhouette. Both remain recognizably related within one material tier.

Progression must be visible without making early equipment look unfinished.
Copper, Bronze, and Iron are practical equipment with simple construction and
little ornament. Steel through Sunsteel become cleaner and more deliberate.
Runite through Wyrmsteel introduce stronger silhouettes and restrained magical
accents. Glacial through Voidsteel feel rare and supernatural. Wyrmforged,
Ancient, and Ascendant have the greatest gravitas, but still obey the same body,
face, hand, and weapon boundaries. Higher level means more authority, material
quality, controlled contrast, and authored focal points—not indiscriminate glow,
noise, spikes, or ever-larger geometry.

| Tier | Material and exact sword name   | Armour and weapon visual language                                                                                             |
| ---: | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
|    1 | Copper — Copper Sword           | Hammered warm copper, plain leather ties, small simple guard, visible practical rivets, almost no decoration.                 |
|    2 | Bronze — Bronze Sword           | Slightly stronger golden-brown cast, cleaner cast fittings, modest reinforced edges; still workmanlike and plain.             |
|    3 | Iron — Iron Sword               | Dark utilitarian iron, sturdy rectangular plates and direct construction, minimal polish, no magical effects.                 |
|    4 | Steel — Steel Sword             | Cleaner cool steel, improved symmetry and tailoring, crisp bevel highlights, first restrained heraldic line.                  |
|    5 | Mithril — Mithril Sword         | Lighter blue-silver metal, slimmer high-quality construction, fine etched channels without glow.                              |
|    6 | Sunsteel — Sunsteel Sword       | Warm gold-orange highlights, sun-ray geometry used sparingly at chest/guard, polished but not yet regal.                      |
|    7 | Runite — Runite Sword           | Deep red mineral metal, angular rune cuts and a broader greatsword silhouette; a small controlled rune accent.                |
|    8 | Shadowsteel — Shadowsteel Sword | Near-black violet metal, low-reflective planes and sharp negative shapes, subtle purple edge light rather than a black blob.  |
|    9 | Froststeel — Froststeel Sword   | Cold blue steel, pale bevels and restrained frost etching; solid forged metal rather than transparent ice.                    |
|   10 | Wyrmsteel — Wyrmsteel Sword     | Blue-grey scale motifs, swept draconic lines and a stronger blade spine, imposing but still engineered.                       |
|   11 | Glacial — Glacial Sword         | Crystalline cyan facets over a credible structural core, icy highlights and greater presence without fuzzy glow.              |
|   12 | Starsteel — Starsteel Sword     | Midnight blue metal with sparse star points, precise celestial inlay and high contrast at selected focal areas.               |
|   13 | Voidsteel — Voidsteel Sword     | Very dark purple-black mass broken by a few readable violet seams, unusual cut-outs contained inside safe envelopes.          |
|   14 | Wyrmforged — Wyrmforged Sword   | Dark red-black forge metal, mature dragon-scale/rib language and ember accents; legendary weight without excessive flames.    |
|   15 | Ancient — Ancient Sword         | Aged bronze-gold/brown relic metal, monumental geometry, worn engraved bands and restrained patina suggesting history.        |
|   16 | Ascendant — Ascendant Sword     | Most refined gold/ivory authority, balanced radiant accents, crown-like geometry and the clearest focal hierarchy in the set. |

The table is an art brief, not permission to override the catalogue. Exact IDs,
names, tier order, rarity, and configured colours are read from generated release
content at build time. Contact sheets are always ordered by tier so accidental
regressions—such as a Copper set looking more elaborate than Ascendant—are easy
to spot.

Each tier review includes four armour views (heavy/light × male/female), the
equipped sword, and silhouettes rendered in flat black. Reviewers score material
recognition, heavy/light family distinction, NPC-style match, game-scale clarity,
and progression on a fixed rubric. A tier fails if its identity depends only on
a hue shift, if ornament reads as random detail at 72 world pixels, or if its
silhouette has more visual authority than a meaningfully higher tier without a
documented reason.

## Image-production method

Generation is a concept and source-art tool, not an unattended one-shot batch.
The supplied example and the armour uploads are style references only.

1. Generate several paired male/female base concepts on a flat removable
   chroma-key background, front-facing in the same neutral stance, using the NPC
   reference board and measured style sheet as explicit image references.
2. Approve one direction, then refine each body separately. Freeze proportions,
   centre line, feet, palette, light direction, outline weight, neck boundary,
   bald scalp, fixed hand pose, modesty garment, and registration geometry in a
   versioned style sheet.
3. Remove the key locally, normalize to the canonical canvas, and validate alpha,
   bounds, anchor, and in-game readability. If hair edges cannot survive this
   workflow, native transparency requires a separately approved fallback.
4. Generate faces and hair against the locked bodies. Review contact sheets
   before isolating final layers. Convert hair masters to grayscale and test them
   with very light, dark, saturated, and muted runtime colours.
5. Make one sword proof and one early-tier heavy and light armour proof for both
   bodies. Use the
   locked body as the reference and deterministic local masks/compositing to
   preserve alignment. Test the sword both with the base and all four armour
   proofs. Do not batch either catalogue until the occlusion tests pass.
6. Produce remaining armour in small tier batches. Every record is keyed by the
   real item ID (for example `copper_heavy_armor`) and owns `male` and `female`
   variants. Each prompt includes the row from the material brief plus the exact
   catalogue name, rarity, and colour. Generated output remains draft art until
   it passes all gates.
7. Produce the 16 tier swords from one approved silhouette/registration template.
   Vary material, ornament, and blade language without moving the grip, changing
   the angle, or exceeding the weapon envelope.

Every prompt repeats the invariants: exact front view, neutral stance, full
character, bald scalp for body masters, identical proportions and anchor, flat
removable background, no cast shadow, no baked-in weapon, no text, no extra
accessories, and no pose change. Armour prompts also specify the tier/material
and approved heavy or light silhouette. Sword prompts generate the isolated
weapon against the registration template, never a new character holding it.

## Visual progress: Avatar Lab

Before art batching, build a development-only Avatar Lab route. It will show the
384×384 source composite beside the real in-game scale and provide:

- model, face, hairstyle, hair-colour, armour, sword, and activity controls;
- checkerboard, light, dark, and representative world backgrounds;
- layer visibility toggles plus centre-line and foot-anchor guides;
- overlays for body masks, face/hair envelopes, neck seam, hand sockets, weapon
  envelope, grip pivot, and illegal-pixel heat maps;
- previous/next navigation across the gameplay armour catalogue;
- a tier-progression strip that presents all armour and swords from Copper to
  Ascendant at identical scale, with optional grayscale and silhouette modes;
- a male/female contact-sheet comparison; and
- visible loading, missing-asset, and invalid-manifest failures.

Each art phase lands in a reviewable commit with contact-sheet screenshots. The
lab is the progress dashboard, so style and fit can be approved before dozens of
variants are produced. Gameplay does not switch renderers during art review.

## Phases and acceptance gates

### Phase 0 — specification and inventory

Freeze file naming, the registration map, 32 gameplay armour IDs, 16 sword IDs,
hairstyle compatibility, skin-tone strategy, activity list, NPC reference board,
measured style sheet, material brief, and acceptance rubric. Deliver
manifest/mask schemas and prompt templates. **Gate:** no unresolved catalogue,
style, progression, occlusion, or model-compatibility decisions.

### Phase 1 — Avatar Lab and renderer foundation

Implement manifest loading, dimension/alpha checks, shared-transform composition,
hair tinting, split-weapon compositing, activity indicators, and the lab. Keep
`KnightRig` as default.
**Gate:** reference layers swap without code changes and invalid assets fail
clearly in development.

### Phase 2 — lock two body models

Generate paired concepts, review at source and game scale, and approve one male
and one female bald base with a close-fitting modesty layer and identical grip
socket. Export canonical transparent masters, masks, and checksums. **Gate:**
equal scale, exact x=192/y=300 alignment, no clothing silhouette leakage, and
matching hand/grip geometry.

### Phase 3 — faces and hairstyles

Create four faces per model and ten grayscale hairstyles. Each hairstyle declares
male, female, or universal compatibility. **Gate:** every valid combination fits;
tints preserve shading with no fringe or baked colour.

### Phase 4 — armour and sword occlusion proofs

Create early-tier heavy and light proofs for both bodies. Test neck, hands, feet,
hair overlap, clothing coverage, and a two-slice sword. **Gate:** all four armour
proofs plus the sword pass at 384×384 and game scale, with the grip readable and
no impossible hand/blade ordering.

### Phase 5 — armour and sword production

Work through 16 material tiers in reviewable batches. Each tier has heavy/light ×
male/female outputs. **Gate per batch:** contact sheet, manifest validation,
transparency check, alignment diff, material/rubric review, progression comparison
against adjacent tiers, and in-game preview. Expected total: 64 PNGs.
Then produce 16 registered sword bundles and review their reach against both
models and every armour silhouette. A bundle may contain one or two PNGs depending
on whether it crosses the hand/body depth boundary.

### Phase 6 — gameplay integration

Map saved appearance and equipped armour/weapon item IDs to visuals; render local and remote
players behind a feature flag; persist model, face, and hair selections. Movement,
combat, inventory, stats, save/load, Canvas timing, and multiplayer authority stay
unchanged. **Gate:** old saves load and missing cosmetics fall back safely.

### Phase 7 — rollout and cleanup

Run visual regression, performance, multiplayer, save-migration, and gameplay
smoke tests. Enable gradually. Remove `KnightRig` only in a later, separately
approved change after the fallback period.

## Automated and visual quality checks

The asset checker rejects duplicate or unknown IDs, missing files, non-PNG raster
assets, non-384×384 canvases, missing alpha, fully opaque backgrounds, pixels
outside slot masks/envelopes, uncovered required regions, invalid model
compatibility, body hair pixels, modesty-layer silhouette leakage, armour/sword
IDs absent from the gameplay catalogue, grip-pivot drift, and mismatched paired
weapon layers.

Human review additionally checks silhouette consistency, edge quality, face/hair
fit, neck coverage, clipping, recognisability at game scale, tint extremes, and
male/female parity. Sword review also checks hand readability, believable depth,
clear separation from the activity icon/nameplate, and visual balance while the
character moves. Those art qualities cannot be established by automation alone.

## Approvals needed before final art

Phase 1 can start immediately. Before Phase 2 finals, approve the preferred base
concept, whether every hairstyle must fit both models or may be model-specific,
the supported skin tones, and the activity-icon look/list. These are short art
direction checkpoints, not dependencies on the discarded Replit pack.

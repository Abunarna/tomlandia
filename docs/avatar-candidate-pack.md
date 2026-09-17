# Avatar candidate-pack handoff

The Avatar Lab can now load a replaceable JSON manifest without recompiling the
application. Candidate files must be served from the same origin under
`/assets/avatar/`; remote URLs are rejected so Canvas pixel inspection cannot be
broken by cross-origin security rules.

## Try a candidate

1. Put the candidate PNGs under `public/assets/avatar/candidate/`.
2. Add `public/assets/avatar/candidate/manifest.json` using manifest version 1.
3. Run `bun run avatar:candidate-check -- public/assets/avatar/candidate/manifest.json`.
4. Run `bun run dev` and open `/avatar-lab`.
5. Enter `/assets/avatar/candidate/manifest.json` and select **Load candidate**.

The loader validates JSON shape, 384×384 registration, safe asset paths, exact
release equipment IDs, four faces per model, ten hairstyles, both model variants
for every armour, and all sixteen heavy/light/sword tiers before activating the
pack. Image preload then checks each URL, dimensions, transparency, visible
pixels, and the registration masks. A failure leaves the current manifest active
and displays the reason in the lab.

The command-line preflight resolves every manifest URL to its corresponding file
under `public/`, rejects missing or unreadable files, checks the PNG signature,
and enforces the 384×384 8-bit RGBA header before a browser review begins. It
deduplicates deliberately shared URLs while a pack remains in reference status.

A candidate may use `status: "reference"` during iteration. `status:
"production"` means only that the pack is requesting production review; it does
not bypass catalogue, image, mask, visual, or approval gates.

A production-status pack also cannot reuse geometry-proof URLs or point several
catalogue entries at one generic picture. Every face, hairstyle, male armour,
female armour, and sword must have its own artwork URL. Each armour ID requires
separate male/female files, and every large sword requires both rear and front
slices around the fixed hand grip. Keep body-only and partial packs at
`status: "reference"` while they borrow the checked geometry proofs.

## Body fragment

```json
{
  "version": 1,
  "status": "reference",
  "registration": {
    "width": 384,
    "height": 384,
    "pivotX": 192,
    "footY": 300,
    "masks": {
      "bodyMale": "/assets/avatar/candidate/masks/body-male.png",
      "bodyFemale": "/assets/avatar/candidate/masks/body-female.png",
      "face": "/assets/avatar/candidate/masks/face.png",
      "hair": "/assets/avatar/candidate/masks/hair.png",
      "neckSeam": "/assets/avatar/candidate/masks/neck-seam.png",
      "gripSocket": "/assets/avatar/candidate/masks/grip-socket.png",
      "weapon": "/assets/avatar/candidate/masks/weapon.png"
    }
  },
  "bodies": {
    "male": {
      "skinUrl": "/assets/avatar/candidate/body/skin-male.png",
      "modestyUrl": "/assets/avatar/candidate/body/modesty-male.png"
    },
    "female": {
      "skinUrl": "/assets/avatar/candidate/body/skin-female.png",
      "modestyUrl": "/assets/avatar/candidate/body/modesty-female.png"
    }
  }
}
```

The complete manifest must also contain `faces`, `hairstyles`, `armour`,
`weapons`, and `activities` arrays matching the TypeScript contract in
`src/game/player-avatar.ts`.

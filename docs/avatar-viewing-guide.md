# How to view the avatar work

You do not need to know how to code. There are three useful ways to look at the current work.

## Easiest: open the audit picture

In Lovable or GitHub, open `docs`, then `images`, then click `avatar-stage-1-composite-audit.png`. This is one picture showing several male/female combinations. You can download it and open it like any other image.

The colourful figures are **alignment proofs**, not the final character art. They deliberately use simple blocks so incorrect layer positions are easy to see.

## Interactive Avatar Lab

If the project is open in Lovable, use its preview address and add `/avatar-lab` to the end. For example:

```text
https://your-preview-address.example/avatar-lab
```

If the project is on your computer:

1. Open a terminal in the Tomlandia project folder.
2. Run `bun install` once, if dependencies have not been installed.
3. Run `bun run avatar:lab`.
4. Your browser should open the Avatar Lab. If it does not, copy the `Local` address printed in the terminal and add `/avatar-lab`.
5. Leave the terminal open while viewing the lab. Press **Ctrl+C** in the terminal when finished.

In the lab, use the dropdowns to switch sex/model, face, hairstyle, armour tier, light/heavy armour, sword, colour, and activity. “Game scale” is the important small preview; “source scale” is for inspecting pixels and alignment guides.

## Open one layer by itself

The individual proof layers are in `public/assets/avatar/reference/`. Click a filename such as `hair-1.png`, `armour-heavy-male.png`, or `sword-front.png` in Lovable/GitHub to see it.

Transparent areas may appear white, black, or checkerboard depending on the viewer. That is normal. Do not judge a layer's position by itself: all layers use the full 384×384 canvas and are intended to be stacked without cropping.

## What feedback is most useful

When reviewing, say which view and selection you used, then comment on:

- overall body proportions and stance;
- whether the face and hair sit naturally;
- whether heavy and light armour look distinct;
- whether the large sword reads clearly without hiding the character;
- whether low tiers look appropriately plain and high tiers feel more imposing; and
- whether the result remains readable in the small game-scale preview.

Screenshots with a circle or arrow are welcome. Final-art approval should wait for the first NPC-style bald body candidate; the current PNGs prove the technical overlay system only.

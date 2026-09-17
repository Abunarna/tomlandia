# Avatar Stage 2: first candidate bodies

Stage 2 begins with exactly two generated candidates: one bald, lightly dressed male body and one bald, lightly dressed female body. The locked machine-readable briefs are in `content/avatar/candidate-generation-briefs.json`.

This intentionally does **not** batch-generate armour, faces, hairstyles, or swords. If the base anatomy, stance, head envelope, neck seam, or grip is wrong, every later layer would inherit the error. Both candidates must therefore pass the shared 384×384 registration and game-scale review before production expands.

## Generation procedure

1. Use the supplied Adventurer and Desert Spearman only as style references—not edit targets.
2. Generate each body separately on the specified flat chroma-key background.
3. Remove the key locally, retain a lossless intermediate, and inspect the edge for green spill.
4. Place the transparent candidate at its declared output path without cropping or repositioning it independently.
5. Trace candidate-owned body, neck, face/hair, and grip masks from the approved pixels.
6. Load both through a candidate manifest in the Avatar Lab and review at source and game scale.
7. Reject both candidates if their registration sockets do not agree; never repair a mismatch with a runtime offset.

Run `bun run avatar:briefs-check` whenever the briefs change. After both bodies are approved, the next controlled generation round is Copper heavy/light armour plus a Copper sword, followed by one high-tier Glacial or Shadowsteel extreme. Only then should the full catalogue be scheduled.

The current execution environment does not expose the built-in image-generation tool, so this slice locks and validates the prompts rather than silently substituting procedural geometry or an unapproved API/model. The existing proof PNGs remain technical placeholders until a genuine candidate-generation run is available.

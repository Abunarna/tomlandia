# Avatar style references

This folder accepts lossless source PNG or JPEG images used to calibrate Tomlandia's avatar art. Reference images are evidence, not runtime avatar layers; unlike production layers, they do not need transparency or a 384×384 canvas.

Keep each original filename and file byte-for-byte intact. Add one entry to `manifest.json` with a stable `id`, `filename`, `label`, `role` (`npc`, `body`, `face`, `hair`, `armour`, or `weapon`), `source`, and optional `notes`. Do not crop, resize, remove backgrounds, or overwrite source files during intake.

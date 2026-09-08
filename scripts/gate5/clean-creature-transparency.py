"""Remove known off-white background remnants trapped inside creature silhouettes.

The source artwork contains deliberate pale highlights, so cleanup is constrained to
reviewed rectangles rather than applying a destructive global colour key.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CREATURES = ROOT / "public/assets/creatures"
METADATA = ROOT / "content/v2/sprite-metadata.json"

# Inclusive pixel rectangles containing only background gaps and their antialiasing.
MASKS: dict[str, tuple[tuple[int, int, int, int], ...]] = {
    "dust_jackal": ((37, 86, 58, 114),),
    "forest_lynx": ((39, 89, 58, 114),),
    "goblin": ((36, 85, 58, 110), (62, 51, 72, 76)),
    "goblin_brute": ((25, 70, 41, 136), (52, 109, 74, 143), (84, 70, 93, 99)),
    "ironback_boar": ((31, 103, 35, 114), (47, 104, 70, 117), (82, 103, 86, 113)),
    "mithril_stalker": ((36, 83, 76, 146),),
    "shadow_beast": ((41, 97, 81, 119),),
    "withered_ghoul": ((33, 92, 55, 143),),
    "wolf": ((40, 85, 58, 117),),
    "wyrm_knight": ((17, 68, 30, 113), (17, 124, 24, 148), (34, 132, 56, 149), (60, 68, 70, 90)),
}


def is_background(r: int, g: int, b: int, alpha: int) -> bool:
    return alpha > 0 and min(r, g, b) >= 210 and max(r, g, b) - min(r, g, b) <= 18


def clean(path: Path, rectangles: tuple[tuple[int, int, int, int], ...]) -> int:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    removed = 0
    for left, top, right, bottom in rectangles:
        for y in range(top, bottom + 1):
            for x in range(left, right + 1):
                r, g, b, alpha = pixels[x, y]
                if is_background(r, g, b, alpha):
                    pixels[x, y] = (r, g, b, 0)
                    removed += 1
    image.save(path, optimize=True)
    return removed


def main() -> None:
    metadata = json.loads(METADATA.read_text())
    by_kind = {sprite["kind"]: sprite for sprite in metadata["sprites"]}
    total = 0
    for kind, rectangles in MASKS.items():
        path = CREATURES / f"{kind}.png"
        removed = clean(path, rectangles)
        total += removed
        by_kind[kind]["padded_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        print(f"{kind}: removed {removed} background pixels")
    METADATA.write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Removed {total} background pixels from {len(MASKS)} creature sprites")


if __name__ == "__main__":
    main()

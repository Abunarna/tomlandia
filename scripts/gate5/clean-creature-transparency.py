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
    "forest_boar": ((43, 96, 64, 109),),
    "forest_lynx": ((39, 89, 58, 114),),
    "frost_wolf": ((34, 83, 63, 119),),
    "goblin": ((36, 85, 58, 110), (62, 51, 72, 76)),
    "goblin_brute": ((25, 70, 41, 136), (52, 109, 74, 143), (84, 70, 93, 99)),
    "ironback_boar": ((31, 103, 35, 114), (47, 104, 70, 117), (82, 103, 86, 113)),
    "mithril_stalker": ((36, 83, 76, 146),),
    "scorpion_stalker": ((15, 70, 116, 124),),
    "shadow_beast": ((41, 97, 81, 119),),
    "withered_ghoul": ((33, 92, 55, 143),),
    "wolf": ((40, 85, 58, 117),),
    "wyrm_knight": ((17, 68, 30, 113), (17, 124, 24, 148), (34, 132, 56, 149), (60, 68, 70, 90)),
    "yeti": ((43, 103, 69, 127),),
}


def is_background(r: int, g: int, b: int, alpha: int) -> bool:
    return alpha > 0 and min(r, g, b) >= 170 and max(r, g, b) - min(r, g, b) <= 25


def recolor_scorpion_pincer(path: Path) -> int:
    """Replace the trapped white on the raised pincer with its brown shell palette."""
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    changed = 0
    for y in range(37, 62):
        for x in range(58, 77):
            r, g, b, alpha = pixels[x, y]
            if is_background(r, g, b, alpha):
                shade = max(0.72, min(1.18, (r + g + b) / (3 * 225)))
                pixels[x, y] = (
                    round(112 * shade),
                    round(67 * shade),
                    round(38 * shade),
                    alpha,
                )
                changed += 1
    image.save(path, optimize=True)
    return changed


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
    recolored = recolor_scorpion_pincer(CREATURES / "scorpion_stalker.png")
    for kind, rectangles in MASKS.items():
        path = CREATURES / f"{kind}.png"
        removed = clean(path, rectangles)
        total += removed
        by_kind[kind]["padded_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        print(f"{kind}: removed {removed} background pixels")
    METADATA.write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Removed {total} background pixels from {len(MASKS)} creature sprites")
    print(f"Recolored {recolored} pixels on the scorpion's raised pincer")


if __name__ == "__main__":
    main()

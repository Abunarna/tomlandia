import fieldsTile from "@/assets/biome-fields.jpg.asset.json";
import forestTile from "@/assets/biome-forest.jpg.asset.json";
import desertTile from "@/assets/biome-desert.jpg.asset.json";
import evilTile from "@/assets/biome-evil.jpg.asset.json";
import winterTile from "@/assets/biome-winter.jpg.asset.json";

/** biome id -> tileable ground texture (added one biome at a time) */
const TILE_SRC: Record<string, string> = {
  fields: fieldsTile.url,
  forest: forestTile.url,
  desert: desertTile.url,
  evil: evilTile.url,
  winter: winterTile.url,
};

/** how many world pixels one tile covers */
const TILE_WORLD = 640;

const images = new Map<string, HTMLImageElement>();
const ready = new Set<string>();
let onReady: (() => void) | null = null;

/** called once a tile finishes decoding so the terrain cache can be rebuilt */
export function onBiomeTileReady(cb: () => void) {
  onReady = cb;
}

function load(id: string): HTMLImageElement | null {
  const src = TILE_SRC[id];
  if (!src) return null;
  let img = images.get(id);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = () => {
      ready.add(id);
      onReady?.();
    };
    img.src = src;
    images.set(id, img);
  }
  return ready.has(id) ? img : null;
}

/**
 * Repeating ground pattern for a biome, scaled so one tile spans TILE_WORLD
 * world pixels. Returns null while the image is still loading (or if the
 * biome has no texture yet) so callers fall back to the flat gradient.
 */
export function biomePattern(ctx: CanvasRenderingContext2D, id: string): CanvasPattern | null {
  const img = load(id);
  if (!img) return null;
  const pat = ctx.createPattern(img, "repeat");
  if (!pat) return null;
  const s = TILE_WORLD / img.width;
  pat.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0]));
  return pat;
}

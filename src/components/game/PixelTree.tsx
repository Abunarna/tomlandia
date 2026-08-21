import { treePaletteFor, type TreePalette } from "@/game/tree-sprite";

export { treePaletteFor };
export type { TreePalette };

/**
 * 16x20 pure-CSS pixel-art tree.
 * The silhouette is static; the canopy and bark colours come from CSS custom
 * properties supplied by the `.tree-*` palette classes in src/styles.css.
 */
export function PixelTree({
  palette = "oak",
  className = "size-9",
}: {
  palette?: TreePalette;
  className?: string;
}) {
  return (
    <span className={`@container relative grid shrink-0 place-items-center ${className}`}>
      <span className={`fantasy-tree tree-${palette}`} aria-hidden="true" />
    </span>
  );
}

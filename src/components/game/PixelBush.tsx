import { bushPaletteFor, type BushPalette } from "@/game/bush-sprite";

export { bushPaletteFor };
export type { BushPalette };

/**
 * 10x8 pure-CSS pixel-art bush.
 * The silhouette is static; leaf and berry colours come from CSS custom
 * properties supplied by the `.bush-*` palette classes in src/styles.css.
 */
export function PixelBush({
  palette = "berry",
  className = "size-9",
}: {
  palette?: BushPalette;
  className?: string;
}) {
  return (
    <span className={`@container relative grid shrink-0 place-items-center ${className}`}>
      <span className={`fantasy-bush bush-${palette}`} aria-hidden="true" />
    </span>
  );
}

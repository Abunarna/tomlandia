import { orePaletteFor, type OrePalette } from "@/game/ore-sprite";

export { orePaletteFor };
export type { OrePalette };

/**
 * 16x16 pure-CSS pixel-art ore rock.
 * The rock body is static; the vein colours come from four CSS custom
 * properties supplied by the `.ore-*` palette classes in src/styles.css.
 */
export function OreRock({
  palette = "iron",
  className = "size-9",
}: {
  palette?: OrePalette;
  className?: string;
}) {
  return (
    <span className={`@container relative grid shrink-0 place-items-center ${className}`}>
      <span className={`fantasy-ore ore-${palette}`} aria-hidden="true" />
    </span>
  );
}

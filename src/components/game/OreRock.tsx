/**
 * 16x16 pure-CSS pixel-art ore rock.
 * The rock body is static; the vein colours come from four CSS custom
 * properties supplied by the `.ore-*` palette classes in src/styles.css.
 */
export type OrePalette =
  | "copper"
  | "gold"
  | "iron"
  | "emerald"
  | "amethyst"
  | "mithril";

/** Map an inventory item id (or node kind) onto a metal palette. */
export function orePaletteFor(id: string): OrePalette {
  const s = id.toLowerCase();
  if (s.includes("copper")) return "copper";
  if (s.includes("gold")) return "gold";
  if (s.includes("mithril")) return "mithril";
  if (s.includes("rune") || s.includes("runite") || s.includes("emerald")) return "emerald";
  if (s.includes("cursed") || s.includes("shard") || s.includes("amethyst")) return "amethyst";
  return "iron";
}

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

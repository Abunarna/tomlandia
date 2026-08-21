import { Shield, Sword } from "lucide-react";
import type { ItemDef, ItemFamily } from "@/game/types";
import { OreRock, orePaletteFor } from "./OreRock";

/* Shared look: solid fill from the item colour, subtle dark outline, light highlight. */
const STROKE = "rgba(0,0,0,0.35)";
const LIGHT = "rgba(255,255,255,0.45)";

type ShapeProps = { color: string };

const Ore = ({ color }: ShapeProps) => (
  <>
    <polygon points="4,15 8,7 16,6 20,13 15,20 7,20" fill={color} stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
    <polygon points="8,8 14,7 12,12" fill={LIGHT} />
  </>
);

const Log = ({ color }: ShapeProps) => (
  <>
    <rect x="3" y="7" width="18" height="10" rx="5" fill={color} stroke={STROKE} strokeWidth="1.2" />
    <ellipse cx="18" cy="12" rx="3" ry="5" fill={LIGHT} stroke={STROKE} strokeWidth="1" />
  </>
);

const Herb = ({ color }: ShapeProps) => (
  <>
    <path d="M12 21V9" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M12 12C7 12 5 9 5 5c4 0 7 3 7 7z" fill={color} stroke={STROKE} strokeWidth="1.1" />
    <path d="M12 14c5 0 7-3 7-7-4 0-7 3-7 7z" fill={color} stroke={STROKE} strokeWidth="1.1" />
    <path d="M13.5 9.5c1.5-1 2.5-2 3-3.2" stroke={LIGHT} strokeWidth="1.2" strokeLinecap="round" />
  </>
);

const Berries = ({ color }: ShapeProps) => (
  <>
    <circle cx="9" cy="15" r="4.2" fill={color} stroke={STROKE} strokeWidth="1.1" />
    <circle cx="15.5" cy="16" r="3.4" fill={color} stroke={STROKE} strokeWidth="1.1" />
    <circle cx="12.5" cy="9.5" r="3.4" fill={color} stroke={STROKE} strokeWidth="1.1" />
    <circle cx="8" cy="13.5" r="1.1" fill={LIGHT} />
  </>
);

const Hide = ({ color }: ShapeProps) => (
  <>
    <path
      d="M7 4c2 1.5 8 1.5 10 0 1.5 2-1 4-1 6s2.5 4 1 6c-2-1.5-8-1.5-10 0-1.5-2 1-4 1-6S5.5 6 7 4z"
      fill={color}
      stroke={STROKE}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M10 7c-.8 1.6-.8 3.4 0 5" stroke={LIGHT} strokeWidth="1.2" strokeLinecap="round" fill="none" />
  </>
);

const Feather = ({ color }: ShapeProps) => (
  <>
    <path d="M18 4c-7 1-11 5-12 12l3 .5C10 10 13 6.5 18 4z" fill={color} stroke={STROKE} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M9 16.5 5.5 20" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M15 6.5c-3 1.8-5 4.5-6 8" stroke={LIGHT} strokeWidth="1" strokeLinecap="round" fill="none" />
  </>
);

const Charm = ({ color }: ShapeProps) => (
  <>
    <path d="M12 3.5 4.5 8v8L12 20.5 19.5 16V8L12 3.5z" fill={color} stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M12 3.5 4.5 8l7.5 4 7.5-4-7.5-4.5z" fill={LIGHT} />
  </>
);

const Bar = ({ color }: ShapeProps) => (
  <>
    <path d="M4 16h16l-2.5-5h-11L4 16z" fill={color} stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M6.5 11 8 8h8l1.5 3h-11z" fill={color} stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M8.5 9h6" stroke={LIGHT} strokeWidth="1.2" strokeLinecap="round" />
  </>
);

const Cloth = ({ color }: ShapeProps) => (
  <>
    <path
      d="M4 6c3 2 5 2 8 0s5-2 8 0v11c-3-2-5-2-8 0s-5 2-8 0V6z"
      fill={color}
      stroke={STROKE}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M6 9.5c3 1.6 5 1.6 8 0" stroke={LIGHT} strokeWidth="1.1" fill="none" strokeLinecap="round" />
  </>
);

const Bun = ({ color }: ShapeProps) => (
  <>
    <path d="M3.5 15c0-5 3.8-8 8.5-8s8.5 3 8.5 8H3.5z" fill={color} stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
    <rect x="3" y="15" width="18" height="4" rx="2" fill={color} stroke={STROKE} strokeWidth="1.2" />
    <path d="M8 11c1.2-1.4 2.6-2.2 4-2.5" stroke={LIGHT} strokeWidth="1.2" strokeLinecap="round" fill="none" />
  </>
);

const Pie = ({ color }: ShapeProps) => (
  <>
    <path d="M12 5 3.5 19h17L12 5z" fill={color} stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M7 15h10" stroke={STROKE} strokeWidth="1.1" strokeLinecap="round" />
    <path d="M11 8.5 8.5 13" stroke={LIGHT} strokeWidth="1.2" strokeLinecap="round" />
  </>
);

const Stew = ({ color }: ShapeProps) => (
  <>
    <path d="M4 10h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-3z" fill={color} stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M4 10h16" stroke={STROKE} strokeWidth="1.2" />
    <path d="M9 5c-.8 1.2.8 2 0 3.2M14 5c-.8 1.2.8 2 0 3.2" stroke={LIGHT} strokeWidth="1.2" strokeLinecap="round" fill="none" />
  </>
);

const Tonic = ({ color }: ShapeProps) => (
  <>
    <path d="M10 3h4v4l3.2 5.6A5 5 0 0 1 12.8 20h-1.6a5 5 0 0 1-4.4-7.4L10 7V3z" fill={color} stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
    <rect x="9.2" y="2" width="5.6" height="2.4" rx="1.2" fill={LIGHT} stroke={STROKE} strokeWidth="1" />
    <circle cx="10.5" cy="15.5" r="1.2" fill={LIGHT} />
  </>
);

const Fish = ({ color }: ShapeProps) => (
  <>
    <path
      d="M3.5 12c3-4.5 7-6.5 11-6.5 2.6 0 4.6.9 6 2.3-1.4 1.4-2 2.7-2 4.2s.6 2.8 2 4.2c-1.4 1.4-3.4 2.3-6 2.3-4 0-8-2-11-6.5z"
      fill={color}
      stroke={STROKE}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M3.5 12 7 9.5v5L3.5 12z" fill={color} stroke={STROKE} strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="16.5" cy="10.5" r="1" fill={STROKE} />
    <path d="M9 8.8c1.6-.9 3.2-1.3 4.8-1.3" stroke={LIGHT} strokeWidth="1.2" strokeLinecap="round" fill="none" />
  </>
);

const Potion = ({ color }: ShapeProps) => (
  <>
    <path d="M9.5 2.5h5v3.2l2.6 4A6 6 0 0 1 12.3 21h-.6A6 6 0 0 1 6.9 9.7l2.6-4V2.5z" fill={color} stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
    <rect x="8.8" y="1.5" width="6.4" height="2.4" rx="1.2" fill={LIGHT} stroke={STROKE} strokeWidth="1" />
    <path d="M8.6 13.5c2.4 1.2 4.4 1.2 6.8 0" stroke={LIGHT} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    <circle cx="10.6" cy="17" r="1" fill={LIGHT} />
  </>
);

const SHAPES: Record<Exclude<ItemFamily, "weapon" | "armor">, (p: ShapeProps) => React.ReactElement> = {
  ore: Ore,
  log: Log,
  herb: Herb,
  berries: Berries,
  hide: Hide,
  leather: Hide,
  feather: Feather,
  charm: Charm,
  bar: Bar,
  cloth: Cloth,
  bun: Bun,
  pie: Pie,
  stew: Stew,
  tonic: Tonic,
  fish: Fish,
  potion: Potion,
};


/** Lucide gear badge — the same treatment the equipment slots use. */
export function GearBadge({
  kind,
  color,
  className = "size-9",
}: {
  kind: "weapon" | "armor";
  color?: string | undefined;
  className?: string | undefined;
}) {
  const Icon = kind === "weapon" ? Sword : Shield;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl ${className}`}
      style={{ backgroundColor: color ?? "var(--muted)" }}
    >
      <Icon className="size-[55%] text-foreground/80" />
    </span>
  );
}

export function ItemIcon({ item, className = "size-9" }: { item: ItemDef; className?: string }) {
  const family: ItemFamily =
    item.family ?? (item.kind === "weapon" ? "weapon" : item.kind === "armor" ? "armor" : "ore");

  if (family === "weapon" || family === "armor") {
    return <GearBadge kind={family} color={item.color} className={className} />;
  }

  if (family === "ore") {
    return <OreRock palette={orePaletteFor(item.id)} className={className} />;
  }

  const Shape = SHAPES[family] ?? Ore;
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl bg-muted/60 ${className}`} title={item.name}>
      <svg viewBox="0 0 24 24" className="size-[86%]" role="img" aria-label={item.name}>
        <Shape color={item.color} />
      </svg>
    </span>
  );
}

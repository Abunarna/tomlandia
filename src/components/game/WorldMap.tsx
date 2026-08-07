import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  BARRIERS,
  BIOMES,
  BUILDINGS,
  NPCS,
  NPC_ICONS,
  WORLD_H,
  WORLD_W,
} from "@/game/data";

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 10;
/** >1 makes pinch zoom move faster than the raw finger distance ratio. */
const PINCH_GAIN = 2.2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Props {
  /** live player position in world coordinates */
  position: () => { x: number; y: number };
  onClose: () => void;
}

/**
 * Full-screen world map: pinch to zoom, drag to pan, wheel/trackpad supported.
 * Rendered from the same biome/building/NPC data the game world uses.
 */
export function WorldMap({ position, onClose }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 640 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [player, setPlayer] = useState(() => position());

  // "fit" scale maps the whole world into the viewport at zoom 1.
  const fit = Math.min(size.w / WORLD_W, size.h / WORLD_H);
  const scale = fit * zoom;

  const stateRef = useRef({ zoom, offset, scale, size });
  stateRef.current = { zoom, offset, scale, size };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track the player's live position while the map is open.
  useEffect(() => {
    const t = window.setInterval(() => setPlayer(position()), 250);
    return () => window.clearInterval(t);
  }, [position]);

  /** Zoom about a screen point so the world point under it stays put. */
  const zoomAt = useCallback((px: number, py: number, next: number) => {
    const cur = stateRef.current;
    const clamped = clamp(next, MIN_ZOOM, MAX_ZOOM);
    const k = clamped / cur.zoom;
    setOffset({
      x: px - (px - cur.offset.x) * k,
      y: py - (py - cur.offset.y) * k,
    });
    setZoom(clamped);
  }, []);

  // Non-passive wheel/trackpad-pinch handling (React's onWheel is passive).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(
        e.clientX - rect.left,
        e.clientY - rect.top,
        stateRef.current.zoom * Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0045)),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Pointer events: one finger pans, two fingers pinch-zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const localPoint = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, localPoint(e));
    gesture.current = null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    const next = localPoint(e);
    pointers.current.set(e.pointerId, next);

    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const g = gesture.current;
      if (g && g.dist > 0 && dist > 0) {
        // pinch scale + two-finger drag in one step (gain > 1 = snappier pinch)
        const cur = stateRef.current;
        const ratio = Math.pow(dist / g.dist, PINCH_GAIN);
        const target = clamp(cur.zoom * ratio, MIN_ZOOM, MAX_ZOOM);
        const k = target / cur.zoom;
        const nextOffset = {
          x: cx - (cx - cur.offset.x) * k + (cx - g.cx),
          y: cy - (cy - cur.offset.y) * k + (cy - g.cy),
        };
        // keep the ref fresh: several pointermove events can fire per frame
        stateRef.current = { ...cur, zoom: target, offset: nextOffset };
        setOffset(nextOffset);
        setZoom(target);
      }
      gesture.current = { dist, cx, cy };
      return;
    }

    setOffset((o) => ({ x: o.x + (next.x - prev.x), y: o.y + (next.y - prev.y) }));
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
  };

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const focusPlayer = () => {
    const z = clamp(3, MIN_ZOOM, MAX_ZOOM);
    const s = fit * z;
    setZoom(z);
    setOffset({
      x: (WORLD_W * s) / 2 - player.x * s,
      y: (WORLD_H * s) / 2 - player.y * s,
    });
  };

  // World -> screen. The world is centred in the viewport before pan/zoom.
  const baseX = (size.w - WORLD_W * scale) / 2;
  const baseY = (size.h - WORLD_H * scale) / 2;
  const sx = (x: number) => baseX + x * scale + offset.x;
  const sy = (y: number) => baseY + y * scale + offset.y;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-card/90 px-4 py-3 backdrop-blur-md">
        <h2 className="font-display text-lg font-bold text-foreground">World Map</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={focusPlayer}
            className="rounded-2xl border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            Find me
          </button>
          <button
            onClick={reset}
            className="rounded-2xl border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            aria-label="Close world map"
            className="grid size-9 place-items-center rounded-2xl bg-primary text-primary-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        className="relative flex-1 touch-none overflow-hidden bg-muted/40"
      >
        <svg
          className="pointer-events-none absolute left-0 top-0"
          width={size.w}
          height={size.h}
          style={{ overflow: "visible" }}
        >
          <defs>
            {BIOMES.map((b) => (
              <linearGradient key={`g-${b.key}`} id={`bg-${b.key}`} x1="0" y1="0" x2="0.6" y2="1">
                <stop offset="0%" stopColor={b.top} />
                <stop offset="100%" stopColor={b.bottom} />
              </linearGradient>
            ))}
          </defs>
          {BIOMES.map((b) => (
            <path
              key={b.key}
              d={`${b.poly.map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x)},${sy(y)}`).join(" ")} Z`}
              fill={`url(#bg-${b.key})`}
              stroke="rgba(70,55,70,0.20)"
              strokeWidth={1}
            />
          ))}
          {BARRIERS.map((bar) => (
            <path
              key={bar.id}
              d={bar.pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x)},${sy(y)}`).join(" ")}
              fill="none"
              stroke={bar.kind === "river" ? "#79bbdb" : bar.kind === "rocks" ? "#94908b" : "#3f8f6a"}
              strokeWidth={Math.max(2, bar.width * scale * 0.9)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />
          ))}
        </svg>

        {BIOMES.filter((b) => b.label).map((b) => (
          <div
            key={`label-${b.key}`}
            className="pointer-events-none absolute px-2 py-1"
            style={{ left: sx(b.x + b.w / 2), top: sy(b.y + b.h * 0.32), transform: "translate(-50%,-50%)" }}
          >
            <div
              className="text-center font-display font-bold leading-tight text-[rgba(60,48,60,0.85)]"
              style={{ fontSize: Math.max(9, Math.min(20, 13 * zoom)) }}
            >
              {b.name}
            </div>
            <div
              className="text-center leading-tight text-[rgba(60,48,60,0.6)]"
              style={{ fontSize: Math.max(8, Math.min(15, 10 * zoom)) }}
            >
              {b.levels}
            </div>
          </div>
        ))}


        {STREETS.map((s, i) => (
          <div
            key={`street-${i}`}
            className="absolute"
            style={{
              left: sx(s.x),
              top: sy(s.y),
              width: Math.max(2, s.w * scale),
              height: Math.max(2, s.h * scale),
              background: "rgba(196,166,124,0.65)",
            }}
          />
        ))}

        {BUILDINGS.map((b) => (

          <div
            key={`${b.name}-${b.x}-${b.y}`}
            className="absolute rounded-[3px]"
            style={{
              left: sx(b.x),
              top: sy(b.y),
              width: Math.max(3, b.w * scale),
              height: Math.max(3, b.h * scale),
              background: b.wall,
              borderTop: `${Math.max(2, 6 * scale)}px solid ${b.roof}`,
            }}
            title={b.name}
          />
        ))}

        {NPCS.map((n) => {
          const icon = NPC_ICONS[n.id];
          const s = Math.max(20, Math.min(40, 26 * zoom));
          return (
            <div
              key={n.id}
              className="absolute grid place-items-center rounded-full border-2 border-white/80 shadow-soft"
              style={{
                left: sx(n.x) - s / 2,
                top: sy(n.y) - s / 2,
                width: s,
                height: s,
                background: icon.color,
                fontSize: s * 0.55,
              }}
              title={`${n.name} — ${icon.label}`}
            >
              <span aria-hidden>{icon.glyph}</span>
              <span className="sr-only">{`${n.name}, ${icon.label}`}</span>
            </div>
          );
        })}

        <div
          className="absolute size-3.5 rounded-full border-2 border-white bg-primary shadow-soft"
          style={{ left: sx(player.x) - 7, top: sy(player.y) - 7 }}
          title="You"
        />
      </div>

      <div className="border-t border-border/60 bg-card/90 px-4 py-3 backdrop-blur-md">
        <p className="mb-2 text-xs text-muted-foreground">
          Pinch to zoom, drag to pan.
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {[...new Set(NPCS.map((n) => n.id))].map((id) => (
            <div key={id} className="flex items-center gap-1.5 text-xs text-foreground">
              <span
                className="grid size-5 place-items-center rounded-full text-[10px]"
                style={{ background: NPC_ICONS[id].color }}
                aria-hidden
              >
                {NPC_ICONS[id].glyph}
              </span>
              {NPC_ICONS[id].label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

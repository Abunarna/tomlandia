import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  BIOMES,
  BUILDINGS,
  NPCS,
  NPC_ICONS,
  WORLD_H,
  WORLD_W,
} from "@/game/data";

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 6;

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
        stateRef.current.zoom * Math.exp(-dy * 0.0018),
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
      if (g && g.dist > 0) {
        // pinch scale + two-finger drag in one step
        const cur = stateRef.current;
        const target = clamp(cur.zoom * (dist / g.dist), MIN_ZOOM, MAX_ZOOM);
        const k = target / cur.zoom;
        setOffset({
          x: cx - (cx - cur.offset.x) * k + (cx - g.cx),
          y: cy - (cy - cur.offset.y) * k + (cy - g.cy),
        });
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
    const cur = stateRef.current;
    const z = clamp(3, MIN_ZOOM, MAX_ZOOM);
    const s = fit * z;
    setZoom(z);
    setOffset({
      x: cur.size.w / 2 - (player.x - WORLD_W / 2) * s - (WORLD_W * s) / 2 + (WORLD_W * s) / 2,
      y: cur.size.h / 2 - (player.y - WORLD_H / 2) * s - (WORLD_H * s) / 2 + (WORLD_H * s) / 2,
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
        {BIOMES.map((b) => (
          <div
            key={b.id}
            className="absolute overflow-hidden"
            style={{
              left: sx(b.x),
              top: sy(b.y),
              width: b.w * scale,
              height: b.h * scale,
              background: `linear-gradient(160deg, ${b.top}, ${b.bottom})`,
              boxShadow: "inset 0 0 0 1px rgba(70,55,70,0.18)",
            }}
          >
            <div className="pointer-events-none px-2 py-1">
              <div
                className="font-display font-bold leading-tight text-[rgba(60,48,60,0.85)]"
                style={{ fontSize: Math.max(9, Math.min(20, 13 * zoom)) }}
              >
                {b.name}
              </div>
              <div
                className="leading-tight text-[rgba(60,48,60,0.6)]"
                style={{ fontSize: Math.max(8, Math.min(15, 10 * zoom)) }}
              >
                {b.levels}
              </div>
            </div>
          </div>
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

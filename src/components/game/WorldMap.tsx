import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  BARRIERS,
  BRIDGES,
  BIOMES,
  BUILDINGS,
  STREETS,
  LAKES,

  ROAD_RUNS,
  NPCS,
  NPC_ICONS,
  WORLD_H,
  WORLD_W,
} from "@/game/data";
import { BOSS_NAME, desolatusAt } from "@/game/boss";

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
  // Rendered view (eased) and the target the gestures write to.
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [player, setPlayer] = useState(() => position());

  const zoom = view.zoom;
  const offset = { x: view.x, y: view.y };

  // "fit" scale maps the whole world into the viewport at zoom 1.
  const fit = Math.min(size.w / WORLD_W, size.h / WORLD_H);
  const scale = fit * zoom;
  // Never zoom out past the point where the world covers the viewport:
  // no empty space around the map.
  const minZoom = Math.max(size.w / WORLD_W, size.h / WORLD_H) / fit;

  const target = useRef({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const limits = useRef({ w: size.w, h: size.h, fit, minZoom });
  limits.current = { w: size.w, h: size.h, fit, minZoom };
  const raf = useRef<number | null>(null);

  /** Clamp zoom + pan so the world always fills the viewport. */
  const clampView = useCallback((v: { zoom: number; x: number; y: number }) => {
    const L = limits.current;
    const z = clamp(v.zoom, L.minZoom, MAX_ZOOM);
    const s = L.fit * z;
    const mx = Math.max(0, (WORLD_W * s - L.w) / 2);
    const my = Math.max(0, (WORLD_H * s - L.h) / 2);
    return { zoom: z, x: clamp(v.x, -mx, mx), y: clamp(v.y, -my, my) };
  }, []);


  /** Ease the rendered view toward the target (frame-rate independent). */
  const animate = useCallback(() => {
    if (raf.current !== null) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const cur = viewRef.current;
      const t = target.current;
      // ~90ms time constant: quick to respond, still smooth to follow
      const k = 1 - Math.exp(-dt / 90);
      const next = {
        // zoom eases in log space so it feels even at every scale
        zoom: cur.zoom * Math.exp(Math.log(t.zoom / cur.zoom) * k),
        x: cur.x + (t.x - cur.x) * k,
        y: cur.y + (t.y - cur.y) * k,
      };
      const done =
        Math.abs(next.zoom / t.zoom - 1) < 0.001 &&
        Math.abs(next.x - t.x) < 0.3 &&
        Math.abs(next.y - t.y) < 0.3;
      viewRef.current = done ? { ...t } : next;
      setView(viewRef.current);
      if (done) {
        raf.current = null;
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
  }, []);

  /** Set the eased target. */
  const glide = useCallback(
    (v: { zoom: number; x: number; y: number }) => {
      target.current = clampView(v);
      animate();
    },
    [animate, clampView],
  );

  /** Move now, with no easing (used for panning and pinch tracking). */
  const jump = useCallback(
    (v: { zoom: number; x: number; y: number }) => {
      const c = clampView(v);
      target.current = c;
      viewRef.current = c;
      setView(c);
    },
    [clampView],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the view legal when the viewport resizes.
  useEffect(() => {
    jump(viewRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  // Track the player's live position while the map is open.
  // (player state declared above)

  const [boss, setBoss] = useState(() => desolatusAt());

  // Track the player's live position while the map is open.
  useEffect(() => {
    const t = window.setInterval(() => {
      setPlayer(position());
      setBoss(desolatusAt());
    }, 250);
    return () => window.clearInterval(t);
  }, [position]);


  /** Zoom about a screen point so the world point under it stays put. */
  const zoomAt = useCallback(
    (px: number, py: number, next: number) => {
      const cur = target.current;
      const clamped = clamp(next, limits.current.minZoom, MAX_ZOOM);
      const k = clamped / cur.zoom;
      glide({
        zoom: clamped,
        x: px - (px - cur.x) * k,
        y: py - (py - cur.y) * k,
      });
    },

    [glide],
  );

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
        target.current.zoom * Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0045)),
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
        // Anchor on the *rendered* view so the world point under the pinch
        // midpoint stays exactly under the fingers (no easing lag drift).
        const cur = viewRef.current;
        const ratio = Math.pow(dist / g.dist, PINCH_GAIN);
        const zoomTo = clamp(cur.zoom * ratio, limits.current.minZoom, MAX_ZOOM);
        const k = zoomTo / cur.zoom;
        jump({
          zoom: zoomTo,
          x: cx - (cx - cur.x) * k + (cx - g.cx),
          y: cy - (cy - cur.y) * k + (cy - g.cy),
        });
      }
      gesture.current = { dist, cx, cy };
      return;
    }

    const cur = target.current;
    jump({ ...cur, x: cur.x + (next.x - prev.x), y: cur.y + (next.y - prev.y) });
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
  };

  const reset = () => glide({ zoom: minZoom, x: 0, y: 0 });

  const focusPlayer = () => {
    const z = clamp(3, minZoom, MAX_ZOOM);

    const s = fit * z;
    glide({
      zoom: z,
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
          {LAKES.map((l) => (

            <path
              key={`lake-${l.key}`}
              d={`${l.poly.map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x)},${sy(y)}`).join(" ")} Z`}
              fill={l.style === "winter" ? "#a9d8ea" : l.style === "evil" ? "#3f5c62" : "#5fb2d6"}
              stroke="rgba(30,60,80,0.45)"
              strokeWidth={1}
            />
          ))}
          {LAKES.flatMap((l) =>
            l.jetties.map((j) => (
              <line
                key={`jetty-${j.id}`}
                x1={sx(j.x1)}
                y1={sy(j.y1)}
                x2={sx(j.x2)}
                y2={sy(j.y2)}
                stroke="#a9793f"
                strokeWidth={Math.max(1.5, j.hw * scale)}
                strokeLinecap="round"
              />
            )),
          )}

          {ROAD_RUNS.map((r, i) => (
            <path
              key={`road-${i}`}
              d={r.pts.map(([x, y], k) => `${k === 0 ? "M" : "L"}${sx(x)},${sy(y)}`).join(" ")}
              fill="none"
              stroke={r.trail ? "#93805d" : "#a8a5a0"}
              strokeWidth={Math.max(r.trail ? 0.8 : 1.5, r.width * scale)}
              strokeDasharray={r.trail ? "4 3" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {BRIDGES.map((br) => (
            <rect
              key={br.id}
              x={sx(br.x) - (br.width * scale) / 2}
              y={sy(br.y) - ((br.len + 28) * scale) / 2}
              width={Math.max(3, br.width * scale)}
              height={Math.max(4, (br.len + 28) * scale)}
              fill="#a9793f"
              stroke="#6f4a2a"
              strokeWidth={1}
              transform={`rotate(${(br.angle * 180) / Math.PI} ${sx(br.x)} ${sy(br.y)})`}
            />
          ))}
        </svg>

        {BIOMES.filter((b) => b.label).map((b) => {
          const bx = b.x + b.w / 2;
          const by = b.y + b.h / 2;
          // Anchor each biome label directly above that biome's city.
          const city = CITIES.reduce((best, c) =>
            Math.hypot(c.cx - bx, c.cy - by) < Math.hypot(best.cx - bx, best.cy - by) ? c : best,
          );
          const lx = city.cx;
          const ly = city.cy - cityOuterR(city) - 70;
          return (
            <div
              key={`label-${b.key}`}
              className="pointer-events-none absolute z-30 flex flex-col items-center rounded-md px-1 py-0.5"
              style={{
                left: sx(lx),
                top: sy(ly),
                transform: "translate(-50%,-100%)",
                background: "rgba(52,40,64,0.55)",
              }}
            >
              <div className="text-center font-display font-bold leading-none text-white" style={{ fontSize: 10.5 }}>
                {b.name}
              </div>
              <div className="text-center font-bold leading-none text-white/80" style={{ fontSize: 7.5 }}>
                {b.levels}
              </div>
            </div>
          );
        })}





        {STREETS.map((s, i) => (
          <div
            key={`street-${i}`}
            className="absolute"
            style={{
              left: sx(s.x),
              top: sy(s.y),
              width: Math.max(2, s.w * scale),
              height: Math.max(2, s.h * scale),
              background: "#c4a67c",
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

        {(() => {
          const s = Math.max(20, Math.min(40, 26 * zoom));
          return (
            <div
              className="pointer-events-none absolute z-20 grid place-items-center rounded-full border-2 border-white/80"
              style={{
                left: sx(boss.x) - s / 2,
                top: sy(boss.y) - s / 2,
                width: s,
                height: s,
                background: "#7a0f1c",
                animation: "boss-pulse 1.2s ease-in-out infinite",
              }}
              title={`${BOSS_NAME} — world boss`}
            >
              <svg viewBox="0 0 24 24" width={s * 0.72} height={s * 0.72} aria-hidden>
                {/* horns */}
                <path
                  d="M6 10C3.5 9 2.5 6 3 3.5C5.5 4.5 7.5 6.5 8 9Z M18 10C20.5 9 21.5 6 21 3.5C18.5 4.5 16.5 6.5 16 9Z"
                  fill="#f4c2c7"
                />
                {/* head */}
                <path
                  d="M12 7c3.6 0 6 2.3 6 5.5 0 3.4-2.7 6.5-6 8-3.3-1.5-6-4.6-6-8C6 9.3 8.4 7 12 7Z"
                  fill="#e0343f"
                />
                {/* eyes */}
                <circle cx="9.8" cy="12.3" r="1.1" fill="#2b0508" />
                <circle cx="14.2" cy="12.3" r="1.1" fill="#2b0508" />
              </svg>
              <span className="sr-only">{BOSS_NAME} location</span>
            </div>
          );
        })()}

        <style>{`@keyframes boss-pulse{0%,100%{box-shadow:0 0 0 0 rgba(224,52,63,.75);transform:scale(1)}50%{box-shadow:0 0 0 10px rgba(224,52,63,0);transform:scale(1.12)}}`}</style>

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

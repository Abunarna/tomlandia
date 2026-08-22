/**
 * TEMPORARY developer panel for the pixel-art river pass.
 * Switch between the Fine / Sprite-matched / Coarse presets and tune the
 * individual knobs at runtime. Safe to delete once a default is locked in.
 */
import { useState } from "react";
import {
  applyRiverPreset,
  riverConfig,
  setRiverConfig,
  type RiverPalette,
} from "@/game/river-pixel";

const PALETTE_KEYS: (keyof RiverPalette)[] = [
  "bankShadow",
  "bankMid",
  "waterDeep",
  "waterBase",
  "waterLight",
  "foamHighlight",
];

export function RiverDebug() {
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  const redraw = () => bump((v) => v + 1);

  const set = (patch: Parameters<typeof setRiverConfig>[0]) => {
    setRiverConfig(patch);
    redraw();
  };

  return (
    <div className="pointer-events-auto absolute right-2 top-24 z-40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-border/60 bg-card/90 px-2 py-1 font-semibold backdrop-blur-md"
      >
        {open ? "× River" : "River debug"}
      </button>

      {open && (
        <div className="mt-2 w-56 space-y-2 rounded-xl border border-border/60 bg-card/95 p-2 backdrop-blur-md">
          <div className="grid grid-cols-3 gap-1">
            {(["fine", "sprite", "coarse"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  applyRiverPreset(p);
                  redraw();
                }}
                className={`rounded-md border px-1 py-1 capitalize ${
                  riverConfig.preset === p ? "border-primary text-primary" : "border-border/60"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <label className="flex items-center justify-between gap-2">
            <span>Cell {riverConfig.cell}px</span>
            <input
              type="range"
              min={2}
              max={7}
              step={1}
              defaultValue={riverConfig.cell}
              onChange={(e) => set({ cell: Number(e.target.value) })}
            />
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>Bank {riverConfig.bankPx}px</span>
            <input
              type="range"
              min={1}
              max={3}
              step={1}
              defaultValue={riverConfig.bankPx}
              onChange={(e) => set({ bankPx: Number(e.target.value) })}
            />
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>Density {(riverConfig.density * 100).toFixed(1)}%</span>
            <input
              type="range"
              min={5}
              max={60}
              step={1}
              defaultValue={riverConfig.density * 1000}
              onChange={(e) => set({ density: Number(e.target.value) / 1000 })}
            />
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>FPS {riverConfig.fps}</span>
            <input
              type="range"
              min={4}
              max={6}
              step={1}
              defaultValue={riverConfig.fps}
              onChange={(e) => set({ fps: Number(e.target.value) })}
            />
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>Animate</span>
            <input
              type="checkbox"
              defaultChecked={riverConfig.animate}
              onChange={(e) => set({ animate: e.target.checked })}
            />
          </label>

          <div className="space-y-1">
            {PALETTE_KEYS.map((k) => (
              <label key={k} className="flex items-center justify-between gap-2">
                <span className="truncate">{k}</span>
                <input
                  type="color"
                  defaultValue={riverConfig.palette[k]}
                  onChange={(e) => set({ palette: { [k]: e.target.value } as Partial<RiverPalette> as RiverPalette })}
                  className="h-5 w-8 rounded border border-border/60 bg-transparent"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TEMPORARY developer panel for the knight sprite rig.
 * Lets you drive animations and tint armour / sword independently at runtime.
 * Safe to delete once the equipment system is verified.
 */
import { useState } from "react";
import type { KnightAnim } from "@/game/knight";

const ANIMS: KnightAnim[] = ["idle", "walk", "attack", "mine", "chop", "loot"];

export function KnightDebug({
  onAnim,
  onColor,
}: {
  onAnim: (a: KnightAnim | null) => void;
  onColor: (kind: "armor" | "weapon", color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [armor, setArmor] = useState("#8fa7c7");
  const [weapon, setWeapon] = useState("#d9dee6");

  return (
    <div className="pointer-events-auto absolute left-2 top-24 z-40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-border/60 bg-card/90 px-2 py-1 font-semibold backdrop-blur-md"
      >
        {open ? "× Debug" : "Knight debug"}
      </button>

      {open && (
        <div className="mt-2 w-56 space-y-2 rounded-xl border border-border/60 bg-card/95 p-2 backdrop-blur-md">
          <div className="grid grid-cols-3 gap-1">
            {ANIMS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onAnim(a)}
                className="rounded-md border border-border/60 px-1 py-1 capitalize"
              >
                {a}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onAnim(null)}
            className="w-full rounded-md border border-border/60 px-1 py-1"
          >
            Auto (follow gameplay)
          </button>

          <label className="flex items-center justify-between gap-2">
            Armour colour
            <input
              type="color"
              value={armor}
              onChange={(e) => {
                setArmor(e.target.value);
                onColor("armor", e.target.value);
              }}
              className="h-7 w-12 rounded border border-border/60 bg-transparent"
            />
          </label>

          <label className="flex items-center justify-between gap-2">
            Sword colour
            <input
              type="color"
              value={weapon}
              onChange={(e) => {
                setWeapon(e.target.value);
                onColor("weapon", e.target.value);
              }}
              className="h-7 w-12 rounded border border-border/60 bg-transparent"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setWeapon("#39D353");
              onColor("weapon", "#39D353");
            }}
            className="w-full rounded-md border border-border/60 bg-[#39D353]/20 px-1 py-1 font-semibold"
          >
            Green Sword Test
          </button>

          <button
            type="button"
            onClick={() => {
              onColor("armor", null);
              onColor("weapon", null);
            }}
            className="w-full rounded-md border border-border/60 px-1 py-1"
          >
            Reset to equipped colours
          </button>
        </div>
      )}
    </div>
  );
}

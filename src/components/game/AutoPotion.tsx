import { useEffect, useState } from "react";
import { ITEMS } from "@/game/data";
import { ItemIcon } from "@/components/game/ItemIcon";
import type { HudSnapshot } from "@/game/types";

const SIZE = 54;
const R = SIZE / 2 - 3;
const C = 2 * Math.PI * R;

/** Circular auto-potion widget: on/off toggle, potion icon, quantity and remaining buff. */
export function AutoPotion({ hud, onToggle }: { hud: HudSnapshot; onToggle: () => void }) {
  const { on, item, qty, hits, maxHits, firedAt } = hud.autoPotionState;
  const def = item ? ITEMS[item] : undefined;
  const buff = hud.buff;
  const effect = buff ? (buff.pct > 0 ? `+${buff.pct}% strength` : `+${buff.dmg} damage`) : null;
  const has = !!def && qty > 0;
  const left = maxHits > 0 ? Math.max(0, Math.min(1, hits / maxHits)) : 0;

  const [now, setNow] = useState(() => Date.now());
  const glowing = now - firedAt < 380;

  useEffect(() => {
    if (!glowing) return;
    const id = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(id);
  }, [glowing]);

  useEffect(() => {
    setNow(Date.now());
  }, [firedAt]);

  return (
    <button
      type="button"
      aria-label={`Auto-potion ${on ? "on" : "off"}${effect ? `, ${effect} for ${hits} hits` : ""}`}
      aria-pressed={on}
      onClick={onToggle}
      className="pointer-events-auto relative grid place-items-center rounded-full bg-card/80 shadow-soft backdrop-blur-md transition active:scale-95"
      style={{
        width: SIZE,
        height: SIZE,
        boxShadow: glowing ? "0 0 18px 6px hsl(var(--primary) / 0.55)" : undefined,
        opacity: on ? 1 : 0.65,
      }}
    >
      <span
        className={`absolute inset-0 rounded-full border-2 ${
          on ? "border-primary/70" : "border-dashed border-border/50"
        }`}
      />

      {/* remaining buff ring */}
      {on && hits > 0 && (
        <svg className="absolute inset-0" width={SIZE} height={SIZE} aria-hidden>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="hsl(var(--primary) / 0.9)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${C * left} ${C}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
      )}

      {!has ? (
        <span className="relative text-[10px] font-semibold tracking-wide text-muted-foreground/70">
          empty
        </span>
      ) : (
        <>
          <span className={`relative block size-7 ${on ? "" : "grayscale"}`}>
            <ItemIcon item={def!} className="size-full" />
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card px-1 text-[10px] font-black text-foreground shadow-soft">
            {qty}
          </span>
        </>
      )}

      {/* on/off + remaining hits readout */}
      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-card/95 px-1.5 py-[1px] text-[9px] font-black leading-none text-foreground shadow-soft">
        {on ? (hits > 0 ? `${buff && buff.pct > 0 ? `+${buff.pct}% · ` : ""}${hits} hits` : "ON") : "OFF"}
      </span>
    </button>
  );
}

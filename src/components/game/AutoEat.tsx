import { useEffect, useState } from "react";
import { ITEMS } from "@/game/data";
import { ItemIcon } from "@/components/game/ItemIcon";
import type { HudSnapshot } from "@/game/types";

const SIZE = 54;
const R = SIZE / 2 - 3;
const C = 2 * Math.PI * R;

/** Circular auto-snack widget: food icon, quantity, threshold ring and cooldown wipe. */
export function AutoEat({ hud, onCycle }: { hud: HudSnapshot; onCycle: () => void }) {
  const { threshold, qty, firedAt, cooldownUntil } = hud.autoEat;
  const def = hud.food ? ITEMS[hud.food] : undefined;
  const has = !!def && qty > 0;

  const [now, setNow] = useState(() => Date.now());
  const cooling = now < cooldownUntil;
  const glowing = now - firedAt < 380;

  useEffect(() => {
    if (!cooling && !glowing) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cooling, glowing]);

  useEffect(() => {
    setNow(Date.now());
  }, [firedAt, cooldownUntil]);

  const left = cooling ? Math.max(0, Math.min(1, (cooldownUntil - now) / 2000)) : 0;

  return (
    <button
      type="button"
      aria-label={`Auto-snack at ${Math.round(threshold * 100)}% health`}
      onClick={onCycle}
      className="pointer-events-auto relative grid place-items-center rounded-full bg-card/80 shadow-soft backdrop-blur-md transition active:scale-95"
      style={{
        width: SIZE,
        height: SIZE,
        boxShadow: glowing ? "0 0 18px 6px hsl(var(--xp) / 0.55)" : undefined,
      }}
    >
      <span
        className={`absolute inset-0 rounded-full border ${
          has ? "border-border/60" : "border-dashed border-border/40"
        }`}
      />

      {/* threshold ring */}
      <svg className="absolute inset-0" width={SIZE} height={SIZE} aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="hsl(var(--xp) / 0.9)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${C * threshold} ${C}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>

      {!has ? (
        <span className="relative text-[10px] font-semibold tracking-wide text-muted-foreground/70">
          empty
        </span>
      ) : (
        <>
          <span className="relative block size-7">
            <ItemIcon item={def!} className="size-full" />
            {/* cooldown wipe */}
            {cooling && (
              <span
                className="absolute inset-[-6px] rounded-full bg-background/70"
                style={{
                  maskImage: `conic-gradient(#000 ${left * 360}deg, transparent 0deg)`,
                  WebkitMaskImage: `conic-gradient(#000 ${left * 360}deg, transparent 0deg)`,
                }}
              />
            )}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card px-1 text-[10px] font-black text-foreground shadow-soft">
            {qty}
          </span>
        </>
      )}

      {/* threshold readout */}
      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-card/95 px-1.5 py-[1px] text-[9px] font-black leading-none text-foreground shadow-soft">
        {Math.round(threshold * 100)}%
      </span>
    </button>
  );
}


import { Heart, Coins, Sparkles, MapPin } from "lucide-react";
import type { HudSnapshot } from "@/game/types";

export function Hud({ hud }: { hud: HudSnapshot }) {
  const skill = hud.skills.combat;
  return (
    <div className="pointer-events-none px-3 pt-3">
      <div className="rounded-2xl border border-border/60 bg-card/85 px-3 py-2 shadow-soft backdrop-blur">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-sm font-black text-primary">
              {hud.level}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-foreground">Tom</p>
              <p className="flex items-center gap-1 truncate text-[11px] leading-tight text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                {hud.region}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-xl bg-gold/15 px-2 py-1 text-sm font-bold text-gold-foreground">
            <Coins className="size-4 text-gold" />
            {hud.gold}
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          <Bar
            icon={<Heart className="size-3.5 text-hp" />}
            value={hud.hp / hud.maxHp}
            label={`${hud.hp}/${hud.maxHp}`}
            className="bg-hp"
          />
          <Bar
            icon={<Sparkles className="size-3.5 text-xp" />}
            value={skill.progress}
            label={`${skill.into}/${skill.need} XP`}
            className="bg-xp"
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="truncate text-[11px] font-semibold text-muted-foreground">{hud.activity}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-100"
              style={{ width: `${Math.min(100, hud.activityProgress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar({
  icon,
  value,
  label,
  className,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-150 ${className}`}
          style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        />
        <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-foreground/70">
          {label}
        </span>
      </div>
    </div>
  );
}

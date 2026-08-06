import { Coins, Check, X } from "lucide-react";
import { ITEMS, NPCS, QUESTS, SHOP_STOCK, type NpcRole } from "@/game/data";
import type { HudSnapshot } from "@/game/types";

export function NpcDialog({
  npc,
  hud,
  onClose,
  onBuy,
  onSellAll,
  onAccept,
  onClaim,
  onAbandon,
}: {
  npc: NpcRole;
  hud: HudSnapshot;
  onClose: () => void;
  onBuy: (id: (typeof SHOP_STOCK)[number]["id"]) => void;
  onSellAll: () => void;
  onAccept: (id: string) => void;
  onClaim: () => void;
  onAbandon: () => void;
}) {
  const def = NPCS.find((n) => n.id === npc)!;
  const resourceValue = hud.inv.reduce(
    (sum, s) => (s && ITEMS[s.id].kind === "resource" ? sum + ITEMS[s.id].value * s.qty : sum),
    0,
  );

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-end bg-foreground/25 backdrop-blur-[2px]">
      <div className="max-h-[70dvh] w-full overflow-y-auto rounded-t-3xl border-t border-border/60 bg-card p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="size-10 shrink-0 rounded-2xl" style={{ backgroundColor: def.robe }} />
            <div>
              <p className="text-sm font-bold text-foreground">{def.name}</p>
              <p className="text-[11px] text-muted-foreground">{def.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close conversation"
            className="grid size-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground active:scale-95"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-3 rounded-2xl bg-muted/60 px-3 py-2 text-[12px] italic text-muted-foreground">
          “{def.greeting}”
        </p>

        {npc === "smith" && (
          <div className="mt-3 space-y-1.5">
            {SHOP_STOCK.map((entry) => {
              const item = ITEMS[entry.id];
              const afford = hud.gold >= entry.price;
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-muted/40 p-2"
                >
                  <span className="size-9 shrink-0 rounded-xl" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.attack ? `+${item.attack} attack` : item.defense ? `+${item.defense} defense` : `Heals ${item.heal} hp`}
                    </p>
                  </div>
                  <button
                    disabled={!afford}
                    onClick={() => onBuy(entry.id)}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                  >
                    <Coins className="size-3.5" />
                    {entry.price}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {npc === "merchant" && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Your bag holds <span className="font-bold text-foreground">{resourceValue}g</span> worth of resources.
            </p>
            <button
              disabled={resourceValue === 0}
              onClick={onSellAll}
              className="w-full rounded-2xl bg-gold px-3 py-2.5 text-sm font-bold text-gold-foreground disabled:opacity-40 active:scale-95"
            >
              Sell all resources
            </button>
          </div>
        )}

        {npc === "elder" && (
          <div className="mt-3 space-y-2">
            {hud.quest ? (
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
                <p className="text-xs font-bold text-foreground">{hud.quest.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{hud.quest.desc}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-xp"
                    style={{ width: `${(hud.quest.progress / hud.quest.count) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {hud.quest.progress} / {hud.quest.count}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={!hud.quest.ready}
                    onClick={onClaim}
                    className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                  >
                    Hand in
                  </button>
                  <button
                    onClick={onAbandon}
                    className="rounded-xl bg-muted px-3 py-2 text-xs font-bold text-muted-foreground active:scale-95"
                  >
                    Abandon
                  </button>
                </div>
              </div>
            ) : (
              QUESTS.map((q) => {
                const done = hud.completed.includes(q.id);
                return (
                  <div key={q.id} className="rounded-2xl border border-border/70 bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-foreground">{q.name}</p>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-gold-foreground">
                        <Coins className="size-3 text-gold" />
                        {q.gold}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{q.desc}</p>
                    <button
                      disabled={done}
                      onClick={() => onAccept(q.id)}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                    >
                      {done ? (
                        <>
                          <Check className="size-3.5" /> Completed
                        </>
                      ) : (
                        "Accept"
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

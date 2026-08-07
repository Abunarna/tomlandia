import { useState } from "react";
import { Coins, Check, X, Hammer, ArrowUpCircle, ChevronDown } from "lucide-react";
import { MAX_PLUS, NPCS, QUESTS, RECIPES, SHOP_STOCK, item, type NpcRole } from "@/game/data";
import type { HudSnapshot, ItemId } from "@/game/types";


export function NpcDialog({
  npc,
  hud,
  onClose,
  onBuy,
  onSellAll,
  onAccept,
  onClaim,
  onAbandon,
  onCraft,
  onUpgrade,
  upgradeCosts,
}: {
  npc: NpcRole;
  hud: HudSnapshot;
  onClose: () => void;
  onBuy: (npc: NpcRole, id: ItemId) => void;
  onSellAll: () => void;
  onAccept: (id: string) => void;
  onClaim: () => void;
  onAbandon: () => void;
  onCraft: (recipeId: string) => void;
  onUpgrade: (which: "weapon" | "armor") => void;
  upgradeCosts: { weapon: number | null; armor: number | null };
}) {
  const def = NPCS.find((n) => n.id === npc)!;
  const stock = SHOP_STOCK[npc] ?? [];
  const services = def.services;
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);

  const resourceValue = hud.inv.reduce((sum, s) => {
    if (!s) return sum;
    const d = item(s.id);
    return d.kind === "resource" ? sum + d.value * s.qty : sum;
  }, 0);

  const count = (id: ItemId) => hud.inv.reduce((n, s) => (s && s.id === id ? n + s.qty : n), 0);

  const craftSkills = services.filter((s) => s === "smith" || s === "tailor" || s === "skin");
  const skillFor = (s: string): "smithing" | "tailoring" | "skinning" =>
    s === "smith" ? "smithing" : s === "tailor" ? "tailoring" : "skinning";

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-end bg-foreground/25 backdrop-blur-[2px]">
      <div className="max-h-[74dvh] w-full overflow-y-auto rounded-t-3xl border-t border-border/60 bg-card p-4 shadow-soft">
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

        {services.includes("shop") && stock.length > 0 && (
          <Section title="Wares">
            {stock.map((entry) => {
              const d = item(entry.id);
              const afford = hud.gold >= entry.price;
              return (
                <div key={entry.id} className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-muted/40 p-2">
                  <span className="size-9 shrink-0 rounded-xl" style={{ backgroundColor: d.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.attack ? `+${d.attack} attack` : d.defense ? `+${d.defense} defense` : d.heal ? `Heals ${d.heal} hp` : "Material"}
                    </p>
                  </div>
                  <button
                    disabled={!afford}
                    onClick={() => onBuy(npc, entry.id)}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                  >
                    <Coins className="size-3.5" />
                    {entry.price}
                  </button>
                </div>
              );
            })}
          </Section>
        )}

        {services.includes("sell") && (
          <Section title="Trade">
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
          </Section>
        )}

        {craftSkills.map((svc) => {
          const skill = skillFor(svc);
          const list = RECIPES.filter((r) => r.skill === skill);
          const lvl = hud.skills[skill].level;
          return (
            <Section key={svc} title={`${skill[0]!.toUpperCase()}${skill.slice(1)} (Lv ${lvl})`}>
              {list.map((r) => {
                const ok = lvl >= r.req && r.inputs.every((i) => count(i.id) >= i.qty);
                const out = item(r.out);
                return (
                  <div key={r.id} className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-muted/40 p-2">
                    <span className="size-9 shrink-0 rounded-xl" style={{ backgroundColor: out.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground">
                        {out.name} {r.outQty > 1 && `x${r.outQty}`}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        Lv {r.req} · {r.inputs.map((i) => `${count(i.id)}/${i.qty} ${item(i.id).name}`).join(", ")}
                      </p>
                    </div>
                    <button
                      disabled={!ok}
                      onClick={() => onCraft(r.id)}
                      className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                    >
                      <Hammer className="size-3.5" />
                      Make
                    </button>
                  </div>
                );
              })}
            </Section>
          );
        })}

        {services.includes("upgrade") && (
          <Section title="Upgrade gear">
            {(["weapon", "armor"] as const).map((which) => {
              const eq = which === "weapon" ? hud.weapon : hud.armor;
              const cost = upgradeCosts[which];
              const d = eq ? item(eq.id) : null;
              return (
                <div key={which} className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-muted/40 p-2">
                  <span className="size-9 shrink-0 rounded-xl" style={{ backgroundColor: d?.color ?? "var(--muted)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">
                      {d ? `${d.name} +${eq!.plus}` : `No ${which}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {eq && eq.plus >= MAX_PLUS ? "Fully upgraded" : "+5% stats per level"}
                    </p>
                  </div>
                  <button
                    disabled={cost === null || hud.gold < cost}
                    onClick={() => onUpgrade(which)}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                  >
                    <ArrowUpCircle className="size-3.5" />
                    {cost ?? "—"}
                  </button>
                </div>
              );
            })}
          </Section>
        )}

        {services.includes("quests") && (
          <Section title="Quest board">
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
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

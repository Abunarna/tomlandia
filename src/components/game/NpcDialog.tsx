import { useState } from "react";
import { Coins, Check, X, Hammer, ArrowUpCircle, ChevronDown } from "lucide-react";
import { MAX_PLUS, NPCS, QUESTS, RECIPES, SHOP_STOCK, item, type NpcRole } from "@/game/data";
import type { HudSnapshot, InvSlot, ItemId } from "@/game/types";
import { ItemIcon } from "./ItemIcon";


export function NpcDialog({
  npc,
  hud,
  onClose,
  onBuy,
  onSellAll,
  onSellItem,
  onDepositGold,
  onWithdrawGold,
  onDepositItem,
  onWithdrawItem,
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
  onSellItem: (index: number) => void;
  onDepositGold: (n: number) => void;
  onWithdrawGold: (n: number) => void;
  onDepositItem: (bagIndex: number, qty: number) => void;
  onWithdrawItem: (bankIndex: number, qty: number) => void;
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
  const [amount, setAmount] = useState("");

  const resourceValue = hud.inv.reduce((sum, s) => {
    if (!s) return sum;
    const d = item(s.id);
    return d.kind === "resource" ? sum + d.value * s.qty : sum;
  }, 0);

  /** everything sellable in the bag, with the merchant's offer */
  const bagForSale = hud.inv
    .map((slot, index) => ({ slot, index }))
    .filter((e): e is { slot: InvSlot; index: number } => {
      if (!e.slot) return false;
      return item(e.slot.id).value > 0;
    })
    .map((e) => ({
      ...e,
      price: Math.max(
        0,
        Math.floor(item(e.slot.id).value * e.slot.qty * (1 + 0.1 * (e.slot.plus ?? 0))),
      ),
    }));

  const count = (id: ItemId) => hud.inv.reduce((n, s) => (s && s.id === id ? n + s.qty : n), 0);

  const STATIONS = ["smelt", "forge", "weave", "armor", "skin", "cook", "alchemy"] as const;
  type Station = (typeof STATIONS)[number];
  const stationTitle: Record<Station, string> = {
    smelt: "Smelting",
    forge: "Weaponsmithing",
    weave: "Weaving",
    armor: "Armoursmithing",
    skin: "Skinning",
    cook: "Cooking",
    alchemy: "Alchemy",
  };
  const craftStations = services.filter((s): s is Station =>
    (STATIONS as readonly string[]).includes(s),
  );

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
                  <ItemIcon item={d} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.attack || d.defense
                        ? [d.attack ? `+${d.attack} attack` : null, d.defense ? `+${d.defense} defense` : null].filter(Boolean).join(" · ")
                        : d.heal ? `Heals ${d.heal} hp` : "Material"}
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


        {services.includes("bank") && (
          <Section title="Bank">
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">
                  Bag <span className="text-foreground">{hud.gold}g</span>
                </span>
                <span className="text-muted-foreground">
                  Bank <span className="text-foreground">{hud.bank.gold}g</span>
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Amount"
                  aria-label="Gold amount"
                  className="min-w-0 flex-1 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-bold text-foreground outline-none"
                />
                <button
                  onClick={() => onDepositGold(Number(amount) || 0)}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground active:scale-95"
                >
                  Deposit
                </button>
                <button
                  onClick={() => onWithdrawGold(Number(amount) || 0)}
                  className="rounded-xl bg-muted px-3 py-2 text-xs font-bold text-muted-foreground active:scale-95"
                >
                  Withdraw
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onDepositGold(hud.gold)}
                  className="flex-1 rounded-xl bg-gold px-3 py-1.5 text-[11px] font-bold text-gold-foreground active:scale-95"
                >
                  Deposit all
                </button>
                <button
                  onClick={() => onWithdrawGold(hud.bank.gold)}
                  className="flex-1 rounded-xl bg-muted px-3 py-1.5 text-[11px] font-bold text-muted-foreground active:scale-95"
                >
                  Withdraw all
                </button>
              </div>
            </div>

            <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Your bag — tap to deposit
            </p>
            <ItemGrid slots={hud.inv} onTap={(i, qty) => onDepositItem(i, qty)} />
            <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              In the bank — tap to withdraw
            </p>
            <ItemGrid slots={hud.bank.items} onTap={(i, qty) => onWithdrawItem(i, qty)} empty="The vault is empty." />
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
            {bagForSale.length > 0 && (
              <>
                <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Your bag — tap to sell
                </p>
                <div className="space-y-1.5">
                  {bagForSale.map(({ slot, index, price }) => (
                    <button
                      key={index}
                      onClick={() => onSellItem(index)}
                      className="flex w-full items-center gap-2.5 rounded-2xl border border-border/60 bg-muted/40 px-3 py-2 text-left active:scale-[0.99]"
                    >
                      <ItemIcon item={item(slot.id)} className="size-7 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                        {item(slot.id).name}
                        {slot.plus ? ` +${slot.plus}` : ""}
                        {slot.qty > 1 ? ` ×${slot.qty}` : ""}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-gold">{price}g</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Section>
        )}

        {craftStations.map((svc) => {
          const list = RECIPES.filter((r) => r.station === svc);
          const stationLvl = Math.max(...list.map((r) => hud.skills[r.skill].level), 0);
          return (
            <Section key={svc} title={`${stationTitle[svc]} (Lv ${stationLvl})`}>
              {list.map((r) => {
                const skill = r.skill;
                const lvl = hud.skills[skill].level;
                const ok = lvl >= r.req && r.inputs.every((i) => count(i.id) >= i.qty);
                const out = item(r.out);
                const open = openRecipe === r.id;
                return (
                  <div key={r.id} className="rounded-2xl border border-border/70 bg-muted/40 p-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setOpenRecipe(open ? null : r.id)}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left active:scale-[0.99]"
                      >
                        <ItemIcon item={out} className="size-9" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1">
                            <span className="truncate text-xs font-bold text-foreground">
                              {out.name} {r.outQty > 1 && `x${r.outQty}`}
                            </span>
                            <ChevronDown
                              className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                            />
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            Lv {r.req} · {r.inputs.map((i) => `${count(i.id)}/${i.qty} ${item(i.id).name}`).join(", ")}
                          </span>
                        </span>
                      </button>
                      <button
                        disabled={!ok}
                        onClick={() => onCraft(r.id)}
                        className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                      >
                        <Hammer className="size-3.5" />
                        Make
                      </button>
                    </div>

                    {open && (
                      <div className="mt-2 space-y-2 rounded-xl bg-card/70 p-2.5">
                        <p className="text-[10px] text-muted-foreground">
                          {out.attack || out.defense
                            ? [
                                out.attack ? `+${out.attack} attack` : null,
                                out.defense ? `+${out.defense} defense` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : out.heal
                              ? `Heals ${out.heal} hp`
                              : "Crafting material"}
                          {" · "}
                          {r.xp} {skill} xp · {r.time}s
                          {lvl < r.req && ` · needs Lv ${r.req}`}
                        </p>
                        <div className="space-y-1">
                          {r.inputs.map((i) => {
                            const mat = item(i.id);
                            const have = count(i.id);
                            const sub = RECIPES.find((x) => x.out === i.id);
                            return (
                              <div key={i.id}>
                                <div className="flex items-center gap-2">
                                  <ItemIcon item={mat} className="size-4" />
                                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{mat.name}</span>
                                  <span
                                    className={`text-[11px] font-bold ${have >= i.qty ? "text-primary" : "text-destructive"}`}
                                  >
                                    {have}/{i.qty}
                                  </span>
                                </div>
                                {sub && have < i.qty && (
                                  <p className="ml-6 text-[10px] text-muted-foreground">
                                    Craft from {sub.inputs.map((s) => `${s.qty}x ${item(s.id).name}`).join(" + ")}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                  {d ? <ItemIcon item={d} className="size-9" /> : <span className="size-9 shrink-0 rounded-xl bg-muted" />}
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

function ItemGrid({
  slots,
  onTap,
  empty,
}: {
  slots: (InvSlot | null)[];
  onTap: (index: number, qty: number) => void;
  empty?: string;
}) {
  const filled = slots.map((s, i) => ({ s, i })).filter((e) => e.s);
  if (filled.length === 0) {
    return <p className="text-[11px] text-muted-foreground">{empty ?? "Nothing here."}</p>;
  }
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {filled.map(({ s, i }) => {
        const def = item(s!.id);
        return (
          <button
            key={`${i}-${s!.id}`}
            onClick={() => onTap(i, s!.qty)}
            className="flex flex-col items-center gap-0.5 rounded-xl border border-border/70 bg-muted/60 p-1 active:scale-95"
          >
            <span className="relative block aspect-square w-full">
              <ItemIcon item={def} className="size-full" />
              {s!.qty > 1 && (
                <span className="absolute bottom-0 right-0.5 text-[10px] font-black text-foreground">{s!.qty}</span>
              )}
            </span>
            <span className="w-full truncate text-center text-[9px] font-semibold leading-tight text-muted-foreground">
              {def.name}
              {s!.plus ? ` +${s!.plus}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

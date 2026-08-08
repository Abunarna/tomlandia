import { useState } from "react";
import { Coins, Store, Tag, Undo2 } from "lucide-react";
import { ITEMS } from "@/game/data";
import type { HudSnapshot } from "@/game/types";

type FilterKey = "all" | "weapon" | "armor" | "material" | "food";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "weapon", label: "Weapons" },
  { key: "armor", label: "Armour" },
  { key: "material", label: "Materials" },
  { key: "food", label: "Food" },
];



export function MarketTab({
  hud,
  onBuy,
  onCancel,
  onList,
  suggestPrice,
}: {
  hud: HudSnapshot;
  onBuy: (id: string) => void;
  onCancel: (id: string) => void;
  onList: (index: number, qty: number, price: number) => void;
  suggestPrice: (itemId: string) => number;
}) {
  const [tab, setTab] = useState<"browse" | "sell">("browse");
  const [filter, setFilter] = useState<FilterKey>("all");
  const fee = Math.round(hud.market.fee * 100);

  const matches = (itemId: string) => {
    if (filter === "all") return true;
    const kind = ITEMS[itemId]?.kind;
    if (!kind) return false;
    if (filter === "material") return kind === "material" || kind === "resource";
    return kind === filter;
  };

  const listings = hud.market.listings.filter((l) => matches(l.item));


  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TabButton active={tab === "browse"} onClick={() => setTab("browse")}>
          Browse
        </TabButton>
        <TabButton active={tab === "sell"} onClick={() => setTab("sell")}>
          Sell
        </TabButton>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
          <Coins className="size-3.5 text-gold" />
          {hud.gold}
        </span>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold active:scale-95 ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {tab === "browse" ? (
        <div className="space-y-1.5">
          {listings.slice(0, 30).map((l) => {

            const def = ITEMS[l.item];
            const total = l.price * l.qty;
            return (
              <div
                key={l.id}
                className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2"
              >
                {def ? (
                  <ItemIcon item={def} className="size-8" />
                ) : (
                  <span className="size-8 shrink-0 rounded-lg bg-muted" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-foreground">
                    {l.qty}× {def?.name ?? l.item}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {l.seller} · {l.price}g each
                  </p>
                </div>
                <button
                  onClick={() => (l.mine ? onCancel(l.id) : onBuy(l.id))}
                  className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold active:scale-95 ${
                    l.mine
                      ? "bg-muted text-muted-foreground"
                      : hud.gold >= total
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {l.mine ? (
                    <span className="flex items-center gap-1">
                      <Undo2 className="size-3" /> Cancel
                    </span>
                  ) : (
                    `Buy ${total}g`
                  )}
                </button>
              </div>
            );
          })}
          {!listings.length && (
            <p className="text-[11px] text-muted-foreground">No listings in this category right now.</p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {hud.inv.map((slot, i) => {
            if (!slot || !matches(slot.id)) return null;
            const def = ITEMS[slot.id];
            const price = suggestPrice(slot.id);
            const net = Math.round(price * slot.qty * (1 - hud.market.fee));
            return (
              <div key={i} className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2">
                <span
                  className="size-8 shrink-0 rounded-lg"
                  style={{ backgroundColor: def?.color ?? "var(--muted)" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-foreground">
                    {slot.qty}× {def?.name ?? slot.id}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {price}g each · you net {net}g after {fee}% fee
                  </p>
                </div>
                <button
                  onClick={() => onList(i, slot.qty, price)}
                  className="shrink-0 rounded-xl bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground active:scale-95"
                >
                  <span className="flex items-center gap-1">
                    <Tag className="size-3" /> List
                  </span>
                </button>
              </div>
            );
          })}
          {hud.inv.every((s) => !s || !matches(s.id)) && (
            <p className="text-[11px] text-muted-foreground">
              {hud.inv.some((s) => s) ? "Nothing in this category in your bag." : "Your bag is empty — go gather something to trade."}
            </p>
          )}
        </div>
      )}


      <div className="rounded-2xl border border-border/70 bg-muted/30 p-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
          <Store className="size-3.5 text-primary" /> Trade feed
        </p>
        <ul className="mt-1 space-y-0.5">
          {hud.market.log.slice(0, 6).map((l) => (
            <li key={l.id} className="truncate text-[10px] text-muted-foreground">
              {l.text}
            </li>
          ))}
          {!hud.market.log.length && (
            <li className="text-[10px] text-muted-foreground">Traders are quiet right now…</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 text-[11px] font-bold active:scale-95 ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

import { useMemo, useState } from "react";
import { ArrowLeft, Coins, Search, Tag, Undo2 } from "lucide-react";
import { ITEMS, item as itemDef } from "@/game/data";
import { priceKey, recommendedPrice, suggestedPrice, timeLeft } from "@/game/market";
import type { HudSnapshot, ItemId } from "@/game/types";
import { ItemIcon } from "./ItemIcon";

type FilterKey = "all" | "ore" | "wood" | "material" | "food" | "potion" | "weapon" | "armor";
type SortKey = "cheap" | "dear" | "new" | "level" | "rarity";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ore", label: "Ores" },
  { key: "wood", label: "Wood" },
  { key: "material", label: "Materials" },
  { key: "food", label: "Consumables" },
  { key: "potion", label: "Potions" },
  { key: "weapon", label: "Weapons" },
  { key: "armor", label: "Armour" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "cheap", label: "Lowest price" },
  { key: "dear", label: "Highest price" },
  { key: "new", label: "Newest" },
  { key: "level", label: "Item level" },
  { key: "rarity", label: "Rarity" },
];

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function inCategory(id: ItemId, filter: FilterKey): boolean {
  if (filter === "all") return true;
  const def = ITEMS[id];
  if (!def) return false;
  if (filter === "ore") return def.family === "ore" || def.family === "bar";
  if (filter === "wood") return def.family === "log";
  if (filter === "material") return def.kind === "material" || def.kind === "resource";
  if (filter === "food") return def.kind === "food";
  return def.kind === filter;
}

function label(id: ItemId, plus?: number): string {
  const name = ITEMS[id]?.name ?? id;
  return plus ? `${name} +${plus}` : name;
}

export function MarketTab({
  hud,
  onBuy,
  onCancel,
  onList,
}: {
  hud: HudSnapshot;
  onBuy: (id: string, qty: number) => void;
  onCancel: (id: string) => void;
  onList: (index: number, qty: number, price: number) => void;
  suggestPrice: (itemId: string) => number;
}) {
  const [tab, setTab] = useState<"browse" | "sell" | "mine">("browse");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("cheap");
  const [query, setQuery] = useState("");
  const [buying, setBuying] = useState<string | null>(null);
  const [selling, setSelling] = useState<number | null>(null);
  const fee = Math.round(hud.market.fee * 100);

  const listings = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = hud.market.listings.filter(
      (l) => !l.mine && inCategory(l.item, filter) && (!q || label(l.item, l.plus).toLowerCase().includes(q)),
    );
    const by: Record<SortKey, (a: typeof rows[number], b: typeof rows[number]) => number> = {
      cheap: (a, b) => a.price - b.price,
      dear: (a, b) => b.price - a.price,
      new: (a, b) => b.createdAt - a.createdAt,
      level: (a, b) => (ITEMS[b.item]?.level ?? 0) - (ITEMS[a.item]?.level ?? 0) || b.plus - a.plus,
      rarity: (a, b) =>
        (RARITY_ORDER[ITEMS[b.item]?.rarity ?? "common"] ?? 0) -
        (RARITY_ORDER[ITEMS[a.item]?.rarity ?? "common"] ?? 0),
    };
    return [...rows].sort(by[sort]);
  }, [hud.market.listings, filter, sort, query]);

  const mine = hud.market.listings.filter((l) => l.mine);

  const buyRow = hud.market.listings.find((l) => l.id === buying) ?? null;
  if (buyRow) {
    return <BuyCard hud={hud} listing={buyRow} onBack={() => setBuying(null)} onBuy={onBuy} />;
  }

  if (selling !== null && hud.inv[selling]) {
    return (
      <SellCard
        hud={hud}
        index={selling}
        onBack={() => setSelling(null)}
        onList={(i, q, p) => {
          onList(i, q, p);
          setSelling(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TabButton active={tab === "browse"} onClick={() => setTab("browse")}>
          Buy
        </TabButton>
        <TabButton active={tab === "sell"} onClick={() => setTab("sell")}>
          Sell
        </TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          My listings{mine.length ? ` (${mine.length})` : ""}
        </TabButton>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
          <Coins className="size-3.5 text-gold" />
          {hud.gold}
        </span>
      </div>

      {tab !== "mine" && (
        <>
          <label className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 px-2.5 py-1.5">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
              className="w-full bg-transparent text-[12px] font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold active:scale-95 ${
                  filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "browse" && (
        <>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                aria-pressed={sort === s.key}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold active:scale-95 ${
                  sort === s.key ? "bg-secondary text-secondary-foreground" : "bg-muted/60 text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            {listings.slice(0, 60).map((l) => {
              const def = ITEMS[l.item];
              const last = hud.market.lastSold[priceKey(l.item, l.plus)];
              return (
                <button
                  key={l.id}
                  onClick={() => setBuying(l.id)}
                  className="flex w-full items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2 text-left active:scale-[0.99]"
                >
                  {def ? (
                    <ItemIcon item={def} className="size-8" />
                  ) : (
                    <span className="size-8 shrink-0 rounded-lg bg-muted" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-foreground">
                      {l.qty}× {label(l.item, l.plus)}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {l.price}g each · {l.price * l.qty}g total · {l.seller}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-[10px] text-muted-foreground">
                    {last ? `last ${last}g` : "no sales"}
                  </span>
                </button>
              );
            })}
            {!listings.length && (
              <p className="text-[11px] text-muted-foreground">
                Nobody is selling that right now — every listing here comes from a real player.
              </p>
            )}
          </div>
        </>
      )}

      {tab === "sell" && (
        <div className="space-y-1.5">
          {hud.inv.map((slot, i) => {
            if (!slot || !inCategory(slot.id, filter)) return null;
            const q = query.trim().toLowerCase();
            if (q && !label(slot.id, slot.plus).toLowerCase().includes(q)) return null;
            const def = ITEMS[slot.id];
            if (def?.untradable) return null;
            const last = hud.market.lastSold[priceKey(slot.id, slot.plus ?? 0)];
            const rec = recommendedPrice(slot.id, slot.plus ?? 0, last);
            return (
              <button
                key={i}
                onClick={() => setSelling(i)}
                className="flex w-full items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2 text-left active:scale-[0.99]"
              >
                {def ? (
                  <ItemIcon item={def} className="size-8" />
                ) : (
                  <span className="size-8 shrink-0 rounded-lg bg-muted" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-foreground">
                    {slot.qty}× {label(slot.id, slot.plus)}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    recommended {rec}g each · {last ? `last sold ${last}g` : "no previous sales"}
                  </p>
                </div>
                <span className="shrink-0 rounded-xl bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground">
                  <span className="flex items-center gap-1">
                    <Tag className="size-3" /> Sell
                  </span>
                </span>
              </button>
            );
          })}
          {hud.inv.every((s) => !s || !inCategory(s.id, filter)) && (
            <p className="text-[11px] text-muted-foreground">
              {hud.inv.some((s) => s)
                ? "Nothing in this category in your bag."
                : "Your bag is empty — go gather something to trade."}
            </p>
          )}
        </div>
      )}

      {tab === "mine" && (
        <div className="space-y-1.5">
          {mine.map((l) => {
            const def = ITEMS[l.item];
            return (
              <div key={l.id} className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2">
                {def ? (
                  <ItemIcon item={def} className="size-8" />
                ) : (
                  <span className="size-8 shrink-0 rounded-lg bg-muted" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-foreground">
                    {l.qty}× {label(l.item, l.plus)}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {l.price}g each · {l.price * l.qty}g total · {timeLeft(l.expiresAt)} left
                  </p>
                </div>
                <button
                  onClick={() => onCancel(l.id)}
                  className="shrink-0 rounded-xl bg-muted px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground active:scale-95"
                >
                  <span className="flex items-center gap-1">
                    <Undo2 className="size-3" /> Cancel
                  </span>
                </button>
              </div>
            );
          })}
          {!mine.length && (
            <p className="text-[11px] text-muted-foreground">
              You have nothing listed. Listings last {14} days and unsold goods come straight back to you.
            </p>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Every sale pays a {fee}% transaction tax, which is destroyed. Buyers pay the listed price in full.
      </p>
    </div>
  );
}

function BuyCard({
  hud,
  listing,
  onBack,
  onBuy,
}: {
  hud: HudSnapshot;
  listing: HudSnapshot["market"]["listings"][number];
  onBack: () => void;
  onBuy: (id: string, qty: number) => void;
}) {
  const [qty, setQty] = useState(listing.qty);
  const amount = Math.max(1, Math.min(qty || 1, listing.qty));
  const total = amount * listing.price;
  const after = hud.gold - total;
  const def = ITEMS[listing.item];

  return (
    <div className="space-y-3">
      <BackBar onBack={onBack} title={label(listing.item, listing.plus)} def={def} />
      <dl className="space-y-1 rounded-2xl border border-border/70 bg-muted/40 p-3 text-[12px]">
        <Row label="Seller" value={listing.seller} />
        <Row label="Price per item" value={`${listing.price}g`} />
        <Row label="Available" value={`${listing.qty}`} />
        <Row
          label="Last sold"
          value={
            hud.market.lastSold[priceKey(listing.item, listing.plus)]
              ? `${hud.market.lastSold[priceKey(listing.item, listing.plus)]}g`
              : "No previous sales"
          }
        />
      </dl>

      {listing.qty > 1 && (
        <label className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2 text-[12px] font-semibold">
          <span className="text-muted-foreground">Your quantity</span>
          <input
            type="number"
            min={1}
            max={listing.qty}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="ml-auto w-24 rounded-xl bg-background px-2 py-1 text-right text-foreground outline-none"
          />
        </label>
      )}

      <dl className="space-y-1 rounded-2xl border border-border/70 bg-muted/30 p-3 text-[12px]">
        <Row label="Total cost" value={`${total}g`} />
        <Row label="Gold after purchase" value={`${after}g`} />
      </dl>

      <button
        disabled={after < 0}
        onClick={() => {
          onBuy(listing.id, amount);
          onBack();
        }}
        className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
      >
        {after < 0 ? "Not enough gold" : `BUY · ${total}g`}
      </button>
    </div>
  );
}

function SellCard({
  hud,
  index,
  onBack,
  onList,
}: {
  hud: HudSnapshot;
  index: number;
  onBack: () => void;
  onList: (index: number, qty: number, price: number) => void;
}) {
  const slot = hud.inv[index]!;
  const plus = slot.plus ?? 0;
  const def = ITEMS[slot.id];
  const last = hud.market.lastSold[priceKey(slot.id, plus)];
  const suggested = suggestedPrice(slot.id, plus);
  const recommended = recommendedPrice(slot.id, plus, last);
  const stackable = itemDef(slot.id).stackable;

  const [qty, setQty] = useState(slot.qty);
  const [price, setPrice] = useState(recommended);

  const amount = Math.max(1, Math.min(qty || 1, slot.qty));
  const unit = Math.max(1, Math.round(price || 1));
  const gross = amount * unit;
  const tax = Math.ceil(gross * hud.market.fee);

  return (
    <div className="space-y-3">
      <BackBar onBack={onBack} title={label(slot.id, plus)} def={def} />

      <label className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2 text-[12px] font-semibold">
        <span className="text-muted-foreground">Quantity</span>
        <input
          type="number"
          min={1}
          max={slot.qty}
          disabled={!stackable}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="ml-auto w-24 rounded-xl bg-background px-2 py-1 text-right text-foreground outline-none disabled:opacity-60"
        />
      </label>

      <dl className="space-y-1 rounded-2xl border border-border/70 bg-muted/30 p-3 text-[12px]">
        <Row label="Suggested price" value={`${suggested}g`} />
        <Row label="Last sold" value={last ? `${last}g` : "No previous sales"} />
        <Row label="Recommended price" value={`${recommended}g`} />
      </dl>

      <label className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-muted/40 p-2 text-[12px] font-semibold">
        <span className="text-muted-foreground">Your price (each)</span>
        <input
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="ml-auto w-24 rounded-xl bg-background px-2 py-1 text-right text-foreground outline-none"
        />
      </label>

      <dl className="space-y-1 rounded-2xl border border-border/70 bg-muted/30 p-3 text-[12px]">
        <Row label="Total listing value" value={`${gross}g`} />
        <Row label={`Tax (${Math.round(hud.market.fee * 100)}%)`} value={`-${tax}g`} />
        <Row label="You receive" value={`${gross - tax}g`} />
      </dl>

      <button
        onClick={() => onList(index, amount, unit)}
        className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
      >
        LIST · {amount}× at {unit}g
      </button>
      <p className="text-[10px] text-muted-foreground">
        Listings run for 14 days. Cancel any time for free — unsold goods return to your bag.
      </p>
    </div>
  );
}

function BackBar({
  onBack,
  title,
  def,
}: {
  onBack: () => void;
  title: string;
  def?: (typeof ITEMS)[string] | undefined;
}) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onBack} className="rounded-xl bg-muted p-1.5 text-muted-foreground active:scale-95">
        <ArrowLeft className="size-4" />
      </button>
      {def && <ItemIcon item={def} className="size-8" />}
      <p className="truncate text-[13px] font-bold text-foreground">{title}</p>
    </div>
  );
}

function Row({ label: l, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{l}</dt>
      <dd className="font-bold text-foreground">{value}</dd>
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

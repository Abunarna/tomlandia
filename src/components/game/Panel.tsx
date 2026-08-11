import { useState } from "react";
import { Backpack, Hammer, Store, Trophy, X } from "lucide-react";
import { ITEMS } from "@/game/data";
import type { HudSnapshot, ItemDef } from "@/game/types";
import { GearBadge, ItemIcon } from "./ItemIcon";
import { MarketTab } from "./Market";
import { LeaderboardTab } from "./Leaderboard";

export type PanelId = "inventory" | "skills" | "market" | "leaderboard";


export function Panel({
  panel,
  onClose,
  hud,
  onEquip,
  onUse,
  onDrop,
  onSetFood,
  onBuyListing,
  onCancelListing,
  onList,
  suggestPrice,
}: {
  panel: PanelId;
  onClose: () => void;
  hud: HudSnapshot;
  onEquip: (i: number) => void;
  onUse: (i: number) => void;
  onDrop: (i: number) => void;
  onSetFood: (i: number) => void;
  onBuyListing: (id: string, qty: number) => void;
  onCancelListing: (id: string) => void;
  onList: (index: number, qty: number, price: number) => void;
  suggestPrice: (itemId: string) => number;
}) {

  const title =
    panel === "inventory"
      ? "Bag"
      : panel === "skills"
        ? "Skills"
        : panel === "leaderboard"
          ? "Global Leaderboards"
          : "Market";
  return (
    <div className="pointer-events-auto flex h-full min-h-0 flex-col overflow-y-auto rounded-t-3xl border-t border-border/60 bg-card/95 p-3 shadow-soft backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          {panel === "inventory" ? (
            <Backpack className="size-4" />
          ) : panel === "skills" ? (
            <Hammer className="size-4" />
          ) : panel === "leaderboard" ? (
            <Trophy className="size-4" />
          ) : (
            <Store className="size-4" />
          )}
          {title}
        </p>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="grid size-8 place-items-center rounded-xl bg-muted text-muted-foreground active:scale-95"
        >
          <X className="size-4" />
        </button>
      </div>
      {panel === "inventory" ? (
        <InventoryTab
          hud={hud}
          onEquip={onEquip}
          onUse={onUse}
          onDrop={onDrop}
          onSetFood={onSetFood}
        />
      ) : panel === "skills" ? (
        <SkillsTab hud={hud} />
      ) : panel === "leaderboard" ? (
        <LeaderboardTab />
      ) : (
        <MarketTab
          hud={hud}
          onBuy={onBuyListing}
          onCancel={onCancelListing}
          onList={onList}
          suggestPrice={suggestPrice}
        />
      )}

    </div>
  );
}

function slotLabel(def: ItemDef, plus?: number | undefined) {
  return `${def.name}${plus && plus > 0 ? ` +${plus}` : ""}`;
}

function InventoryTab({
  hud,
  onEquip,
  onUse,
  onDrop,
  onSetFood,
}: {
  hud: HudSnapshot;
  onEquip: (i: number) => void;
  onUse: (i: number) => void;
  onDrop: (i: number) => void;
  onSetFood: (i: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const sel = selected != null ? hud.inv[selected] : null;
  const selDef = sel ? ITEMS[sel.id] : null;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <EquipSlot kind="weapon" eq={hud.weapon} label="Weapon" />
        <EquipSlot kind="armor" eq={hud.armor} label="Armor" />
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-bold">
        <span className="text-muted-foreground">
          Attack <span className="text-foreground">{hud.attack}</span>
        </span>
        <span className="text-muted-foreground">
          Defense <span className="text-foreground">{hud.defense}</span>
        </span>
        <span className="text-muted-foreground">
          Swing <span className="text-foreground">{hud.attackInterval.toFixed(2)}s</span>
          {hud.attackInterval < 1 && (
            <span className="ml-1 text-xp">{Math.round((1 - hud.attackInterval) * 100)}% faster</span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {hud.inv.map((slot, i) => {
          const def = slot ? ITEMS[slot.id] : null;
          return (
            <button
              key={i}
              onClick={() => {
                if (!def) return;
                setSelected(i);
              }}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-border/70 bg-muted/60 p-1 active:scale-95"
            >
              <span className="relative block aspect-square w-full">
                {def && (
                  <>
                    <ItemIcon item={def} className="size-full" />
                    {slot!.qty > 1 && (
                      <span className="absolute bottom-0 right-0.5 text-[10px] font-black text-foreground">
                        {slot!.qty}
                      </span>
                    )}
                  </>
                )}
              </span>
              <span className="w-full truncate text-center text-[9px] font-semibold leading-tight text-muted-foreground">
                {def ? slotLabel(def, slot!.plus) : ""}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tap an item to choose what to do with it. Visit Pip in Grand Haven to sell everything at once.
      </p>

      {selected != null && sel && selDef && (
        <ItemActions
          index={selected}
          def={selDef}
          plus={sel.plus}
          qty={sel.qty}
          onClose={() => setSelected(null)}
          onEquip={onEquip}
          onUse={onUse}
          onDrop={onDrop}
          onSetFood={onSetFood}
        />
      )}
    </div>
  );
}

function ItemActions({
  index,
  def,
  plus,
  qty,
  onClose,
  onEquip,
  onUse,
  onDrop,
  onSetFood,
}: {
  index: number;
  def: ItemDef;
  plus?: number | undefined;
  qty: number;
  onClose: () => void;
  onEquip: (i: number) => void;
  onUse: (i: number) => void;
  onDrop: (i: number) => void;
  onSetFood: (i: number) => void;
}) {
  const [examine, setExamine] = useState(false);
  const gear = def.kind === "weapon" || def.kind === "armor";
  const run = (fn: (i: number) => void) => {
    fn(index);
    onClose();
  };

  const stats: { label: string; value: string }[] = [];
  if (def.attack != null) stats.push({ label: "Attack", value: `+${def.attack}` });
  if (def.defense != null) stats.push({ label: "Defense", value: `+${def.defense}` });
  if (def.speed != null)
    stats.push({ label: "Attack speed", value: `+${Math.round(def.speed * 100)}% faster` });
  if (def.heal != null) stats.push({ label: "Heals", value: `${def.heal} hp` });
  if (def.dmgBoost != null)
    stats.push({
      label: "Damage boost",
      value: `+${def.dmgBoost}${def.boostHits != null ? ` for ${def.boostHits} hits` : ""}`,
    });
  if (def.value != null) stats.push({ label: "Value", value: `${def.value}g each` });

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-3xl border border-border/60 bg-card p-5 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="block size-10 shrink-0">
            <ItemIcon item={def} className="size-full" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold text-foreground">
              {slotLabel(def, plus)}
            </p>
            <p className="text-[11px] capitalize text-muted-foreground">
              {def.kind}
              {qty > 1 ? ` · ${qty} held` : ""}
            </p>
          </div>
        </div>

        {examine && (
          <div className="mt-3 space-y-1 rounded-2xl border border-border/60 bg-muted/40 p-3">
            {stats.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No notable stats.</p>
            ) : (
              stats.map((s) => (
                <div key={s.label} className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-bold text-foreground">{s.value}</span>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {gear && <ActionButton primary label="Equip" onClick={() => run(onEquip)} />}
          {def.kind === "food" && (
            <>
              <ActionButton primary label="Eat now" onClick={() => run(onUse)} />
              <ActionButton label="Set as auto-snack" onClick={() => run(onSetFood)} />
            </>
          )}
          {def.kind === "potion" && <ActionButton primary label="Drink" onClick={() => run(onUse)} />}
          <ActionButton label="Drop" onClick={() => run(onDrop)} />
          <ActionButton
            label={examine ? "Hide details" : "Examine"}
            onClick={() => setExamine((v) => !v)}
          />
          <button
            onClick={onClose}
            className="w-full rounded-2xl px-4 py-2.5 text-sm font-semibold text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl px-4 py-2.5 text-sm font-semibold active:scale-[0.98] ${
        primary
          ? "bg-primary text-primary-foreground"
          : "border border-border/60 bg-muted/40 text-foreground"
      }`}
    >
      {label}
    </button>
  );
}


function EquipSlot({
  kind,
  eq,
  label,
}: {
  kind: "weapon" | "armor";
  eq: { id: string; plus: number } | null;
  label: string;
}) {
  const def = eq ? ITEMS[eq.id] : null;
  return (
    <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/70 bg-muted/50 p-2">
      <GearBadge kind={kind} color={def?.color} className="size-9" />
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold text-foreground">
          {def ? `${def.name}${eq && eq.plus > 0 ? ` +${eq.plus}` : ""}` : "Empty"}
        </p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SkillsTab({ hud }: { hud: HudSnapshot }) {
  const rows: { id: keyof HudSnapshot["skills"]; name: string }[] = [
    { id: "combat", name: "Combat" },
    { id: "mining", name: "Mining" },
    { id: "woodcutting", name: "Woodcutting" },
    { id: "gathering", name: "Gathering" },
    { id: "fishing", name: "Fishing" },
    { id: "cooking", name: "Cooking" },
    { id: "alchemy", name: "Alchemy" },

    { id: "smithing", name: "Smithing" },
    { id: "skinning", name: "Skinning" },
    { id: "tailoring", name: "Tailoring" },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const s = hud.skills[r.id];
        return (
          <div key={r.id} className="rounded-2xl border border-border/70 bg-muted/40 p-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span>{r.name}</span>
              <span className="text-primary">Lv {s.level}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-xp" style={{ width: `${s.progress * 100}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {s.into} / {s.need} xp to next level
            </p>
          </div>
        );
      })}
    </div>
  );
}

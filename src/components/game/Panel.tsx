import { Backpack, Hammer, Shield, Store, Sword, X } from "lucide-react";
import { ITEMS } from "@/game/data";
import type { HudSnapshot } from "@/game/types";
import { MarketTab } from "./Market";

export type PanelId = "inventory" | "skills" | "market";

export function Panel({
  panel,
  onClose,
  hud,
  onEquip,
  onSell,
  onUse,
  onBuyListing,
  onCancelListing,
  onList,
  suggestPrice,
}: {
  panel: PanelId;
  onClose: () => void;
  hud: HudSnapshot;
  onEquip: (i: number) => void;
  onSell: (i: number) => void;
  onUse: (i: number) => void;
  onBuyListing: (id: string) => void;
  onCancelListing: (id: string) => void;
  onList: (index: number, qty: number, price: number) => void;
  suggestPrice: (itemId: string) => number;
}) {
  const title = panel === "inventory" ? "Bag" : panel === "skills" ? "Skills" : "Market";
  return (
    <div className="pointer-events-auto max-h-[52dvh] overflow-y-auto rounded-t-3xl border-t border-border/60 bg-card/95 p-3 shadow-soft backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          {panel === "inventory" ? (
            <Backpack className="size-4" />
          ) : panel === "skills" ? (
            <Hammer className="size-4" />
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
        <InventoryTab hud={hud} onEquip={onEquip} onSell={onSell} onUse={onUse} />
      ) : panel === "skills" ? (
        <SkillsTab hud={hud} />
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


function InventoryTab({
  hud,
  onEquip,
  onSell,
  onUse,
}: {
  hud: HudSnapshot;
  onEquip: (i: number) => void;
  onSell: (i: number) => void;
  onUse: (i: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <EquipSlot icon={<Sword className="size-4" />} eq={hud.weapon} label="Weapon" />
        <EquipSlot icon={<Shield className="size-4" />} eq={hud.armor} label="Armor" />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {hud.inv.map((slot, i) => {
          const def = slot ? ITEMS[slot.id] : null;
          return (
            <button
              key={i}
              onClick={() => {
                if (!def) return;
                if (def.kind === "weapon" || def.kind === "armor") onEquip(i);
                else if (def.kind === "food") onUse(i);
                else onSell(i);
              }}
              className="relative aspect-square rounded-xl border border-border/70 bg-muted/60 p-1 active:scale-95"
            >
              {def && (
                <>
                  <ItemIcon item={def} className="size-full" />
                  {slot!.qty > 1 && (
                    <span className="absolute bottom-0 right-1 text-[10px] font-black text-foreground">
                      {slot!.qty}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tap gear to equip, food to eat, resources to sell. Visit Pip in Grand Haven to sell everything at once.
      </p>
    </div>
  );
}

function EquipSlot({ icon, eq, label }: { icon: React.ReactNode; eq: { id: string; plus: number } | null; label: string }) {
  const def = eq ? ITEMS[eq.id] : null;
  return (
    <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/70 bg-muted/50 p-2">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: def?.color ?? "var(--muted)" }}
      >
        {icon}
      </span>
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

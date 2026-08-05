import { Backpack, Hammer, Map as MapIcon, Scale, Shield, Sword, Coins } from "lucide-react";
import { ITEMS } from "@/game/data";
import type { HudSnapshot } from "@/game/types";
import { Joystick } from "./Joystick";

export type TabId = "world" | "inventory" | "skills" | "market";

const TABS: { id: TabId; label: string; icon: typeof MapIcon }[] = [
  { id: "world", label: "World", icon: MapIcon },
  { id: "inventory", label: "Bag", icon: Backpack },
  { id: "skills", label: "Skills", icon: Hammer },
  { id: "market", label: "Market", icon: Scale },
];

export function Dock({
  tab,
  setTab,
  hud,
  onJoystick,
  onEquip,
  onSell,
}: {
  tab: TabId;
  setTab: (t: TabId) => void;
  hud: HudSnapshot;
  onJoystick: (dx: number, dy: number, active: boolean) => void;
  onEquip: (i: number) => void;
  onSell: (i: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-t-3xl border-t border-border/60 bg-card/95 shadow-soft backdrop-blur">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "world" && <WorldTab hud={hud} onJoystick={onJoystick} />}
        {tab === "inventory" && <InventoryTab hud={hud} onEquip={onEquip} onSell={onSell} />}
        {tab === "skills" && <SkillsTab hud={hud} />}
        {tab === "market" && <MarketTab />}
      </div>
      <nav className="grid grid-cols-4 gap-1 border-t border-border/60 p-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition-colors ${
                active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="size-5" />
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function WorldTab({ hud, onJoystick }: { hud: HudSnapshot; onJoystick: (dx: number, dy: number, a: boolean) => void }) {
  return (
    <div className="flex items-center gap-4">
      <Joystick onChange={onJoystick} />
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-bold text-foreground">{hud.region}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Tap the map to walk. Tap a rock, tree or critter to gather or fight automatically.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["Grand Haven", "Copper Ridge", "Oak Grove", "Cluckin' Meadow"].map((p) => (
            <span key={p} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function InventoryTab({
  hud,
  onEquip,
  onSell,
}: {
  hud: HudSnapshot;
  onEquip: (i: number) => void;
  onSell: (i: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <EquipSlot icon={<Sword className="size-4" />} id={hud.weapon} label="Weapon" />
        <EquipSlot icon={<Shield className="size-4" />} id={hud.armor} label="Armor" />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {hud.inv.map((slot, i) => {
          const def = slot ? ITEMS[slot.id] : null;
          const gear = def && def.kind !== "resource";
          return (
            <button
              key={i}
              onClick={() => (gear ? onEquip(i) : slot ? onSell(i) : undefined)}
              className="relative aspect-square rounded-xl border border-border/70 bg-muted/60 p-1 active:scale-95"
            >
              {def && (
                <>
                  <span
                    className="block size-full rounded-lg"
                    style={{ backgroundColor: def.color }}
                    aria-label={def.name}
                  />
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
        Tap gear to equip. Tap resources to sell at the Market stall for gold.
      </p>
    </div>
  );
}

function EquipSlot({ icon, id, label }: { icon: React.ReactNode; id: string | null; label: string }) {
  const def = id ? ITEMS[id as keyof typeof ITEMS] : null;
  return (
    <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/70 bg-muted/50 p-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: def?.color ?? "var(--muted)" }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold text-foreground">{def?.name ?? "Empty"}</p>
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

function MarketTab() {
  return (
    <div className="grid h-full place-items-center rounded-2xl border border-dashed border-border p-6 text-center">
      <div>
        <Coins className="mx-auto size-6 text-gold" />
        <p className="mt-2 text-sm font-bold text-foreground">Grand Exchange coming soon</p>
        <p className="text-[11px] text-muted-foreground">For now, sell resources from your bag.</p>
      </div>
    </div>
  );
}

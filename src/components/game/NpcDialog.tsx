import { useState } from "react";
import { Coins, Check, X, Hammer, ArrowUpCircle, ChevronDown, Lock } from "lucide-react";
import {
  MAX_PLUS,
  NPCS,
  QUESTS,
  RECIPES,
  SHOP_STOCK,
  item,
  type NpcRole,
  type Recipe,
} from "@/game/data";
import {
  BASE_ATTACK_INTERVAL_S,
  releaseArmourTiers,
  releasePotionTiers,
  releaseWeaponTiers,
  type PotionTierRow,
} from "@/game/release-content";
import type { HudSnapshot, InvSlot, ItemDef, ItemId } from "@/game/types";
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
  onCraftAll,
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
  onCraftAll: (recipeId: string) => void;
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
  const armourTiers = releaseArmourTiers();
  const weaponTiers = releaseWeaponTiers();
  const potionTiers = releasePotionTiers();

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
              <p className="text-sm font-bold text-foreground">{def.title}</p>
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
                <div
                  key={entry.id}
                  className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-muted/40 p-2"
                >
                  <ItemIcon item={d} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.attack || d.defense
                        ? [
                            d.attack ? `+${d.attack} attack` : null,
                            d.defense ? `+${d.defense} defense` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : d.heal
                          ? `Heals ${d.heal} hp`
                          : "Material"}
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
            <ItemGrid
              slots={hud.bank.items}
              onTap={(i, qty) => onWithdrawItem(i, qty)}
              empty="The vault is empty."
            />
          </Section>
        )}
        {services.includes("sell") && (
          <Section title="Trade">
            <p className="text-xs text-muted-foreground">
              Your bag holds <span className="font-bold text-foreground">{resourceValue}g</span>{" "}
              worth of resources.
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

          if (svc === "armor") {
            return (
              <Section key={svc} title={`${stationTitle[svc]} (Lv ${stationLvl})`}>
                <p className="text-[10px] text-muted-foreground">
                  Every tier offers a Heavy and a Light set. Heavy trades swing speed for
                  survivability; Light swings faster for more experience per minute.
                </p>
                {armourTiers.map((row) => {
                  const unlocked =
                    (row.heavy
                      ? hud.skills[row.heavy.recipe.skill].level >= row.heavy.recipe.req
                      : false) ||
                    (row.light
                      ? hud.skills[row.light.recipe.skill].level >= row.light.recipe.req
                      : false);
                  return (
                    <div key={row.tier} className="space-y-1.5">
                      <div className="flex items-center gap-2 px-0.5">
                        <span
                          className={`text-[11px] font-bold ${unlocked ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          T{row.tier} · {row.theme}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Lv {row.levelRequirement}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[row.heavy, row.light].map((entry, side) =>
                          entry ? (
                            <ArmourCard
                              key={entry.recipe.id}
                              recipe={entry.recipe}
                              def={entry.item}
                              level={hud.skills[entry.recipe.skill].level}
                              count={count}
                              open={openRecipe === entry.recipe.id}
                              onToggle={() =>
                                setOpenRecipe(
                                  openRecipe === entry.recipe.id ? null : entry.recipe.id,
                                )
                              }
                              onCraft={onCraft}
                              onCraftAll={onCraftAll}
                            />
                          ) : (
                            <div key={side} />
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
              </Section>
            );
          }

          if (svc === "alchemy") {
            const potionRecipeIds = new Set(potionTiers.map((row) => row.recipe.id));
            const others = list.filter((r) => !potionRecipeIds.has(r.id));
            const bagBest = potionTiers
              .filter((row) => count(row.item.id) > 0)
              .sort((a, b) => b.strengthPct - a.strengthPct || b.boostHits - a.boostHits)[0];
            return (
              <Section key={svc} title={`${stationTitle[svc]} (Lv ${stationLvl})`}>
                <p className="text-[10px] text-muted-foreground">
                  One strength potion per tier, from Lv 1 to Lv 150. A potion raises your attack by
                  a percentage for a set number of hits — it never changes how much your food heals.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {potionTiers.map((row) => (
                    <PotionCard
                      key={row.recipe.id}
                      row={row}
                      attackInterval={hud.attackInterval}
                      activePct={hud.buff?.pct ?? 0}
                      bagBest={bagBest ?? null}
                      owned={count(row.item.id)}
                      level={hud.skills[row.recipe.skill].level}
                      count={count}
                      open={openRecipe === row.recipe.id}
                      onToggle={() =>
                        setOpenRecipe(openRecipe === row.recipe.id ? null : row.recipe.id)
                      }
                      onCraft={onCraft}
                      onCraftAll={onCraftAll}
                    />
                  ))}
                </div>
                {others.length > 0 && (
                  <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Other brews
                  </p>
                )}
                {others.map((r) => {
                  const lvl = hud.skills[r.skill].level;
                  const ok = lvl >= r.req && r.inputs.every((i) => count(i.id) >= i.qty);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2"
                    >
                      <ItemIcon item={item(r.out)} className="size-8 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-foreground">
                          {item(r.out).name}
                          {r.outQty > 1 ? ` x${r.outQty}` : ""}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          Lv {r.req} {r.skill} · {r.xp} xp
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          disabled={!ok}
                          onClick={() => onCraft(r.id)}
                          className="flex items-center gap-1 rounded-xl bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                        >
                          <Hammer className="size-3" />
                          Make
                        </button>
                        <button
                          disabled={!ok}
                          onClick={() => onCraftAll(r.id)}
                          className="rounded-xl bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                        >
                          All
                        </button>
                      </div>
                    </div>
                  );
                })}
              </Section>
            );
          }

          if (svc === "forge") {
            const swordRecipeIds = new Set(weaponTiers.map((row) => row.recipe.id));
            const others = list.filter((r) => !swordRecipeIds.has(r.id));
            return (
              <Section key={svc} title={`${stationTitle[svc]} (Lv ${stationLvl})`}>
                <p className="text-[10px] text-muted-foreground">
                  One sword per tier, from Lv 1 to Lv 150. Every sword swings on a{" "}
                  {BASE_ATTACK_INTERVAL_S.toFixed(2)}s base interval; your armour modifies that
                  cadence.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {weaponTiers.map((row) => (
                    <WeaponCard
                      key={row.recipe.id}
                      tier={row.tier}
                      theme={row.theme}
                      recipe={row.recipe}
                      def={row.item}
                      equipped={hud.weapon ? item(hud.weapon.id) : null}
                      level={hud.skills[row.recipe.skill].level}
                      count={count}
                      open={openRecipe === row.recipe.id}
                      onToggle={() =>
                        setOpenRecipe(openRecipe === row.recipe.id ? null : row.recipe.id)
                      }
                      onCraft={onCraft}
                      onCraftAll={onCraftAll}
                    />
                  ))}
                </div>
                {others.length > 0 && (
                  <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Materials
                  </p>
                )}
                {others.map((r) => {
                  const lvl = hud.skills[r.skill].level;
                  const ok = lvl >= r.req && r.inputs.every((i) => count(i.id) >= i.qty);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2"
                    >
                      <ItemIcon item={item(r.out)} className="size-8 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-foreground">
                          {item(r.out).name}
                          {r.outQty > 1 ? ` x${r.outQty}` : ""}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          Lv {r.req} {r.skill} · {r.xp} xp ·{" "}
                          {r.inputs
                            .map((i) => `${item(i.id).name} ${count(i.id)}/${i.qty}`)
                            .join(", ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          disabled={!ok}
                          onClick={() => onCraft(r.id)}
                          className="flex items-center gap-1 rounded-xl bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                        >
                          <Hammer className="size-3" />
                          Make
                        </button>
                        <button
                          disabled={!ok}
                          onClick={() => onCraftAll(r.id)}
                          className="rounded-xl bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                        >
                          All
                        </button>
                      </div>
                    </div>
                  );
                })}
              </Section>
            );
          }

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
                            Lv {r.req} ·{" "}
                            {r.inputs
                              .map((i) => `${count(i.id)}/${i.qty} ${item(i.id).name}`)
                              .join(", ")}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          disabled={!ok}
                          onClick={() => onCraft(r.id)}
                          className="flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                        >
                          <Hammer className="size-3.5" />
                          Make
                        </button>
                        <button
                          disabled={!ok}
                          onClick={() => onCraftAll(r.id)}
                          className="rounded-xl bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
                        >
                          Make all
                        </button>
                      </div>
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
                          {r.xp} {skill} xp · {r.time}s{lvl < r.req && ` · needs Lv ${r.req}`}
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
                                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                                    {mat.name}
                                  </span>
                                  <span
                                    className={`text-[11px] font-bold ${have >= i.qty ? "text-primary" : "text-destructive"}`}
                                  >
                                    {have}/{i.qty}
                                  </span>
                                </div>
                                {sub && have < i.qty && (
                                  <p className="ml-6 text-[10px] text-muted-foreground">
                                    Craft from{" "}
                                    {sub.inputs
                                      .map((s) => `${s.qty}x ${item(s.id).name}`)
                                      .join(" + ")}
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
                <div
                  key={which}
                  className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-muted/40 p-2"
                >
                  {d ? (
                    <ItemIcon item={d} className="size-9" />
                  ) : (
                    <span className="size-9 shrink-0 rounded-xl bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">
                      {d ? `${d.name} +${eq!.plus}` : `No ${which}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {eq && eq.plus >= MAX_PLUS
                        ? "Fully upgraded"
                        : "+2% attack per level through +50, then +0.5% per level"}
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
                <span className="absolute bottom-0 right-0.5 text-[10px] font-black text-foreground">
                  {s!.qty}
                </span>
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

/**
 * Compact armour tile used by the Armourer's tier grid.
 *
 * Unlike the generic recipe row, a locked set stays visible: players need to
 * see the whole ladder to plan, so an unmet level shows the gate rather than
 * hiding the set.
 */
function ArmourCard({
  recipe,
  def,
  level,
  count,
  open,
  onToggle,
  onCraft,
  onCraftAll,
}: {
  recipe: Recipe;
  def: ItemDef;
  level: number;
  count: (id: ItemId) => number;
  open: boolean;
  onToggle: () => void;
  onCraft: (recipeId: string) => void;
  onCraftAll: (recipeId: string) => void;
}) {
  const levelOk = level >= recipe.req;
  const hasMats = recipe.inputs.every((i) => count(i.id) >= i.qty);
  const ok = levelOk && hasMats;
  return (
    <div
      className={`rounded-2xl border p-1.5 ${
        levelOk ? "border-border/70 bg-muted/40" : "border-border/40 bg-muted/20 opacity-70"
      }`}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-1.5 text-left active:scale-[0.99]"
      >
        <span className="relative shrink-0">
          <ItemIcon item={def} className="size-8" />
          {!levelOk && (
            <Lock className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-card p-[1px] text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-bold text-foreground">{def.name}</span>
          <span className="block truncate text-[9px] text-muted-foreground">
            {def.defense ? `${def.defense} def` : "—"}
            {def.attack ? ` · ${def.attack} atk` : ""}
            {def.speed ? ` · ${Math.round(def.speed * 100)}% spd` : ""}
          </span>
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div className="mt-1.5 flex gap-1">
        <button
          disabled={!ok}
          onClick={() => onCraft(recipe.id)}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
        >
          <Hammer className="size-3" />
          Make
        </button>
        <button
          disabled={!ok}
          onClick={() => onCraftAll(recipe.id)}
          className="rounded-xl bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
        >
          All
        </button>
      </div>

      {open && (
        <div className="mt-1.5 space-y-1 rounded-xl bg-card/70 p-2">
          <p className="text-[10px] text-muted-foreground">
            Lv {recipe.req} {recipe.skill} · {recipe.xp} xp · {recipe.time}s
            {!levelOk && ` · needs Lv ${recipe.req}`}
          </p>
          {recipe.inputs.map((i) => {
            const mat = item(i.id);
            const have = count(i.id);
            return (
              <div key={i.id} className="flex items-center gap-1.5">
                <ItemIcon item={mat} className="size-4" />
                <span className="min-w-0 flex-1 truncate text-[10px] text-foreground">
                  {mat.name}
                </span>
                <span
                  className={`text-[10px] font-bold ${have >= i.qty ? "text-primary" : "text-destructive"}`}
                >
                  {have}/{i.qty}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Compact sword tile used by the Weaponsmith's 16-tier ladder.
 *
 * Locked tiers stay visible so players can plan the whole ladder, and the tile
 * always compares against the equipped weapon: the ladder is only useful if you
 * can see whether the next tier is actually an upgrade.
 */
/**
 * One strength potion tier for the Alchemist. Locked future tiers still show,
 * so the whole ladder is readable from level 1.
 */
function PotionCard({
  row,
  attackInterval,
  activePct,
  bagBest,
  owned,
  level,
  count,
  open,
  onToggle,
  onCraft,
  onCraftAll,
}: {
  row: PotionTierRow;
  attackInterval: number;
  activePct: number;
  bagBest: PotionTierRow | null;
  owned: number;
  level: number;
  count: (id: ItemId) => number;
  open: boolean;
  onToggle: () => void;
  onCraft: (recipeId: string) => void;
  onCraftAll: (recipeId: string) => void;
}) {
  const { recipe, item: def, strengthPct, boostHits } = row;
  const levelOk = level >= recipe.req;
  const hasMats = recipe.inputs.every((i) => count(i.id) >= i.qty);
  const ok = levelOk && hasMats;
  const seconds = Math.round(boostHits * Math.max(attackInterval, 0.1));
  const effect = `+${strengthPct}% strength for ${boostHits} hits`;
  return (
    <div
      className={`rounded-2xl border p-1.5 ${
        levelOk ? "border-border/70 bg-muted/40" : "border-border/40 bg-muted/20 opacity-70"
      }`}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${def.name}, tier ${row.tier}, ${effect}`}
        className="flex w-full min-w-0 items-center gap-1.5 text-left active:scale-[0.99]"
      >
        <span className="relative shrink-0">
          <ItemIcon item={def} className="size-8" />
          {!levelOk && (
            <Lock className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-card p-[1px] text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-bold text-foreground">{def.name}</span>
          <span className="block truncate text-[9px] text-muted-foreground">
            T{row.tier} · Lv {row.levelRequirement} · {effect}
          </span>
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div className="mt-1.5 flex gap-1">
        <button
          disabled={!ok}
          onClick={() => onCraft(recipe.id)}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
        >
          <Hammer className="size-3" />
          Brew
        </button>
        <button
          disabled={!ok}
          onClick={() => onCraftAll(recipe.id)}
          className="rounded-xl bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
        >
          All
        </button>
      </div>

      {open && (
        <div className="mt-1.5 space-y-1 rounded-xl bg-card/70 p-2">
          <p className="text-[10px] text-muted-foreground">
            {effect} · about {seconds}s at your current swing speed
          </p>
          <p className="text-[10px] text-muted-foreground">
            Lv {recipe.req} {recipe.skill} · {recipe.xp} xp · {recipe.time}s · worth {def.value}g ·
            you hold {owned}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground">
            {activePct > 0
              ? `${strengthPct - activePct >= 0 ? "+" : ""}${strengthPct - activePct}% vs the potion you are drinking`
              : "No potion active"}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground">
            {bagBest
              ? `${strengthPct - bagBest.strengthPct >= 0 ? "+" : ""}${strengthPct - bagBest.strengthPct}% vs your best carried potion (${bagBest.item.name})`
              : "No strength potion in your bag"}
          </p>
          {recipe.inputs.map((i) => {
            const mat = item(i.id);
            const have = count(i.id);
            return (
              <div key={i.id} className="flex items-center gap-1.5">
                <ItemIcon item={mat} className="size-4" />
                <span className="min-w-0 flex-1 truncate text-[10px] text-foreground">
                  {mat.name}
                </span>
                <span
                  className={`text-[10px] font-bold ${have >= i.qty ? "text-primary" : "text-destructive"}`}
                >
                  {have}/{i.qty}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeaponCard({
  tier,
  theme,
  recipe,
  def,
  equipped,
  level,
  count,
  open,
  onToggle,
  onCraft,
  onCraftAll,
}: {
  tier: number;
  theme: string;
  recipe: Recipe;
  def: ItemDef;
  equipped: ItemDef | null;
  level: number;
  count: (id: ItemId) => number;
  open: boolean;
  onToggle: () => void;
  onCraft: (recipeId: string) => void;
  onCraftAll: (recipeId: string) => void;
}) {
  const levelOk = level >= recipe.req;
  const hasMats = recipe.inputs.every((i) => count(i.id) >= i.qty);
  const ok = levelOk && hasMats;
  const attack = def.attack ?? 0;
  const delta = equipped ? attack - (equipped.attack ?? 0) : attack;
  return (
    <div
      className={`rounded-2xl border p-1.5 ${
        levelOk ? "border-border/70 bg-muted/40" : "border-border/40 bg-muted/20 opacity-70"
      }`}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-1.5 text-left active:scale-[0.99]"
      >
        <span className="relative shrink-0">
          <ItemIcon item={def} className="size-8" />
          {!levelOk && (
            <Lock className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-card p-[1px] text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-bold text-foreground">{def.name}</span>
          <span className="block truncate text-[9px] text-muted-foreground">
            T{tier} · {theme} · Lv {def.level ?? recipe.req} · {attack} atk
          </span>
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div className="mt-1.5 flex gap-1">
        <button
          disabled={!ok}
          onClick={() => onCraft(recipe.id)}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
        >
          <Hammer className="size-3" />
          Make
        </button>
        <button
          disabled={!ok}
          onClick={() => onCraftAll(recipe.id)}
          className="rounded-xl bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
        >
          All
        </button>
      </div>

      {open && (
        <div className="mt-1.5 space-y-1 rounded-xl bg-card/70 p-2">
          <p className="text-[10px] text-muted-foreground">
            {attack} attack · {BASE_ATTACK_INTERVAL_S.toFixed(2)}s base attack interval (armour
            modifies cadence)
          </p>
          <p className="text-[10px] text-muted-foreground">
            Lv {recipe.req} {recipe.skill} · {recipe.xp} xp · {recipe.time}s
            {!levelOk && ` · needs Lv ${recipe.req}`}
          </p>
          <p
            className={`text-[10px] font-bold ${delta > 0 ? "text-primary" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}
          >
            {equipped
              ? `${delta >= 0 ? "+" : ""}${delta} atk vs ${equipped.name}`
              : "No weapon equipped"}
          </p>
          {recipe.inputs.map((i) => {
            const mat = item(i.id);
            const have = count(i.id);
            return (
              <div key={i.id} className="flex items-center gap-1.5">
                <ItemIcon item={mat} className="size-4" />
                <span className="min-w-0 flex-1 truncate text-[10px] text-foreground">
                  {mat.name}
                </span>
                <span
                  className={`text-[10px] font-bold ${have >= i.qty ? "text-primary" : "text-destructive"}`}
                >
                  {have}/{i.qty}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

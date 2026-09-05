import type { ItemDef, ItemId, InvSlot } from "./types";

/**
 * The server-owned potion buff. V6 potions send `strength_pct`; releases up to
 * V5 send the flat `dmg` bonus, and both shapes must keep parsing so a rollback
 * to V5 content never breaks a save that is already loaded.
 */
export interface ServerBuff {
  dmg?: number | null;
  strength_pct?: number | null;
  hits: number;
  item?: string | null;
  content_version?: string | null;
}

/** Active potion buff as the client mirrors it. */
export interface ClientBuff {
  /** Percentage strength boost (V6). Zero for legacy flat buffs. */
  pct: number;
  /** Flat damage bonus (V1..V5). Zero for percentage buffs. */
  dmg: number;
  hits: number;
  item: ItemId | null;
}

/**
 * Parses any buff the server may return: absent, a legacy flat buff, a V6
 * percentage buff, an expired buff or a corrupt one. Anything that is not a
 * live, positive buff becomes null. The client never invents an effect value.
 */
export function readServerBuff(raw: ServerBuff | null | undefined): ClientBuff | null {
  if (!raw || typeof raw !== "object") return null;
  const hits = Number(raw.hits);
  if (!Number.isFinite(hits) || hits <= 0) return null;
  const pct = Number(raw.strength_pct);
  const dmg = Number(raw.dmg);
  const safePct = Number.isFinite(pct) && pct > 0 ? pct : 0;
  const safeDmg = Number.isFinite(dmg) && dmg > 0 ? dmg : 0;
  if (safePct <= 0 && safeDmg <= 0) return null;
  return {
    pct: safePct,
    dmg: safeDmg,
    hits: Math.floor(hits),
    item: typeof raw.item === "string" && raw.item ? (raw.item as ItemId) : null,
  };
}

/**
 * Ranks the bag for auto-potion: strength percentage, then boosted hits, then
 * tier. Definitions the active release does not publish are ignored, and a
 * legacy flat-only potion ranks below every percentage potion.
 */
export function bestPotionIndex(
  inv: (InvSlot | null)[],
  defs: Record<string, ItemDef | undefined>,
): number {
  let best = -1;
  let bestKey: [number, number, number] | null = null;
  for (let i = 0; i < inv.length; i++) {
    const slot = inv[i];
    if (!slot) continue;
    const def = defs[slot.id];
    if (!def || def.kind !== "potion") continue;
    const pct = def.strengthPct ?? 0;
    const hits = def.boostHits ?? 0;
    if (hits <= 0) continue;
    if (pct <= 0 && !(def.dmgBoost ?? 0)) continue;
    const key: [number, number, number] = [pct, hits, def.tier ?? def.level ?? 0];
    if (
      !bestKey ||
      key[0] > bestKey[0] ||
      (key[0] === bestKey[0] && key[1] > bestKey[1]) ||
      (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] > bestKey[2])
    ) {
      bestKey = key;
      best = i;
    }
  }
  return best;
}

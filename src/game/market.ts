import { ITEMS, item } from "./data";
import type { ItemId } from "./types";

/** Phase 3 — Global marketplace (local + simulated, no server). */

export const MARKET_FEE = 0.05;

export interface Listing {
  id: string;
  item: ItemId;
  qty: number;
  /** price per unit */
  price: number;
  seller: string;
  /** true when the player listed it */
  mine: boolean;
}

export interface TradeLog {
  id: string;
  text: string;
  at: number;
}

const NPC_TRADERS = [
  "Pip",
  "Coinmaster Odo",
  "Rook",
  "Mabel",
  "Sigrid",
  "Master Alric",
  "Lira",
  "Wandering Tess",
  "Bram the Bold",
  "Old Hollis",
  "Nim",
  "Fenwick",
];

const TRADEABLE: ItemId[] = Object.values(ITEMS)
  .filter((d) => d.kind !== "food" || true)
  .map((d) => d.id);

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

let seq = 0;
const nextId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export function suggestedPrice(id: ItemId): number {
  return Math.max(1, Math.round(item(id).value * rnd(0.85, 1.35)));
}

export function feeFor(total: number): number {
  return Math.ceil(total * MARKET_FEE);
}

/** Creates a fresh batch of NPC listings so the board is never empty. */
export function seedListings(count = 14): Listing[] {
  const out: Listing[] = [];
  for (let i = 0; i < count; i++) out.push(npcListing());
  return out;
}

export function npcListing(): Listing {
  const id = pick(TRADEABLE);
  const def = item(id);
  const stack = def.stackable ? Math.max(1, Math.round(rnd(1, 12))) : 1;
  return {
    id: nextId(),
    item: id,
    qty: stack,
    price: suggestedPrice(id),
    seller: pick(NPC_TRADERS),
    mine: false,
  };
}

export function makePlayerListing(itemId: ItemId, qty: number, price: number): Listing {
  return { id: nextId(), item: itemId, qty, price, seller: "You", mine: true };
}

export interface SimResult {
  listings: Listing[];
  /** gold credited to the player from sold listings, already net of fee */
  earned: number;
  logs: TradeLog[];
}

/**
 * One simulated market beat: NPCs post new stock, buy each other's goods,
 * and occasionally snap up the player's listings (5% fee deducted).
 */
export function simulate(listings: Listing[], at: number): SimResult {
  let out = [...listings];
  const logs: TradeLog[] = [];
  let earned = 0;

  // NPCs list new stock
  if (out.length < 26 && Math.random() < 0.85) {
    const l = npcListing();
    out.push(l);
    logs.push({ id: l.id + "n", text: `${l.seller} listed ${l.qty}× ${item(l.item).name}`, at });
  }

  // NPCs buy something
  if (out.length && Math.random() < 0.7) {
    const idx = Math.floor(Math.random() * out.length);
    const l = out[idx]!;
    const fair = item(l.item).value;
    // cheap listings sell fast, overpriced ones linger
    const chance = l.price <= fair ? 0.85 : Math.max(0.05, 0.85 - (l.price / fair - 1) * 0.9);
    if (Math.random() < chance) {
      const buyer = pick(NPC_TRADERS);
      const gross = l.price * l.qty;
      if (l.mine) {
        earned += gross - feeFor(gross);
        logs.push({ id: l.id + "s", text: `${buyer} bought your ${l.qty}× ${item(l.item).name}`, at });
      } else {
        logs.push({ id: l.id + "t", text: `${buyer} bought ${l.qty}× ${item(l.item).name} from ${l.seller}`, at });
      }
      out.splice(idx, 1);
    }
  }

  // trim oldest NPC listings so the board stays fresh
  if (out.length > 30) {
    const i = out.findIndex((l) => !l.mine);
    if (i >= 0) out.splice(i, 1);
  }

  return { listings: out, earned, logs };
}

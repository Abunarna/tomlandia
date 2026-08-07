import { item } from "./data";
import type { ServerState } from "./engine";
import type { ItemId } from "./types";

/**
 * Phase 10 — the marketplace is a real shared order book.
 *
 * Listings and trades live in the database; every buy / sell / cancel goes
 * through a server routine that moves the items and the gold and takes the
 * 5% fee. This module only holds the shared types and the price helpers the
 * UI uses to suggest a asking price.
 */

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
  /** shopkeeper stock, kept around so a young market never looks empty */
  npc?: boolean;
}

export interface TradeLog {
  id: string;
  text: string;
  at: number;
}

/** Raw shapes returned by the `market_browse` routine. */
export interface BrowseRow {
  id: string;
  item: ItemId;
  qty: number;
  price: number;
  seller: string;
  mine: boolean;
  npc: boolean;
}

export interface TradeRow {
  id: string;
  item: ItemId;
  qty: number;
  price: number;
  seller: string;
  buyer: string;
  at: string;
}

export interface BrowseRes {
  ok: boolean;
  reason?: string;
  listings?: BrowseRow[];
  trades?: TradeRow[];
  /** The caller's authoritative gold / bag — sales credit the seller server-side. */
  state?: ServerState | null;
}

/** Reply shared by list / buy / cancel. */
export interface MarketRes {
  ok: boolean;
  reason?: string;
  spent?: number;
  item?: ItemId;
  qty?: number;
  state?: ServerState;
}

/** A fair asking price for one unit — a touch above the shop value. */
export function suggestedPrice(id: ItemId): number {
  return Math.max(1, Math.round(item(id).value * 1.15));
}

export function feeFor(total: number): number {
  return Math.ceil(total * MARKET_FEE);
}

export function tradeText(t: TradeRow): string {
  return `${t.buyer} bought ${t.qty}× ${item(t.item).name} from ${t.seller} (${t.price}g ea)`;
}

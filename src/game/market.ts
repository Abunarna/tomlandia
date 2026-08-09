import { item } from "./data";
import type { ServerState } from "./engine";
import type { ItemId } from "./types";

/**
 * The global player exchange.
 *
 * Every listing is created by a real player — there are no NPC sellers, no
 * simulated trades and no artificial market activity. Listings, sales and the
 * last-sold prices live in the database; this module only holds the shared
 * types and the cheap, deterministic price helpers the UI uses for guidance.
 */

export const MARKET_FEE = 0.05;
/** Listings expire after 14 days and the goods go back to the seller. */
export const LISTING_DAYS = 14;

export interface Listing {
  id: string;
  item: ItemId;
  qty: number;
  /** price per unit */
  price: number;
  /** upgrade level of the listed gear (0 for everything else) */
  plus: number;
  seller: string;
  /** true when the player listed it — no Buy button for your own goods */
  mine: boolean;
  createdAt: number;
  expiresAt: number;
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
  plus: number;
  seller: string;
  mine: boolean;
  created_at: string;
  expires_at: string;
}

export interface TradeRow {
  id: string;
  item: ItemId;
  qty: number;
  price: number;
  plus?: number;
  seller: string;
  buyer: string;
  at: string;
}

export interface PriceRow {
  item: ItemId;
  plus: number;
  price: number;
}

export interface BrowseRes {
  ok: boolean;
  reason?: string;
  listings?: BrowseRow[];
  trades?: TradeRow[];
  /** last completed sale price per item configuration */
  prices?: PriceRow[];
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

/* ---------- lightweight, deterministic price guidance ---------- */

const TIER_MULT: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 12, 5: 30 };

const RARITY_MULT: Record<string, number> = {
  common: 1,
  uncommon: 1.5,
  rare: 3,
  epic: 7,
  legendary: 15,
};

/** Key used for last-sold lookups — configuration matters, so +0 ≠ +50. */
export function priceKey(id: ItemId, plus = 0): string {
  return `${id}:${plus || 0}`;
}

/**
 * Suggested Price = Base Value × Tier × Rarity × Level × Upgrade.
 * Pure lookup-table maths, cheap enough to call on every render.
 */
export function suggestedPrice(id: ItemId, plus = 0): number {
  const def = item(id);
  const base = Math.max(1, def.value);
  const tier = TIER_MULT[def.tier ?? 1] ?? 1;
  const rarity = RARITY_MULT[def.rarity ?? "common"] ?? 1;
  const level = 1 + (def.level ?? 0) * 0.05;
  const upgrade = 1 + Math.max(0, plus) * 0.05;
  return Math.max(1, Math.round(base * 1.15 * tier * rarity * level * upgrade));
}

/**
 * Recommended Price = average of Suggested and Last Sold.
 * With no sales history, the suggested price stands on its own.
 */
export function recommendedPrice(id: ItemId, plus = 0, lastSold?: number | null): number {
  const suggested = suggestedPrice(id, plus);
  if (!lastSold || lastSold <= 0) return suggested;
  return Math.max(1, Math.round((suggested + lastSold) / 2));
}

export function feeFor(total: number): number {
  return Math.ceil(total * MARKET_FEE);
}

export function tradeText(t: TradeRow): string {
  const name = `${item(t.item).name}${t.plus ? ` +${t.plus}` : ""}`;
  return `${t.buyer} bought ${t.qty}× ${name} from ${t.seller} (${t.price}g ea)`;
}

/** "6d 4h" / "3h 12m" / "8m" — for listing expiry countdowns. */
export function timeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

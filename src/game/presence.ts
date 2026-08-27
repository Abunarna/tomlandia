import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { WORLD_H, WORLD_W } from "./data";

/**
 * Phase 7 — shared presence across the whole map.
 *
 * The world is sharded into a grid of cells. A player only ever subscribes to
 * their own cell plus the eight neighbours, so realtime traffic stays local
 * no matter how many people are online. There is never a global channel.
 */
export const CELL_W = 700;
export const CELL_H = 500;
export const COLS = Math.ceil(WORLD_W / CELL_W);
export const ROWS = Math.ceil(WORLD_H / CELL_H);

/** How often we broadcast our own position (seconds between sends). */
const SEND_HZ = 4;
/** Drop a remote player we have not heard from in this long. */
export const STALE_MS = 6000;
/** Send a heartbeat at least this often even when stationary, so we don't
 *  get dropped by STALE_MS on neighbouring clients. */
const HEARTBEAT_MS = 2000;
/** Movement below this many world units is treated as "no change". */
const POS_EPSILON = 2;
/** Persist authoritative combat coordinates at most once per second. */
const POSITION_SYNC_MS = 1000;
/** Keep a stationary player\'s authoritative row fresh without busy polling. */
const POSITION_HEARTBEAT_MS = 5000;

export interface PresencePacket {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
  f: number;
  act: string;
  /** emote glyph currently shown above this player's head (if any) */
  emo?: string;
  /** wall-clock ms the emote was triggered (used to de-dupe repeats) */
  eat?: number;
}


export function cellOf(x: number, y: number): [number, number] {
  return [
    Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL_W))),
    Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL_H))),
  ];
}

export function cellKey(cx: number, cy: number) {
  return `presence:cell:${cx}:${cy}`;
}

function neighbours(cx: number, cy: number): string[] {
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      keys.push(cellKey(nx, ny));
    }
  }
  return keys;
}

type Source = () => Omit<PresencePacket, "id">;

export class PresenceNet {
  private channels = new Map<string, RealtimeChannel>();
  /** The channel for our own cell — the only one we broadcast on. */
  private homeKey = "";
  private joined = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private lastSent: Omit<PresencePacket, "id"> | null = null;
  private lastSentAt = 0;
  private lastPositionAttemptAt = 0;
  private lastPersistedPosition: { x: number; y: number } | null = null;
  private positionSyncPending = false;

  constructor(
    private userId: string,
    private source: Source,
    private onPacket: (p: PresencePacket) => void,
    private onLeave: (id: string) => void,
  ) {}

  start() {
    this.stopped = false;
    this.tick();
    this.timer = setInterval(() => this.tick(), Math.round(1000 / SEND_HZ));
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const ch of this.channels.values()) void supabase.removeChannel(ch);
    this.channels.clear();
    this.joined.clear();
    this.homeKey = "";
  }

  /** Cell keys we are currently subscribed to (debug/verification aid). */
  get subscribed(): string[] {
    return [...this.channels.keys()];
  }

  private tick() {
    if (this.stopped) return;
    const me = this.source();
    const now = Date.now();
    this.persistPosition(me, now);
    const [cx, cy] = cellOf(me.x, me.y);
    this.resubscribe(cx, cy);

    const home = this.channels.get(this.homeKey);
    if (!home || !this.joined.has(this.homeKey)) return;

    const moved =
      !this.lastSent ||
      Math.hypot(me.x - this.lastSent.x, me.y - this.lastSent.y) > POS_EPSILON ||
      me.f !== this.lastSent.f ||
      me.act !== this.lastSent.act ||
      me.emo !== this.lastSent.emo;
    const heartbeatDue = now - this.lastSentAt >= HEARTBEAT_MS;

    if (!moved && !heartbeatDue) return;

    void home
      .send({
        type: "broadcast",
        event: "pos",
        payload: { id: this.userId, ...me } satisfies PresencePacket,
      })
      .catch(() => {});
    this.lastSent = me;
    this.lastSentAt = now;
  }

  private persistPosition(me: Omit<PresencePacket, "id">, now: number) {
    if (this.positionSyncPending || now - this.lastPositionAttemptAt < POSITION_SYNC_MS) return;
    const moved =
      !this.lastPersistedPosition ||
      Math.hypot(me.x - this.lastPersistedPosition.x, me.y - this.lastPersistedPosition.y) > POS_EPSILON;
    const heartbeatDue = now - this.lastPositionAttemptAt >= POSITION_HEARTBEAT_MS;
    if (!moved && !heartbeatDue) return;

    this.lastPositionAttemptAt = now;
    this.positionSyncPending = true;
    const sent = { x: me.x, y: me.y };
    void supabase
      .rpc("track_position", { _uid: this.userId, _x: sent.x, _y: sent.y })
      .then(({ data, error }) => {
        this.positionSyncPending = false;
        if (this.stopped) return;
        if (error) {
          console.warn("Authoritative position sync failed", error.message);
          return;
        }
        if (data === true) {
          this.lastPersistedPosition = sent;
          return;
        }
        console.warn("Authoritative position sync rejected");
      });
  }

  private resubscribe(cx: number, cy: number) {
    const wanted = new Set(neighbours(cx, cy));
    this.homeKey = cellKey(cx, cy);

    // Leave cells that are no longer adjacent.
    for (const [key, ch] of this.channels) {
      if (wanted.has(key)) continue;
      void supabase.removeChannel(ch);
      this.channels.delete(key);
      this.joined.delete(key);
    }

    // Join newly adjacent cells.
    for (const key of wanted) {
      if (this.channels.has(key)) continue;
      const ch = supabase.channel(key, { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "pos" }, ({ payload }) => {
        const p = payload as PresencePacket;
        if (!p || p.id === this.userId) return;
        this.onPacket(p);
      });
      ch.on("broadcast", { event: "bye" }, ({ payload }) => {
        const p = payload as { id?: string };
        if (p?.id && p.id !== this.userId) this.onLeave(p.id);
      });
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") this.joined.add(key);
        else this.joined.delete(key);
      });
      this.channels.set(key, ch);
    }
  }

  /** Politely tell neighbours we are gone (best effort). */
  farewell() {
    const home = this.channels.get(this.homeKey);
    if (home) void home.send({ type: "broadcast", event: "bye", payload: { id: this.userId } });
  }
}

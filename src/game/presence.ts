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

export interface PresencePacket {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
  f: number;
  act: string;
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
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

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
    this.homeKey = "";
  }

  /** Cell keys we are currently subscribed to (debug/verification aid). */
  get subscribed(): string[] {
    return [...this.channels.keys()];
  }

  private tick() {
    if (this.stopped) return;
    const me = this.source();
    const [cx, cy] = cellOf(me.x, me.y);
    this.resubscribe(cx, cy);

    const home = this.channels.get(this.homeKey);
    if (home) {
      void home.send({
        type: "broadcast",
        event: "pos",
        payload: { id: this.userId, ...me } satisfies PresencePacket,
      });
    }
  }

  private resubscribe(cx: number, cy: number) {
    const wanted = new Set(neighbours(cx, cy));
    this.homeKey = cellKey(cx, cy);

    // Leave cells that are no longer adjacent.
    for (const [key, ch] of this.channels) {
      if (wanted.has(key)) continue;
      void supabase.removeChannel(ch);
      this.channels.delete(key);
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
      ch.subscribe();
      this.channels.set(key, ch);
    }
  }

  /** Politely tell neighbours we are gone (best effort). */
  farewell() {
    const home = this.channels.get(this.homeKey);
    if (home) void home.send({ type: "broadcast", event: "bye", payload: { id: this.userId } });
  }
}

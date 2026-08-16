import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { CELL_H, CELL_W, COLS, ROWS } from "./presence";

/**
 * Phase 8 — shared world state (nodes & monsters).
 *
 * The authoritative state lives in the database. Clients read it and follow
 * realtime updates, sharded by the same grid cells the presence system uses:
 * a player only listens to their own cell plus the eight neighbours.
 */

export interface NodeRow {
  id: number;
  cell: string;
  kind?: string;
  x?: number;
  y?: number;
  charges: number;
  max_charges: number;
  respawn_at: string | null;
}

export interface MonsterRow {
  id: number;
  cell: string;
  kind?: string;
  x?: number;
  y?: number;
  hp: number;
  max_hp: number;
  tagged_by: string | null;
  respawn_at: string | null;
}

/** DESOLATUS — one global row. Only his HP is shared state; he roams by clock. */
export interface BossRow {
  hp: number;
  max_hp: number;
  respawn_at: string | null;
}

export function worldCellId(x: number, y: number) {
  const cx = Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL_W)));
  const cy = Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL_H)));
  return `${cx}:${cy}`;
}

function neighbourCells(x: number, y: number): string[] {
  const cx = Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL_W)));
  const cy = Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL_H)));
  const out: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) out.push(`${nx}:${ny}`);
    }
  }
  return out;
}

interface Sink {
  position: () => { x: number; y: number };
  onNodes: (rows: NodeRow[], full?: boolean) => void;
  onMonsters: (rows: MonsterRow[], full?: boolean) => void;
  onBoss?: (row: BossRow) => void;
}

export class WorldNet {
  private channels = new Map<string, RealtimeChannel>();
  private bossChannel: RealtimeChannel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private lastCells = "";

  constructor(private sink: Sink) {}

  async start() {
    this.stopped = false;
    // One cheap full snapshot on join, then per-cell realtime deltas.
    const [nodes, monsters] = await Promise.all([
      supabase.from("world_nodes").select("id,cell,kind,x,y,charges,max_charges,respawn_at"),
      supabase.from("world_monsters").select("id,cell,kind,x,y,hp,max_hp,tagged_by,respawn_at"),
    ]);
    if (this.stopped) return;
    if (nodes.data) this.sink.onNodes(nodes.data as NodeRow[], true);
    if (monsters.data) this.sink.onMonsters(monsters.data as MonsterRow[], true);

    // The boss is global, not sharded: he can be anywhere, so everyone follows
    // the single row wherever they stand.
    if (this.sink.onBoss) {
      const boss = await supabase.from("world_boss").select("hp,max_hp,respawn_at").eq("id", 1).maybeSingle();
      if (this.stopped) return;
      if (boss.data) this.sink.onBoss(boss.data as BossRow);
      this.bossChannel = supabase
        .channel("world:boss")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "world_boss" },
          ({ new: row }) => this.sink.onBoss?.(row as BossRow),
        );
      this.bossChannel.subscribe();
    }

    this.sync();
    this.timer = setInterval(() => this.sync(), 1000);
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const ch of this.channels.values()) void supabase.removeChannel(ch);
    this.channels.clear();
    if (this.bossChannel) void supabase.removeChannel(this.bossChannel);
    this.bossChannel = null;
    this.lastCells = "";
  }

  /** Re-point subscriptions at the player's current 3x3 cell window. */
  private sync() {
    if (this.stopped) return;
    const { x, y } = this.sink.position();
    const wanted = neighbourCells(x, y);
    const key = wanted.join(",");
    if (key === this.lastCells) return;
    this.lastCells = key;
    const set = new Set(wanted);

    for (const [cell, ch] of this.channels) {
      if (set.has(cell)) continue;
      void supabase.removeChannel(ch);
      this.channels.delete(cell);
    }

    for (const cell of wanted) {
      if (this.channels.has(cell)) continue;
      const ch = supabase
        .channel(`world:${cell}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "world_nodes", filter: `cell=eq.${cell}` },
          ({ new: row }) => this.sink.onNodes([row as NodeRow]),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "world_monsters", filter: `cell=eq.${cell}` },
          ({ new: row }) => this.sink.onMonsters([row as MonsterRow]),
        );
      ch.subscribe();
      this.channels.set(cell, ch);
    }

    // Entering a new area: pull fresh state for the cells we just joined.
    void this.refresh(wanted);
  }

  private async refresh(cells: string[]) {
    const [nodes, monsters] = await Promise.all([
      supabase.from("world_nodes").select("id,cell,kind,x,y,charges,max_charges,respawn_at").in("cell", cells),
      supabase
        .from("world_monsters")
        .select("id,cell,kind,x,y,hp,max_hp,tagged_by,respawn_at")
        .in("cell", cells),
    ]);
    if (this.stopped) return;
    if (nodes.data) this.sink.onNodes(nodes.data as NodeRow[], true);
    if (monsters.data) this.sink.onMonsters(monsters.data as MonsterRow[], true);
  }
}

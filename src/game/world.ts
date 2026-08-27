import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { parseRpcResponse, rpcContracts } from "@/contracts/rpc";
import { CELL_H, CELL_W, COLS, ROWS } from "./presence";
import { resolveWorldRuntime, type WorldRuntimeResolution } from "./world-runtime";

/**
 * Phase 8 — shared world state (nodes & monsters).
 *
 * The authoritative state lives in the database. Clients read it and follow
 * realtime updates, sharded by the same grid cells the presence system uses:
 * a player only listens to their own cell plus the eight neighbours.
 */

export type WorldEntityId = number | string;

export interface NodeRow {
  id: WorldEntityId;
  cell: string;
  kind?: string;
  x?: number;
  y?: number;
  charges: number;
  max_charges: number;
  respawn_at: string | null;
}

export interface MonsterRow {
  id: WorldEntityId;
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
  onRuntime?: (runtime: WorldRuntimeResolution) => void;
}

export class WorldNet {
  private channels = new Map<string, RealtimeChannel>();
  private bossChannel: RealtimeChannel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private lastCells = "";
  private uuidV2 = false;

  constructor(private sink: Sink) {}

  async start() {
    this.stopped = false;
    // Gate 8 reads the version control plane before subscribing. A missing
    // Gate 7 RPC remains a legacy-safe fallback, which preserves existing v1
    // deployments while the dual client is rolled out.
    rpcContracts.game_world_runtime_status.request.parse({});
    const { data: runtime, error: runtimeError } = await supabase.rpc("game_world_runtime_status");
    if (this.stopped) return;
    // A status-schema mismatch must not silently revive the disabled legacy
    // world. Preserve the parsed value where possible, but honour production's
    // explicit UUID/V2 control-plane signal for this V2-capable renderer.
    let parsedRuntime: unknown = null;
    if (!runtimeError) {
      try {
        parsedRuntime = parseRpcResponse("game_world_runtime_status", rpcContracts.game_world_runtime_status.response, runtime);
      } catch {
        // The raw V2 control-plane signal below is still sufficient to prevent
        // a disabled legacy-world fallback in this V2-capable client.
      }
    }
    const rawV2 = !runtimeError && runtime && typeof runtime === "object" &&
      (runtime as { state_contract?: unknown }).state_contract === "uuid_v2" &&
      (runtime as { active_content_version?: unknown }).active_content_version === "v2" &&
      (runtime as { active_spawn_set_version?: unknown }).active_spawn_set_version === "v2";
    // This Gate 8 client contains the UUID/V2 renderer and may activate it
    // once the server's manifest contract matches.
    const resolved = resolveWorldRuntime(parsedRuntime, true);
    const resolution = rawV2 && resolved.mode === "legacy_v1"
      ? { mode: "uuid_v2" as const, status: resolved.status, message: null }
      : resolved;
    this.uuidV2 = resolution.mode === "uuid_v2";
    this.sink.onRuntime?.(resolution);
    // The active control plane decides which immutable world contract we read.
    // UUID V2 rows deliberately never pass through the legacy integer tables.
    const snapshot = await this.readWorld();
    if (this.stopped) return;
    this.sink.onNodes(snapshot.nodes, true);
    this.sink.onMonsters(snapshot.monsters, true);

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
      const nodeTable = this.uuidV2 ? "game_world_nodes" : "world_nodes";
      const monsterTable = this.uuidV2 ? "game_world_monsters" : "world_monsters";
      const ch = supabase
        .channel(`world:${cell}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: nodeTable, filter: `cell=eq.${cell}` },
          ({ new: row }) => this.sink.onNodes([this.uuidV2 ? {
            id: String((row as { spawn_id: string }).spawn_id),
            cell: String((row as { cell: string }).cell),
            kind: String((row as { kind: string }).kind),
            x: Number((row as { x: number }).x),
            y: Number((row as { y: number }).y),
            charges: Number((row as { charges: number }).charges),
            max_charges: Number((row as { max_charges: number }).max_charges),
            respawn_at: (row as { respawn_at: string | null }).respawn_at,
          } : row as NodeRow]),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: monsterTable, filter: `cell=eq.${cell}` },
          ({ new: row }) => this.sink.onMonsters([this.uuidV2 ? {
            id: String((row as { spawn_id: string }).spawn_id),
            cell: String((row as { cell: string }).cell),
            kind: String((row as { kind: string }).kind),
            x: Number((row as { x: number }).x),
            y: Number((row as { y: number }).y),
            hp: Number((row as { hp: number }).hp),
            max_hp: Number((row as { max_hp: number }).max_hp),
            tagged_by: (row as { tagged_by: string | null }).tagged_by,
            respawn_at: (row as { respawn_at: string | null }).respawn_at,
          } : row as MonsterRow]),
        );
      ch.subscribe();
      this.channels.set(cell, ch);
    }

    // Entering a new area: pull fresh state for the cells we just joined.
    void this.refresh(wanted);
  }

  private async readWorld(cells?: string[]) {
    if (this.uuidV2) {
      let nodes = supabase
        .from("game_world_nodes")
        .select("spawn_id,cell,kind,x,y,charges,max_charges,respawn_at");
      let monsters = supabase
        .from("game_world_monsters")
        .select("spawn_id,cell,kind,x,y,hp,max_hp,tagged_by,respawn_at");
      if (cells) {
        nodes = nodes.in("cell", cells);
        monsters = monsters.in("cell", cells);
      }
      const [nodeRes, monsterRes] = await Promise.all([nodes, monsters]);
      return {
        nodes: (nodeRes.data ?? []).map((row) => ({
          id: row.spawn_id,
          cell: row.cell,
          kind: row.kind,
          x: Number(row.x),
          y: Number(row.y),
          charges: row.charges,
          max_charges: row.max_charges,
          respawn_at: row.respawn_at,
        })),
        monsters: (monsterRes.data ?? []).map((row) => ({
          id: row.spawn_id,
          cell: row.cell,
          kind: row.kind,
          x: Number(row.x),
          y: Number(row.y),
          hp: row.hp,
          max_hp: row.max_hp,
          tagged_by: row.tagged_by,
          respawn_at: row.respawn_at,
        })),
      };
    }

    let nodes = supabase.from("world_nodes").select("id,cell,kind,x,y,charges,max_charges,respawn_at");
    let monsters = supabase
      .from("world_monsters")
      .select("id,cell,kind,x,y,hp,max_hp,tagged_by,respawn_at");
    if (cells) {
      nodes = nodes.in("cell", cells);
      monsters = monsters.in("cell", cells);
    }
    const [nodeRes, monsterRes] = await Promise.all([nodes, monsters]);
    return {
      nodes: (nodeRes.data ?? []) as NodeRow[],
      monsters: (monsterRes.data ?? []) as MonsterRow[],
    };
  }

  private async refresh(cells: string[]) {
    const snapshot = await this.readWorld(cells);
    if (this.stopped) return;
    this.sink.onNodes(snapshot.nodes, true);
    this.sink.onMonsters(snapshot.monsters, true);
  }
}

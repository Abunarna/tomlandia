import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { parseRpcResponse, rpcContracts } from "@/contracts/rpc";
import { CELL_H, CELL_W, COLS, ROWS } from "./presence";
import { resolveWorldRuntime, type WorldRuntimeResolution } from "./world-runtime";
import { ensureV2RuntimeContent } from "./v2-runtime-content";

/**
 * Live UUID/V2 world transport.
 *
 * The authenticated game never renders local or legacy world rows. Startup
 * either installs a validated UUID snapshot or reports maintenance.
 */
export type WorldEntityId = string;

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
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
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

const nodeRow = (row: Record<string, unknown>): NodeRow => ({
  id: String(row["spawn_id"]),
  cell: String(row["cell"]),
  kind: String(row["kind"]),
  x: Number(row["x"]),
  y: Number(row["y"]),
  charges: Number(row["charges"]),
  max_charges: Number(row["max_charges"]),
  respawn_at: row["respawn_at"] == null ? null : String(row["respawn_at"]),
});

const monsterRow = (row: Record<string, unknown>): MonsterRow => ({
  id: String(row["spawn_id"]),
  cell: String(row["cell"]),
  kind: String(row["kind"]),
  x: Number(row["x"]),
  y: Number(row["y"]),
  hp: Number(row["hp"]),
  max_hp: Number(row["max_hp"]),
  tagged_by: row["tagged_by"] == null ? null : String(row["tagged_by"]),
  respawn_at: row["respawn_at"] == null ? null : String(row["respawn_at"]),
});

export class WorldNet {
  private channels = new Map<string, RealtimeChannel>();
  private bossChannel: RealtimeChannel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private lastCells = "";

  constructor(private sink: Sink) {}

  private maintenance(message: string, status: WorldRuntimeResolution["status"] = null) {
    this.sink.onRuntime?.({ mode: "maintenance", status, message });
  }

  async start() {
    this.stopped = false;
    ensureV2RuntimeContent();
    rpcContracts.game_world_runtime_status.request.parse({});
    const { data: runtime, error: runtimeError } = await supabase.rpc("game_world_runtime_status");
    if (this.stopped) return;
    if (runtimeError) {
      this.maintenance("Could not verify the active V2 world. Please retry.");
      return;
    }

    let resolution: WorldRuntimeResolution;
    try {
      const parsed = parseRpcResponse(
        "game_world_runtime_status",
        rpcContracts.game_world_runtime_status.response,
        runtime,
      );
      resolution = resolveWorldRuntime(parsed, true);
    } catch {
      this.maintenance("The server returned an invalid world contract. Please refresh.");
      return;
    }

    if (resolution.mode !== "uuid_v2") {
      this.maintenance(
        resolution.message ?? "This client requires the active UUID V2 world.",
        resolution.status,
      );
      return;
    }
    this.sink.onRuntime?.(resolution);

    let snapshot: { nodes: NodeRow[]; monsters: MonsterRow[] };
    try {
      snapshot = await this.readWorld();
    } catch (error) {
      console.error("V2 world snapshot failed", error);
      if (!this.stopped) this.maintenance("Could not load the UUID V2 world snapshot. Please retry.", resolution.status);
      return;
    }
    if (this.stopped) return;
    this.sink.onNodes(snapshot.nodes, true);
    this.sink.onMonsters(snapshot.monsters, true);

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

  private sync() {
    if (this.stopped) return;
    const { x, y } = this.sink.position();
    const wanted = neighbourCells(x, y);
    const key = wanted.join(",");
    if (key === this.lastCells) return;
    this.lastCells = key;
    const set = new Set(wanted);

    for (const [cell, channel] of this.channels) {
      if (set.has(cell)) continue;
      void supabase.removeChannel(channel);
      this.channels.delete(cell);
    }

    for (const cell of wanted) {
      if (this.channels.has(cell)) continue;
      const channel = supabase
        .channel(`world:v2:${cell}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "game_world_nodes", filter: `cell=eq.${cell}` },
          ({ new: row }) => this.sink.onNodes([nodeRow(row)]),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "game_world_monsters", filter: `cell=eq.${cell}` },
          ({ new: row }) => this.sink.onMonsters([monsterRow(row)]),
        );
      channel.subscribe();
      this.channels.set(cell, channel);
    }

    void this.refresh(wanted).catch((error) => {
      console.error("V2 world refresh failed", error);
      if (!this.stopped) this.maintenance("Lost the UUID V2 world connection. Please refresh.");
    });
  }

  private async readWorld(cells?: string[]) {
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
    const [nodeResult, monsterResult] = await Promise.all([nodes, monsters]);
    if (nodeResult.error) throw nodeResult.error;
    if (monsterResult.error) throw monsterResult.error;
    return {
      nodes: (nodeResult.data ?? []).map((row) => nodeRow(row as Record<string, unknown>)),
      monsters: (monsterResult.data ?? []).map((row) => monsterRow(row as Record<string, unknown>)),
    };
  }

  private async refresh(cells: string[]) {
    const snapshot = await this.readWorld(cells);
    if (this.stopped) return;
    this.sink.onNodes(snapshot.nodes, true);
    this.sink.onMonsters(snapshot.monsters, true);
  }
}

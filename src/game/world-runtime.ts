import { CONTENT_MANIFEST_HASH, CONTENT_VERSION } from "@/generated/content-manifest";

export type WorldRuntimeMode = "legacy_v1" | "uuid_v2" | "maintenance";

export interface WorldRuntimeStatus {
  contract_version: number;
  active_content_version: string;
  active_spawn_set_version: string;
  state_contract: "legacy_integer_v1" | "uuid_v2";
  spawn_hash: string;
  world_width: number | null;
  world_height: number | null;
  movement_speed: number | null;
  server_time: string | null;
}

export interface WorldRuntimeResolution {
  mode: WorldRuntimeMode;
  status: WorldRuntimeStatus | null;
  message: string | null;
}

const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const finiteNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Parse the SQL JSON contract defensively: an unavailable or future contract must not cut players over. */
export function parseWorldRuntimeStatus(value: unknown): WorldRuntimeStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.contract_version !== 1) return null;
  if (!nonEmptyString(input.active_content_version) || !nonEmptyString(input.active_spawn_set_version)) return null;
  if (input.state_contract !== "legacy_integer_v1" && input.state_contract !== "uuid_v2") return null;
  if (typeof input.spawn_hash !== "string") return null;
  return {
    contract_version: input.contract_version,
    active_content_version: input.active_content_version,
    active_spawn_set_version: input.active_spawn_set_version,
    state_contract: input.state_contract,
    spawn_hash: input.spawn_hash,
    world_width: finiteNumberOrNull(input.world_width),
    world_height: finiteNumberOrNull(input.world_height),
    movement_speed: finiteNumberOrNull(input.movement_speed),
    server_time: typeof input.server_time === "string" ? input.server_time : null,
  };
}

/**
 * Legacy is always the safe fallback. V2 becomes selectable only when both
 * server version and immutable manifest hash agree with this client build.
 */
export function resolveWorldRuntime(value: unknown, supportsUuidV2 = false): WorldRuntimeResolution {
  const status = parseWorldRuntimeStatus(value);
  if (!status || status.state_contract === "legacy_integer_v1") {
    return { mode: "legacy_v1", status, message: null };
  }
  if (
    !supportsUuidV2 ||
    status.active_content_version !== CONTENT_VERSION ||
    status.spawn_hash !== CONTENT_MANIFEST_HASH
  ) {
    return {
      mode: "maintenance",
      status,
      message: supportsUuidV2
        ? "The world has updated. Please refresh to load the matching game content."
        : "The world is updating. This client is waiting for its compatible world renderer.",
    };
  }
  return { mode: "uuid_v2", status, message: null };
}

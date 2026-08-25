import { z, type ZodTypeAny } from "zod";
import {
  itemIdSchema,
  jsonValueSchema,
  potionBuffSchema,
  serverStateSchema,
  skillIdSchema,
  storedSaveSchema,
} from "./save";

const finite = z.number().finite();
const nonNegativeInt = z.number().int().nonnegative();
const positiveInt = z.number().int().positive();
const dbTimestamp = z.string().min(1);
const uuid = z.string().uuid();
const worldPoint = { _x: finite, _y: finite };

export const harvestResponseSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().optional(),
    depleted: z.boolean().optional(),
    low_level: z.boolean().optional(),
    too_fast: z.boolean().optional(),
    charges: nonNegativeInt.optional(),
    respawn_at: dbTimestamp.nullable().optional(),
    item: itemIdSchema.optional(),
    qty: positiveInt.optional(),
    skill: skillIdSchema.optional(),
    xp: z.number().finite().nonnegative().optional(),
    leveled: z.boolean().optional(),
    level: positiveInt.optional(),
    req: positiveInt.optional(),
    state: serverStateSchema.optional(),
  })
  .strict();

const lootSchema = z
  .object({
    item: itemIdSchema.optional(),
    id: itemIdSchema.optional(),
    qty: positiveInt,
  })
  .strict()
  .refine((loot) => Boolean(loot.item || loot.id), "loot requires item or id");

export const damageResponseSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().optional(),
    dmg: nonNegativeInt.optional(),
    taken: nonNegativeInt.optional(),
    hp: nonNegativeInt.optional(),
    max_hp: positiveInt.optional(),
    killed: z.boolean().optional(),
    credited: z.boolean().optional(),
    kind: itemIdSchema.optional(),
    gold: nonNegativeInt.optional(),
    loot: z.array(lootSchema).optional(),
    xp: z.number().finite().nonnegative().optional(),
    leveled: z.boolean().optional(),
    level: positiveInt.optional(),
    tagged_by: uuid.nullable().optional(),
    respawn_at: dbTimestamp.nullable().optional(),
    buff: potionBuffSchema.nullable().optional(),
    state: serverStateSchema.optional(),
  })
  .strict();

export const attackMonsterResponseSchema = damageResponseSchema.superRefine((value, context) => {
  if (!value.ok) return;
  for (const key of ["leveled", "state", "buff"] as const) {
    if (value[key] !== undefined) continue;
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [key],
      message: `${key} is required when attack_monster succeeds`,
    });
  }
});

export const fishResponseSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().optional(),
    item: itemIdSchema.optional(),
    qty: positiveInt.optional(),
    skill: skillIdSchema.optional(),
    xp: z.number().finite().nonnegative().optional(),
    leveled: z.boolean().optional(),
    level: positiveInt.optional(),
    state: serverStateSchema.optional(),
  })
  .strict();

export const potionResponseSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().optional(),
    buff: potionBuffSchema.optional(),
    state: serverStateSchema.optional(),
  })
  .strict();

export const craftResponseSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().optional(),
    low_level: z.boolean().optional(),
    missing_materials: z.boolean().optional(),
    out: itemIdSchema.optional(),
    out_qty: positiveInt.optional(),
    skill: skillIdSchema.optional(),
    xp: z.number().finite().nonnegative().optional(),
    leveled: z.boolean().optional(),
    level: positiveInt.optional(),
    req: positiveInt.optional(),
    item: itemIdSchema.optional(),
    state: serverStateSchema.optional(),
  })
  .strict();

export const gearResponseSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().optional(),
    poor: z.boolean().optional(),
    cost: nonNegativeInt.optional(),
    plus: nonNegativeInt.max(100).optional(),
    item: itemIdSchema.optional(),
    gold: nonNegativeInt.optional(),
    state: serverStateSchema.optional(),
  })
  .strict();

const browseRowSchema = z
  .object({
    id: uuid,
    item: itemIdSchema,
    qty: positiveInt,
    price: positiveInt,
    plus: nonNegativeInt.max(100),
    seller: z.string().min(1),
    mine: z.boolean(),
    created_at: dbTimestamp,
    expires_at: dbTimestamp,
  })
  .strict();

const tradeRowSchema = z
  .object({
    id: uuid,
    item: itemIdSchema,
    qty: positiveInt,
    price: positiveInt,
    plus: nonNegativeInt.max(100).optional(),
    seller: z.string().min(1),
    buyer: z.string().min(1),
    at: dbTimestamp,
  })
  .strict();

const priceRowSchema = z
  .object({
    item: itemIdSchema,
    plus: nonNegativeInt.max(100),
    price: positiveInt,
  })
  .strict();

export const browseResponseSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().optional(),
    listings: z.array(browseRowSchema).optional(),
    trades: z.array(tradeRowSchema).optional(),
    prices: z.array(priceRowSchema).optional(),
    state: serverStateSchema.nullable().optional(),
  })
  .strict();

export const marketResponseSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().optional(),
    poor: z.boolean().optional(),
    need: positiveInt.optional(),
    spent: nonNegativeInt.optional(),
    item: itemIdSchema.optional(),
    qty: positiveInt.optional(),
    state: serverStateSchema.optional(),
  })
  .strict();

export const leaderRowSchema = z
  .object({
    rank: positiveInt,
    name: z.string().min(1),
    score: positiveInt,
    me: z.boolean(),
  })
  .strict();

export const leaderboardResponseSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().optional(),
    skill: z.union([skillIdSchema, z.literal("total")]).optional(),
    top: z.array(leaderRowSchema).optional(),
    me: leaderRowSchema.nullable().optional(),
  })
  .strict();

export const syncResponseSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().min(1).optional(),
    rev: nonNegativeInt.optional(),
    conflict: z.boolean().optional(),
    data: storedSaveSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.ok) return;
    for (const key of ["rev", "conflict", "data"] as const) {
      if (value[key] !== undefined) continue;
      context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required when ok=true` });
    }
  });

export const rpcContracts = {
  harvest_node: {
    request: z.object({ _id: nonNegativeInt, ...worldPoint }).strict(),
    response: harvestResponseSchema,
  },
  attack_monster: {
    request: z.object({ _id: nonNegativeInt, ...worldPoint }).strict(),
    response: attackMonsterResponseSchema,
  },
  attack_boss: {
    request: z
      .object({ ...worldPoint, _bx: finite, _by: finite, _passive: z.boolean().default(false) })
      .strict(),
    response: damageResponseSchema,
  },
  craft_item: {
    request: z.object({ _recipe: itemIdSchema }).strict(),
    response: craftResponseSchema,
  },
  fish_cast: {
    request: z.object({ _spot: nonNegativeInt, ...worldPoint }).strict(),
    response: fishResponseSchema,
  },
  use_potion: {
    request: z.object({ _item: itemIdSchema }).strict(),
    response: potionResponseSchema,
  },
  gear_equip: {
    request: z.object({ _index: z.number().int().min(0).max(19) }).strict(),
    response: gearResponseSchema,
  },
  gear_upgrade: {
    request: z.object({ _which: z.enum(["weapon", "armor"]) }).strict(),
    response: gearResponseSchema,
  },
  inv_drop: {
    request: z.object({ _index: z.number().int().min(0).max(19) }).strict(),
    response: gearResponseSchema,
  },
  inv_sell: {
    request: z.object({ _index: z.number().int().min(0).max(19) }).strict(),
    response: gearResponseSchema,
  },
  bank_gold: {
    request: z.object({ _dir: z.enum(["in", "out"]), _amount: positiveInt }).strict(),
    response: gearResponseSchema,
  },
  bank_item: {
    request: z.discriminatedUnion("_dir", [
      z.object({ _dir: z.literal("in"), _index: z.number().int().min(0).max(19), _qty: positiveInt }).strict(),
      z.object({ _dir: z.literal("out"), _index: z.number().int().min(0).max(59), _qty: positiveInt }).strict(),
    ]),
    response: gearResponseSchema,
  },
  market_browse: {
    request: z.object({}).strict(),
    response: browseResponseSchema,
  },
  market_list: {
    request: z
      .object({
        _item: itemIdSchema,
        _qty: positiveInt.max(100_000),
        _price: positiveInt.max(10_000_000),
        _plus: nonNegativeInt.max(100).default(0),
      })
      .strict(),
    response: marketResponseSchema,
  },
  market_buy: {
    request: z.object({ _id: uuid, _qty: positiveInt.max(100_000).default(1) }).strict(),
    response: marketResponseSchema,
  },
  market_cancel: {
    request: z.object({ _id: uuid }).strict(),
    response: marketResponseSchema,
  },
  leaderboard: {
    request: z.object({ _skill: z.union([skillIdSchema, z.literal("total")]) }).strict(),
    response: leaderboardResponseSchema,
  },
  player_sync: {
    request: z.union([
      z.object({ _data: storedSaveSchema }).strict(),
      z.object({ _data: storedSaveSchema, _rev: nonNegativeInt }).strict(),
    ]),
    response: syncResponseSchema,
  },
} as const;

export type RpcName = keyof typeof rpcContracts;

/**
 * A failed parse is a protocol error, not a value to cast through. Raw payloads
 * are deliberately omitted from the error so character data cannot leak into logs.
 */
export class RpcContractError extends Error {
  constructor(
    readonly rpc: RpcName,
    readonly issues: readonly string[],
  ) {
    super(`RPC ${rpc} violated its response contract: ${issues.join("; ")}`);
    this.name = "RpcContractError";
  }
}

export function parseRpcResponse<T>(rpc: RpcName, schema: ZodTypeAny, value: unknown): T {
  const parsed = schema.safeParse(value);
  // The value has been parsed before this type bridge. This assertion is not
  // validation; it adapts Zod's `optional | undefined` output to the project's
  // exact-optional legacy interfaces until those interfaces are generated.
  if (parsed.success) return parsed.data as T;
  throw new RpcContractError(
    rpc,
    parsed.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`),
  );
}

/** Reviewed, serialisable contract index. Its checked-in JSON twin is the Gate 1 snapshot. */
export const rpcContractManifest = {
  version: "tomlandia-gate1-rpc-v1",
  upgrade_max: 100,
  access: "authenticated",
  rpcs: {
    harvest_node: { request: ["_id", "_x", "_y"], response: "harvest" },
    attack_monster: {
      request: ["_id", "_x", "_y"],
      response: "damage",
      canonical_success_keys: ["leveled", "state", "buff"],
    },
    attack_boss: { request: ["_x", "_y", "_bx", "_by", "_passive"], response: "damage" },
    craft_item: { request: ["_recipe"], response: "craft" },
    fish_cast: { request: ["_spot", "_x", "_y"], response: "fish" },
    use_potion: { request: ["_item"], response: "potion" },
    gear_equip: { request: ["_index"], response: "gear" },
    gear_upgrade: { request: ["_which"], response: "gear" },
    inv_drop: { request: ["_index"], response: "gear" },
    inv_sell: { request: ["_index"], response: "gear" },
    bank_gold: { request: ["_dir", "_amount"], response: "gear" },
    bank_item: { request: ["_dir", "_index", "_qty"], response: "gear" },
    market_browse: { request: [], response: "market_browse" },
    market_list: { request: ["_item", "_qty", "_price", "_plus"], response: "market" },
    market_buy: { request: ["_id", "_qty"], response: "market" },
    market_cancel: { request: ["_id"], response: "market" },
    leaderboard: { request: ["_skill"], response: "leaderboard" },
    player_sync: { request: ["_data", "_rev?"], response: "sync" },
  },
} as const;

export type HarvestResponse = z.infer<typeof harvestResponseSchema>;
export type DamageResponse = z.infer<typeof damageResponseSchema>;
export type AttackMonsterResponse = z.infer<typeof attackMonsterResponseSchema>;
export type FishResponse = z.infer<typeof fishResponseSchema>;
export type PotionResponse = z.infer<typeof potionResponseSchema>;
export type CraftResponse = z.infer<typeof craftResponseSchema>;
export type GearResponse = z.infer<typeof gearResponseSchema>;
export type BrowseResponse = z.infer<typeof browseResponseSchema>;
export type MarketResponse = z.infer<typeof marketResponseSchema>;
export type LeaderRowContract = z.infer<typeof leaderRowSchema>;
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;
export type SyncResponse = z.infer<typeof syncResponseSchema>;
export type RpcJsonValue = z.infer<typeof jsonValueSchema>;

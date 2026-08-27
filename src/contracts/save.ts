import { z } from "zod";

/** Gate 0 locks the hard upgrade ceiling at +100. */
export const MAX_UPGRADE = 100;
export const INVENTORY_SIZE = 20;
export const BANK_SIZE = 60;

export const skillIds = [
  "combat",
  "mining",
  "woodcutting",
  "gathering",
  "fishing",
  "cooking",
  "alchemy",
  "smithing",
  "skinning",
  "tailoring",
] as const;

export const skillIdSchema = z.enum(skillIds);
export const itemIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "item IDs must be lowercase snake_case");

export const inventorySlotSchema = z
  .object({
    id: itemIdSchema,
    qty: z.number().int().positive(),
    plus: z.number().int().min(0).max(MAX_UPGRADE).optional(),
  })
  .strict();

export const equipmentSchema = z
  .object({
    id: itemIdSchema,
    plus: z.number().int().min(0).max(MAX_UPGRADE),
  })
  .strict();

export const skillSchema = z.object({ xp: z.number().finite().nonnegative() }).strict();

export const potionBuffSchema = z
  .object({
    dmg: z.number().finite().nonnegative(),
    hits: z.number().int().nonnegative(),
    item: itemIdSchema.optional(),
  })
  .strict();

export const questStateSchema = z
  .object({
    id: itemIdSchema,
    progress: z.number().int().nonnegative(),
  })
  .strict();

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const inventorySchema = z.array(inventorySlotSchema.nullable()).max(INVENTORY_SIZE);
const bankItemsSchema = z.array(inventorySlotSchema.nullable()).max(BANK_SIZE);

/**
 * The durable database save shape. Arrays may be short because the engine pads
 * legacy saves on load; schemas must not mistake old-but-valid saves for loss.
 * `buff` is server-owned and may be present in rows returned by player_sync.
 */
export const storedSaveSchema = z
  .object({
    v: z.number().int().nonnegative(),
    px: z.number().finite(),
    py: z.number().finite(),
    hp: z.number().finite().nonnegative(),
    gold: z.number().int().nonnegative(),
    inv: inventorySchema,
    bank: z
      .object({
        gold: z.number().int().nonnegative(),
        items: bankItemsSchema,
      })
      .strict()
      .optional(),
    skills: z.record(skillSchema),
    weapon: z.union([equipmentSchema, itemIdSchema, z.null()]),
    armor: z.union([equipmentSchema, itemIdSchema, z.null()]),
    food: itemIdSchema.nullable().optional(),
    autoEatAt: z.number().finite().min(0).max(1).optional(),
    quest: questStateSchema.nullable().optional(),
    completed: z.array(itemIdSchema).optional(),
    discovered: z.array(itemIdSchema).optional(),
    listings: z.array(jsonValueSchema).optional(),
    clock: z.number().finite().optional(),
    buff: potionBuffSchema.nullable().optional(),
  })
  .strict();

/** Authoritative economy slice returned by action RPCs. */
export const serverStateSchema = z
  .object({
    inv: inventorySchema.nullable().optional(),
    gold: z.number().int().nonnegative().nullable().optional(),
    skills: z.record(skillSchema).nullable().optional(),
    weapon: z.union([equipmentSchema, itemIdSchema, z.null()]).optional(),
    armor: z.union([equipmentSchema, itemIdSchema, z.null()]).optional(),
    food: itemIdSchema.nullable().optional(),
    bank: z
      .object({
        gold: z.number().int().nonnegative().optional(),
        items: bankItemsSchema.optional(),
      })
      .strict()
      .nullable()
      .optional(),
    hp: z.number().finite().nonnegative().optional(),
    px: z.number().finite().optional(),
    py: z.number().finite().optional(),
    quest: questStateSchema.nullable().optional(),
    completed: z.array(itemIdSchema).optional(),
    autoEatAt: z.number().finite().min(0).max(1).optional(),
    // Combat RPCs return the server-owned potion state inside `state`.
    buff: potionBuffSchema.nullable().optional(),
  })
  .strict();

export type InventorySlotContract = z.infer<typeof inventorySlotSchema>;
export type StoredSaveContract = z.infer<typeof storedSaveSchema>;
export type ServerStateContract = z.infer<typeof serverStateSchema>;

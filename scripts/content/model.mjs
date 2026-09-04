import { createHash } from "node:crypto";

export const MANIFEST_SCHEMA_VERSION = "tomlandia-content-manifest/v1";
export const OUTPUT_PATHS = Object.freeze({
  client: "src/generated/content-manifest.ts",
  sql: "supabase/generated/content-manifest.sql",
  graph: "content/generated/dependency-graph.json",
  spawns: "content/generated/spawn-manifest.json",
});

const CONTENT_ID = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const VERSION_ID = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const FORBIDDEN_RUNTIME_TEXT = /\b(?:TBD|TODO|FIXME|PLACEHOLDER|UNKNOWN_VALUE)\b/i;

const ITEM_KINDS = new Set(["resource", "material", "weapon", "armor", "food", "potion", "trophy"]);
const RARITIES = new Set(["common", "uncommon", "rare", "epic", "legendary"]);
const SKILLS = new Set([
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
]);
const CRAFTING_SKILLS = new Set(["smithing", "tailoring", "skinning", "cooking", "alchemy"]);
const NODE_SKILLS = new Set(["mining", "woodcutting", "gathering"]);
const STATIONS = new Set(["smelt", "forge", "weave", "armor", "skin", "cook", "alchemy"]);
const STATION_SKILLS = Object.freeze({
  smelt: new Set(["smithing"]),
  forge: new Set(["smithing"]),
  armor: new Set(["smithing", "tailoring"]),
  weave: new Set(["tailoring"]),
  skin: new Set(["skinning"]),
  cook: new Set(["cooking"]),
  alchemy: new Set(["alchemy"]),
});
const QUEST_KINDS = new Set(["kill", "gather"]);
const LOOT_CHANNELS = new Set(["drop", "hide"]);
const MIGRATION_ACTIONS = new Set(["retain", "replace", "replace_or_compensate", "compensate", "stop"]);
const FALLBACK_EARS = new Set(["none", "beak", "horns", "spikes"]);

export class ManifestValidationError extends Error {
  constructor(issues) {
    super(`Content manifest validation failed with ${issues.length} issue(s):\n- ${issues.join("\n- ")}`);
    this.name = "ManifestValidationError";
    this.issues = issues;
  }
}

export class UnknownContentIdError extends Error {
  constructor(kind, value) {
    super(`Unknown ${kind} ID: ${String(value)}`);
    this.name = "UnknownContentIdError";
    this.kind = kind;
    this.value = value;
  }
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

export function prettyCanonicalJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function manifestHash(manifest) {
  return createHash("sha256").update(canonicalJson(manifest)).digest("hex");
}

function namespaceBytes(uuid) {
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

export function uuidV5(namespace, name) {
  if (!UUID.test(namespace)) throw new Error(`Invalid UUID namespace: ${namespace}`);
  const digest = createHash("sha1")
    .update(Buffer.concat([namespaceBytes(namespace), Buffer.from(name, "utf8")]))
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function compareCanonical(a, b) {
  return canonicalJson(a) === canonicalJson(b);
}

export function assertKnownId(kind, knownIds, value) {
  if (!knownIds.includes(value)) throw new UnknownContentIdError(kind, value);
  return value;
}

export function validateManifest(manifest, lockedRegistry) {
  const issues = [];
  const issue = (path, message) => issues.push(`${path}: ${message}`);

  const objectAt = (value, path) => {
    if (!isRecord(value)) {
      issue(path, "must be an object");
      return {};
    }
    return value;
  };
  const arrayAt = (value, path) => {
    if (!Array.isArray(value)) {
      issue(path, "must be an array");
      return [];
    }
    return value;
  };
  const stringAt = (value, path, pattern = null) => {
    if (typeof value !== "string" || value.length === 0) {
      issue(path, "must be a non-empty string");
      return "";
    }
    if (pattern && !pattern.test(value)) issue(path, `has invalid format: ${value}`);
    return value;
  };
  const booleanAt = (value, path) => {
    if (typeof value !== "boolean") issue(path, "must be a boolean");
    return value === true;
  };
  const numberAt = (value, path, { integer = false, min = -Infinity, max = Infinity } = {}) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issue(path, "must be a finite number");
      return 0;
    }
    if (integer && !Number.isInteger(value)) issue(path, "must be an integer");
    if (value < min || value > max) issue(path, `must be between ${min} and ${max}`);
    return value;
  };
  const onlyKeys = (value, path, allowed) => {
    if (!isRecord(value)) return;
    for (const key of Object.keys(value)) if (!allowed.has(key)) issue(`${path}.${key}`, "is not allowed");
  };
  const requireKeys = (value, path, required) => {
    if (!isRecord(value)) return;
    for (const key of required) if (!(key in value)) issue(`${path}.${key}`, "is required");
  };
  const enumAt = (value, path, allowed) => {
    const text = stringAt(value, path);
    if (text && !allowed.has(text)) issue(path, `must be one of: ${[...allowed].join(", ")}`);
    return text;
  };
  const idAt = (value, path) => stringAt(value, path, CONTENT_ID);
  const versionAt = (value, path) => stringAt(value, path, VERSION_ID);
  const assertUnique = (rows, key, path) => {
    const seen = new Map();
    rows.forEach((row, index) => {
      if (!isRecord(row)) return;
      const value = row[key];
      if (typeof value !== "string" && typeof value !== "number") return;
      if (seen.has(value)) issue(`${path}[${index}].${key}`, `duplicates ${path}[${seen.get(value)}].${key}: ${value}`);
      else seen.set(value, index);
    });
  };

  const root = objectAt(manifest, "$manifest");
  requireKeys(root, "$manifest", ["schema_version", "content_version", "lifecycle", "spawn_set_version", "uuid_namespace", "tiers"]);
  stringAt(root.schema_version, "$manifest.schema_version");
  if (root.schema_version !== MANIFEST_SCHEMA_VERSION) {
    issue("$manifest.schema_version", `must equal ${MANIFEST_SCHEMA_VERSION}`);
  }
  versionAt(root.content_version, "$manifest.content_version");
  versionAt(root.spawn_set_version, "$manifest.spawn_set_version");
  stringAt(root.uuid_namespace, "$manifest.uuid_namespace", UUID);
  if (root.lifecycle !== "draft" && root.lifecycle !== "runtime") {
    issue("$manifest.lifecycle", "must be draft or runtime");
  }

  const registry = objectAt(lockedRegistry, "$registry");
  const lockedTiers = arrayAt(registry.tiers, "$registry.tiers");
  const lockedPair = new Map(lockedTiers.map((tier) => [tier.tier_index, tier.level_requirement]));
  const lockedTheme = new Map(lockedTiers.map((tier) => [tier.tier_index, tier.theme]));
  const tiers = arrayAt(root.tiers, "$manifest.tiers");
  if (tiers.length !== 16) issue("$manifest.tiers", "must contain exactly 16 locked tiers");
  assertUnique(tiers, "tier_index", "$manifest.tiers");
  assertUnique(tiers, "level_requirement", "$manifest.tiers");
  tiers.forEach((rawTier, index) => {
    const path = `$manifest.tiers[${index}]`;
    const tier = objectAt(rawTier, path);
    const allowed = root.lifecycle === "runtime"
      ? new Set(["tier_index", "level_requirement", "theme", "palette"])
      : new Set(["tier_index", "level_requirement", "theme"]);
    onlyKeys(tier, path, allowed);
    requireKeys(tier, path, root.lifecycle === "runtime"
      ? ["tier_index", "level_requirement", "theme", "palette"]
      : ["tier_index", "level_requirement", "theme"]);
    const tierIndex = numberAt(tier.tier_index, `${path}.tier_index`, { integer: true, min: 1, max: 16 });
    const level = numberAt(tier.level_requirement, `${path}.level_requirement`, { integer: true, min: 1, max: 150 });
    stringAt(tier.theme, `${path}.theme`);
    if (lockedPair.get(tierIndex) !== level) {
      issue(`${path}.level_requirement`, `does not match locked tier_index ${tierIndex}`);
    }
    if (lockedTheme.get(tierIndex) !== tier.theme) {
      issue(`${path}.theme`, `does not match locked tier_index ${tierIndex}`);
    }
    if (root.lifecycle === "runtime") {
      const palette = objectAt(tier.palette, `${path}.palette`);
      onlyKeys(palette, `${path}.palette`, new Set(["primary", "secondary", "accent"]));
      requireKeys(palette, `${path}.palette`, ["primary", "secondary", "accent"]);
      stringAt(palette.primary, `${path}.palette.primary`, HEX_COLOUR);
      stringAt(palette.secondary, `${path}.palette.secondary`, HEX_COLOUR);
      stringAt(palette.accent, `${path}.palette.accent`, HEX_COLOUR);
    }
  });

  const validateTierPair = (entity, path) => {
    const tierIndex = numberAt(entity.tier_index, `${path}.tier_index`, { integer: true, min: 1, max: 16 });
    const level = numberAt(entity.level_requirement, `${path}.level_requirement`, { integer: true, min: 1, max: 150 });
    const expectedTier = [...lockedTiers]
      .filter((tier) => tier.level_requirement <= level)
      .sort((a, b) => b.level_requirement - a.level_requirement)[0]?.tier_index;
    if (expectedTier !== tierIndex) {
      issue(`${path}.tier_index`, `must be tier ${expectedTier} for level_requirement ${level}`);
    }
  };

  if (root.lifecycle === "draft") {
    onlyKeys(root, "$manifest", new Set([
      "schema_version", "content_version", "lifecycle", "spawn_set_version", "uuid_namespace",
      "tier_registry_version", "tiers", "id_inventory",
    ]));
    requireKeys(root, "$manifest", ["tier_registry_version", "id_inventory"]);
    if (root.tier_registry_version !== registry.registry_version) {
      issue("$manifest.tier_registry_version", `must equal locked registry ${registry.registry_version}`);
    }
    const inventory = objectAt(root.id_inventory, "$manifest.id_inventory");
    onlyKeys(inventory, "$manifest.id_inventory", new Set(["in_place_ids", "retired_ids", "new_ids", "sprite_kinds"]));
    requireKeys(inventory, "$manifest.id_inventory", ["in_place_ids", "retired_ids", "new_ids", "sprite_kinds"]);
    const expected = {
      in_place_ids: registry.in_place_ids,
      retired_ids: registry.retired_ids,
      new_ids: registry.new_ids,
      sprite_kinds: registry.sprite_kinds,
    };
    if (!compareCanonical(inventory, expected)) {
      issue("$manifest.id_inventory", "must exactly match the locked Gate 0 ID registry");
    }
    if (issues.length) throw new ManifestValidationError(issues);
    return { lifecycle: "draft", hash: manifestHash(root) };
  }

  onlyKeys(root, "$manifest", new Set([
    "schema_version", "content_version", "lifecycle", "spawn_set_version", "uuid_namespace",
    "tiers", "runtime", "test_fixture",
  ]));
  requireKeys(root, "$manifest", ["runtime"]);
  if ("test_fixture" in root) {
    booleanAt(root.test_fixture, "$manifest.test_fixture");
    if (root.test_fixture === true && !String(root.content_version).startsWith("gate4_test_")) {
      issue("$manifest.content_version", "test fixtures must use a gate4_test_ content version");
    }
  }

  const walkRuntime = (value, path) => {
    if (value === null) {
      issue(path, "runtime manifests may not contain null");
      return;
    }
    if (typeof value === "string" && FORBIDDEN_RUNTIME_TEXT.test(value)) {
      issue(path, `runtime placeholder text is forbidden: ${value}`);
    }
    if (typeof value === "number" && !Number.isFinite(value)) issue(path, "must be finite");
    if (Array.isArray(value)) value.forEach((entry, index) => walkRuntime(entry, `${path}[${index}]`));
    else if (isRecord(value)) Object.entries(value).forEach(([key, entry]) => walkRuntime(entry, `${path}.${key}`));
  };
  walkRuntime(root.runtime, "$manifest.runtime");

  const runtime = objectAt(root.runtime, "$manifest.runtime");
  const runtimeKeys = [
    "items", "recipes", "nodes", "monsters", "fish", "fishing_spots", "quests", "bosses",
    "node_spawns", "monster_spawns", "migration_rules", "starter_loadout", "mechanics", "player_notice",
  ];
  onlyKeys(runtime, "$manifest.runtime", new Set(runtimeKeys));
  requireKeys(runtime, "$manifest.runtime", runtimeKeys);

  const items = arrayAt(runtime.items, "$manifest.runtime.items");
  const recipes = arrayAt(runtime.recipes, "$manifest.runtime.recipes");
  const nodes = arrayAt(runtime.nodes, "$manifest.runtime.nodes");
  const monsters = arrayAt(runtime.monsters, "$manifest.runtime.monsters");
  const fish = arrayAt(runtime.fish, "$manifest.runtime.fish");
  const fishingSpots = arrayAt(runtime.fishing_spots, "$manifest.runtime.fishing_spots");
  const quests = arrayAt(runtime.quests, "$manifest.runtime.quests");
  const bosses = arrayAt(runtime.bosses, "$manifest.runtime.bosses");
  const nodeSpawns = arrayAt(runtime.node_spawns, "$manifest.runtime.node_spawns");
  const monsterSpawns = arrayAt(runtime.monster_spawns, "$manifest.runtime.monster_spawns");
  const migrationRules = arrayAt(runtime.migration_rules, "$manifest.runtime.migration_rules");
  const starterLoadout = objectAt(runtime.starter_loadout, "$manifest.runtime.starter_loadout");
  const mechanics = objectAt(runtime.mechanics, "$manifest.runtime.mechanics");
  objectAt(runtime.player_notice, "$manifest.runtime.player_notice");

  for (const [name, rows] of Object.entries({
    items,
    recipes,
    nodes,
    monsters,
    fish,
    fishing_spots: fishingSpots,
    quests,
    bosses,
    node_spawns: nodeSpawns,
    monster_spawns: monsterSpawns,
    migration_rules: migrationRules,
  })) {
    if (rows.length === 0) issue(`$manifest.runtime.${name}`, "must contain at least one complete record");
  }

  assertUnique(items, "id", "$manifest.runtime.items");
  assertUnique(recipes, "id", "$manifest.runtime.recipes");
  assertUnique(nodes, "kind", "$manifest.runtime.nodes");
  assertUnique(monsters, "kind", "$manifest.runtime.monsters");
  assertUnique(fish, "item_id", "$manifest.runtime.fish");
  assertUnique(fishingSpots, "id", "$manifest.runtime.fishing_spots");
  assertUnique(quests, "id", "$manifest.runtime.quests");
  assertUnique(bosses, "id", "$manifest.runtime.bosses");
  assertUnique(migrationRules, "from_id", "$manifest.runtime.migration_rules");

  const itemById = new Map();
  items.forEach((rawItem, index) => {
    const path = `$manifest.runtime.items[${index}]`;
    const item = objectAt(rawItem, path);
    const required = [
      "id", "name", "active", "tier_index", "level_requirement", "kind", "family", "colour",
      "icon_key", "rarity", "tradable", "stackable", "value", "stats",
    ];
    onlyKeys(item, path, new Set([...required, "equip_skill"]));
    requireKeys(item, path, required);
    const id = idAt(item.id, `${path}.id`);
    stringAt(item.name, `${path}.name`);
    booleanAt(item.active, `${path}.active`);
    validateTierPair(item, path);
    const kind = enumAt(item.kind, `${path}.kind`, ITEM_KINDS);
    idAt(item.family, `${path}.family`);
    idAt(item.icon_key, `${path}.icon_key`);
    stringAt(item.colour, `${path}.colour`, HEX_COLOUR);
    enumAt(item.rarity, `${path}.rarity`, RARITIES);
    booleanAt(item.tradable, `${path}.tradable`);
    const stackable = booleanAt(item.stackable, `${path}.stackable`);
    numberAt(item.value, `${path}.value`, { integer: true, min: 0, max: 2_000_000_000 });
    const stats = objectAt(item.stats, `${path}.stats`);
    const statKeys = ["attack", "defense", "heal", "speed", "dmg_boost", "boost_hits"];
    onlyKeys(stats, `${path}.stats`, new Set(statKeys));
    requireKeys(stats, `${path}.stats`, statKeys);
    numberAt(stats.attack, `${path}.stats.attack`, { min: 0, max: 1_000_000 });
    numberAt(stats.defense, `${path}.stats.defense`, { min: 0, max: 1_000_000 });
    numberAt(stats.heal, `${path}.stats.heal`, { integer: true, min: 0, max: 1_000_000_000 });
    numberAt(stats.speed, `${path}.stats.speed`, { min: 0, max: 0.25 });
    numberAt(stats.dmg_boost, `${path}.stats.dmg_boost`, { min: 0, max: 1_000_000 });
    numberAt(stats.boost_hits, `${path}.stats.boost_hits`, { integer: true, min: 0, max: 1_000_000 });
    if (kind === "weapon" || kind === "armor") {
      if (stackable) issue(`${path}.stackable`, "gear must be non-stackable");
      enumAt(item.equip_skill, `${path}.equip_skill`, SKILLS);
      if (kind === "weapon" && !(stats.attack > 0)) issue(`${path}.stats.attack`, "weapons require positive attack");
      if (kind === "armor" && !(stats.defense > 0)) issue(`${path}.stats.defense`, "armor requires positive defense");
    } else if ("equip_skill" in item) {
      issue(`${path}.equip_skill`, "is allowed only for weapons and armor");
    }
    if (kind === "food" && !(stats.heal > 0)) issue(`${path}.stats.heal`, "food requires positive healing");
    if (kind === "potion" && (!(stats.dmg_boost > 0) || !(stats.boost_hits > 0))) {
      issue(`${path}.stats`, "potions require positive damage boost and hit duration");
    }
    if (id) itemById.set(id, item);
  });

  const requireActiveItem = (id, path) => {
    const item = itemById.get(id);
    if (!item) issue(path, `dangling item reference: ${id}`);
    else if (!item.active) issue(path, `references inactive item: ${id}`);
  };

  const recipeById = new Map();
  recipes.forEach((rawRecipe, index) => {
    const path = `$manifest.runtime.recipes[${index}]`;
    const recipe = objectAt(rawRecipe, path);
    const required = [
      "id", "active", "tier_index", "level_requirement", "station", "skill", "output_item_id",
      "output_qty", "xp", "time_s", "inputs",
    ];
    onlyKeys(recipe, path, new Set(required));
    requireKeys(recipe, path, required);
    const id = idAt(recipe.id, `${path}.id`);
    booleanAt(recipe.active, `${path}.active`);
    validateTierPair(recipe, path);
    const station = enumAt(recipe.station, `${path}.station`, STATIONS);
    const skill = enumAt(recipe.skill, `${path}.skill`, CRAFTING_SKILLS);
    if (station && skill && !STATION_SKILLS[station]?.has(skill)) {
      issue(`${path}.skill`, `station ${station} requires one of: ${[...(STATION_SKILLS[station] ?? [])].join(", ")}`);
    }
    const outputId = idAt(recipe.output_item_id, `${path}.output_item_id`);
    if (id && station && outputId && id !== `${station}_${outputId}`) {
      issue(`${path}.id`, `must follow {station}_{output_id}: ${station}_${outputId}`);
    }
    requireActiveItem(outputId, `${path}.output_item_id`);
    numberAt(recipe.output_qty, `${path}.output_qty`, { integer: true, min: 1, max: 1_000_000 });
    numberAt(recipe.xp, `${path}.xp`, { integer: true, min: 0, max: 2_000_000_000 });
    numberAt(recipe.time_s, `${path}.time_s`, { min: 0.1, max: 86_400 });
    const inputs = arrayAt(recipe.inputs, `${path}.inputs`);
    if (inputs.length === 0) issue(`${path}.inputs`, "must contain at least one input");
    assertUnique(inputs, "item_id", `${path}.inputs`);
    inputs.forEach((rawInput, inputIndex) => {
      const inputPath = `${path}.inputs[${inputIndex}]`;
      const input = objectAt(rawInput, inputPath);
      onlyKeys(input, inputPath, new Set(["item_id", "qty"]));
      requireKeys(input, inputPath, ["item_id", "qty"]);
      const itemId = idAt(input.item_id, `${inputPath}.item_id`);
      requireActiveItem(itemId, `${inputPath}.item_id`);
      numberAt(input.qty, `${inputPath}.qty`, { integer: true, min: 1, max: 1_000_000 });
    });
    if (id) recipeById.set(id, recipe);
  });

  const nodeByKind = new Map();
  nodes.forEach((rawNode, index) => {
    const path = `$manifest.runtime.nodes[${index}]`;
    const node = objectAt(rawNode, path);
    const required = [
      "kind", "name", "active", "tier_index", "level_requirement", "skill", "item_id", "xp",
      "gather_s", "respawn_s", "max_charges", "cluster_min", "shape", "family", "colour", "visual_key",
    ];
    onlyKeys(node, path, new Set(required));
    requireKeys(node, path, required);
    const kind = idAt(node.kind, `${path}.kind`);
    stringAt(node.name, `${path}.name`);
    booleanAt(node.active, `${path}.active`);
    validateTierPair(node, path);
    enumAt(node.skill, `${path}.skill`, NODE_SKILLS);
    const itemId = idAt(node.item_id, `${path}.item_id`);
    requireActiveItem(itemId, `${path}.item_id`);
    numberAt(node.xp, `${path}.xp`, { integer: true, min: 0, max: 2_000_000_000 });
    numberAt(node.gather_s, `${path}.gather_s`, { min: 0.1, max: 86_400 });
    numberAt(node.respawn_s, `${path}.respawn_s`, { integer: true, min: 1, max: 2_592_000 });
    numberAt(node.max_charges, `${path}.max_charges`, { integer: true, min: 1, max: 1_000_000 });
    numberAt(node.cluster_min, `${path}.cluster_min`, { integer: true, min: 1, max: 1_000_000 });
    enumAt(node.shape, `${path}.shape`, new Set(["rock", "tree", "bush"]));
    idAt(node.family, `${path}.family`);
    stringAt(node.colour, `${path}.colour`, HEX_COLOUR);
    idAt(node.visual_key, `${path}.visual_key`);
    if (kind) nodeByKind.set(kind, node);
  });

  const monsterByKind = new Map();
  monsters.forEach((rawMonster, index) => {
    const path = `$manifest.runtime.monsters[${index}]`;
    const monster = objectAt(rawMonster, path);
    const required = [
      "kind", "name", "active", "tier_index", "level_requirement", "hp", "attack", "defense",
      "xp", "gold_min", "gold_max", "respawn_s", "visual_key", "visual", "loot",
    ];
    onlyKeys(monster, path, new Set(required));
    requireKeys(monster, path, required);
    const kind = idAt(monster.kind, `${path}.kind`);
    stringAt(monster.name, `${path}.name`);
    booleanAt(monster.active, `${path}.active`);
    validateTierPair(monster, path);
    numberAt(monster.hp, `${path}.hp`, { integer: true, min: 1, max: 2_000_000_000 });
    numberAt(monster.attack, `${path}.attack`, { integer: true, min: 0, max: 2_000_000_000 });
    numberAt(monster.defense, `${path}.defense`, { integer: true, min: 0, max: 2_000_000_000 });
    numberAt(monster.xp, `${path}.xp`, { integer: true, min: 0, max: 2_000_000_000 });
    const goldMin = numberAt(monster.gold_min, `${path}.gold_min`, { integer: true, min: 0, max: 2_000_000_000 });
    const goldMax = numberAt(monster.gold_max, `${path}.gold_max`, { integer: true, min: 0, max: 2_000_000_000 });
    if (goldMax < goldMin) issue(`${path}.gold_max`, "must be greater than or equal to gold_min");
    numberAt(monster.respawn_s, `${path}.respawn_s`, { integer: true, min: 1, max: 2_592_000 });
    idAt(monster.visual_key, `${path}.visual_key`);
    const visual = objectAt(monster.visual, `${path}.visual`);
    const visualKeys = [
      "asset_key", "asset_path", "source_sha256", "padded_sha256", "canvas", "pivot",
      "visual_bounds", "click_bounds", "render_scale", "ground_offset_y", "motion_profile", "fallback",
    ];
    onlyKeys(visual, `${path}.visual`, new Set(visualKeys));
    requireKeys(visual, `${path}.visual`, visualKeys);
    idAt(visual.asset_key, `${path}.visual.asset_key`);
    stringAt(visual.asset_path, `${path}.visual.asset_path`);
    stringAt(visual.source_sha256, `${path}.visual.source_sha256`, SHA256);
    stringAt(visual.padded_sha256, `${path}.visual.padded_sha256`, SHA256);
    const canvas = objectAt(visual.canvas, `${path}.visual.canvas`);
    onlyKeys(canvas, `${path}.visual.canvas`, new Set(["width", "height"]));
    requireKeys(canvas, `${path}.visual.canvas`, ["width", "height"]);
    const canvasWidth = numberAt(canvas.width, `${path}.visual.canvas.width`, { min: 1, max: 8192 });
    const canvasHeight = numberAt(canvas.height, `${path}.visual.canvas.height`, { min: 1, max: 8192 });
    const pivot = objectAt(visual.pivot, `${path}.visual.pivot`);
    onlyKeys(pivot, `${path}.visual.pivot`, new Set(["x", "y"]));
    requireKeys(pivot, `${path}.visual.pivot`, ["x", "y"]);
    numberAt(pivot.x, `${path}.visual.pivot.x`, { min: 0, max: canvasWidth });
    numberAt(pivot.y, `${path}.visual.pivot.y`, { min: 0, max: canvasHeight });
    for (const boundsKey of ["visual_bounds", "click_bounds"]) {
      const boundsPath = `${path}.visual.${boundsKey}`;
      const bounds = objectAt(visual[boundsKey], boundsPath);
      onlyKeys(bounds, boundsPath, new Set(["left", "top", "right", "bottom"]));
      requireKeys(bounds, boundsPath, ["left", "top", "right", "bottom"]);
      const left = numberAt(bounds.left, `${boundsPath}.left`, { min: 0, max: canvasWidth });
      const top = numberAt(bounds.top, `${boundsPath}.top`, { min: 0, max: canvasHeight });
      const right = numberAt(bounds.right, `${boundsPath}.right`, { min: 0, max: canvasWidth });
      const bottom = numberAt(bounds.bottom, `${boundsPath}.bottom`, { min: 0, max: canvasHeight });
      if (right <= left) issue(`${boundsPath}.right`, "must be greater than left");
      if (bottom <= top) issue(`${boundsPath}.bottom`, "must be greater than top");
    }
    numberAt(visual.render_scale, `${path}.visual.render_scale`, { min: 0.01, max: 100 });
    numberAt(visual.ground_offset_y, `${path}.visual.ground_offset_y`, { min: 0, max: 10_000 });
    if (stringAt(visual.motion_profile, `${path}.visual.motion_profile`) !== "static_front_facing_bob") {
      issue(`${path}.visual.motion_profile`, "must be static_front_facing_bob");
    }
    const fallback = objectAt(visual.fallback, `${path}.visual.fallback`);
    onlyKeys(fallback, `${path}.visual.fallback`, new Set(["body", "accent", "size", "ears"]));
    requireKeys(fallback, `${path}.visual.fallback`, ["body", "accent", "size", "ears"]);
    stringAt(fallback.body, `${path}.visual.fallback.body`, HEX_COLOUR);
    stringAt(fallback.accent, `${path}.visual.fallback.accent`, HEX_COLOUR);
    numberAt(fallback.size, `${path}.visual.fallback.size`, { min: 0.01, max: 100 });
    enumAt(fallback.ears, `${path}.visual.fallback.ears`, FALLBACK_EARS);
    const loot = arrayAt(monster.loot, `${path}.loot`);
    loot.forEach((rawLoot, lootIndex) => {
      const lootPath = `${path}.loot[${lootIndex}]`;
      const drop = objectAt(rawLoot, lootPath);
      const requiredLoot = ["item_id", "chance", "qty_min", "qty_max", "channel", "xp"];
      onlyKeys(drop, lootPath, new Set(requiredLoot));
      requireKeys(drop, lootPath, requiredLoot);
      const itemId = idAt(drop.item_id, `${lootPath}.item_id`);
      requireActiveItem(itemId, `${lootPath}.item_id`);
      numberAt(drop.chance, `${lootPath}.chance`, { min: 0, max: 1 });
      const qtyMin = numberAt(drop.qty_min, `${lootPath}.qty_min`, { integer: true, min: 1, max: 1_000_000 });
      const qtyMax = numberAt(drop.qty_max, `${lootPath}.qty_max`, { integer: true, min: 1, max: 1_000_000 });
      if (qtyMax < qtyMin) issue(`${lootPath}.qty_max`, "must be greater than or equal to qty_min");
      enumAt(drop.channel, `${lootPath}.channel`, LOOT_CHANNELS);
      numberAt(drop.xp, `${lootPath}.xp`, { integer: true, min: 0, max: 2_000_000_000 });
    });
    if (kind) monsterByKind.set(kind, monster);
  });

  const fishByItem = new Map();
  fish.forEach((rawFish, index) => {
    const path = `$manifest.runtime.fish[${index}]`;
    const rule = objectAt(rawFish, path);
    const required = ["item_id", "active", "tier_index", "level_requirement", "xp", "weights"];
    onlyKeys(rule, path, new Set(required));
    requireKeys(rule, path, required);
    const itemId = idAt(rule.item_id, `${path}.item_id`);
    requireActiveItem(itemId, `${path}.item_id`);
    booleanAt(rule.active, `${path}.active`);
    validateTierPair(rule, path);
    numberAt(rule.xp, `${path}.xp`, { integer: true, min: 0, max: 2_000_000_000 });
    const weights = arrayAt(rule.weights, `${path}.weights`);
    if (weights.length === 0) issue(`${path}.weights`, "must contain at least one level weight");
    assertUnique(weights, "level", `${path}.weights`);
    weights.forEach((rawWeight, weightIndex) => {
      const weightPath = `${path}.weights[${weightIndex}]`;
      const weight = objectAt(rawWeight, weightPath);
      onlyKeys(weight, weightPath, new Set(["level", "weight"]));
      requireKeys(weight, weightPath, ["level", "weight"]);
      numberAt(weight.level, `${weightPath}.level`, { integer: true, min: 1, max: 150 });
      numberAt(weight.weight, `${weightPath}.weight`, { min: 0, max: 1 });
    });
    if (itemId) fishByItem.set(itemId, rule);
  });
  if (fish.length > 0) {
    const checkpointLevels = (weights) => [...new Set(weights.map((entry) => entry.level))].sort((a, b) => a - b);
    const expectedCheckpoints = checkpointLevels(fish[0].weights);
    for (const [index, rule] of fish.entries()) {
      const checkpoints = checkpointLevels(rule.weights);
      if (!compareCanonical(checkpoints, expectedCheckpoints)) {
        issue(`$manifest.runtime.fish[${index}].weights`, "must use the same level checkpoints as every fish rule");
      }
    }
    for (const checkpoint of expectedCheckpoints) {
      const total = fish.reduce(
        (sum, rule) => sum + (rule.weights.find((entry) => entry.level === checkpoint)?.weight ?? 0),
        0,
      );
      if (Math.abs(total - 1) > 1e-9) {
        issue("$manifest.runtime.fish", `weights at level ${checkpoint} must sum to 1; received ${total}`);
      }
    }
  }

  fishingSpots.forEach((rawSpot, index) => {
    const path = `$manifest.runtime.fishing_spots[${index}]`;
    const spot = objectAt(rawSpot, path);
    const required = ["id", "active", "biome", "subzone", "x", "y", "fish_item_ids"];
    onlyKeys(spot, path, new Set(required));
    requireKeys(spot, path, required);
    idAt(spot.id, `${path}.id`);
    booleanAt(spot.active, `${path}.active`);
    idAt(spot.biome, `${path}.biome`);
    idAt(spot.subzone, `${path}.subzone`);
    numberAt(spot.x, `${path}.x`, { min: 0, max: 1_000_000 });
    numberAt(spot.y, `${path}.y`, { min: 0, max: 1_000_000 });
    const ids = arrayAt(spot.fish_item_ids, `${path}.fish_item_ids`);
    if (ids.length === 0) issue(`${path}.fish_item_ids`, "must contain at least one fish item");
    if (new Set(ids).size !== ids.length) issue(`${path}.fish_item_ids`, "must not contain duplicates");
    ids.forEach((itemId, itemIndex) => {
      idAt(itemId, `${path}.fish_item_ids[${itemIndex}]`);
      const fishRule = fishByItem.get(itemId);
      if (!fishRule) issue(`${path}.fish_item_ids[${itemIndex}]`, `dangling fish rule reference: ${itemId}`);
      else if (!fishRule.active) issue(`${path}.fish_item_ids[${itemIndex}]`, `references inactive fish rule: ${itemId}`);
    });
  });

  quests.forEach((rawQuest, index) => {
    const path = `$manifest.runtime.quests[${index}]`;
    const quest = objectAt(rawQuest, path);
    const required = [
      "id", "name", "description", "active", "tier_index", "level_requirement", "kind", "target_id", "count",
      "gold", "xp_skill", "xp", "reward_items",
    ];
    onlyKeys(quest, path, new Set(required));
    requireKeys(quest, path, required);
    idAt(quest.id, `${path}.id`);
    stringAt(quest.name, `${path}.name`);
    stringAt(quest.description, `${path}.description`);
    booleanAt(quest.active, `${path}.active`);
    validateTierPair(quest, path);
    const kind = enumAt(quest.kind, `${path}.kind`, QUEST_KINDS);
    const targetId = idAt(quest.target_id, `${path}.target_id`);
    if (kind === "kill") {
      const target = monsterByKind.get(targetId);
      if (!target) issue(`${path}.target_id`, `dangling monster reference: ${targetId}`);
      else if (!target.active) issue(`${path}.target_id`, `references inactive monster: ${targetId}`);
    }
    if (kind === "gather") requireActiveItem(targetId, `${path}.target_id`);
    numberAt(quest.count, `${path}.count`, { integer: true, min: 1, max: 2_000_000_000 });
    numberAt(quest.gold, `${path}.gold`, { integer: true, min: 0, max: 2_000_000_000 });
    enumAt(quest.xp_skill, `${path}.xp_skill`, SKILLS);
    numberAt(quest.xp, `${path}.xp`, { integer: true, min: 0, max: 2_000_000_000 });
    const rewards = arrayAt(quest.reward_items, `${path}.reward_items`);
    rewards.forEach((rawReward, rewardIndex) => {
      const rewardPath = `${path}.reward_items[${rewardIndex}]`;
      const reward = objectAt(rawReward, rewardPath);
      onlyKeys(reward, rewardPath, new Set(["item_id", "qty"]));
      requireKeys(reward, rewardPath, ["item_id", "qty"]);
      const itemId = idAt(reward.item_id, `${rewardPath}.item_id`);
      requireActiveItem(itemId, `${rewardPath}.item_id`);
      numberAt(reward.qty, `${rewardPath}.qty`, { integer: true, min: 1, max: 1_000_000 });
    });
  });

  bosses.forEach((rawBoss, index) => {
    const path = `$manifest.runtime.bosses[${index}]`;
    const boss = objectAt(rawBoss, path);
    const required = [
      "id", "name", "active", "level_requirement", "hp", "attack", "defense", "respawn_s",
      "visual_key", "reward_mode", "target_contributors", "minimum_damage", "xp_pool",
      "xp_per_player_cap", "gold_pool_min", "gold_pool_max", "gold_per_player_cap_min",
      "gold_per_player_cap_max", "rewards",
    ];
    onlyKeys(boss, path, new Set(required));
    requireKeys(boss, path, required);
    idAt(boss.id, `${path}.id`);
    stringAt(boss.name, `${path}.name`);
    booleanAt(boss.active, `${path}.active`);
    numberAt(boss.level_requirement, `${path}.level_requirement`, { integer: true, min: 1, max: 150 });
    numberAt(boss.hp, `${path}.hp`, { integer: true, min: 1, max: 2_000_000_000 });
    numberAt(boss.attack, `${path}.attack`, { integer: true, min: 0, max: 2_000_000_000 });
    numberAt(boss.defense, `${path}.defense`, { integer: true, min: 0, max: 2_000_000_000 });
    numberAt(boss.respawn_s, `${path}.respawn_s`, { integer: true, min: 1, max: 2_592_000 });
    idAt(boss.visual_key, `${path}.visual_key`);
    if (stringAt(boss.reward_mode, `${path}.reward_mode`) !== "fixed_pool_proportional_damage_with_per_player_cap") {
      issue(`${path}.reward_mode`, "must be fixed_pool_proportional_damage_with_per_player_cap");
    }
    const contributors = numberAt(boss.target_contributors, `${path}.target_contributors`, { integer: true, min: 1, max: 10_000 });
    const minimumDamage = numberAt(boss.minimum_damage, `${path}.minimum_damage`, { integer: true, min: 1, max: 2_000_000_000 });
    if (minimumDamage >= boss.hp) issue(`${path}.minimum_damage`, "must be less than boss hp");
    const xpPool = numberAt(boss.xp_pool, `${path}.xp_pool`, { integer: true, min: 1, max: 2_000_000_000 });
    const xpCap = numberAt(boss.xp_per_player_cap, `${path}.xp_per_player_cap`, { integer: true, min: 1, max: 2_000_000_000 });
    const goldPoolMin = numberAt(boss.gold_pool_min, `${path}.gold_pool_min`, { integer: true, min: 1, max: 2_000_000_000 });
    const goldPoolMax = numberAt(boss.gold_pool_max, `${path}.gold_pool_max`, { integer: true, min: 1, max: 2_000_000_000 });
    const goldCapMin = numberAt(boss.gold_per_player_cap_min, `${path}.gold_per_player_cap_min`, { integer: true, min: 1, max: 2_000_000_000 });
    const goldCapMax = numberAt(boss.gold_per_player_cap_max, `${path}.gold_per_player_cap_max`, { integer: true, min: 1, max: 2_000_000_000 });
    if (goldPoolMax < goldPoolMin) issue(`${path}.gold_pool_max`, "must be greater than or equal to gold_pool_min");
    if (goldCapMax < goldCapMin) issue(`${path}.gold_per_player_cap_max`, "must be greater than or equal to gold_per_player_cap_min");
    if (xpCap * contributors !== xpPool) issue(`${path}.xp_per_player_cap`, "times target_contributors must equal xp_pool");
    if (goldCapMin * contributors !== goldPoolMin) issue(`${path}.gold_per_player_cap_min`, "times target_contributors must equal gold_pool_min");
    if (goldCapMax * contributors !== goldPoolMax) issue(`${path}.gold_per_player_cap_max`, "times target_contributors must equal gold_pool_max");
    const rewards = arrayAt(boss.rewards, `${path}.rewards`);
    rewards.forEach((rawReward, rewardIndex) => {
      const rewardPath = `${path}.rewards[${rewardIndex}]`;
      const reward = objectAt(rawReward, rewardPath);
      const rewardKeys = ["item_id", "chance", "qty_min", "qty_max"];
      onlyKeys(reward, rewardPath, new Set(rewardKeys));
      requireKeys(reward, rewardPath, rewardKeys);
      const itemId = idAt(reward.item_id, `${rewardPath}.item_id`);
      requireActiveItem(itemId, `${rewardPath}.item_id`);
      numberAt(reward.chance, `${rewardPath}.chance`, { min: 0, max: 1 });
      const min = numberAt(reward.qty_min, `${rewardPath}.qty_min`, { integer: true, min: 1, max: 1_000_000 });
      const max = numberAt(reward.qty_max, `${rewardPath}.qty_max`, { integer: true, min: 1, max: 1_000_000 });
      if (max < min) issue(`${rewardPath}.qty_max`, "must be greater than or equal to qty_min");
    });
  });

  const spawnKeys = new Set();
  const validateSpawns = (rows, entityType, definitions, pathBase) => {
    rows.forEach((rawSpawn, index) => {
      const path = `${pathBase}[${index}]`;
      const spawn = objectAt(rawSpawn, path);
      const required = ["kind", "ordinal", "active", "biome", "subzone", "x", "y"];
      onlyKeys(spawn, path, new Set(required));
      requireKeys(spawn, path, required);
      const kind = idAt(spawn.kind, `${path}.kind`);
      const ordinal = numberAt(spawn.ordinal, `${path}.ordinal`, { integer: true, min: 0, max: 2_000_000_000 });
      booleanAt(spawn.active, `${path}.active`);
      idAt(spawn.biome, `${path}.biome`);
      idAt(spawn.subzone, `${path}.subzone`);
      numberAt(spawn.x, `${path}.x`, { min: 0, max: 1_000_000 });
      numberAt(spawn.y, `${path}.y`, { min: 0, max: 1_000_000 });
      const definition = definitions.get(kind);
      if (!definition) issue(`${path}.kind`, `dangling ${entityType} definition: ${kind}`);
      else if (!definition.active) issue(`${path}.kind`, `references inactive ${entityType} definition: ${kind}`);
      const key = `${entityType}:${kind}:${ordinal}`;
      if (spawnKeys.has(key)) issue(path, `duplicate spawn identity: ${key}`);
      spawnKeys.add(key);
    });
  };
  validateSpawns(nodeSpawns, "node", nodeByKind, "$manifest.runtime.node_spawns");
  validateSpawns(monsterSpawns, "monster", monsterByKind, "$manifest.runtime.monster_spawns");

  migrationRules.forEach((rawRule, index) => {
    const path = `$manifest.runtime.migration_rules[${index}]`;
    const rule = objectAt(rawRule, path);
    const required = ["from_id", "action", "captured_value_required", "notice_key"];
    onlyKeys(rule, path, new Set([...required, "to_id", "equipped_action", "unequipped_action"]));
    requireKeys(rule, path, required);
    idAt(rule.from_id, `${path}.from_id`);
    const action = enumAt(rule.action, `${path}.action`, MIGRATION_ACTIONS);
    booleanAt(rule.captured_value_required, `${path}.captured_value_required`);
    idAt(rule.notice_key, `${path}.notice_key`);
    if (action === "replace" || action === "replace_or_compensate") {
      if (!("to_id" in rule)) issue(`${path}.to_id`, `is required for ${action} actions`);
      else requireActiveItem(idAt(rule.to_id, `${path}.to_id`), `${path}.to_id`);
    } else if ("to_id" in rule) {
      issue(`${path}.to_id`, "is allowed only for replace or replace_or_compensate actions");
    }
    if (action === "replace_or_compensate") {
      if (rule.captured_value_required !== true) issue(`${path}.captured_value_required`, "must be true for replace_or_compensate");
      if (rule.equipped_action !== "replace_preserve_plus") issue(`${path}.equipped_action`, "must be replace_preserve_plus");
      if (rule.unequipped_action !== "compensate_captured_value") issue(`${path}.unequipped_action`, "must be compensate_captured_value");
    } else {
      if ("equipped_action" in rule) issue(`${path}.equipped_action`, "is allowed only for replace_or_compensate");
      if ("unequipped_action" in rule) issue(`${path}.unequipped_action`, "is allowed only for replace_or_compensate");
    }
  });

  onlyKeys(starterLoadout, "$manifest.runtime.starter_loadout", new Set(["weapon_item_id", "armor_item_id", "plus"]));
  requireKeys(starterLoadout, "$manifest.runtime.starter_loadout", ["weapon_item_id", "armor_item_id", "plus"]);
  const starterWeaponId = idAt(starterLoadout.weapon_item_id, "$manifest.runtime.starter_loadout.weapon_item_id");
  const starterArmorId = idAt(starterLoadout.armor_item_id, "$manifest.runtime.starter_loadout.armor_item_id");
  const starterWeapon = itemById.get(starterWeaponId);
  const starterArmor = itemById.get(starterArmorId);
  if (!starterWeapon?.active || starterWeapon.kind !== "weapon") issue("$manifest.runtime.starter_loadout.weapon_item_id", "must reference an active weapon");
  if (!starterArmor?.active || starterArmor.kind !== "armor") issue("$manifest.runtime.starter_loadout.armor_item_id", "must reference active armor");
  numberAt(starterLoadout.plus, "$manifest.runtime.starter_loadout.plus", { integer: true, min: 0, max: 100 });

  const mechanicKeys = [
    "approved_balance_model_hash", "max_level", "max_plus", "market_fee_pct", "weapon_multiplier_rule",
    "light_attack_multiplier_rule", "defense_multiplier_rule", "upgrade_cost_rule", "gear_resale_rule",
    "fishing_xp_curve",
  ];
  // `strength_potions` is optional and additive (introduced by the V6 strength
  // release). Older manifests omit it and stay byte-identical.
  onlyKeys(mechanics, "$manifest.runtime.mechanics", new Set([...mechanicKeys, "strength_potions"]));
  requireKeys(mechanics, "$manifest.runtime.mechanics", mechanicKeys);
  if (mechanics.strength_potions !== undefined) {
    const strengthPotions = arrayAt(mechanics.strength_potions, "$manifest.runtime.mechanics.strength_potions");
    if (strengthPotions.length !== 16) issue("$manifest.runtime.mechanics.strength_potions", "must contain exactly 16 tier entries");
    assertUnique(strengthPotions, "tier_index", "$manifest.runtime.mechanics.strength_potions");
    assertUnique(strengthPotions, "item_id", "$manifest.runtime.mechanics.strength_potions");
    strengthPotions.forEach((rawEntry, index) => {
      const path = `$manifest.runtime.mechanics.strength_potions[${index}]`;
      const entry = objectAt(rawEntry, path);
      onlyKeys(entry, path, new Set(["tier_index", "item_id", "strength_pct", "boost_hits"]));
      requireKeys(entry, path, ["tier_index", "item_id", "strength_pct", "boost_hits"]);
      numberAt(entry.tier_index, `${path}.tier_index`, { integer: true, min: 1, max: 16 });
      stringAt(entry.item_id, `${path}.item_id`, CONTENT_ID);
      numberAt(entry.strength_pct, `${path}.strength_pct`, { integer: true, min: 1, max: 100 });
      numberAt(entry.boost_hits, `${path}.boost_hits`, { integer: true, min: 1, max: 1000 });
    });
  }
  stringAt(mechanics.approved_balance_model_hash, "$manifest.runtime.mechanics.approved_balance_model_hash", SHA256);
  const maxLevel = numberAt(mechanics.max_level, "$manifest.runtime.mechanics.max_level", { integer: true, min: 1, max: 150 });
  if (maxLevel !== 150) issue("$manifest.runtime.mechanics.max_level", "must equal 150");
  const maxPlus = numberAt(mechanics.max_plus, "$manifest.runtime.mechanics.max_plus", { integer: true, min: 0, max: 100 });
  if (maxPlus !== 100) issue("$manifest.runtime.mechanics.max_plus", "must equal 100");
  numberAt(mechanics.market_fee_pct, "$manifest.runtime.mechanics.market_fee_pct", { min: 0, max: 100 });
  for (const key of ["weapon_multiplier_rule", "light_attack_multiplier_rule", "defense_multiplier_rule", "upgrade_cost_rule", "gear_resale_rule"]) {
    stringAt(mechanics[key], `$manifest.runtime.mechanics.${key}`);
  }
  const fishingXpCurve = arrayAt(mechanics.fishing_xp_curve, "$manifest.runtime.mechanics.fishing_xp_curve");
  if (fishingXpCurve.length !== 16) issue("$manifest.runtime.mechanics.fishing_xp_curve", "must contain exactly 16 tier checkpoints");
  assertUnique(fishingXpCurve, "tier_index", "$manifest.runtime.mechanics.fishing_xp_curve");
  fishingXpCurve.forEach((rawCheckpoint, index) => {
    const path = `$manifest.runtime.mechanics.fishing_xp_curve[${index}]`;
    const checkpoint = objectAt(rawCheckpoint, path);
    onlyKeys(checkpoint, path, new Set(["tier_index", "level_requirement", "xp_per_action"]));
    requireKeys(checkpoint, path, ["tier_index", "level_requirement", "xp_per_action"]);
    const tierIndex = numberAt(checkpoint.tier_index, `${path}.tier_index`, { integer: true, min: 1, max: 16 });
    const level = numberAt(checkpoint.level_requirement, `${path}.level_requirement`, { integer: true, min: 1, max: 150 });
    if (lockedPair.get(tierIndex) !== level) issue(`${path}.level_requirement`, `does not match locked tier_index ${tierIndex}`);
    numberAt(checkpoint.xp_per_action, `${path}.xp_per_action`, { integer: true, min: 1, max: 2_000_000_000 });
  });

  const notice = objectAt(runtime.player_notice, "$manifest.runtime.player_notice");
  onlyKeys(notice, "$manifest.runtime.player_notice", new Set(["title", "summary", "details"]));
  requireKeys(notice, "$manifest.runtime.player_notice", ["title", "summary", "details"]);
  stringAt(notice.title, "$manifest.runtime.player_notice.title");
  stringAt(notice.summary, "$manifest.runtime.player_notice.summary");
  const noticeDetails = arrayAt(notice.details, "$manifest.runtime.player_notice.details");
  if (noticeDetails.length === 0) issue("$manifest.runtime.player_notice.details", "must contain at least one detail");
  noticeDetails.forEach((detail, index) => stringAt(detail, `$manifest.runtime.player_notice.details[${index}]`));

  if (issues.length) throw new ManifestValidationError(issues);
  return { lifecycle: "runtime", hash: manifestHash(root) };
}

function draftIds(manifest) {
  const inventory = manifest.id_inventory;
  const newIds = inventory.new_ids;
  const itemCategories = Object.entries(newIds)
    .filter(([key]) => key !== "node_kinds" && key !== "monster_kinds")
    .flatMap(([, ids]) => ids);
  return {
    itemIds: uniqueSorted([
      ...Object.values(inventory.in_place_ids).flat(),
      ...inventory.retired_ids,
      ...itemCategories,
    ]),
    nodeKinds: uniqueSorted(newIds.node_kinds),
    monsterKinds: uniqueSorted(inventory.sprite_kinds),
    recipeIds: [],
    retiredIds: uniqueSorted(inventory.retired_ids),
  };
}

function runtimeIds(manifest) {
  const runtime = manifest.runtime;
  return {
    itemIds: uniqueSorted(runtime.items.map((item) => item.id)),
    nodeKinds: uniqueSorted(runtime.nodes.map((node) => node.kind)),
    monsterKinds: uniqueSorted(runtime.monsters.map((monster) => monster.kind)),
    recipeIds: uniqueSorted(runtime.recipes.map((recipe) => recipe.id)),
    retiredIds: uniqueSorted(runtime.migration_rules.map((rule) => rule.from_id)),
  };
}

function tsArray(name, values) {
  return `export const ${name} = ${JSON.stringify(values, null, 2)} as const;`;
}

function generateClient(manifest, hash, ids) {
  const tiers = manifest.tiers.map(({ tier_index, level_requirement, theme, palette }) =>
    palette === undefined
      ? { tier_index, level_requirement, theme }
      : { tier_index, level_requirement, theme, palette },
  );
  return `/* eslint-disable */\n/*\n * GENERATED FILE — DO NOT EDIT.\n * Source: content/v2/manifest.authoring.json (or the generator input named in CI)\n * Manifest SHA-256: ${hash}\n */\n\nexport const CONTENT_SCHEMA_VERSION = ${JSON.stringify(manifest.schema_version)};\nexport const CONTENT_VERSION = ${JSON.stringify(manifest.content_version)};\nexport const SPAWN_SET_VERSION = ${JSON.stringify(manifest.spawn_set_version)};\nexport const CONTENT_MANIFEST_HASH = ${JSON.stringify(hash)};\nexport const CONTENT_RUNNABLE = ${manifest.lifecycle === "runtime"};\n\n${tsArray("CONTENT_TIERS", tiers)}\n${tsArray("CONTENT_ITEM_IDS", ids.itemIds)}\n${tsArray("CONTENT_NODE_KINDS", ids.nodeKinds)}\n${tsArray("CONTENT_MONSTER_KINDS", ids.monsterKinds)}\n${tsArray("CONTENT_RECIPE_IDS", ids.recipeIds)}\n${tsArray("RETIRED_CONTENT_IDS", ids.retiredIds)}\n\nexport type ContentItemId = (typeof CONTENT_ITEM_IDS)[number];\nexport type ContentNodeKind = (typeof CONTENT_NODE_KINDS)[number];\nexport type ContentMonsterKind = (typeof CONTENT_MONSTER_KINDS)[number];\nexport type ContentRecipeId = (typeof CONTENT_RECIPE_IDS)[number];\n\nexport class UnknownGeneratedContentIdError extends Error {\n  readonly kind: string;\n  readonly value: string;\n\n  constructor(kind: string, value: string) {\n    super(\`Unknown \${kind} ID: \${value}\`);\n    this.name = "UnknownGeneratedContentIdError";\n    this.kind = kind;\n    this.value = value;\n  }\n}\n\nfunction assertGeneratedId<T extends string>(kind: string, known: readonly T[], value: string): T {\n  if (!(known as readonly string[]).includes(value)) throw new UnknownGeneratedContentIdError(kind, value);\n  return value as T;\n}\n\nexport const assertContentItemId = (value: string): ContentItemId =>\n  assertGeneratedId("item", CONTENT_ITEM_IDS, value);\nexport const assertContentNodeKind = (value: string): ContentNodeKind =>\n  assertGeneratedId("node", CONTENT_NODE_KINDS, value);\nexport const assertContentMonsterKind = (value: string): ContentMonsterKind =>\n  assertGeneratedId("monster", CONTENT_MONSTER_KINDS, value);\nexport const assertContentRecipeId = (value: string): ContentRecipeId =>\n  assertGeneratedId("recipe", CONTENT_RECIPE_IDS, value);\n`;
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlText(canonicalJson(value))}::jsonb`;
}

function sqlBool(value) {
  return value ? "true" : "false";
}

function sqlNumber(value) {
  if (!Number.isFinite(value)) throw new Error(`Cannot emit non-finite SQL number: ${value}`);
  return String(value);
}

function sqlNullableText(value) {
  return value === undefined ? "NULL" : sqlText(value);
}

function valuesBlock(rows) {
  return `VALUES\n${rows.map((row) => `  (${row.join(", ")})`).join(",\n")}`;
}

function draftSql(manifest, hash) {
  return `-- GENERATED FILE — DO NOT EDIT.\n-- Manifest SHA-256: ${hash}\n-- This authoring manifest is deliberately non-runnable.\n\nDO $tomlandia_draft_guard$\nBEGIN\n  RAISE EXCEPTION 'Tomlandia content manifest ${manifest.content_version} is draft-only and cannot be applied (hash ${hash})';\nEND\n$tomlandia_draft_guard$;\n`;
}

function runtimeSql(manifest, hash) {
  const r = manifest.runtime;
  const version = sqlText(manifest.content_version);
  const spawnSet = sqlText(manifest.spawn_set_version);
  const lines = [
    "-- GENERATED FILE — DO NOT EDIT.",
    `-- Manifest SHA-256: ${hash}`,
    `-- Content version: ${manifest.content_version}`,
    "-- This stages content only; it never changes the active control row.",
    "",
    "BEGIN;",
    "",
    "DO $content_not_active$",
    "BEGIN",
    `  IF EXISTS (SELECT 1 FROM public.game_content_versions WHERE content_version = ${version} AND status = 'active') THEN`,
    `    RAISE EXCEPTION 'Refusing to replace active content version ${manifest.content_version}';`,
    "  END IF;",
    "END",
    "$content_not_active$;",
    "",
    "INSERT INTO public.game_content_versions",
    "  (content_version, spawn_set_version, uuid_namespace, manifest_hash, status, starter_loadout, mechanics, player_notice)",
    `VALUES (${version}, ${spawnSet}, ${sqlText(manifest.uuid_namespace)}, ${sqlText(hash)}, 'staged', ${sqlJson(r.starter_loadout)}, ${sqlJson(r.mechanics)}, ${sqlJson(r.player_notice)})`,
    "ON CONFLICT (content_version) DO NOTHING;",
    "",
    "DELETE FROM public.game_content_spawns WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_migration_rules WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_bosses WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_quests WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_fishing_spots WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_fish WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_monster_loot WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_monsters WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_nodes WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_recipe_inputs WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_recipes WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_items WHERE content_version = " + version + ";",
    "DELETE FROM public.game_content_tiers WHERE content_version = " + version + ";",
    "",
    "UPDATE public.game_content_versions SET",
    `  spawn_set_version = ${spawnSet},`,
    `  uuid_namespace = ${sqlText(manifest.uuid_namespace)},`,
    `  manifest_hash = ${sqlText(hash)},`,
    "  status = 'staged',",
    `  starter_loadout = ${sqlJson(r.starter_loadout)},`,
    `  mechanics = ${sqlJson(r.mechanics)},`,
    `  player_notice = ${sqlJson(r.player_notice)},`,
    "  activated_at = NULL",
    `WHERE content_version = ${version};`,
    "",
  ];

  const tiers = manifest.tiers.map((tier) => [
    version,
    sqlNumber(tier.tier_index),
    sqlNumber(tier.level_requirement),
    sqlText(tier.theme),
    sqlJson(tier.palette),
  ]);
  lines.push(
    "INSERT INTO public.game_content_tiers",
    "  (content_version, tier_index, level_requirement, theme, palette)",
    `${valuesBlock(tiers)};`,
    "",
  );

  const items = r.items.map((item) => [
    version,
    sqlText(item.id),
    sqlText(item.name),
    sqlBool(item.active),
    sqlNumber(item.tier_index),
    sqlNumber(item.level_requirement),
    sqlText(item.kind),
    sqlText(item.family),
    sqlText(item.icon_key),
    sqlText(item.colour),
    sqlText(item.rarity),
    sqlBool(item.tradable),
    sqlBool(item.stackable),
    sqlNumber(item.value),
    sqlNullableText(item.equip_skill),
    sqlNumber(item.stats.attack),
    sqlNumber(item.stats.defense),
    sqlNumber(item.stats.heal),
    sqlNumber(item.stats.speed),
    sqlNumber(item.stats.dmg_boost),
    sqlNumber(item.stats.boost_hits),
  ]);
  if (items.length) lines.push(
    "INSERT INTO public.game_content_items",
    "  (content_version, id, name, active, tier_index, level_requirement, kind, family, icon_key, colour, rarity, tradable, stackable, value, equip_skill, attack, defense, heal, speed, dmg_boost, boost_hits)",
    `${valuesBlock(items)};`,
    "",
  );

  const recipes = r.recipes.map((recipe) => [
    version, sqlText(recipe.id), sqlBool(recipe.active), sqlNumber(recipe.tier_index),
    sqlNumber(recipe.level_requirement), sqlText(recipe.station), sqlText(recipe.skill),
    sqlText(recipe.output_item_id), sqlNumber(recipe.output_qty), sqlNumber(recipe.xp), sqlNumber(recipe.time_s),
  ]);
  if (recipes.length) lines.push(
    "INSERT INTO public.game_content_recipes",
    "  (content_version, id, active, tier_index, level_requirement, station, skill, output_item_id, output_qty, xp, time_s)",
    `${valuesBlock(recipes)};`,
    "",
  );
  const inputs = r.recipes.flatMap((recipe) => recipe.inputs.map((input) => [
    version, sqlText(recipe.id), sqlText(input.item_id), sqlNumber(input.qty),
  ]));
  if (inputs.length) lines.push(
    "INSERT INTO public.game_content_recipe_inputs (content_version, recipe_id, item_id, qty)",
    `${valuesBlock(inputs)};`,
    "",
  );

  const nodes = r.nodes.map((node) => [
    version, sqlText(node.kind), sqlText(node.name), sqlBool(node.active), sqlNumber(node.tier_index),
    sqlNumber(node.level_requirement), sqlText(node.skill), sqlText(node.item_id), sqlNumber(node.xp),
    sqlNumber(node.gather_s), sqlNumber(node.respawn_s), sqlNumber(node.max_charges), sqlNumber(node.cluster_min),
    sqlText(node.shape), sqlText(node.family), sqlText(node.colour), sqlText(node.visual_key),
  ]);
  if (nodes.length) lines.push(
    "INSERT INTO public.game_content_nodes",
    "  (content_version, kind, name, active, tier_index, level_requirement, skill, item_id, xp, gather_s, respawn_s, max_charges, cluster_min, shape, family, colour, visual_key)",
    `${valuesBlock(nodes)};`,
    "",
  );

  const monsters = r.monsters.map((monster) => [
    version, sqlText(monster.kind), sqlText(monster.name), sqlBool(monster.active), sqlNumber(monster.tier_index),
    sqlNumber(monster.level_requirement), sqlNumber(monster.hp), sqlNumber(monster.attack),
    sqlNumber(monster.defense), sqlNumber(monster.xp), sqlNumber(monster.gold_min), sqlNumber(monster.gold_max),
    sqlNumber(monster.respawn_s), sqlText(monster.visual_key), sqlJson(monster.visual),
  ]);
  if (monsters.length) lines.push(
    "INSERT INTO public.game_content_monsters",
    "  (content_version, kind, name, active, tier_index, level_requirement, hp, attack, defense, xp, gold_min, gold_max, respawn_s, visual_key, visual)",
    `${valuesBlock(monsters)};`,
    "",
  );
  const loot = r.monsters.flatMap((monster) => monster.loot.map((drop, index) => [
    version, sqlText(monster.kind), sqlNumber(index), sqlText(drop.item_id), sqlNumber(drop.chance),
    sqlNumber(drop.qty_min), sqlNumber(drop.qty_max), sqlText(drop.channel), sqlNumber(drop.xp),
  ]));
  if (loot.length) lines.push(
    "INSERT INTO public.game_content_monster_loot",
    "  (content_version, monster_kind, ordinal, item_id, chance, qty_min, qty_max, channel, xp)",
    `${valuesBlock(loot)};`,
    "",
  );

  const fish = r.fish.map((rule) => [
    version, sqlText(rule.item_id), sqlBool(rule.active), sqlNumber(rule.tier_index),
    sqlNumber(rule.level_requirement), sqlNumber(rule.xp), sqlJson(rule.weights),
  ]);
  if (fish.length) lines.push(
    "INSERT INTO public.game_content_fish",
    "  (content_version, item_id, active, tier_index, level_requirement, xp, weights)",
    `${valuesBlock(fish)};`,
    "",
  );
  const spots = r.fishing_spots.map((spot) => [
    version, sqlText(spot.id), sqlBool(spot.active), sqlText(spot.biome), sqlText(spot.subzone),
    sqlNumber(spot.x), sqlNumber(spot.y), sqlJson(spot.fish_item_ids),
  ]);
  if (spots.length) lines.push(
    "INSERT INTO public.game_content_fishing_spots",
    "  (content_version, id, active, biome, subzone, x, y, fish_item_ids)",
    `${valuesBlock(spots)};`,
    "",
  );

  const quests = r.quests.map((quest) => [
    version, sqlText(quest.id), sqlText(quest.name), sqlText(quest.description), sqlBool(quest.active), sqlNumber(quest.tier_index),
    sqlNumber(quest.level_requirement), sqlText(quest.kind), sqlText(quest.target_id), sqlNumber(quest.count),
    sqlNumber(quest.gold), sqlText(quest.xp_skill), sqlNumber(quest.xp), sqlJson(quest.reward_items),
  ]);
  if (quests.length) lines.push(
    "INSERT INTO public.game_content_quests",
    "  (content_version, id, name, description, active, tier_index, level_requirement, kind, target_id, count, gold, xp_skill, xp, reward_items)",
    `${valuesBlock(quests)};`,
    "",
  );
  const bosses = r.bosses.map((boss) => [
    version, sqlText(boss.id), sqlText(boss.name), sqlBool(boss.active), sqlNumber(boss.level_requirement),
    sqlNumber(boss.hp), sqlNumber(boss.attack), sqlNumber(boss.defense), sqlNumber(boss.respawn_s),
    sqlText(boss.visual_key), sqlText(boss.reward_mode), sqlNumber(boss.target_contributors),
    sqlNumber(boss.minimum_damage), sqlNumber(boss.xp_pool), sqlNumber(boss.xp_per_player_cap),
    sqlNumber(boss.gold_pool_min), sqlNumber(boss.gold_pool_max), sqlNumber(boss.gold_per_player_cap_min),
    sqlNumber(boss.gold_per_player_cap_max), sqlJson(boss.rewards),
  ]);
  if (bosses.length) lines.push(
    "INSERT INTO public.game_content_bosses",
    "  (content_version, id, name, active, level_requirement, hp, attack, defense, respawn_s, visual_key, reward_mode, target_contributors, minimum_damage, xp_pool, xp_per_player_cap, gold_pool_min, gold_pool_max, gold_per_player_cap_min, gold_per_player_cap_max, rewards)",
    `${valuesBlock(bosses)};`,
    "",
  );

  const spawnRows = [
    ...r.node_spawns.map((spawn) => ({ ...spawn, entity_type: "node" })),
    ...r.monster_spawns.map((spawn) => ({ ...spawn, entity_type: "monster" })),
  ].map((spawn) => {
    const identity = `${manifest.spawn_set_version}:${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`;
    return [
      sqlText(uuidV5(manifest.uuid_namespace, identity)), version, spawnSet, sqlText(spawn.entity_type),
      sqlText(spawn.kind), sqlNumber(spawn.ordinal), sqlBool(spawn.active), sqlText(spawn.biome),
      sqlText(spawn.subzone), sqlNumber(spawn.x), sqlNumber(spawn.y),
    ];
  });
  if (spawnRows.length) lines.push(
    "INSERT INTO public.game_content_spawns",
    "  (spawn_id, content_version, spawn_set_version, entity_type, kind, ordinal, active, biome, subzone, x, y)",
    `${valuesBlock(spawnRows)};`,
    "",
  );

  const rules = r.migration_rules.map((rule) => [
    version, sqlText(rule.from_id), sqlText(rule.action), sqlNullableText(rule.to_id),
    sqlBool(rule.captured_value_required), sqlText(rule.notice_key), sqlNullableText(rule.equipped_action),
    sqlNullableText(rule.unequipped_action),
  ]);
  if (rules.length) lines.push(
    "INSERT INTO public.game_content_migration_rules",
    "  (content_version, from_id, action, to_id, captured_value_required, notice_key, equipped_action, unequipped_action)",
    `${valuesBlock(rules)};`,
    "",
  );
  lines.push(
    `SELECT public.game_assert_content_version(${version});`,
    "",
    "COMMIT;",
    "",
  );
  return lines.join("\n");
}

function dependencyGraph(manifest, hash, ids) {
  if (manifest.lifecycle === "draft") {
    const nodes = [
      ...ids.itemIds.map((id) => ({ id: `item:${id}`, type: "item", state: ids.retiredIds.includes(id) ? "retired" : "planned" })),
      ...ids.nodeKinds.map((id) => ({ id: `node:${id}`, type: "node", state: "planned" })),
      ...ids.monsterKinds.map((id) => ({ id: `monster:${id}`, type: "monster", state: "planned" })),
    ].sort((a, b) => a.id.localeCompare(b.id));
    return { content_version: manifest.content_version, manifest_hash: hash, runnable: false, nodes, edges: [] };
  }
  const r = manifest.runtime;
  const nodes = [];
  const edges = [];
  const addNode = (type, id, active = true) => nodes.push({ id: `${type}:${id}`, type, active });
  const addEdge = (from, relation, to) => edges.push({ from, relation, to });
  r.items.forEach((item) => addNode("item", item.id, item.active));
  r.recipes.forEach((recipe) => {
    addNode("recipe", recipe.id, recipe.active);
    addEdge(`recipe:${recipe.id}`, "produces", `item:${recipe.output_item_id}`);
    recipe.inputs.forEach((input) => addEdge(`item:${input.item_id}`, "input_to", `recipe:${recipe.id}`));
  });
  r.nodes.forEach((node) => {
    addNode("node", node.kind, node.active);
    addEdge(`node:${node.kind}`, "yields", `item:${node.item_id}`);
  });
  r.monsters.forEach((monster) => {
    addNode("monster", monster.kind, monster.active);
    monster.loot.forEach((drop) => addEdge(`monster:${monster.kind}`, drop.channel, `item:${drop.item_id}`));
  });
  r.fish.forEach((rule) => addEdge(`fish_rule:${rule.item_id}`, "yields", `item:${rule.item_id}`));
  r.fishing_spots.forEach((spot) => {
    addNode("fishing_spot", spot.id, spot.active);
    spot.fish_item_ids.forEach((id) => addEdge(`fishing_spot:${spot.id}`, "contains", `item:${id}`));
  });
  r.quests.forEach((quest) => {
    addNode("quest", quest.id, quest.active);
    addEdge(`quest:${quest.id}`, "targets", `${quest.kind === "kill" ? "monster" : "item"}:${quest.target_id}`);
    quest.reward_items.forEach((reward) => addEdge(`quest:${quest.id}`, "rewards", `item:${reward.item_id}`));
  });
  r.bosses.forEach((boss) => {
    addNode("boss", boss.id, boss.active);
    boss.rewards.forEach((reward) => addEdge(`boss:${boss.id}`, "rewards", `item:${reward.item_id}`));
  });
  r.migration_rules.forEach((rule) => {
    addNode("legacy_item", rule.from_id, false);
    if (rule.to_id) addEdge(`legacy_item:${rule.from_id}`, rule.action, `item:${rule.to_id}`);
  });
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => `${a.from}|${a.relation}|${a.to}`.localeCompare(`${b.from}|${b.relation}|${b.to}`));
  return { content_version: manifest.content_version, manifest_hash: hash, runnable: true, nodes, edges };
}

function spawnManifest(manifest, hash) {
  if (manifest.lifecycle === "draft") {
    return {
      content_version: manifest.content_version,
      manifest_hash: hash,
      runnable: false,
      spawn_set_version: manifest.spawn_set_version,
      uuid_namespace: manifest.uuid_namespace,
      spawns: [],
    };
  }
  const rows = [
    ...manifest.runtime.node_spawns.map((spawn) => ({ ...spawn, entity_type: "node" })),
    ...manifest.runtime.monster_spawns.map((spawn) => ({ ...spawn, entity_type: "monster" })),
  ].map((spawn) => {
    const identity = `${manifest.spawn_set_version}:${spawn.entity_type}:${spawn.kind}:${spawn.ordinal}`;
    return {
      spawn_id: uuidV5(manifest.uuid_namespace, identity),
      spawn_set_version: manifest.spawn_set_version,
      entity_type: spawn.entity_type,
      kind: spawn.kind,
      ordinal: spawn.ordinal,
      active: spawn.active,
      biome: spawn.biome,
      subzone: spawn.subzone,
      x: spawn.x,
      y: spawn.y,
    };
  });
  rows.sort((a, b) => a.spawn_id.localeCompare(b.spawn_id));
  return {
    content_version: manifest.content_version,
    manifest_hash: hash,
    runnable: true,
    spawn_set_version: manifest.spawn_set_version,
    uuid_namespace: manifest.uuid_namespace,
    spawns: rows,
  };
}

export function generateRuntimeOutputs(manifest, lockedRegistry) {
  if (manifest.lifecycle !== "runtime") {
    throw new Error(`Refusing runtime generation for ${manifest.lifecycle ?? "unknown"} manifest ${manifest.content_version ?? "unknown"}`);
  }
  validateManifest(manifest, lockedRegistry);
  return generateOutputs(manifest, lockedRegistry);
}

export function generateOutputs(manifest, lockedRegistry) {
  const validation = validateManifest(manifest, lockedRegistry);
  const hash = validation.hash;
  if (!SHA256.test(hash)) throw new Error("Internal manifest hash failure");
  const ids = manifest.lifecycle === "runtime" ? runtimeIds(manifest) : draftIds(manifest);
  const graph = dependencyGraph(manifest, hash, ids);
  const spawns = spawnManifest(manifest, hash);
  return {
    hash,
    files: {
      [OUTPUT_PATHS.client]: generateClient(manifest, hash, ids),
      [OUTPUT_PATHS.sql]: manifest.lifecycle === "runtime" ? runtimeSql(manifest, hash) : draftSql(manifest, hash),
      [OUTPUT_PATHS.graph]: prettyCanonicalJson(graph),
      [OUTPUT_PATHS.spawns]: prettyCanonicalJson(spawns),
    },
  };
}

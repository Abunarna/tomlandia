-- Gate 4: additive, inactive canonical content contract.
--
-- This migration deliberately does not insert a v2 content version, change the
-- active game version, or modify any player save. Existing v1 definition tables
-- remain in place so current RPCs and rollback data are untouched. Gate 6 will
-- stage generated v2 rows in these versioned tables after Gate 5 is complete.

CREATE TABLE public.game_content_versions (
  content_version text PRIMARY KEY,
  spawn_set_version text NOT NULL,
  uuid_namespace uuid NOT NULL,
  manifest_hash text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  player_notice jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  CONSTRAINT game_content_versions_content_id_check
    CHECK (content_version ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_versions_spawn_id_check
    CHECK (spawn_set_version ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_versions_hash_check
    CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT game_content_versions_status_check
    CHECK (status IN ('draft', 'staged', 'active', 'retired')),
  CONSTRAINT game_content_versions_notice_check
    CHECK (jsonb_typeof(player_notice) = 'object'),
  CONSTRAINT game_content_versions_activation_check
    CHECK (status <> 'active' OR activated_at IS NOT NULL),
  UNIQUE (content_version, spawn_set_version)
);

CREATE UNIQUE INDEX game_content_versions_one_active_idx
  ON public.game_content_versions ((status))
  WHERE status = 'active';

CREATE TABLE public.game_content_tiers (
  content_version text NOT NULL REFERENCES public.game_content_versions(content_version) ON DELETE CASCADE,
  tier_index integer NOT NULL,
  level_requirement integer NOT NULL,
  theme text NOT NULL,
  palette jsonb NOT NULL,
  PRIMARY KEY (content_version, tier_index),
  UNIQUE (content_version, level_requirement),
  UNIQUE (content_version, tier_index, level_requirement),
  CONSTRAINT game_content_tiers_index_check CHECK (tier_index BETWEEN 1 AND 16),
  CONSTRAINT game_content_tiers_level_check CHECK (level_requirement BETWEEN 1 AND 150),
  CONSTRAINT game_content_tiers_theme_check CHECK (theme <> ''),
  CONSTRAINT game_content_tiers_palette_check CHECK (
    jsonb_typeof(palette) = 'object'
    AND palette ?& ARRAY['primary', 'secondary', 'accent']
    AND palette->>'primary' ~ '^#[0-9A-Fa-f]{6}$'
    AND palette->>'secondary' ~ '^#[0-9A-Fa-f]{6}$'
    AND palette->>'accent' ~ '^#[0-9A-Fa-f]{6}$'
  )
);

CREATE TABLE public.game_content_items (
  content_version text NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL,
  tier_index integer NOT NULL,
  level_requirement integer NOT NULL,
  kind text NOT NULL,
  family text NOT NULL,
  colour text NOT NULL,
  rarity text NOT NULL,
  tradable boolean NOT NULL,
  stackable boolean NOT NULL,
  value integer NOT NULL,
  equip_skill text,
  attack numeric NOT NULL,
  defense numeric NOT NULL,
  heal integer NOT NULL,
  speed numeric NOT NULL,
  dmg_boost numeric NOT NULL,
  boost_hits integer NOT NULL,
  PRIMARY KEY (content_version, id),
  FOREIGN KEY (content_version, tier_index, level_requirement)
    REFERENCES public.game_content_tiers(content_version, tier_index, level_requirement) ON DELETE CASCADE,
  CONSTRAINT game_content_items_id_check CHECK (id ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_items_name_check CHECK (name <> ''),
  CONSTRAINT game_content_items_kind_check
    CHECK (kind IN ('resource', 'material', 'weapon', 'armor', 'food', 'potion', 'trophy')),
  CONSTRAINT game_content_items_family_check CHECK (family ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_items_colour_check CHECK (colour ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT game_content_items_rarity_check
    CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  CONSTRAINT game_content_items_value_check CHECK (value >= 0),
  CONSTRAINT game_content_items_stats_check CHECK (
    attack >= 0 AND defense >= 0 AND heal >= 0 AND speed BETWEEN 0 AND 0.25
    AND dmg_boost >= 0 AND boost_hits >= 0
  ),
  CONSTRAINT game_content_items_equipment_check CHECK (
    (kind IN ('weapon', 'armor') AND NOT stackable AND equip_skill IS NOT NULL)
    OR (kind NOT IN ('weapon', 'armor') AND equip_skill IS NULL)
  ),
  CONSTRAINT game_content_items_equip_skill_check CHECK (
    equip_skill IS NULL OR equip_skill IN (
      'combat', 'mining', 'woodcutting', 'gathering', 'fishing',
      'cooking', 'alchemy', 'smithing', 'skinning', 'tailoring'
    )
  ),
  CONSTRAINT game_content_items_weapon_check CHECK (kind <> 'weapon' OR attack > 0),
  CONSTRAINT game_content_items_armor_check CHECK (kind <> 'armor' OR defense > 0),
  CONSTRAINT game_content_items_food_check CHECK (kind <> 'food' OR heal > 0),
  CONSTRAINT game_content_items_potion_check CHECK (kind <> 'potion' OR (dmg_boost > 0 AND boost_hits > 0))
);

CREATE TABLE public.game_content_recipes (
  content_version text NOT NULL,
  id text NOT NULL,
  active boolean NOT NULL,
  tier_index integer NOT NULL,
  level_requirement integer NOT NULL,
  station text NOT NULL,
  skill text NOT NULL,
  output_item_id text NOT NULL,
  output_qty integer NOT NULL,
  xp integer NOT NULL,
  time_s numeric NOT NULL,
  PRIMARY KEY (content_version, id),
  FOREIGN KEY (content_version, tier_index, level_requirement)
    REFERENCES public.game_content_tiers(content_version, tier_index, level_requirement) ON DELETE CASCADE,
  FOREIGN KEY (content_version, output_item_id)
    REFERENCES public.game_content_items(content_version, id),
  CONSTRAINT game_content_recipes_id_check CHECK (id ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_recipes_station_check
    CHECK (station IN ('smelt', 'forge', 'weave', 'armor', 'skin', 'cook', 'alchemy')),
  CONSTRAINT game_content_recipes_skill_check
    CHECK (skill IN ('smithing', 'tailoring', 'skinning', 'cooking', 'alchemy')),
  CONSTRAINT game_content_recipes_station_skill_check CHECK (
    (station IN ('smelt', 'forge', 'armor') AND skill = 'smithing')
    OR (station = 'weave' AND skill = 'tailoring')
    OR (station = 'skin' AND skill = 'skinning')
    OR (station = 'cook' AND skill = 'cooking')
    OR (station = 'alchemy' AND skill = 'alchemy')
  ),
  CONSTRAINT game_content_recipes_canonical_id_check CHECK (id = station || '_' || output_item_id),
  CONSTRAINT game_content_recipes_output_qty_check CHECK (output_qty > 0),
  CONSTRAINT game_content_recipes_xp_check CHECK (xp >= 0),
  CONSTRAINT game_content_recipes_time_check CHECK (time_s > 0)
);

CREATE TABLE public.game_content_recipe_inputs (
  content_version text NOT NULL,
  recipe_id text NOT NULL,
  item_id text NOT NULL,
  qty integer NOT NULL,
  PRIMARY KEY (content_version, recipe_id, item_id),
  FOREIGN KEY (content_version, recipe_id)
    REFERENCES public.game_content_recipes(content_version, id) ON DELETE CASCADE,
  FOREIGN KEY (content_version, item_id)
    REFERENCES public.game_content_items(content_version, id),
  CONSTRAINT game_content_recipe_inputs_qty_check CHECK (qty > 0)
);

CREATE TABLE public.game_content_nodes (
  content_version text NOT NULL,
  kind text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL,
  tier_index integer NOT NULL,
  level_requirement integer NOT NULL,
  skill text NOT NULL,
  item_id text NOT NULL,
  xp integer NOT NULL,
  gather_s numeric NOT NULL,
  respawn_s integer NOT NULL,
  max_charges integer NOT NULL,
  family text NOT NULL,
  colour text NOT NULL,
  visual_key text NOT NULL,
  PRIMARY KEY (content_version, kind),
  FOREIGN KEY (content_version, tier_index, level_requirement)
    REFERENCES public.game_content_tiers(content_version, tier_index, level_requirement) ON DELETE CASCADE,
  FOREIGN KEY (content_version, item_id)
    REFERENCES public.game_content_items(content_version, id),
  CONSTRAINT game_content_nodes_kind_check CHECK (kind ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_nodes_name_check CHECK (name <> ''),
  CONSTRAINT game_content_nodes_skill_check
    CHECK (skill IN ('mining', 'woodcutting', 'gathering')),
  CONSTRAINT game_content_nodes_xp_check CHECK (xp >= 0),
  CONSTRAINT game_content_nodes_time_check CHECK (gather_s > 0 AND respawn_s > 0),
  CONSTRAINT game_content_nodes_charges_check CHECK (max_charges > 0),
  CONSTRAINT game_content_nodes_family_check CHECK (family ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_nodes_colour_check CHECK (colour ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT game_content_nodes_visual_check CHECK (visual_key ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$')
);

CREATE TABLE public.game_content_monsters (
  content_version text NOT NULL,
  kind text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL,
  tier_index integer NOT NULL,
  level_requirement integer NOT NULL,
  hp integer NOT NULL,
  attack integer NOT NULL,
  defense integer NOT NULL,
  xp integer NOT NULL,
  gold_min integer NOT NULL,
  gold_max integer NOT NULL,
  respawn_s integer NOT NULL,
  visual_key text NOT NULL,
  PRIMARY KEY (content_version, kind),
  FOREIGN KEY (content_version, tier_index, level_requirement)
    REFERENCES public.game_content_tiers(content_version, tier_index, level_requirement) ON DELETE CASCADE,
  CONSTRAINT game_content_monsters_kind_check CHECK (kind ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_monsters_name_check CHECK (name <> ''),
  CONSTRAINT game_content_monsters_stats_check
    CHECK (hp > 0 AND attack >= 0 AND defense >= 0 AND xp >= 0 AND respawn_s > 0),
  CONSTRAINT game_content_monsters_gold_check CHECK (gold_min >= 0 AND gold_max >= gold_min),
  CONSTRAINT game_content_monsters_visual_check CHECK (visual_key ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$')
);

CREATE TABLE public.game_content_monster_loot (
  content_version text NOT NULL,
  monster_kind text NOT NULL,
  ordinal integer NOT NULL,
  item_id text NOT NULL,
  chance numeric NOT NULL,
  qty_min integer NOT NULL,
  qty_max integer NOT NULL,
  channel text NOT NULL,
  xp integer NOT NULL,
  PRIMARY KEY (content_version, monster_kind, ordinal),
  FOREIGN KEY (content_version, monster_kind)
    REFERENCES public.game_content_monsters(content_version, kind) ON DELETE CASCADE,
  FOREIGN KEY (content_version, item_id)
    REFERENCES public.game_content_items(content_version, id),
  CONSTRAINT game_content_monster_loot_ordinal_check CHECK (ordinal >= 0),
  CONSTRAINT game_content_monster_loot_chance_check CHECK (chance BETWEEN 0 AND 1),
  CONSTRAINT game_content_monster_loot_qty_check CHECK (qty_min > 0 AND qty_max >= qty_min),
  CONSTRAINT game_content_monster_loot_channel_check CHECK (channel IN ('drop', 'hide')),
  CONSTRAINT game_content_monster_loot_xp_check CHECK (xp >= 0)
);

CREATE TABLE public.game_content_fish (
  content_version text NOT NULL,
  item_id text NOT NULL,
  active boolean NOT NULL,
  tier_index integer NOT NULL,
  level_requirement integer NOT NULL,
  xp integer NOT NULL,
  weights jsonb NOT NULL,
  PRIMARY KEY (content_version, item_id),
  FOREIGN KEY (content_version, tier_index, level_requirement)
    REFERENCES public.game_content_tiers(content_version, tier_index, level_requirement) ON DELETE CASCADE,
  FOREIGN KEY (content_version, item_id)
    REFERENCES public.game_content_items(content_version, id),
  CONSTRAINT game_content_fish_xp_check CHECK (xp >= 0),
  CONSTRAINT game_content_fish_weights_check
    CHECK (jsonb_typeof(weights) = 'array' AND jsonb_array_length(weights) > 0)
);

CREATE TABLE public.game_content_fishing_spots (
  content_version text NOT NULL REFERENCES public.game_content_versions(content_version) ON DELETE CASCADE,
  id text NOT NULL,
  active boolean NOT NULL,
  biome text NOT NULL,
  subzone text NOT NULL,
  x numeric NOT NULL,
  y numeric NOT NULL,
  fish_item_ids jsonb NOT NULL,
  PRIMARY KEY (content_version, id),
  CONSTRAINT game_content_fishing_spots_id_check CHECK (id ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_fishing_spots_owner_check CHECK (
    biome ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
    AND subzone ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
  ),
  CONSTRAINT game_content_fishing_spots_position_check CHECK (x >= 0 AND y >= 0),
  CONSTRAINT game_content_fishing_spots_fish_check
    CHECK (jsonb_typeof(fish_item_ids) = 'array' AND jsonb_array_length(fish_item_ids) > 0)
);

CREATE TABLE public.game_content_quests (
  content_version text NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL,
  tier_index integer NOT NULL,
  level_requirement integer NOT NULL,
  kind text NOT NULL,
  target_id text NOT NULL,
  count integer NOT NULL,
  gold integer NOT NULL,
  xp_skill text NOT NULL,
  xp integer NOT NULL,
  reward_items jsonb NOT NULL,
  PRIMARY KEY (content_version, id),
  FOREIGN KEY (content_version, tier_index, level_requirement)
    REFERENCES public.game_content_tiers(content_version, tier_index, level_requirement) ON DELETE CASCADE,
  CONSTRAINT game_content_quests_id_check CHECK (id ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_quests_name_check CHECK (name <> ''),
  CONSTRAINT game_content_quests_kind_check CHECK (kind IN ('kill', 'gather')),
  CONSTRAINT game_content_quests_target_check CHECK (target_id ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_quests_count_check CHECK (count > 0),
  CONSTRAINT game_content_quests_xp_skill_check CHECK (
    xp_skill IN (
      'combat', 'mining', 'woodcutting', 'gathering', 'fishing',
      'cooking', 'alchemy', 'smithing', 'skinning', 'tailoring'
    )
  ),
  CONSTRAINT game_content_quests_rewards_check CHECK (
    gold >= 0 AND xp >= 0 AND jsonb_typeof(reward_items) = 'array'
  )
);

CREATE TABLE public.game_content_bosses (
  content_version text NOT NULL REFERENCES public.game_content_versions(content_version) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL,
  level_requirement integer NOT NULL,
  hp integer NOT NULL,
  attack integer NOT NULL,
  defense integer NOT NULL,
  respawn_s integer NOT NULL,
  visual_key text NOT NULL,
  rewards jsonb NOT NULL,
  PRIMARY KEY (content_version, id),
  CONSTRAINT game_content_bosses_id_check CHECK (id ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_bosses_name_check CHECK (name <> ''),
  CONSTRAINT game_content_bosses_level_check CHECK (level_requirement BETWEEN 1 AND 150),
  CONSTRAINT game_content_bosses_stats_check CHECK (hp > 0 AND attack >= 0 AND defense >= 0 AND respawn_s > 0),
  CONSTRAINT game_content_bosses_visual_check CHECK (visual_key ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_bosses_rewards_check
    CHECK (jsonb_typeof(rewards) = 'array' AND jsonb_array_length(rewards) > 0)
);

CREATE TABLE public.game_content_spawns (
  spawn_id uuid PRIMARY KEY,
  content_version text NOT NULL,
  spawn_set_version text NOT NULL,
  entity_type text NOT NULL,
  kind text NOT NULL,
  ordinal integer NOT NULL,
  active boolean NOT NULL,
  biome text NOT NULL,
  subzone text NOT NULL,
  x numeric NOT NULL,
  y numeric NOT NULL,
  FOREIGN KEY (content_version, spawn_set_version)
    REFERENCES public.game_content_versions(content_version, spawn_set_version) ON DELETE CASCADE,
  UNIQUE (spawn_set_version, entity_type, kind, ordinal),
  CONSTRAINT game_content_spawns_type_check CHECK (entity_type IN ('node', 'monster')),
  CONSTRAINT game_content_spawns_kind_check CHECK (kind ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_spawns_ordinal_check CHECK (ordinal >= 0),
  CONSTRAINT game_content_spawns_owner_check CHECK (
    biome ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
    AND subzone ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
  ),
  CONSTRAINT game_content_spawns_position_check CHECK (x >= 0 AND y >= 0)
);

CREATE INDEX game_content_spawns_owner_idx
  ON public.game_content_spawns (spawn_set_version, biome, subzone, entity_type);

CREATE TABLE public.game_content_migration_rules (
  content_version text NOT NULL REFERENCES public.game_content_versions(content_version) ON DELETE CASCADE,
  from_id text NOT NULL,
  action text NOT NULL,
  to_id text,
  captured_value_required boolean NOT NULL,
  notice_key text NOT NULL,
  PRIMARY KEY (content_version, from_id),
  CONSTRAINT game_content_migration_rules_from_check CHECK (from_id ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  CONSTRAINT game_content_migration_rules_action_check CHECK (action IN ('retain', 'replace', 'compensate', 'stop')),
  CONSTRAINT game_content_migration_rules_to_check CHECK (
    (action = 'replace' AND to_id IS NOT NULL)
    OR (action <> 'replace' AND to_id IS NULL)
  ),
  CONSTRAINT game_content_migration_rules_notice_check CHECK (notice_key ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$')
);

CREATE TABLE public.game_content_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  active_content_version text NOT NULL,
  active_spawn_set_version text NOT NULL,
  minimum_client_content_version text NOT NULL,
  maintenance_mode boolean NOT NULL,
  maintenance_message text NOT NULL,
  manifest_hash text NOT NULL,
  activation_timestamp timestamptz NOT NULL,
  migration_run_id text NOT NULL,
  FOREIGN KEY (active_content_version, active_spawn_set_version)
    REFERENCES public.game_content_versions(content_version, spawn_set_version),
  FOREIGN KEY (minimum_client_content_version)
    REFERENCES public.game_content_versions(content_version),
  CONSTRAINT game_content_control_message_check CHECK (
    (maintenance_mode AND maintenance_message <> '') OR (NOT maintenance_mode)
  ),
  CONSTRAINT game_content_control_hash_check CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT game_content_control_run_check CHECK (migration_run_id <> '')
);

-- Historical marketplace rows are explicitly v1. The composite price key
-- prevents a changed in-place v2 item from inheriting a v1 recommendation.
ALTER TABLE public.market_listings
  ADD COLUMN content_version text NOT NULL DEFAULT 'v1';
ALTER TABLE public.market_trades
  ADD COLUMN content_version text NOT NULL DEFAULT 'v1';
ALTER TABLE public.market_prices
  ADD COLUMN content_version text NOT NULL DEFAULT 'v1';

ALTER TABLE public.market_listings
  ADD CONSTRAINT market_listings_content_version_check
  CHECK (content_version ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  ADD CONSTRAINT market_listings_plus_v2_check CHECK (plus BETWEEN 0 AND 100);
ALTER TABLE public.market_trades
  ADD CONSTRAINT market_trades_content_version_check
  CHECK (content_version ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  ADD CONSTRAINT market_trades_plus_v2_check CHECK (plus BETWEEN 0 AND 100);
ALTER TABLE public.market_prices
  ADD CONSTRAINT market_prices_content_version_check
  CHECK (content_version ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  ADD CONSTRAINT market_prices_plus_v2_check CHECK (plus BETWEEN 0 AND 100);

ALTER TABLE public.market_prices DROP CONSTRAINT market_prices_pkey;
ALTER TABLE public.market_prices
  ADD CONSTRAINT market_prices_pkey PRIMARY KEY (content_version, item_id, plus);

CREATE INDEX market_listings_version_item_idx
  ON public.market_listings (content_version, item_id);
CREATE INDEX market_trades_version_item_created_idx
  ON public.market_trades (content_version, item_id, created_at DESC);

-- Deferred cross-entity validation catches polymorphic/JSON references that
-- cannot be represented by ordinary foreign keys. It returns every problem so
-- staging can be corrected in one pass.
CREATE OR REPLACE FUNCTION public.game_validate_content_version(_content_version text)
RETURNS TABLE(issue_code text, reference_path text, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier_pairs jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.game_content_versions v
    WHERE v.content_version = _content_version
  ) THEN
    RETURN QUERY SELECT
      'missing_content_version'::text,
      'game_content_versions'::text,
      format('Unknown content version: %s', _content_version);
    RETURN;
  END IF;

  SELECT jsonb_agg(jsonb_build_array(t.tier_index, t.level_requirement, t.theme) ORDER BY t.tier_index)
    INTO tier_pairs
  FROM public.game_content_tiers t
  WHERE t.content_version = _content_version;

  IF tier_pairs IS DISTINCT FROM
    '[[1,1,"Copper"],[2,10,"Bronze"],[3,20,"Iron"],[4,30,"Steel"],[5,40,"Mithril"],[6,50,"Sunsteel"],[7,60,"Runite"],[8,70,"Shadowsteel"],[9,80,"Froststeel"],[10,90,"Wyrmsteel"],[11,100,"Glacial"],[12,110,"Starsteel"],[13,120,"Voidsteel"],[14,130,"Wyrmforged"],[15,140,"Ancient"],[16,150,"Ascendant"]]'::jsonb
  THEN
    RETURN QUERY SELECT
      'tier_registry_mismatch'::text,
      'game_content_tiers'::text,
      'Expected the locked 16 tier_index/level_requirement/theme records'::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_content_versions v
    WHERE v.content_version = _content_version AND NOT (
      v.player_notice ?& ARRAY['title', 'summary', 'details']
      AND jsonb_typeof(v.player_notice->'title') = 'string'
      AND v.player_notice->>'title' <> ''
      AND jsonb_typeof(v.player_notice->'summary') = 'string'
      AND v.player_notice->>'summary' <> ''
      AND jsonb_typeof(v.player_notice->'details') = 'array'
      AND jsonb_array_length(v.player_notice->'details') > 0
    )
  ) THEN
    RETURN QUERY SELECT
      'invalid_player_notice'::text,
      'game_content_versions.player_notice'::text,
      'Player notice requires non-empty title, summary and details'::text;
  END IF;

  RETURN QUERY
  SELECT 'missing_entity_category', category, 'Runtime categories may not be empty'
  FROM (VALUES
    ('items', (SELECT count(*) FROM public.game_content_items WHERE content_version = _content_version)),
    ('recipes', (SELECT count(*) FROM public.game_content_recipes WHERE content_version = _content_version)),
    ('nodes', (SELECT count(*) FROM public.game_content_nodes WHERE content_version = _content_version)),
    ('monsters', (SELECT count(*) FROM public.game_content_monsters WHERE content_version = _content_version)),
    ('fish', (SELECT count(*) FROM public.game_content_fish WHERE content_version = _content_version)),
    ('fishing_spots', (SELECT count(*) FROM public.game_content_fishing_spots WHERE content_version = _content_version)),
    ('quests', (SELECT count(*) FROM public.game_content_quests WHERE content_version = _content_version)),
    ('bosses', (SELECT count(*) FROM public.game_content_bosses WHERE content_version = _content_version)),
    ('node_spawns', (SELECT count(*) FROM public.game_content_spawns WHERE content_version = _content_version AND entity_type = 'node')),
    ('monster_spawns', (SELECT count(*) FROM public.game_content_spawns WHERE content_version = _content_version AND entity_type = 'monster')),
    ('migration_rules', (SELECT count(*) FROM public.game_content_migration_rules WHERE content_version = _content_version))
  ) AS required_categories(category, row_count)
  WHERE row_count = 0;

  RETURN QUERY
  SELECT 'invalid_fish_weight', format('fish:%s.weights', f.item_id), 'Each weight requires numeric level 1..150 and weight 0..1'
  FROM public.game_content_fish f
  WHERE f.content_version = _content_version AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(f.weights) weight(value)
    WHERE jsonb_typeof(weight.value) <> 'object'
      OR NOT (weight.value ?& ARRAY['level', 'weight'])
      OR jsonb_typeof(weight.value->'level') <> 'number'
      OR jsonb_typeof(weight.value->'weight') <> 'number'
      OR CASE
        WHEN jsonb_typeof(weight.value->'level') = 'number'
         AND jsonb_typeof(weight.value->'weight') = 'number'
        THEN (weight.value->>'level')::numeric NOT BETWEEN 1 AND 150
          OR (weight.value->>'weight')::numeric NOT BETWEEN 0 AND 1
        ELSE false
      END
  )
  UNION ALL
  SELECT 'invalid_fishing_spot_items', format('fishing_spot:%s.fish_item_ids', s.id), 'Fish IDs must be strings'
  FROM public.game_content_fishing_spots s
  WHERE s.content_version = _content_version AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(s.fish_item_ids) fish(value)
    WHERE jsonb_typeof(fish.value) <> 'string'
  )
  UNION ALL
  SELECT 'invalid_quest_reward', format('quest:%s.reward_items', q.id), 'Rewards require string item_id and positive integer qty'
  FROM public.game_content_quests q
  WHERE q.content_version = _content_version AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(q.reward_items) reward(value)
    WHERE jsonb_typeof(reward.value) <> 'object'
      OR NOT (reward.value ?& ARRAY['item_id', 'qty'])
      OR jsonb_typeof(reward.value->'item_id') <> 'string'
      OR jsonb_typeof(reward.value->'qty') <> 'number'
      OR CASE WHEN jsonb_typeof(reward.value->'qty') = 'number'
        THEN (reward.value->>'qty')::numeric <= 0 ELSE false END
  )
  UNION ALL
  SELECT 'invalid_boss_reward', format('boss:%s.rewards', b.id), 'Rewards require item, chance and positive quantity range'
  FROM public.game_content_bosses b
  WHERE b.content_version = _content_version AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(b.rewards) reward(value)
    WHERE jsonb_typeof(reward.value) <> 'object'
      OR NOT (reward.value ?& ARRAY['item_id', 'chance', 'qty_min', 'qty_max'])
      OR jsonb_typeof(reward.value->'item_id') <> 'string'
      OR jsonb_typeof(reward.value->'chance') <> 'number'
      OR jsonb_typeof(reward.value->'qty_min') <> 'number'
      OR jsonb_typeof(reward.value->'qty_max') <> 'number'
      OR CASE
        WHEN jsonb_typeof(reward.value->'chance') = 'number'
         AND jsonb_typeof(reward.value->'qty_min') = 'number'
         AND jsonb_typeof(reward.value->'qty_max') = 'number'
        THEN (reward.value->>'chance')::numeric NOT BETWEEN 0 AND 1
          OR (reward.value->>'qty_min')::numeric <= 0
          OR (reward.value->>'qty_max')::numeric < (reward.value->>'qty_min')::numeric
        ELSE false
      END
  );

  RETURN QUERY
  SELECT 'inactive_recipe_output', format('recipe:%s.output_item_id', r.id), r.output_item_id
  FROM public.game_content_recipes r
  LEFT JOIN public.game_content_items i
    ON i.content_version = r.content_version AND i.id = r.output_item_id AND i.active
  WHERE r.content_version = _content_version AND r.active AND i.id IS NULL
  UNION ALL
  SELECT 'inactive_recipe_input', format('recipe:%s.input:%s', ri.recipe_id, ri.item_id), ri.item_id
  FROM public.game_content_recipe_inputs ri
  JOIN public.game_content_recipes r
    ON r.content_version = ri.content_version AND r.id = ri.recipe_id AND r.active
  LEFT JOIN public.game_content_items i
    ON i.content_version = ri.content_version AND i.id = ri.item_id AND i.active
  WHERE ri.content_version = _content_version AND i.id IS NULL
  UNION ALL
  SELECT 'inactive_node_item', format('node:%s.item_id', n.kind), n.item_id
  FROM public.game_content_nodes n
  LEFT JOIN public.game_content_items i
    ON i.content_version = n.content_version AND i.id = n.item_id AND i.active
  WHERE n.content_version = _content_version AND n.active AND i.id IS NULL
  UNION ALL
  SELECT 'inactive_monster_loot', format('monster:%s.loot:%s', l.monster_kind, l.ordinal), l.item_id
  FROM public.game_content_monster_loot l
  JOIN public.game_content_monsters m
    ON m.content_version = l.content_version AND m.kind = l.monster_kind AND m.active
  LEFT JOIN public.game_content_items i
    ON i.content_version = l.content_version AND i.id = l.item_id AND i.active
  WHERE l.content_version = _content_version AND i.id IS NULL
  UNION ALL
  SELECT 'inactive_fish_item', format('fish:%s', f.item_id), f.item_id
  FROM public.game_content_fish f
  LEFT JOIN public.game_content_items i
    ON i.content_version = f.content_version AND i.id = f.item_id AND i.active
  WHERE f.content_version = _content_version AND f.active AND i.id IS NULL
  UNION ALL
  SELECT 'inactive_spot_fish', format('fishing_spot:%s.fish:%s', s.id, fish.value #>> '{}'), fish.value #>> '{}'
  FROM public.game_content_fishing_spots s
  CROSS JOIN LATERAL jsonb_array_elements(s.fish_item_ids) fish(value)
  LEFT JOIN public.game_content_fish f
    ON f.content_version = s.content_version AND f.item_id = fish.value #>> '{}' AND f.active
  WHERE s.content_version = _content_version AND s.active AND f.item_id IS NULL
  UNION ALL
  SELECT 'inactive_quest_target', format('quest:%s.target_id', q.id), q.target_id
  FROM public.game_content_quests q
  WHERE q.content_version = _content_version AND q.active AND (
    (q.kind = 'kill' AND NOT EXISTS (
      SELECT 1 FROM public.game_content_monsters m
      WHERE m.content_version = q.content_version AND m.kind = q.target_id AND m.active
    ))
    OR (q.kind = 'gather' AND NOT EXISTS (
      SELECT 1 FROM public.game_content_items i
      WHERE i.content_version = q.content_version AND i.id = q.target_id AND i.active
    ))
  )
  UNION ALL
  SELECT 'inactive_quest_reward', format('quest:%s.reward:%s', q.id, reward.value->>'item_id'), reward.value->>'item_id'
  FROM public.game_content_quests q
  CROSS JOIN LATERAL jsonb_array_elements(q.reward_items) reward(value)
  LEFT JOIN public.game_content_items i
    ON i.content_version = q.content_version AND i.id = reward.value->>'item_id' AND i.active
  WHERE q.content_version = _content_version AND q.active AND i.id IS NULL
  UNION ALL
  SELECT 'inactive_boss_reward', format('boss:%s.reward:%s', b.id, reward.value->>'item_id'), reward.value->>'item_id'
  FROM public.game_content_bosses b
  CROSS JOIN LATERAL jsonb_array_elements(b.rewards) reward(value)
  LEFT JOIN public.game_content_items i
    ON i.content_version = b.content_version AND i.id = reward.value->>'item_id' AND i.active
  WHERE b.content_version = _content_version AND b.active AND i.id IS NULL
  UNION ALL
  SELECT 'inactive_migration_target', format('migration:%s.to_id', mr.from_id), mr.to_id
  FROM public.game_content_migration_rules mr
  LEFT JOIN public.game_content_items i
    ON i.content_version = mr.content_version AND i.id = mr.to_id AND i.active
  WHERE mr.content_version = _content_version AND mr.action = 'replace' AND i.id IS NULL
  UNION ALL
  SELECT 'inactive_node_spawn', format('spawn:%s', s.spawn_id), s.kind
  FROM public.game_content_spawns s
  LEFT JOIN public.game_content_nodes n
    ON n.content_version = s.content_version AND n.kind = s.kind AND n.active
  WHERE s.content_version = _content_version AND s.active AND s.entity_type = 'node' AND n.kind IS NULL
  UNION ALL
  SELECT 'inactive_monster_spawn', format('spawn:%s', s.spawn_id), s.kind
  FROM public.game_content_spawns s
  LEFT JOIN public.game_content_monsters m
    ON m.content_version = s.content_version AND m.kind = s.kind AND m.active
  WHERE s.content_version = _content_version AND s.active AND s.entity_type = 'monster' AND m.kind IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_assert_content_version(_content_version text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  violation record;
BEGIN
  SELECT * INTO violation
  FROM public.game_validate_content_version(_content_version)
  ORDER BY issue_code, reference_path
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format(
        'content_integrity_violation [%s] %s: %s',
        violation.issue_code,
        violation.reference_path,
        violation.detail
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_guard_content_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM public.game_assert_content_version(NEW.content_version);
    NEW.activated_at := coalesce(NEW.activated_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER game_content_versions_activation_guard
BEFORE INSERT OR UPDATE OF status ON public.game_content_versions
FOR EACH ROW EXECUTE FUNCTION public.game_guard_content_activation();

CREATE OR REPLACE FUNCTION public.game_guard_content_control()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected public.game_content_versions%ROWTYPE;
BEGIN
  SELECT * INTO selected
  FROM public.game_content_versions v
  WHERE v.content_version = NEW.active_content_version;
  IF NOT FOUND OR selected.status <> 'active' THEN
    RAISE EXCEPTION 'Active content control requires a validated active version';
  END IF;
  IF selected.spawn_set_version <> NEW.active_spawn_set_version THEN
    RAISE EXCEPTION 'Active spawn set does not belong to the selected content version';
  END IF;
  IF selected.manifest_hash <> NEW.manifest_hash THEN
    RAISE EXCEPTION 'Control hash does not match the selected content version';
  END IF;
  PERFORM public.game_assert_content_version(NEW.active_content_version);
  RETURN NEW;
END;
$$;

CREATE TRIGGER game_content_control_guard
BEFORE INSERT OR UPDATE ON public.game_content_control
FOR EACH ROW EXECUTE FUNCTION public.game_guard_content_control();

-- Version-aware settlement for the legacy v1 market. It propagates the
-- listing version into trade/price history and fails closed for any staged v2
-- listing until the version-aware v2 action layer is deployed in a later gate.
CREATE OR REPLACE FUNCTION public.market_buy(_id uuid, _qty integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); listing public.market_listings%ROWTYPE; definition public.game_items%ROWTYPE;
  buyer_data jsonb; seller_data jsonb; next_inv jsonb; wanted integer;
  gross numeric; fee numeric; payout numeric; buyer_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.market_expire();
  SELECT * INTO listing FROM public.market_listings WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'gone'); END IF;
  IF listing.content_version <> 'v1' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_content_version');
  END IF;
  IF listing.seller_id = uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'own_listing'); END IF;
  SELECT * INTO definition FROM public.game_items WHERE id = listing.item_id;
  IF NOT FOUND OR definition.untradable THEN RETURN jsonb_build_object('ok', false, 'reason', 'untradable'); END IF;
  IF listing.plus < 0 OR listing.plus > 100 OR (definition.stackable AND listing.plus <> 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_listing');
  END IF;
  IF NOT definition.stackable AND listing.qty <> 1 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_listing'); END IF;

  wanted := least(greatest(coalesce(_qty, 1), 1), listing.qty);
  IF NOT definition.stackable THEN wanted := 1; END IF;
  gross := listing.price::numeric * wanted::numeric;
  IF gross <= 0 OR gross > 1000000000000::numeric THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_total'); END IF;
  fee := ceil(gross * 0.05);
  payout := gross - fee;

  PERFORM 1 FROM public.player_saves
  WHERE user_id IN (uid, listing.seller_id)
  ORDER BY user_id
  FOR UPDATE;
  SELECT data INTO buyer_data FROM public.player_saves WHERE user_id = uid;
  SELECT data INTO seller_data FROM public.player_saves WHERE user_id = listing.seller_id;
  IF buyer_data IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  IF seller_data IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'seller_missing'); END IF;
  IF coalesce((buyer_data->>'gold')::numeric, 0) < gross THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'poor', 'need', gross);
  END IF;
  next_inv := public.mk_inv_give(buyer_data->'inv', listing.item_id, listing.plus, wanted);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;

  buyer_data := jsonb_set(buyer_data, '{inv}', next_inv, true);
  buyer_data := jsonb_set(buyer_data, '{gold}', to_jsonb((buyer_data->>'gold')::numeric - gross), true);
  seller_data := jsonb_set(seller_data, '{gold}', to_jsonb(coalesce((seller_data->>'gold')::numeric, 0) + payout), true);
  UPDATE public.player_saves SET data = buyer_data, updated_at = now() WHERE user_id = uid;
  UPDATE public.player_saves SET data = seller_data, updated_at = now() WHERE user_id = listing.seller_id;

  IF wanted >= listing.qty THEN DELETE FROM public.market_listings WHERE id = _id;
  ELSE UPDATE public.market_listings SET qty = qty - wanted, updated_at = now() WHERE id = _id;
  END IF;
  buyer_name := public.market_player_name(uid);
  INSERT INTO public.market_trades (content_version, item_id, qty, price, plus, seller_name, buyer_name)
  VALUES (listing.content_version, listing.item_id, wanted, listing.price, listing.plus, listing.seller_name, buyer_name);
  INSERT INTO public.market_prices (content_version, item_id, plus, price, updated_at)
  VALUES (listing.content_version, listing.item_id, listing.plus, listing.price, now())
  ON CONFLICT (content_version, item_id, plus)
  DO UPDATE SET price = EXCLUDED.price, updated_at = now();
  DELETE FROM public.market_trades WHERE created_at < now() - interval '1 day';
  RETURN jsonb_build_object(
    'ok', true, 'spent', gross, 'item', listing.item_id, 'qty', wanted,
    'content_version', listing.content_version, 'state', public.pl_state(buyer_data)
  );
END $$;

REVOKE ALL ON FUNCTION public.market_buy(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_buy(uuid, integer) TO authenticated;

-- Canonical content is readable only for the single activated control version.
-- There is intentionally no control row in this migration, so v2 remains invisible.
ALTER TABLE public.game_content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_recipe_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_monsters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_monster_loot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_fish ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_fishing_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_bosses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_spawns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_migration_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_content_control ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.game_content_versions, public.game_content_tiers, public.game_content_items,
  public.game_content_recipes, public.game_content_recipe_inputs, public.game_content_nodes,
  public.game_content_monsters, public.game_content_monster_loot, public.game_content_fish,
  public.game_content_fishing_spots, public.game_content_quests, public.game_content_bosses,
  public.game_content_spawns, public.game_content_control TO authenticated;

GRANT ALL ON public.game_content_versions, public.game_content_tiers, public.game_content_items,
  public.game_content_recipes, public.game_content_recipe_inputs, public.game_content_nodes,
  public.game_content_monsters, public.game_content_monster_loot, public.game_content_fish,
  public.game_content_fishing_spots, public.game_content_quests, public.game_content_bosses,
  public.game_content_spawns, public.game_content_migration_rules, public.game_content_control TO service_role;

CREATE POLICY "Players can read the active content version"
  ON public.game_content_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.game_content_control c
    WHERE c.singleton AND c.active_content_version = game_content_versions.content_version
  ));
CREATE POLICY "Players can read content control"
  ON public.game_content_control FOR SELECT TO authenticated USING (true);
CREATE POLICY "Players can read active tiers"
  ON public.game_content_tiers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_tiers.content_version));
CREATE POLICY "Players can read active items"
  ON public.game_content_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_items.content_version));
CREATE POLICY "Players can read active recipes"
  ON public.game_content_recipes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_recipes.content_version));
CREATE POLICY "Players can read active recipe inputs"
  ON public.game_content_recipe_inputs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_recipe_inputs.content_version));
CREATE POLICY "Players can read active nodes"
  ON public.game_content_nodes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_nodes.content_version));
CREATE POLICY "Players can read active monsters"
  ON public.game_content_monsters FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_monsters.content_version));
CREATE POLICY "Players can read active monster loot"
  ON public.game_content_monster_loot FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_monster_loot.content_version));
CREATE POLICY "Players can read active fish"
  ON public.game_content_fish FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_fish.content_version));
CREATE POLICY "Players can read active fishing spots"
  ON public.game_content_fishing_spots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_fishing_spots.content_version));
CREATE POLICY "Players can read active quests"
  ON public.game_content_quests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_quests.content_version));
CREATE POLICY "Players can read active bosses"
  ON public.game_content_bosses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_content_control c WHERE c.active_content_version = game_content_bosses.content_version));
CREATE POLICY "Players can read active spawns"
  ON public.game_content_spawns FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.game_content_control c
    WHERE c.active_content_version = game_content_spawns.content_version
      AND c.active_spawn_set_version = game_content_spawns.spawn_set_version
  ));

REVOKE ALL ON FUNCTION public.game_validate_content_version(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_assert_content_version(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_guard_content_activation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_guard_content_control() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.game_validate_content_version(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.game_assert_content_version(text) TO service_role;

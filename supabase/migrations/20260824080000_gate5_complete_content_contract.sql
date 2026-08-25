-- Gate 5: extend the canonical content contract for the complete v2 manifest.
--
-- Gate 4 is immutable migration history. This additive migration supplies the
-- complete-content fields and replaces the generic validator with the
-- owner-approved Gate 3/Gate 5 contract. It inserts no content and does not
-- create or update the active control row.

ALTER TABLE public.game_content_versions
  ADD COLUMN starter_loadout jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN mechanics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT game_content_versions_starter_check
    CHECK (jsonb_typeof(starter_loadout) = 'object'),
  ADD CONSTRAINT game_content_versions_mechanics_check
    CHECK (jsonb_typeof(mechanics) = 'object');

ALTER TABLE public.game_content_items
  ADD COLUMN icon_key text NOT NULL,
  ADD CONSTRAINT game_content_items_icon_check
    CHECK (icon_key ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$');

ALTER TABLE public.game_content_nodes
  ADD COLUMN cluster_min integer NOT NULL,
  ADD COLUMN shape text NOT NULL,
  DROP CONSTRAINT game_content_nodes_charges_check,
  ADD CONSTRAINT game_content_nodes_charges_check
    CHECK (max_charges > 0 AND cluster_min > 0),
  ADD CONSTRAINT game_content_nodes_shape_check
    CHECK (shape IN ('rock', 'tree', 'bush'));

ALTER TABLE public.game_content_monsters
  ADD COLUMN visual jsonb NOT NULL,
  DROP CONSTRAINT game_content_monsters_visual_check,
  ADD CONSTRAINT game_content_monsters_visual_check CHECK (
    visual_key ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
    AND jsonb_typeof(visual) = 'object'
    AND visual ?& ARRAY[
      'asset_key', 'asset_path', 'source_sha256', 'padded_sha256', 'canvas', 'pivot',
      'visual_bounds', 'click_bounds', 'render_scale', 'ground_offset_y', 'motion_profile', 'fallback'
    ]
  );

ALTER TABLE public.game_content_quests
  ADD COLUMN description text NOT NULL,
  DROP CONSTRAINT game_content_quests_name_check,
  ADD CONSTRAINT game_content_quests_name_check
    CHECK (name <> '' AND description <> '');

ALTER TABLE public.game_content_bosses
  ADD COLUMN reward_mode text NOT NULL,
  ADD COLUMN target_contributors integer NOT NULL,
  ADD COLUMN minimum_damage integer NOT NULL,
  ADD COLUMN xp_pool integer NOT NULL,
  ADD COLUMN xp_per_player_cap integer NOT NULL,
  ADD COLUMN gold_pool_min integer NOT NULL,
  ADD COLUMN gold_pool_max integer NOT NULL,
  ADD COLUMN gold_per_player_cap_min integer NOT NULL,
  ADD COLUMN gold_per_player_cap_max integer NOT NULL,
  DROP CONSTRAINT game_content_bosses_rewards_check,
  ADD CONSTRAINT game_content_bosses_pool_check CHECK (
    reward_mode = 'fixed_pool_proportional_damage_with_per_player_cap'
    AND target_contributors > 0
    AND minimum_damage > 0 AND minimum_damage < hp
    AND xp_pool > 0 AND xp_per_player_cap * target_contributors = xp_pool
    AND gold_pool_min > 0 AND gold_pool_max >= gold_pool_min
    AND gold_per_player_cap_min > 0 AND gold_per_player_cap_max >= gold_per_player_cap_min
    AND gold_per_player_cap_min * target_contributors = gold_pool_min
    AND gold_per_player_cap_max * target_contributors = gold_pool_max
  ),
  ADD CONSTRAINT game_content_bosses_rewards_check
    CHECK (jsonb_typeof(rewards) = 'array');

ALTER TABLE public.game_content_recipes
  DROP CONSTRAINT game_content_recipes_station_skill_check,
  ADD CONSTRAINT game_content_recipes_station_skill_check CHECK (
    (station IN ('smelt', 'forge') AND skill = 'smithing')
    OR (station = 'armor' AND skill IN ('smithing', 'tailoring'))
    OR (station = 'weave' AND skill = 'tailoring')
    OR (station = 'skin' AND skill = 'skinning')
    OR (station = 'cook' AND skill = 'cooking')
    OR (station = 'alchemy' AND skill = 'alchemy')
  );

ALTER TABLE public.game_content_migration_rules
  ADD COLUMN equipped_action text,
  ADD COLUMN unequipped_action text,
  DROP CONSTRAINT game_content_migration_rules_action_check,
  DROP CONSTRAINT game_content_migration_rules_to_check,
  ADD CONSTRAINT game_content_migration_rules_action_check CHECK (
    action IN ('retain', 'replace', 'replace_or_compensate', 'compensate', 'stop')
  ),
  ADD CONSTRAINT game_content_migration_rules_to_check CHECK (
    (action IN ('replace', 'replace_or_compensate') AND to_id IS NOT NULL)
    OR (action NOT IN ('replace', 'replace_or_compensate') AND to_id IS NULL)
  ),
  ADD CONSTRAINT game_content_migration_rules_context_check CHECK (
    (action = 'replace_or_compensate'
      AND captured_value_required
      AND equipped_action = 'replace_preserve_plus'
      AND unequipped_action = 'compensate_captured_value')
    OR (action <> 'replace_or_compensate' AND equipped_action IS NULL AND unequipped_action IS NULL)
  );

-- Gate 4 bound entities to exact tier checkpoints. Gate 5 permits intentional
-- intermediate requirements (for example levels 25, 45 and 78) while retaining
-- the canonical tier band. Drop only those exact three-column foreign keys.
DO $gate5_drop_exact_tier_fks$
DECLARE
  target_table regclass;
  constraint_name text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'public.game_content_items'::regclass,
    'public.game_content_recipes'::regclass,
    'public.game_content_nodes'::regclass,
    'public.game_content_monsters'::regclass,
    'public.game_content_fish'::regclass,
    'public.game_content_quests'::regclass
  ]
  LOOP
    FOR constraint_name IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = target_table
        AND c.contype = 'f'
        AND pg_get_constraintdef(c.oid)
          LIKE 'FOREIGN KEY (content_version, tier_index, level_requirement)%'
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', target_table, constraint_name);
    END LOOP;
  END LOOP;
END
$gate5_drop_exact_tier_fks$;

ALTER TABLE public.game_content_items
  ADD CONSTRAINT game_content_items_tier_band_fkey
  FOREIGN KEY (content_version, tier_index)
  REFERENCES public.game_content_tiers(content_version, tier_index) ON DELETE CASCADE;
ALTER TABLE public.game_content_recipes
  ADD CONSTRAINT game_content_recipes_tier_band_fkey
  FOREIGN KEY (content_version, tier_index)
  REFERENCES public.game_content_tiers(content_version, tier_index) ON DELETE CASCADE;
ALTER TABLE public.game_content_nodes
  ADD CONSTRAINT game_content_nodes_tier_band_fkey
  FOREIGN KEY (content_version, tier_index)
  REFERENCES public.game_content_tiers(content_version, tier_index) ON DELETE CASCADE;
ALTER TABLE public.game_content_monsters
  ADD CONSTRAINT game_content_monsters_tier_band_fkey
  FOREIGN KEY (content_version, tier_index)
  REFERENCES public.game_content_tiers(content_version, tier_index) ON DELETE CASCADE;
ALTER TABLE public.game_content_fish
  ADD CONSTRAINT game_content_fish_tier_band_fkey
  FOREIGN KEY (content_version, tier_index)
  REFERENCES public.game_content_tiers(content_version, tier_index) ON DELETE CASCADE;
ALTER TABLE public.game_content_quests
  ADD CONSTRAINT game_content_quests_tier_band_fkey
  FOREIGN KEY (content_version, tier_index)
  REFERENCES public.game_content_tiers(content_version, tier_index) ON DELETE CASCADE;

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

  IF EXISTS (
    SELECT 1 FROM public.game_content_versions v
    WHERE v.content_version = _content_version
      AND v.starter_loadout IS DISTINCT FROM
        '{"weapon_item_id":"copper_sword","armor_item_id":"cloth_tunic","plus":0}'::jsonb
  ) THEN
    RETURN QUERY SELECT
      'invalid_starter_loadout'::text,
      'game_content_versions.starter_loadout'::text,
      'Starter loadout must be Copper Sword +0 and Cloth Tunic +0'::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_content_versions v
    WHERE v.content_version = _content_version AND NOT (
      v.mechanics ?& ARRAY[
        'approved_balance_model_hash', 'max_level', 'max_plus', 'market_fee_pct',
        'weapon_multiplier_rule', 'light_attack_multiplier_rule', 'defense_multiplier_rule',
        'upgrade_cost_rule', 'gear_resale_rule', 'fishing_xp_curve'
      ]
      AND v.mechanics->>'approved_balance_model_hash' = 'e1fbe19aac61014b38885ce38cd16d9a12e3852f24858301a2588c65fba4a640'
      AND v.mechanics->'max_level' = '150'::jsonb
      AND v.mechanics->'max_plus' = '100'::jsonb
      AND v.mechanics->'market_fee_pct' = '5'::jsonb
      AND v.mechanics->>'weapon_multiplier_rule' = '1 + 2% * min(plus, 50) + 0.5% * max(plus - 50, 0)'
      AND v.mechanics->>'light_attack_multiplier_rule' = '1 + 5% * min(plus, 20) + 1% * max(plus - 20, 0)'
      AND v.mechanics->>'defense_multiplier_rule' = '1 + 0.1% * plus'
      AND v.mechanics->>'upgrade_cost_rule' = 'round_to_5(max(25, item_value * (0.08 + 3.4 * sqrt(next_plus))))'
      AND v.mechanics->>'gear_resale_rule' = 'floor(item_value * 0.40 + cumulative_upgrade_spend * 0.15)'
      AND v.mechanics->'fishing_xp_curve' = '[
        {"tier_index":1,"level_requirement":1,"xp_per_action":3},
        {"tier_index":2,"level_requirement":10,"xp_per_action":6},
        {"tier_index":3,"level_requirement":20,"xp_per_action":17},
        {"tier_index":4,"level_requirement":30,"xp_per_action":40},
        {"tier_index":5,"level_requirement":40,"xp_per_action":102},
        {"tier_index":6,"level_requirement":50,"xp_per_action":331},
        {"tier_index":7,"level_requirement":60,"xp_per_action":588},
        {"tier_index":8,"level_requirement":70,"xp_per_action":660},
        {"tier_index":9,"level_requirement":80,"xp_per_action":753},
        {"tier_index":10,"level_requirement":90,"xp_per_action":844},
        {"tier_index":11,"level_requirement":100,"xp_per_action":935},
        {"tier_index":12,"level_requirement":110,"xp_per_action":1025},
        {"tier_index":13,"level_requirement":120,"xp_per_action":1113},
        {"tier_index":14,"level_requirement":130,"xp_per_action":1208},
        {"tier_index":15,"level_requirement":140,"xp_per_action":1312},
        {"tier_index":16,"level_requirement":150,"xp_per_action":1413}
      ]'::jsonb
    )
  ) THEN
    RETURN QUERY SELECT
      'invalid_mechanics'::text,
      'game_content_versions.mechanics'::text,
      'Mechanics must contain the approved model hash and complete level/upgrade/economy policy'::text;
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
  SELECT 'tier_band_mismatch', banded.reference_path, format('level %s belongs to tier %s, not tier %s', banded.level_requirement, banded.expected_tier, banded.tier_index)
  FROM (
    SELECT format('item:%s', id) AS reference_path, level_requirement, tier_index,
      least(16, level_requirement / 10 + 1) AS expected_tier
    FROM public.game_content_items WHERE content_version = _content_version
    UNION ALL
    SELECT format('recipe:%s', id), level_requirement, tier_index,
      least(16, level_requirement / 10 + 1)
    FROM public.game_content_recipes WHERE content_version = _content_version
    UNION ALL
    SELECT format('node:%s', kind), level_requirement, tier_index,
      least(16, level_requirement / 10 + 1)
    FROM public.game_content_nodes WHERE content_version = _content_version
    UNION ALL
    SELECT format('monster:%s', kind), level_requirement, tier_index,
      least(16, level_requirement / 10 + 1)
    FROM public.game_content_monsters WHERE content_version = _content_version
    UNION ALL
    SELECT format('fish:%s', item_id), level_requirement, tier_index,
      least(16, level_requirement / 10 + 1)
    FROM public.game_content_fish WHERE content_version = _content_version
    UNION ALL
    SELECT format('quest:%s', id), level_requirement, tier_index,
      least(16, level_requirement / 10 + 1)
    FROM public.game_content_quests WHERE content_version = _content_version
  ) banded
  WHERE banded.tier_index <> banded.expected_tier;

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
  WITH checkpoints AS (
    SELECT
      f.item_id,
      CASE
        WHEN jsonb_typeof(weight.value) = 'object'
         AND weight.value ?& ARRAY['level', 'weight']
         AND jsonb_typeof(weight.value->'level') = 'number'
         AND jsonb_typeof(weight.value->'weight') = 'number'
        THEN (weight.value->>'level')::numeric
      END AS level,
      CASE
        WHEN jsonb_typeof(weight.value) = 'object'
         AND weight.value ?& ARRAY['level', 'weight']
         AND jsonb_typeof(weight.value->'level') = 'number'
         AND jsonb_typeof(weight.value->'weight') = 'number'
        THEN (weight.value->>'weight')::numeric
      END AS weight
    FROM public.game_content_fish f
    CROSS JOIN LATERAL jsonb_array_elements(f.weights) weight(value)
    WHERE f.content_version = _content_version
  ), totals AS (
    SELECT level, count(DISTINCT item_id) AS fish_count, sum(weight) AS total_weight
    FROM checkpoints
    WHERE level IS NOT NULL AND weight IS NOT NULL
    GROUP BY level
  )
  SELECT 'invalid_fish_distribution', format('fish:weights:level:%s', totals.level),
    format('Expected one weight per fish summing to 1; found %s fish and total %s', totals.fish_count, totals.total_weight)
  FROM totals
  WHERE totals.fish_count <> (SELECT count(*) FROM public.game_content_fish WHERE content_version = _content_version)
     OR abs(totals.total_weight - 1) > 0.000000001;

  RETURN QUERY
  SELECT 'inactive_recipe_output', format('recipe:%s.output_item_id', r.id), r.output_item_id
  FROM public.game_content_recipes r
  LEFT JOIN public.game_content_items i
    ON i.content_version = r.content_version AND i.id = r.output_item_id AND i.active
  WHERE r.content_version = _content_version AND r.active AND i.id IS NULL
  UNION ALL
  SELECT 'inactive_starter_weapon', 'starter_loadout.weapon_item_id', v.starter_loadout->>'weapon_item_id'
  FROM public.game_content_versions v
  LEFT JOIN public.game_content_items i
    ON i.content_version = v.content_version
   AND i.id = v.starter_loadout->>'weapon_item_id'
   AND i.active AND i.kind = 'weapon'
  WHERE v.content_version = _content_version AND i.id IS NULL
  UNION ALL
  SELECT 'inactive_starter_armor', 'starter_loadout.armor_item_id', v.starter_loadout->>'armor_item_id'
  FROM public.game_content_versions v
  LEFT JOIN public.game_content_items i
    ON i.content_version = v.content_version
   AND i.id = v.starter_loadout->>'armor_item_id'
   AND i.active AND i.kind = 'armor'
  WHERE v.content_version = _content_version AND i.id IS NULL
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
  WHERE mr.content_version = _content_version AND mr.action IN ('replace', 'replace_or_compensate') AND i.id IS NULL
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

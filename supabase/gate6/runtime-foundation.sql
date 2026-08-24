-- Gate 6 source: version selection, release safety and read contracts.
-- The generated migration embeds this file verbatim before staging v2.

CREATE TABLE public.game_release_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  minimum_client_protocol integer NOT NULL DEFAULT 1 CHECK (minimum_client_protocol >= 1),
  minimum_client_content_version text NOT NULL DEFAULT 'v1'
    CHECK (minimum_client_content_version ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_release_control_message_check CHECK (
    (maintenance_mode AND btrim(maintenance_message) <> '')
    OR (NOT maintenance_mode)
  )
);

INSERT INTO public.game_release_control
  (singleton, minimum_client_protocol, minimum_client_content_version, maintenance_mode, maintenance_message)
VALUES (true, 1, 'v1', false, '');

REVOKE ALL ON public.game_release_control FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.game_release_control TO service_role;
ALTER TABLE public.game_release_control ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.game_content_progression_levels (
  content_version text NOT NULL REFERENCES public.game_content_versions(content_version) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 150),
  xp_to_next bigint,
  cumulative_xp bigint NOT NULL CHECK (cumulative_xp >= 0),
  PRIMARY KEY (content_version, level),
  UNIQUE (content_version, cumulative_xp),
  CONSTRAINT game_content_progression_terminal_check CHECK (
    (level = 150 AND xp_to_next IS NULL)
    OR (level < 150 AND xp_to_next > 0)
  )
);

ALTER TABLE public.game_content_progression_levels ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.game_content_progression_levels TO authenticated;
GRANT ALL ON public.game_content_progression_levels TO service_role;

CREATE OR REPLACE FUNCTION public.game_active_content_version()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT active_content_version FROM public.game_content_control WHERE singleton),
    'v1'
  )
$$;

CREATE OR REPLACE FUNCTION public.game_active_spawn_set_version()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT active_spawn_set_version FROM public.game_content_control WHERE singleton),
    'v1'
  )
$$;

CREATE OR REPLACE FUNCTION public.game_request_client_protocol()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_headers text := current_setting('request.headers', true);
  requested text;
BEGIN
  IF raw_headers IS NULL OR btrim(raw_headers) = '' THEN RETURN 1; END IF;
  BEGIN
    requested := (raw_headers::jsonb)->>'x-tomlandia-client-protocol';
  EXCEPTION WHEN others THEN
    RETURN 1;
  END;
  IF requested IS NULL OR requested !~ '^[0-9]{1,9}$' THEN RETURN 1; END IF;
  RETURN requested::integer;
END
$$;

CREATE OR REPLACE FUNCTION public.game_runtime_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'contract_version', 2,
    'active_content_version', public.game_active_content_version(),
    'active_spawn_set_version', public.game_active_spawn_set_version(),
    'minimum_client_protocol', release_control.minimum_client_protocol,
    'minimum_client_content_version', release_control.minimum_client_content_version,
    'request_client_protocol', public.game_request_client_protocol(),
    'client_supported', public.game_request_client_protocol() >= release_control.minimum_client_protocol,
    'maintenance_mode', release_control.maintenance_mode,
    'maintenance_message', release_control.maintenance_message,
    'manifest_hash', coalesce(control.manifest_hash, ''),
    'server_time', now()
  )
  FROM public.game_release_control AS release_control
  LEFT JOIN public.game_content_control AS control ON control.singleton
  WHERE release_control.singleton
$$;

CREATE OR REPLACE FUNCTION public.game_assert_action_allowed(_legacy_world_contract boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  control_row public.game_release_control%ROWTYPE;
BEGIN
  SELECT * INTO STRICT control_row FROM public.game_release_control WHERE singleton;
  IF control_row.maintenance_mode THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'game_maintenance',
      DETAIL = control_row.maintenance_message;
  END IF;
  IF public.game_request_client_protocol() < control_row.minimum_client_protocol THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'client_update_required',
      DETAIL = format(
        'Client protocol %s is below required protocol %s',
        public.game_request_client_protocol(),
        control_row.minimum_client_protocol
      );
  END IF;
  IF _legacy_world_contract AND public.game_active_content_version() <> 'v1' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'legacy_world_contract_disabled',
      DETAIL = 'Use the UUID spawn contract for the active content version';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.game_active_content_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_active_spawn_set_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_request_client_protocol() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_assert_action_allowed(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_runtime_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.game_active_content_version() TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_active_spawn_set_version() TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_runtime_status() TO anon, authenticated;

CREATE POLICY "Players can read active progression"
  ON public.game_content_progression_levels FOR SELECT TO authenticated
  USING (content_version = public.game_active_content_version());

-- Active-definition compatibility views. Every branch contains an explicit
-- active-version predicate; staged v2 rows can never leak through these views.
CREATE VIEW public.game_runtime_items
WITH (security_invoker = true)
AS
SELECT
  'v1'::text AS content_version,
  item.id,
  item.name,
  true AS active,
  1 AS tier_index,
  1 AS level_requirement,
  item.kind,
  item.kind AS family,
  item.id AS icon_key,
  '#ffffff'::text AS colour,
  'common'::text AS rarity,
  NOT item.untradable AS tradable,
  item.untradable,
  item.stackable,
  item.value,
  CASE WHEN item.kind IN ('weapon', 'armor') THEN 'combat'::text ELSE NULL::text END AS equip_skill,
  coalesce(item.attack, 0)::numeric AS attack,
  coalesce(item.defense, 0)::numeric AS defense,
  coalesce(item.heal, 0)::integer AS heal,
  coalesce(item.speed, 0)::numeric AS speed,
  coalesce(item.dmg_boost, 0)::numeric AS dmg_boost,
  coalesce(item.boost_hits, 0)::integer AS boost_hits
FROM public.game_items AS item
WHERE public.game_active_content_version() = 'v1'
UNION ALL
SELECT
  item.content_version,
  item.id,
  item.name,
  item.active,
  item.tier_index,
  item.level_requirement,
  item.kind,
  item.family,
  item.icon_key,
  item.colour,
  item.rarity,
  item.tradable,
  NOT item.tradable AS untradable,
  item.stackable,
  item.value,
  item.equip_skill,
  item.attack,
  item.defense,
  item.heal,
  item.speed,
  item.dmg_boost,
  item.boost_hits
FROM public.game_content_items AS item
WHERE item.content_version = public.game_active_content_version()
  AND item.active;

CREATE VIEW public.game_runtime_recipes
WITH (security_invoker = true)
AS
SELECT
  'v1'::text AS content_version,
  recipe.id,
  true AS active,
  1 AS tier_index,
  recipe.req AS level_requirement,
  CASE
    WHEN recipe.skill = 'smithing' AND recipe.id LIKE '%_bar' THEN 'smelt'
    WHEN recipe.skill = 'smithing' AND output.kind = 'armor' THEN 'armor'
    WHEN recipe.skill = 'smithing' THEN 'forge'
    WHEN recipe.skill = 'tailoring' THEN 'weave'
    WHEN recipe.skill = 'skinning' THEN 'skin'
    WHEN recipe.skill = 'cooking' THEN 'cook'
    ELSE 'alchemy'
  END::text AS station,
  recipe.skill,
  recipe.out_item AS output_item_id,
  recipe.out_qty AS output_qty,
  recipe.req,
  recipe.xp,
  recipe.time_s
FROM public.game_recipes AS recipe
JOIN public.game_items AS output ON output.id = recipe.out_item
WHERE public.game_active_content_version() = 'v1'
UNION ALL
SELECT
  recipe.content_version,
  recipe.id,
  recipe.active,
  recipe.tier_index,
  recipe.level_requirement,
  recipe.station,
  recipe.skill,
  recipe.output_item_id,
  recipe.output_qty,
  recipe.level_requirement AS req,
  recipe.xp,
  recipe.time_s
FROM public.game_content_recipes AS recipe
WHERE recipe.content_version = public.game_active_content_version()
  AND recipe.active;

CREATE VIEW public.game_runtime_recipe_inputs
WITH (security_invoker = true)
AS
SELECT 'v1'::text AS content_version, input.recipe_id, input.item_id, input.qty
FROM public.game_recipe_inputs AS input
WHERE public.game_active_content_version() = 'v1'
UNION ALL
SELECT input.content_version, input.recipe_id, input.item_id, input.qty
FROM public.game_content_recipe_inputs AS input
JOIN public.game_content_recipes AS recipe
  ON recipe.content_version = input.content_version AND recipe.id = input.recipe_id
WHERE input.content_version = public.game_active_content_version()
  AND recipe.active;

CREATE VIEW public.game_runtime_quests
WITH (security_invoker = true)
AS
SELECT
  'v1'::text AS content_version,
  quest.id,
  quest.name,
  ''::text AS description,
  true AS active,
  1 AS tier_index,
  1 AS level_requirement,
  quest.kind,
  quest.target_key AS target_id,
  quest.target_count AS count,
  quest.gold,
  quest.xp_skill,
  quest.xp,
  CASE WHEN quest.reward_item IS NULL THEN '[]'::jsonb
       ELSE jsonb_build_array(jsonb_build_object('item_id', quest.reward_item, 'qty', 1)) END AS reward_items
FROM public.game_quests AS quest
WHERE public.game_active_content_version() = 'v1'
UNION ALL
SELECT
  quest.content_version,
  quest.id,
  quest.name,
  quest.description,
  quest.active,
  quest.tier_index,
  quest.level_requirement,
  quest.kind,
  quest.target_id,
  quest.count,
  quest.gold,
  quest.xp_skill,
  quest.xp,
  quest.reward_items
FROM public.game_content_quests AS quest
WHERE quest.content_version = public.game_active_content_version()
  AND quest.active;

CREATE VIEW public.game_runtime_nodes
WITH (security_invoker = true)
AS
SELECT
  'v1'::text AS content_version,
  node.kind,
  node.name,
  true AS active,
  1 AS tier_index,
  node.req AS level_requirement,
  node.skill,
  node.item_id,
  node.xp,
  node.time_s AS gather_s,
  12 AS respawn_s,
  1 AS max_charges,
  node.kind AS visual_key
FROM public.game_node_defs AS node
WHERE public.game_active_content_version() = 'v1'
UNION ALL
SELECT
  node.content_version,
  node.kind,
  node.name,
  node.active,
  node.tier_index,
  node.level_requirement,
  node.skill,
  node.item_id,
  node.xp,
  node.gather_s,
  node.respawn_s,
  node.max_charges,
  node.visual_key
FROM public.game_content_nodes AS node
WHERE node.content_version = public.game_active_content_version()
  AND node.active;

CREATE VIEW public.game_runtime_monsters
WITH (security_invoker = true)
AS
SELECT
  'v1'::text AS content_version,
  monster.kind,
  monster.name,
  true AS active,
  1 AS tier_index,
  1 AS level_requirement,
  monster.hp,
  monster.attack,
  monster.defense,
  monster.xp,
  monster.gold_min,
  monster.gold_max,
  12 AS respawn_s,
  monster.kind AS visual_key,
  '{}'::jsonb AS visual
FROM public.game_monster_defs AS monster
WHERE public.game_active_content_version() = 'v1'
UNION ALL
SELECT
  monster.content_version,
  monster.kind,
  monster.name,
  monster.active,
  monster.tier_index,
  monster.level_requirement,
  monster.hp,
  monster.attack,
  monster.defense,
  monster.xp,
  monster.gold_min,
  monster.gold_max,
  monster.respawn_s,
  monster.visual_key,
  monster.visual
FROM public.game_content_monsters AS monster
WHERE monster.content_version = public.game_active_content_version()
  AND monster.active;

CREATE VIEW public.game_runtime_monster_loot
WITH (security_invoker = true)
AS
SELECT
  'v1'::text AS content_version,
  monster.kind AS monster_kind,
  loot.ordinal,
  loot.item_id,
  loot.chance,
  1 AS qty_min,
  1 AS qty_max,
  loot.channel,
  loot.xp
FROM public.game_monster_defs AS monster
CROSS JOIN LATERAL (
  SELECT 0 AS ordinal, monster.drop_item AS item_id, monster.drop_chance AS chance,
         'drop'::text AS channel, 0 AS xp
  WHERE monster.drop_item IS NOT NULL
  UNION ALL
  SELECT 1, monster.hide_item, 1::numeric, 'hide'::text, monster.hide_xp
  WHERE monster.hide_item IS NOT NULL
) AS loot
WHERE public.game_active_content_version() = 'v1'
UNION ALL
SELECT
  loot.content_version,
  loot.monster_kind,
  loot.ordinal,
  loot.item_id,
  loot.chance,
  loot.qty_min,
  loot.qty_max,
  loot.channel,
  loot.xp
FROM public.game_content_monster_loot AS loot
JOIN public.game_content_monsters AS monster
  ON monster.content_version = loot.content_version AND monster.kind = loot.monster_kind
WHERE loot.content_version = public.game_active_content_version()
  AND monster.active;

CREATE VIEW public.game_runtime_fish
WITH (security_invoker = true)
AS
SELECT
  'v1'::text AS content_version,
  fish.item_id,
  true AS active,
  1 AS tier_index,
  1 AS level_requirement,
  fish.xp,
  jsonb_build_array(
    jsonb_build_object('level', 1, 'weight', fish.w1),
    jsonb_build_object('level', 15, 'weight', fish.w15),
    jsonb_build_object('level', 40, 'weight', fish.w40),
    jsonb_build_object('level', 70, 'weight', fish.w70),
    jsonb_build_object('level', 100, 'weight', fish.w100)
  ) AS weights
FROM public.game_fish AS fish
WHERE public.game_active_content_version() = 'v1'
UNION ALL
SELECT fish.content_version, fish.item_id, fish.active, fish.tier_index,
       fish.level_requirement, fish.xp, fish.weights
FROM public.game_content_fish AS fish
WHERE fish.content_version = public.game_active_content_version()
  AND fish.active;

CREATE VIEW public.game_runtime_fishing_spots
WITH (security_invoker = true)
AS
SELECT
  'v1'::text AS content_version,
  spot.id::text AS id,
  true AS active,
  spot.lake AS biome,
  'legacy'::text AS subzone,
  spot.x,
  spot.y,
  (SELECT coalesce(jsonb_agg(fish.item_id ORDER BY fish.xp), '[]'::jsonb) FROM public.game_fish AS fish)
    AS fish_item_ids
FROM public.game_fishing_spots AS spot
WHERE public.game_active_content_version() = 'v1'
UNION ALL
SELECT spot.content_version, spot.id, spot.active, spot.biome, spot.subzone,
       spot.x, spot.y, spot.fish_item_ids
FROM public.game_content_fishing_spots AS spot
WHERE spot.content_version = public.game_active_content_version()
  AND spot.active;

GRANT SELECT ON public.game_runtime_items, public.game_runtime_recipes,
  public.game_runtime_recipe_inputs, public.game_runtime_quests,
  public.game_runtime_nodes, public.game_runtime_monsters,
  public.game_runtime_monster_loot, public.game_runtime_fish,
  public.game_runtime_fishing_spots TO authenticated;

-- Direct marketplace reads must obey the same active-version boundary as RPCs.
DROP POLICY IF EXISTS "Signed-in players can browse listings" ON public.market_listings;
CREATE POLICY "Signed-in players can browse active listings"
  ON public.market_listings FOR SELECT TO authenticated
  USING (content_version = public.game_active_content_version());
DROP POLICY IF EXISTS "Signed-in players can read the trade feed" ON public.market_trades;
CREATE POLICY "Signed-in players can read active trades"
  ON public.market_trades FOR SELECT TO authenticated
  USING (content_version = public.game_active_content_version());
DROP POLICY IF EXISTS "Signed-in players can read last sold prices" ON public.market_prices;
CREATE POLICY "Signed-in players can read active prices"
  ON public.market_prices FOR SELECT TO authenticated
  USING (content_version = public.game_active_content_version());

-- The legacy FK cannot represent new v2 IDs. A version-aware trigger retains
-- strict integrity for both the legacy catalog and canonical versioned catalog.
ALTER TABLE public.market_listings DROP CONSTRAINT market_listings_item_id_fkey;

CREATE OR REPLACE FUNCTION public.game_guard_market_listing_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.content_version = 'v1' THEN
    IF NOT EXISTS (SELECT 1 FROM public.game_items WHERE id = NEW.item_id) THEN
      RAISE EXCEPTION 'Unknown v1 market item: %', NEW.item_id;
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.game_content_items
    WHERE content_version = NEW.content_version AND id = NEW.item_id AND active
  ) THEN
    RAISE EXCEPTION 'Unknown active item % for content version %', NEW.item_id, NEW.content_version;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER market_listings_versioned_item_guard
BEFORE INSERT OR UPDATE OF content_version, item_id ON public.market_listings
FOR EACH ROW EXECUTE FUNCTION public.game_guard_market_listing_item();

REVOKE ALL ON FUNCTION public.game_guard_market_listing_item() FROM PUBLIC, anon, authenticated;

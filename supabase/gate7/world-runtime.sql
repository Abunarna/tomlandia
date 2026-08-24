-- Gate 7 source: additive UUID world state and v2 action contracts.
-- The generated Gate 7 migration embeds this file before its deterministic
-- seed. Legacy integer world tables and dispatchers remain untouched.

ALTER TABLE public.game_content_spawns
  ADD CONSTRAINT game_content_spawns_runtime_identity_unique
  UNIQUE (spawn_id, content_version, spawn_set_version, entity_type, kind);

CREATE TABLE public.game_world_spawn_sets (
  content_version text NOT NULL,
  spawn_set_version text NOT NULL,
  source_content_manifest_hash text NOT NULL,
  spawn_hash text NOT NULL,
  model_version text NOT NULL,
  cluster_probability numeric NOT NULL,
  world_width integer NOT NULL,
  world_height integer NOT NULL,
  movement_speed numeric NOT NULL,
  path_cell_size integer NOT NULL,
  winter_geometry jsonb NOT NULL,
  reachability_summary jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_version, spawn_set_version),
  FOREIGN KEY (content_version, spawn_set_version)
    REFERENCES public.game_content_versions(content_version, spawn_set_version) ON DELETE CASCADE,
  CONSTRAINT game_world_spawn_sets_content_hash_check
    CHECK (source_content_manifest_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT game_world_spawn_sets_spawn_hash_check CHECK (spawn_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT game_world_spawn_sets_probability_check CHECK (cluster_probability BETWEEN 0 AND 1),
  CONSTRAINT game_world_spawn_sets_dimensions_check
    CHECK (world_width > 0 AND world_height > 0 AND movement_speed > 0 AND path_cell_size > 0),
  CONSTRAINT game_world_spawn_sets_geometry_check CHECK (jsonb_typeof(winter_geometry) = 'object'),
  CONSTRAINT game_world_spawn_sets_reachability_check CHECK (jsonb_typeof(reachability_summary) = 'object')
);

CREATE TABLE public.game_world_nodes (
  spawn_id uuid PRIMARY KEY,
  content_version text NOT NULL,
  spawn_set_version text NOT NULL,
  entity_type text NOT NULL DEFAULT 'node' CHECK (entity_type = 'node'),
  kind text NOT NULL,
  cell text NOT NULL,
  biome text NOT NULL,
  subzone text NOT NULL,
  x numeric NOT NULL,
  y numeric NOT NULL,
  charges integer NOT NULL,
  max_charges integer NOT NULL,
  gather_s numeric NOT NULL,
  respawn_s integer NOT NULL,
  respawn_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (spawn_id, content_version, spawn_set_version, entity_type, kind)
    REFERENCES public.game_content_spawns(spawn_id, content_version, spawn_set_version, entity_type, kind)
    ON DELETE CASCADE,
  FOREIGN KEY (content_version, spawn_set_version)
    REFERENCES public.game_world_spawn_sets(content_version, spawn_set_version) ON DELETE CASCADE,
  FOREIGN KEY (content_version, kind)
    REFERENCES public.game_content_nodes(content_version, kind),
  CONSTRAINT game_world_nodes_cell_check CHECK (cell ~ '^[0-9]+:[0-9]+$'),
  CONSTRAINT game_world_nodes_owner_check CHECK (
    biome ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
    AND subzone ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
  ),
  CONSTRAINT game_world_nodes_position_check CHECK (x >= 0 AND y >= 0),
  CONSTRAINT game_world_nodes_cell_position_check CHECK (
    cell = floor(x / 700)::integer::text || ':' || floor(y / 500)::integer::text
  ),
  CONSTRAINT game_world_nodes_state_check CHECK (
    max_charges > 0 AND charges BETWEEN 0 AND max_charges AND gather_s > 0 AND respawn_s > 0
  )
);

CREATE INDEX game_world_nodes_cell_idx
  ON public.game_world_nodes (content_version, spawn_set_version, cell);

CREATE TABLE public.game_world_monsters (
  spawn_id uuid PRIMARY KEY,
  content_version text NOT NULL,
  spawn_set_version text NOT NULL,
  entity_type text NOT NULL DEFAULT 'monster' CHECK (entity_type = 'monster'),
  kind text NOT NULL,
  cell text NOT NULL,
  biome text NOT NULL,
  subzone text NOT NULL,
  x numeric NOT NULL,
  y numeric NOT NULL,
  hp integer NOT NULL,
  max_hp integer NOT NULL,
  tagged_by uuid,
  tagged_at timestamptz,
  respawn_s integer NOT NULL,
  respawn_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (spawn_id, content_version, spawn_set_version, entity_type, kind)
    REFERENCES public.game_content_spawns(spawn_id, content_version, spawn_set_version, entity_type, kind)
    ON DELETE CASCADE,
  FOREIGN KEY (content_version, spawn_set_version)
    REFERENCES public.game_world_spawn_sets(content_version, spawn_set_version) ON DELETE CASCADE,
  FOREIGN KEY (content_version, kind)
    REFERENCES public.game_content_monsters(content_version, kind),
  CONSTRAINT game_world_monsters_cell_check CHECK (cell ~ '^[0-9]+:[0-9]+$'),
  CONSTRAINT game_world_monsters_owner_check CHECK (
    biome ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
    AND subzone ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
  ),
  CONSTRAINT game_world_monsters_position_check CHECK (x >= 0 AND y >= 0),
  CONSTRAINT game_world_monsters_cell_position_check CHECK (
    cell = floor(x / 700)::integer::text || ':' || floor(y / 500)::integer::text
  ),
  CONSTRAINT game_world_monsters_state_check CHECK (max_hp > 0 AND hp BETWEEN 0 AND max_hp AND respawn_s > 0)
);

CREATE INDEX game_world_monsters_cell_idx
  ON public.game_world_monsters (content_version, spawn_set_version, cell);

REVOKE ALL ON public.game_world_spawn_sets, public.game_world_nodes, public.game_world_monsters
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_world_spawn_sets, public.game_world_nodes, public.game_world_monsters
  TO authenticated;
GRANT ALL ON public.game_world_spawn_sets, public.game_world_nodes, public.game_world_monsters
  TO service_role;

ALTER TABLE public.game_world_spawn_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_world_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_world_monsters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read the active world spawn set"
  ON public.game_world_spawn_sets FOR SELECT TO authenticated
  USING (
    content_version = public.game_active_content_version()
    AND spawn_set_version = public.game_active_spawn_set_version()
  );
CREATE POLICY "Players can read active UUID world nodes"
  ON public.game_world_nodes FOR SELECT TO authenticated
  USING (
    content_version = public.game_active_content_version()
    AND spawn_set_version = public.game_active_spawn_set_version()
  );
CREATE POLICY "Players can read active UUID world monsters"
  ON public.game_world_monsters FOR SELECT TO authenticated
  USING (
    content_version = public.game_active_content_version()
    AND spawn_set_version = public.game_active_spawn_set_version()
  );

ALTER TABLE public.game_world_nodes REPLICA IDENTITY FULL;
ALTER TABLE public.game_world_monsters REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_world_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_world_monsters;

CREATE OR REPLACE FUNCTION public.game_world_runtime_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'contract_version', 1,
    'active_content_version', active.content_version,
    'active_spawn_set_version', active.spawn_set_version,
    'state_contract', CASE WHEN active.content_version = 'v1' THEN 'legacy_integer_v1' ELSE 'uuid_v2' END,
    'spawn_hash', coalesce(spawn_set.spawn_hash, ''),
    'world_width', spawn_set.world_width,
    'world_height', spawn_set.world_height,
    'movement_speed', spawn_set.movement_speed,
    'server_time', now()
  )
  FROM (
    SELECT public.game_active_content_version() AS content_version,
           public.game_active_spawn_set_version() AS spawn_set_version
  ) AS active
  LEFT JOIN public.game_world_spawn_sets AS spawn_set
    ON spawn_set.content_version = active.content_version
   AND spawn_set.spawn_set_version = active.spawn_set_version
$$;

REVOKE ALL ON FUNCTION public.game_world_runtime_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.game_world_runtime_status() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.harvest_node_v2(_id uuid, _x numeric, _y numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid();
  node public.game_world_nodes%ROWTYPE;
  definition record;
  data jsonb;
  next_inv jsonb;
  before_level integer;
  after_level integer;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.track_position(uid, _x, _y) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;
  SELECT * INTO node
  FROM public.game_world_nodes
  WHERE spawn_id = _id
    AND content_version = public.game_active_content_version()
    AND spawn_set_version = public.game_active_spawn_set_version()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  SELECT * INTO definition
  FROM public.game_content_nodes
  WHERE content_version = node.content_version AND kind = node.kind AND active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF sqrt(power(_x - node.x, 2) + power(_y - node.y, 2)) > 70 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;
  IF node.respawn_at IS NOT NULL AND now() < node.respawn_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'depleted', 'charges', 0, 'respawn_at', node.respawn_at);
  END IF;
  IF node.respawn_at IS NOT NULL THEN
    node.charges := node.max_charges;
    node.respawn_at := NULL;
  END IF;

  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  IF public.game_level_for_xp(public.skill_xp(data, definition.skill)) < definition.level_requirement THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'low_level', 'req', definition.level_requirement, 'skill', definition.skill
    );
  END IF;
  IF NOT public.action_gate(uid, 'action:gather', make_interval(secs => definition.gather_s * 0.7)) THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'too_fast', 'charges', node.charges, 'respawn_at', node.respawn_at
    );
  END IF;
  next_inv := public.inv_add(data->'inv', definition.item_id, 1);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;

  before_level := public.game_level_for_xp(public.skill_xp(data, definition.skill));
  data := jsonb_set(data, '{inv}', next_inv, true);
  data := public.grant_skill_xp(data, definition.skill, definition.xp);
  data := public.advance_quest(data, 'gather', definition.item_id);
  after_level := public.game_level_for_xp(public.skill_xp(data, definition.skill));
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;

  node.charges := greatest(0, node.charges - 1);
  IF node.charges = 0 THEN node.respawn_at := now() + make_interval(secs => node.respawn_s); END IF;
  UPDATE public.game_world_nodes
  SET charges = node.charges, respawn_at = node.respawn_at, updated_at = now()
  WHERE spawn_id = _id;
  RETURN jsonb_build_object(
    'ok', true, 'spawn_id', node.spawn_id, 'charges', node.charges, 'respawn_at', node.respawn_at,
    'item', definition.item_id, 'qty', 1, 'skill', definition.skill, 'xp', definition.xp,
    'leveled', after_level > before_level, 'level', after_level, 'state', public.pl_state(data)
  );
END
$$;

CREATE OR REPLACE FUNCTION public.attack_monster_v2(_id uuid, _x numeric, _y numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid();
  monster public.game_world_monsters%ROWTYPE;
  definition record;
  loot_rule record;
  data jsonb;
  swing_seconds numeric;
  combat_level integer;
  attack_stat numeric;
  defense_stat numeric;
  damage integer;
  taken integer;
  killed boolean := false;
  credited boolean := false;
  gold_award integer := 0;
  loot jsonb := '[]'::jsonb;
  skipped jsonb := '[]'::jsonb;
  next_inv jsonb;
  loot_qty integer;
  before_level integer;
  after_level integer;
  buff_damage numeric := 0;
  buff_hits integer := 0;
  settlement jsonb;
  death jsonb := 'null'::jsonb;
  food_used boolean := false;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.track_position(uid, _x, _y) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;
  SELECT * INTO monster
  FROM public.game_world_monsters
  WHERE spawn_id = _id
    AND content_version = public.game_active_content_version()
    AND spawn_set_version = public.game_active_spawn_set_version()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  SELECT * INTO definition
  FROM public.game_content_monsters
  WHERE content_version = monster.content_version AND kind = monster.kind AND active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF sqrt(power(_x - monster.x, 2) + power(_y - monster.y, 2)) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;

  IF monster.respawn_at IS NOT NULL AND now() >= monster.respawn_at THEN
    monster.hp := monster.max_hp;
    monster.tagged_by := NULL;
    monster.tagged_at := NULL;
    monster.respawn_at := NULL;
  END IF;
  IF monster.respawn_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'dead', 'hp', 0, 'respawn_at', monster.respawn_at);
  END IF;
  IF monster.tagged_by IS NOT NULL AND monster.tagged_at < now() - interval '15 seconds' THEN
    monster.tagged_by := NULL;
    monster.tagged_at := NULL;
  END IF;

  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  swing_seconds := greatest(0.5, 1 - public.equip_stat(data, 'armor', 'speed')) - 0.15;
  IF NOT public.action_gate(uid, 'combat:global', (swing_seconds || ' seconds')::interval) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'hp', monster.hp, 'tagged_by', monster.tagged_by);
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'combat:last', now() + interval '5 seconds')
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  combat_level := public.game_level_for_xp(public.skill_xp(data, 'combat'));
  attack_stat := round(3 + combat_level + public.equip_stat(data, 'weapon', 'attack') + public.equip_stat(data, 'armor', 'attack'));
  defense_stat := round(floor(combat_level / 2.0) + public.equip_stat(data, 'armor', 'defense'));
  buff_hits := coalesce((data#>>'{buff,hits}')::integer, 0);
  buff_damage := coalesce((data#>>'{buff,dmg}')::numeric, 0);
  IF buff_hits > 0 AND buff_damage > 0 THEN
    attack_stat := attack_stat + buff_damage;
    buff_hits := buff_hits - 1;
    IF buff_hits <= 0 THEN
      data := data - 'buff';
    ELSE
      data := jsonb_set(data, '{buff,hits}', to_jsonb(buff_hits), true);
    END IF;
  END IF;
  damage := greatest(1, floor(attack_stat * (0.6 + random() * 0.6) - definition.defense * 0.4))::integer;
  monster.hp := greatest(0, monster.hp - damage);
  IF monster.tagged_by IS NULL THEN monster.tagged_by := uid; monster.tagged_at := now(); END IF;
  credited := monster.tagged_by = uid;
  taken := greatest(0, floor(definition.attack * (0.5 + random() * 0.7) - defense_stat * 0.5))::integer;
  IF monster.hp <= 0 THEN
    killed := true;
    monster.respawn_at := now() + make_interval(secs => definition.respawn_s);
  END IF;

  UPDATE public.game_world_monsters
  SET hp = monster.hp, tagged_by = monster.tagged_by, tagged_at = monster.tagged_at,
      respawn_at = monster.respawn_at, updated_at = now()
  WHERE spawn_id = monster.spawn_id;
  before_level := public.game_level_for_xp(public.skill_xp(data, 'combat'));
  IF killed AND credited THEN
    data := public.grant_skill_xp(data, 'combat', definition.xp);
    gold_award := definition.gold_min + floor(random() * greatest(1, definition.gold_max - definition.gold_min + 1))::integer;
    data := jsonb_set(data, '{gold}', to_jsonb(coalesce((data->>'gold')::numeric, 0) + gold_award), true);
    FOR loot_rule IN
      SELECT item_id, chance, qty_min, qty_max, channel, xp
      FROM public.game_content_monster_loot
      WHERE content_version = monster.content_version AND monster_kind = monster.kind
      ORDER BY ordinal
    LOOP
      IF random() >= loot_rule.chance THEN CONTINUE; END IF;
      loot_qty := loot_rule.qty_min + floor(random() * greatest(1, loot_rule.qty_max - loot_rule.qty_min + 1))::integer;
      next_inv := public.inv_add(data->'inv', loot_rule.item_id, loot_qty);
      IF next_inv IS NULL THEN
        skipped := skipped || jsonb_build_array(loot_rule.item_id);
      ELSE
        data := jsonb_set(data, '{inv}', next_inv, true);
        loot := loot || jsonb_build_array(jsonb_build_object('item', loot_rule.item_id, 'qty', loot_qty));
        IF loot_rule.channel = 'hide' AND loot_rule.xp > 0 THEN
          data := public.grant_skill_xp(data, 'skinning', loot_rule.xp);
        END IF;
      END IF;
    END LOOP;
    data := public.advance_quest(data, 'kill', monster.kind);
  END IF;

  settlement := public.settle_incoming_damage(uid, data, taken, definition.name);
  data := settlement->'data';
  death := settlement->'death';
  food_used := coalesce((settlement->>'food_used')::boolean, false);
  after_level := public.game_level_for_xp(public.skill_xp(data, 'combat'));
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object(
    'ok', true, 'spawn_id', monster.spawn_id, 'hp', monster.hp, 'dmg', damage, 'taken', taken,
    'killed', killed, 'credited', credited, 'kind', monster.kind, 'tagged_by', monster.tagged_by,
    'gold', gold_award, 'loot', loot, 'skipped_loot', skipped,
    'xp', CASE WHEN killed AND credited THEN definition.xp ELSE 0 END,
    'leveled', after_level > before_level, 'level', after_level, 'respawn_at', monster.respawn_at,
    'buff', coalesce(data->'buff', 'null'::jsonb), 'death', death, 'food_used', food_used,
    'state', public.pl_state(data)
  );
END
$$;

REVOKE ALL ON FUNCTION public.harvest_node_v2(uuid, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attack_monster_v2(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.harvest_node_v2(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attack_monster_v2(uuid, numeric, numeric) TO authenticated;

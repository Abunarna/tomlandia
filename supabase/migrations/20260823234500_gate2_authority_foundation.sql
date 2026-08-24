-- Gate 2: live correctness and server authority foundation.
-- This migration is deliberately append-only: current clients keep their RPC
-- signatures while the database becomes the sole writer of durable game state.

-- ---------------------------------------------------------------------------
-- Server-owned starter and quest definitions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.game_starter_templates (
  version text PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS game_starter_templates_one_active
  ON public.game_starter_templates (active) WHERE active;

REVOKE ALL ON public.game_starter_templates FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.game_starter_templates TO service_role;
ALTER TABLE public.game_starter_templates ENABLE ROW LEVEL SECURITY;

INSERT INTO public.game_starter_templates (version, active, data)
VALUES (
  'current-v1',
  true,
  jsonb_build_object(
    'v', 3,
    'px', 1064,
    'py', 2195,
    'hp', 30,
    'gold', 0,
    'inv', (SELECT jsonb_agg('null'::jsonb) FROM generate_series(1, 20)),
    'bank', jsonb_build_object(
      'gold', 0,
      'items', (SELECT jsonb_agg('null'::jsonb) FROM generate_series(1, 60))
    ),
    'skills', jsonb_build_object(
      'combat', jsonb_build_object('xp', 0),
      'mining', jsonb_build_object('xp', 0),
      'woodcutting', jsonb_build_object('xp', 0),
      'gathering', jsonb_build_object('xp', 0),
      'fishing', jsonb_build_object('xp', 0),
      'cooking', jsonb_build_object('xp', 0),
      'alchemy', jsonb_build_object('xp', 0),
      'smithing', jsonb_build_object('xp', 0),
      'skinning', jsonb_build_object('xp', 0),
      'tailoring', jsonb_build_object('xp', 0)
    ),
    'weapon', jsonb_build_object('id', 'wooden_club', 'plus', 0),
    'armor', jsonb_build_object('id', 'cloth_tunic', 'plus', 0),
    'food', 'null'::jsonb,
    'autoEatAt', 0.5,
    'quest', 'null'::jsonb,
    'completed', '[]'::jsonb,
    'discovered', jsonb_build_array('fields'),
    'clock', 168
  )
)
ON CONFLICT (version) DO UPDATE SET active = EXCLUDED.active, data = EXCLUDED.data;

CREATE TABLE IF NOT EXISTS public.game_quests (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('kill', 'gather')),
  target_key text NOT NULL,
  target_count integer NOT NULL CHECK (target_count > 0),
  gold integer NOT NULL CHECK (gold >= 0),
  xp_skill text NOT NULL,
  xp numeric NOT NULL CHECK (xp >= 0),
  reward_item text REFERENCES public.game_items(id)
);

GRANT SELECT ON public.game_quests TO authenticated;
GRANT ALL ON public.game_quests TO service_role;
ALTER TABLE public.game_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in players can read quest definitions" ON public.game_quests;
CREATE POLICY "Signed-in players can read quest definitions"
  ON public.game_quests FOR SELECT TO authenticated USING (true);

INSERT INTO public.game_quests (id, name, kind, target_key, target_count, gold, xp_skill, xp, reward_item)
VALUES
  ('feather_duster', 'Feather Duster', 'kill', 'chicken', 5, 45, 'combat', 45, NULL),
  ('copper_run', 'Copper Run', 'gather', 'copper_ore', 6, 60, 'mining', 70, NULL),
  ('log_delivery', 'Firewood Duty', 'gather', 'oak_logs', 6, 55, 'woodcutting', 65, NULL),
  ('goblin_trouble', 'Goblin Trouble', 'kill', 'goblin', 3, 120, 'combat', 130, 'bronze_dagger'),
  ('flax_bundle', 'Bundle of Flax', 'gather', 'flax', 8, 90, 'gathering', 120, NULL),
  ('wolf_watch', 'Wolf Watch', 'kill', 'wolf', 4, 260, 'combat', 380, 'steel_sword'),
  ('dune_patrol', 'Dune Patrol', 'kill', 'bandit', 3, 700, 'combat', 1200, NULL),
  ('gloom_harvest', 'Gloom Harvest', 'gather', 'gloomcap', 5, 1100, 'gathering', 1600, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  target_key = EXCLUDED.target_key,
  target_count = EXCLUDED.target_count,
  gold = EXCLUDED.gold,
  xp_skill = EXCLUDED.xp_skill,
  xp = EXCLUDED.xp,
  reward_item = EXCLUDED.reward_item;

-- The five live potion IDs existed without effects in the database.
UPDATE public.game_items AS item
SET dmg_boost = effect.dmg, boost_hits = effect.hits
FROM (VALUES
  ('minor_venom_draught', 2::numeric, 5),
  ('goblins_fury_tonic', 5::numeric, 8),
  ('serpents_bite_elixir', 10::numeric, 10),
  ('shadow_venom', 18::numeric, 12),
  ('frostfire_brew', 30::numeric, 15)
) AS effect(id, dmg, hits)
WHERE item.id = effect.id;

ALTER TABLE public.game_items ADD COLUMN IF NOT EXISTS untradable boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Internal save helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.active_starter_save()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT data FROM public.game_starter_templates WHERE active LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.player_max_hp(_data jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 30 + (public.xp_level(public.skill_xp(_data, 'combat')) - 1) * 6
$$;

CREATE OR REPLACE FUNCTION public.clear_stale_food(_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE selected text;
BEGIN
  selected := _data->>'food';
  IF selected IS NOT NULL AND public.inv_count(_data->'inv', selected) <= 0 THEN
    RETURN jsonb_set(_data, '{food}', 'null'::jsonb, true);
  END IF;
  RETURN _data;
END $$;

CREATE OR REPLACE FUNCTION public.advance_quest(_data jsonb, _kind text, _key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE active_id text; progress integer; target integer;
BEGIN
  active_id := _data#>>'{quest,id}';
  IF active_id IS NULL THEN RETURN _data; END IF;

  SELECT target_count INTO target
  FROM public.game_quests
  WHERE id = active_id AND kind = _kind AND target_key = _key;
  IF NOT FOUND THEN RETURN _data; END IF;

  progress := least(target, greatest(0, coalesce((_data#>>'{quest,progress}')::integer, 0)) + 1);
  RETURN jsonb_set(_data, '{quest,progress}', to_jsonb(progress), true);
END $$;

CREATE OR REPLACE FUNCTION public.pl_state(_data jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'inv', coalesce(_data->'inv', '[]'::jsonb),
    'gold', coalesce(_data->'gold', '0'::jsonb),
    'skills', coalesce(_data->'skills', '{}'::jsonb),
    'weapon', _data->'weapon',
    'armor', _data->'armor',
    'food', _data->'food',
    'bank', coalesce(_data->'bank', jsonb_build_object('gold', 0, 'items', '[]'::jsonb)),
    'hp', coalesce(_data->'hp', to_jsonb(public.player_max_hp(_data))),
    'px', coalesce(_data->'px', '1064'::jsonb),
    'py', coalesce(_data->'py', '2195'::jsonb),
    'quest', coalesce(_data->'quest', 'null'::jsonb),
    'completed', coalesce(_data->'completed', '[]'::jsonb),
    'autoEatAt', coalesce(_data->'autoEatAt', '0.5'::jsonb)
  )
$$;

CREATE OR REPLACE FUNCTION public.slot_add(
  _arr jsonb, _size integer, _id text, _qty integer, _plus integer, _stackable boolean
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE arr jsonb := coalesce(_arr, '[]'::jsonb); i integer; unit integer; candidate integer; element jsonb;
BEGIN
  IF _qty IS NULL OR _qty <= 0 OR _size <= 0 THEN RETURN NULL; END IF;
  WHILE jsonb_array_length(arr) < _size LOOP arr := arr || 'null'::jsonb; END LOOP;

  IF _stackable THEN
    FOR i IN 0.._size - 1 LOOP
      element := arr->i;
      IF jsonb_typeof(element) = 'object'
         AND element->>'id' = _id
         AND coalesce((element->>'plus')::integer, 0) = coalesce(_plus, 0) THEN
        RETURN jsonb_set(
          arr,
          ARRAY[i::text, 'qty'],
          to_jsonb(coalesce((element->>'qty')::integer, 0) + _qty)
        );
      END IF;
    END LOOP;
  END IF;

  FOR unit IN 1..CASE WHEN _stackable THEN 1 ELSE _qty END LOOP
    i := NULL;
    FOR candidate IN 0.._size - 1 LOOP
      IF jsonb_typeof(arr->candidate) IS DISTINCT FROM 'object' THEN
        i := candidate;
        EXIT;
      END IF;
    END LOOP;
    IF i IS NULL THEN RETURN NULL; END IF;
    arr := jsonb_set(
      arr,
      ARRAY[i::text],
      jsonb_build_object('id', _id, 'qty', CASE WHEN _stackable THEN _qty ELSE 1 END, 'plus', coalesce(_plus, 0)),
      true
    );
  END LOOP;
  RETURN arr;
END $$;

CREATE OR REPLACE FUNCTION public.inv_add(_inv jsonb, _item text, _qty integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE stackable boolean;
BEGIN
  SELECT game_items.stackable INTO stackable FROM public.game_items WHERE id = _item;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN public.slot_add(_inv, 20, _item, _qty, 0, stackable);
END $$;

CREATE OR REPLACE FUNCTION public.equip_stat(_data jsonb, _which text, _stat text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE equipped jsonb; item_id text; plus integer := 0; base numeric := 0;
BEGIN
  equipped := _data->_which;
  IF equipped IS NULL OR jsonb_typeof(equipped) = 'null' THEN RETURN 0; END IF;
  IF jsonb_typeof(equipped) = 'string' THEN
    item_id := equipped #>> '{}';
  ELSE
    item_id := equipped->>'id';
    plus := coalesce((equipped->>'plus')::integer, 0);
  END IF;
  IF plus < 0 OR plus > 100 THEN RAISE EXCEPTION 'invalid gear plus: %', plus; END IF;

  IF _stat = 'speed' THEN
    SELECT coalesce(speed, 0) INTO base FROM public.game_items WHERE id = item_id;
    RETURN coalesce(base, 0);
  ELSIF _stat = 'attack' THEN
    SELECT coalesce(attack, 0) INTO base FROM public.game_items WHERE id = item_id;
  ELSE
    SELECT coalesce(defense, 0) INTO base FROM public.game_items WHERE id = item_id;
  END IF;
  RETURN round(coalesce(base, 0) * (1 + plus * 0.05) * 10) / 10;
END $$;

REVOKE ALL ON FUNCTION public.active_starter_save() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.player_max_hp(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_stale_food(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_quest(jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pl_state(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.slot_add(jsonb, integer, text, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_add(jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equip_stat(jsonb, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Position binding and save authority
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.track_position(_uid uuid, _x numeric, _y numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  previous public.player_positions%ROWTYPE;
  base_x numeric;
  base_y numeric;
  elapsed numeric;
  allowed numeric;
  distance numeric;
BEGIN
  IF caller IS NULL OR _uid IS DISTINCT FROM caller THEN RETURN false; END IF;
  IF _x IS NULL OR _y IS NULL OR _x < 0 OR _y < 0 OR _x > 5600 OR _y > 3750 THEN RETURN false; END IF;

  SELECT * INTO previous FROM public.player_positions WHERE user_id = caller FOR UPDATE;
  IF FOUND THEN
    base_x := previous.x;
    base_y := previous.y;
    elapsed := greatest(0, extract(epoch FROM (now() - previous.updated_at)));
    distance := sqrt(power(_x - base_x, 2) + power(_y - base_y, 2));

    -- Saves and actions can arrive in the same browser frame. Accepting a
    -- near-identical sample is harmless, but do not move the trusted anchor:
    -- repeatedly nudging that anchor would otherwise permit a speed-hack.
    IF elapsed < 0.25 THEN
      RETURN distance <= 5;
    END IF;

    -- The player walks at 130 px/s. This deliberately generous ceiling
    -- tolerates latency while still bounding a delayed sample to one screen.
    allowed := 400 * least(elapsed, 2) + 80;
  ELSE
    SELECT coalesce((data->>'px')::numeric, 1064), coalesce((data->>'py')::numeric, 2195)
      INTO base_x, base_y
      FROM public.player_saves WHERE user_id = caller;
    IF NOT FOUND THEN RETURN false; END IF;
    distance := sqrt(power(_x - base_x, 2) + power(_y - base_y, 2));
    allowed := 80;
  END IF;

  -- A rejected jump must never mutate the trusted anchor.
  IF coalesce(distance, sqrt(power(_x - base_x, 2) + power(_y - base_y, 2))) > allowed THEN
    RETURN false;
  END IF;

  INSERT INTO public.player_positions (user_id, x, y, updated_at)
  VALUES (caller, _x, _y, now())
  ON CONFLICT (user_id) DO UPDATE
    SET x = EXCLUDED.x, y = EXCLUDED.y, updated_at = EXCLUDED.updated_at;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.track_position(uuid, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_position(uuid, numeric, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.player_sync(_data jsonb, _rev bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  current_data jsonb;
  current_rev bigint;
  merged jsonb;
  conflicted boolean;
  last_backup timestamptz;
  requested_x numeric;
  requested_y numeric;
  position_valid boolean := false;
  threshold numeric;
  clock_value numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_data');
  END IF;

  -- Acquire the position lock before the save lock. World actions use the
  -- same order, avoiding a sync/action deadlock under concurrent browser tabs.
  IF jsonb_typeof(_data->'px') = 'number' AND jsonb_typeof(_data->'py') = 'number' THEN
    requested_x := (_data->>'px')::numeric;
    requested_y := (_data->>'py')::numeric;
    position_valid := public.track_position(uid, requested_x, requested_y);
  END IF;

  SELECT data, rev INTO current_data, current_rev
  FROM public.player_saves WHERE user_id = uid FOR UPDATE;

  IF NOT FOUND THEN
    current_data := public.active_starter_save();
    IF current_data IS NULL THEN RAISE EXCEPTION 'no active starter template'; END IF;
    INSERT INTO public.player_saves (user_id, data) VALUES (uid, current_data);
    SELECT data, rev INTO current_data, current_rev FROM public.player_saves WHERE user_id = uid;
    INSERT INTO public.player_positions (user_id, x, y)
    VALUES (uid, (current_data->>'px')::numeric, (current_data->>'py')::numeric)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'rev', current_rev, 'conflict', false, 'data', current_data);
  END IF;

  conflicted := _rev IS NULL OR _rev IS DISTINCT FROM current_rev;
  merged := current_data;

  -- Only harmless preferences and a validated movement sample cross from the
  -- client. Economy, XP, health, quests, equipment and bank are ignored.
  IF jsonb_typeof(_data->'autoEatAt') = 'number' THEN
    threshold := (_data->>'autoEatAt')::numeric;
    IF threshold IN (0.25, 0.5, 0.75) THEN
      merged := jsonb_set(merged, '{autoEatAt}', to_jsonb(threshold), true);
    END IF;
  END IF;
  IF jsonb_typeof(_data->'clock') = 'number' THEN
    clock_value := (_data->>'clock')::numeric;
    IF clock_value >= 0 AND clock_value <= 480 THEN
      merged := jsonb_set(merged, '{clock}', to_jsonb(clock_value), true);
    END IF;
  END IF;
  IF position_valid THEN
    merged := jsonb_set(merged, '{px}', to_jsonb(requested_x), true);
    merged := jsonb_set(merged, '{py}', to_jsonb(requested_y), true);
  END IF;

  SELECT max(created_at) INTO last_backup
  FROM public.player_save_backups WHERE user_id = uid;
  IF last_backup IS NULL OR last_backup < now() - interval '2 minutes' THEN
    INSERT INTO public.player_save_backups (user_id, rev, data)
    VALUES (uid, current_rev, current_data);
    DELETE FROM public.player_save_backups
    WHERE user_id = uid
      AND id NOT IN (
        SELECT id FROM public.player_save_backups
        WHERE user_id = uid ORDER BY created_at DESC LIMIT 40
      );
  END IF;

  UPDATE public.player_saves SET data = public.clear_stale_food(merged), updated_at = now()
  WHERE user_id = uid;
  SELECT data, rev INTO current_data, current_rev FROM public.player_saves WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'rev', current_rev, 'conflict', conflicted, 'data', current_data);
END $$;

REVOKE ALL ON FUNCTION public.player_sync(jsonb, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_sync(jsonb, bigint) TO authenticated;

-- Direct table writes bypass every invariant above, so authenticated clients
-- retain read access only and must use the RPC boundary for mutation.
REVOKE INSERT, UPDATE, DELETE ON public.player_saves FROM authenticated;
DROP POLICY IF EXISTS "Players can create their own save" ON public.player_saves;
DROP POLICY IF EXISTS "Players can update their own save" ON public.player_saves;
DROP POLICY IF EXISTS "Players can delete their own save" ON public.player_saves;

REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.profile_set_username(_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); cleaned text := btrim(_username);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF cleaned !~ '^[A-Za-z0-9_]{3,16}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_username');
  END IF;
  UPDATE public.profiles
  SET username = cleaned, username_lower = lower(cleaned)
  WHERE id = uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  RETURN jsonb_build_object('ok', true, 'username', cleaned);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'taken');
END $$;

REVOKE ALL ON FUNCTION public.profile_set_username(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_set_username(text) TO authenticated;

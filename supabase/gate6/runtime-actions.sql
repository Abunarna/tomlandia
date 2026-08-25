-- Gate 6 source: active-version helpers and guarded action layer.

CREATE OR REPLACE FUNCTION public.game_level_for_xp(_xp numeric)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_version text := public.game_active_content_version();
  level_value integer;
BEGIN
  IF active_version = 'v1' THEN RETURN public.xp_level(_xp); END IF;
  SELECT progression.level INTO level_value
  FROM public.game_content_progression_levels AS progression
  WHERE progression.content_version = active_version
    AND progression.cumulative_xp <= greatest(coalesce(_xp, 0), 0)
  ORDER BY progression.level DESC
  LIMIT 1;
  RETURN coalesce(level_value, 1);
END
$$;

CREATE OR REPLACE FUNCTION public.game_upgrade_step_cost(_item_value numeric, _next_plus integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 5 * round(greatest(25, _item_value * (0.08 + 3.4 * sqrt(_next_plus))) / 5)
$$;

CREATE OR REPLACE FUNCTION public.game_cumulative_upgrade_spend(_item_value numeric, _plus integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(sum(public.game_upgrade_step_cost(_item_value, step)), 0)
  FROM generate_series(1, greatest(0, least(coalesce(_plus, 0), 100))) AS steps(step)
$$;

CREATE OR REPLACE FUNCTION public.active_starter_save()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base jsonb;
  loadout jsonb;
BEGIN
  SELECT data INTO base FROM public.game_starter_templates WHERE active LIMIT 1;
  IF public.game_active_content_version() = 'v1' THEN RETURN base; END IF;
  SELECT starter_loadout INTO loadout
  FROM public.game_content_versions
  WHERE content_version = public.game_active_content_version();
  IF base IS NULL OR loadout IS NULL THEN RETURN NULL; END IF;
  base := jsonb_set(base, '{weapon}', jsonb_build_object(
    'id', loadout->>'weapon_item_id', 'plus', coalesce((loadout->>'plus')::integer, 0)
  ), true);
  base := jsonb_set(base, '{armor}', jsonb_build_object(
    'id', loadout->>'armor_item_id', 'plus', coalesce((loadout->>'plus')::integer, 0)
  ), true);
  RETURN base;
END
$$;

CREATE OR REPLACE FUNCTION public.player_max_hp(_data jsonb)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 30 + (public.game_level_for_xp(public.skill_xp(_data, 'combat')) - 1) * 6
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
  IF selected IS NOT NULL AND (
    public.inv_count(_data->'inv', selected) <= 0
    OR NOT EXISTS (
      SELECT 1 FROM public.game_runtime_items
      WHERE id = selected AND kind = 'food' AND heal > 0
    )
  ) THEN
    RETURN jsonb_set(_data, '{food}', 'null'::jsonb, true);
  END IF;
  RETURN _data;
END
$$;

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
  SELECT quest.count INTO target
  FROM public.game_runtime_quests AS quest
  WHERE quest.id = active_id AND quest.kind = _kind AND quest.target_id = _key;
  IF NOT FOUND THEN RETURN _data; END IF;
  progress := least(target, greatest(0, coalesce((_data#>>'{quest,progress}')::integer, 0)) + 1);
  RETURN jsonb_set(_data, '{quest,progress}', to_jsonb(progress), true);
END
$$;

CREATE OR REPLACE FUNCTION public.inv_add(_inv jsonb, _item text, _qty integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE item_stackable boolean;
BEGIN
  SELECT stackable INTO item_stackable FROM public.game_runtime_items WHERE id = _item;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN public.slot_add(_inv, 20, _item, _qty, 0, item_stackable);
END
$$;

CREATE OR REPLACE FUNCTION public.mk_inv_give(_inv jsonb, _item text, _plus integer, _qty integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE item_stackable boolean; normalized_plus integer := coalesce(_plus, 0);
BEGIN
  SELECT stackable INTO item_stackable FROM public.game_runtime_items WHERE id = _item;
  IF NOT FOUND OR normalized_plus < 0 OR normalized_plus > 100 THEN RETURN NULL; END IF;
  IF item_stackable AND normalized_plus <> 0 THEN RETURN NULL; END IF;
  RETURN public.slot_add(_inv, 20, _item, _qty, normalized_plus, item_stackable);
END
$$;

CREATE OR REPLACE FUNCTION public.equip_stat(_data jsonb, _which text, _stat text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  equipped jsonb;
  item_id text;
  plus integer := 0;
  definition public.game_runtime_items%ROWTYPE;
  multiplier numeric := 1;
BEGIN
  equipped := _data->_which;
  IF equipped IS NULL OR jsonb_typeof(equipped) = 'null' THEN RETURN 0; END IF;
  IF jsonb_typeof(equipped) = 'string' THEN
    item_id := equipped #>> '{}';
  ELSIF jsonb_typeof(equipped) = 'object' THEN
    item_id := equipped->>'id';
    plus := coalesce((equipped->>'plus')::integer, 0);
  ELSE
    RETURN 0;
  END IF;
  IF plus < 0 OR plus > 100 THEN RAISE EXCEPTION 'invalid gear plus: %', plus; END IF;
  SELECT * INTO definition FROM public.game_runtime_items WHERE id = item_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF _stat = 'speed' THEN RETURN definition.speed; END IF;

  IF public.game_active_content_version() = 'v1' THEN
    multiplier := 1 + plus * 0.05;
  ELSIF _stat = 'defense' THEN
    multiplier := 1 + plus * 0.001;
  ELSIF definition.kind = 'weapon' THEN
    multiplier := 1 + 0.02 * least(plus, 50) + 0.005 * greatest(plus - 50, 0);
  ELSIF definition.kind = 'armor' AND definition.attack > 0 THEN
    multiplier := 1 + 0.05 * least(plus, 20) + 0.01 * greatest(plus - 20, 0);
  END IF;

  IF _stat = 'attack' THEN
    RETURN round(definition.attack * multiplier * 10) / 10;
  END IF;
  RETURN round(definition.defense * multiplier * 10) / 10;
END
$$;

CREATE OR REPLACE FUNCTION public.try_auto_eat(_uid uuid, _data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  data jsonb := public.clear_stale_food(_data);
  selected text;
  max_hp integer;
  hp integer;
  threshold numeric;
  heal integer;
  next_inv jsonb;
BEGIN
  selected := data->>'food';
  max_hp := public.player_max_hp(data);
  hp := least(max_hp, greatest(0, coalesce((data->>'hp')::integer, max_hp)));
  threshold := coalesce((data->>'autoEatAt')::numeric, 0.5);
  IF selected IS NULL OR hp >= max_hp OR hp::numeric / greatest(max_hp, 1) > threshold THEN
    RETURN jsonb_build_object('data', data, 'used', false, 'healed', 0);
  END IF;
  SELECT item.heal INTO heal
  FROM public.game_runtime_items AS item
  WHERE item.id = selected AND item.kind = 'food' AND item.heal > 0;
  IF NOT FOUND THEN
    data := jsonb_set(data, '{food}', 'null'::jsonb, true);
    RETURN jsonb_build_object('data', data, 'used', false, 'healed', 0);
  END IF;
  IF NOT public.action_gate(_uid, 'action:food', interval '2 seconds') THEN
    RETURN jsonb_build_object('data', data, 'used', false, 'healed', 0);
  END IF;
  next_inv := public.inv_remove(data->'inv', selected, 1);
  IF next_inv IS NULL THEN
    data := jsonb_set(data, '{food}', 'null'::jsonb, true);
    RETURN jsonb_build_object('data', data, 'used', false, 'healed', 0);
  END IF;
  data := jsonb_set(data, '{inv}', next_inv, true);
  data := jsonb_set(data, '{hp}', to_jsonb(least(max_hp, hp + heal)), true);
  data := public.clear_stale_food(data);
  RETURN jsonb_build_object('data', data, 'used', true, 'healed', least(heal, max_hp - hp));
END
$$;

CREATE OR REPLACE FUNCTION public.sync_player_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE username text := public.market_player_name(NEW.user_id); total integer := 0; skill text; level integer;
BEGIN
  DELETE FROM public.player_scores WHERE user_id = NEW.user_id;
  FOR skill IN SELECT jsonb_object_keys(coalesce(NEW.data->'skills', '{}'::jsonb)) LOOP
    level := public.game_level_for_xp(public.skill_xp(NEW.data, skill));
    total := total + level;
    INSERT INTO public.player_scores (user_id, skill, level, username, updated_at)
    VALUES (NEW.user_id, skill, level, username, now());
  END LOOP;
  INSERT INTO public.player_scores (user_id, skill, level, username, updated_at)
  VALUES (NEW.user_id, 'total', greatest(total, 1), username, now());
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.game_runtime_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'contract_version', 2,
    'content_version', public.game_active_content_version(),
    'spawn_set_version', public.game_active_spawn_set_version(),
    'items', coalesce((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id) FROM public.game_runtime_items AS item), '[]'::jsonb),
    'recipes', coalesce((SELECT jsonb_agg(to_jsonb(recipe) ORDER BY recipe.id) FROM public.game_runtime_recipes AS recipe), '[]'::jsonb),
    'recipe_inputs', coalesce((SELECT jsonb_agg(to_jsonb(input) ORDER BY input.recipe_id, input.item_id) FROM public.game_runtime_recipe_inputs AS input), '[]'::jsonb),
    'nodes', coalesce((SELECT jsonb_agg(to_jsonb(node) ORDER BY node.kind) FROM public.game_runtime_nodes AS node), '[]'::jsonb),
    'monsters', coalesce((SELECT jsonb_agg(to_jsonb(monster) ORDER BY monster.kind) FROM public.game_runtime_monsters AS monster), '[]'::jsonb),
    'monster_loot', coalesce((SELECT jsonb_agg(to_jsonb(loot) ORDER BY loot.monster_kind, loot.ordinal) FROM public.game_runtime_monster_loot AS loot), '[]'::jsonb),
    'fish', coalesce((SELECT jsonb_agg(to_jsonb(fish) ORDER BY fish.item_id) FROM public.game_runtime_fish AS fish), '[]'::jsonb),
    'fishing_spots', coalesce((SELECT jsonb_agg(to_jsonb(spot) ORDER BY spot.id) FROM public.game_runtime_fishing_spots AS spot), '[]'::jsonb),
    'quests', coalesce((SELECT jsonb_agg(to_jsonb(quest) ORDER BY quest.id) FROM public.game_runtime_quests AS quest), '[]'::jsonb)
  )
$$;

REVOKE ALL ON FUNCTION public.game_level_for_xp(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_upgrade_step_cost(numeric, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_cumulative_upgrade_spend(numeric, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.active_starter_save() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.player_max_hp(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_stale_food(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_quest(jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_add(jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk_inv_give(jsonb, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equip_stat(jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.try_auto_eat(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_player_scores() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_runtime_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_runtime_catalog() TO authenticated;

-- Preserve the proven v1 bodies without rewriting their behavior. The public
-- names below become maintenance/version-guarded dispatchers.
ALTER FUNCTION public.player_sync(jsonb, bigint) RENAME TO player_sync_v1;
ALTER FUNCTION public.profile_set_username(text) RENAME TO profile_set_username_v1;
ALTER FUNCTION public.gear_equip(integer) RENAME TO gear_equip_v1;
ALTER FUNCTION public.gear_upgrade(text) RENAME TO gear_upgrade_v1;
ALTER FUNCTION public.inv_drop(integer) RENAME TO inv_drop_v1;
ALTER FUNCTION public.inv_sell(integer) RENAME TO inv_sell_v1;
ALTER FUNCTION public.bank_gold(text, integer) RENAME TO bank_gold_v1;
ALTER FUNCTION public.bank_item(text, integer, integer) RENAME TO bank_item_v1;
ALTER FUNCTION public.consume_food(integer) RENAME TO consume_food_v1;
ALTER FUNCTION public.player_recover() RENAME TO player_recover_v1;
ALTER FUNCTION public.quest_action(text, text) RENAME TO quest_action_v1;
ALTER FUNCTION public.sell_all_resources() RENAME TO sell_all_resources_v1;
ALTER FUNCTION public.use_potion(text) RENAME TO use_potion_v1;
ALTER FUNCTION public.craft_item(text) RENAME TO craft_item_v1;
ALTER FUNCTION public.harvest_node(integer, numeric, numeric) RENAME TO harvest_node_v1;
ALTER FUNCTION public.fish_cast(integer, numeric, numeric) RENAME TO fish_cast_v1;
ALTER FUNCTION public.attack_monster(integer, numeric, numeric) RENAME TO attack_monster_v1;
ALTER FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) RENAME TO attack_boss_v1;
ALTER FUNCTION public.market_browse() RENAME TO market_browse_v1;
ALTER FUNCTION public.market_list(text, integer, integer, integer) RENAME TO market_list_v1;
ALTER FUNCTION public.market_buy(uuid, integer) RENAME TO market_buy_v1;
ALTER FUNCTION public.market_cancel(uuid) RENAME TO market_cancel_v1;

REVOKE ALL ON FUNCTION public.player_sync_v1(jsonb, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profile_set_username_v1(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gear_equip_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gear_upgrade_v1(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_drop_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_sell_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_gold_v1(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_item_v1(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_food_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.player_recover_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quest_action_v1(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sell_all_resources_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.use_potion_v1(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.craft_item_v1(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.harvest_node_v1(integer, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fish_cast_v1(integer, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attack_monster_v1(integer, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attack_boss_v1(numeric, numeric, numeric, numeric, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_browse_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_list_v1(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_buy_v1(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_cancel_v1(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.player_sync(_data jsonb, _rev bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  RETURN public.player_sync_v1(_data, _rev);
END
$$;

CREATE OR REPLACE FUNCTION public.profile_set_username(_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  RETURN public.profile_set_username_v1(_username);
END
$$;

CREATE OR REPLACE FUNCTION public.bank_gold(_dir text, _amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  RETURN public.bank_gold_v1(_dir, _amount);
END
$$;

CREATE OR REPLACE FUNCTION public.player_recover()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  RETURN public.player_recover_v1();
END
$$;

CREATE OR REPLACE FUNCTION public.inv_drop(_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); slot jsonb;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
  SELECT data->'inv'->_index INTO slot FROM public.player_saves WHERE user_id = uid;
  IF jsonb_typeof(slot) = 'object' AND NOT EXISTS (
    SELECT 1 FROM public.game_runtime_items WHERE id = slot->>'id'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item');
  END IF;
  RETURN public.inv_drop_v1(_index);
END
$$;

CREATE OR REPLACE FUNCTION public.harvest_node(_id integer, _x numeric, _y numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(true);
  RETURN public.harvest_node_v1(_id, _x, _y);
END
$$;

CREATE OR REPLACE FUNCTION public.fish_cast(_spot integer, _x numeric, _y numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(true);
  RETURN public.fish_cast_v1(_spot, _x, _y);
END
$$;

CREATE OR REPLACE FUNCTION public.attack_monster(_id integer, _x numeric, _y numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(true);
  RETURN public.attack_monster_v1(_id, _x, _y);
END
$$;

CREATE OR REPLACE FUNCTION public.attack_boss(
  _x numeric, _y numeric, _bx numeric, _by numeric, _passive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(true);
  RETURN public.attack_boss_v1(_x, _y, _bx, _by, _passive);
END
$$;

CREATE OR REPLACE FUNCTION public.gear_equip(_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid();
  data jsonb;
  slot jsonb;
  definition public.game_runtime_items%ROWTYPE;
  previous jsonb;
  previous_id text;
  previous_plus integer;
  which text;
  plus integer;
  required_level integer;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF public.game_active_content_version() = 'v1' THEN RETURN public.gear_equip_v1(_index); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < -1 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  IF _index = -1 THEN
    data := jsonb_set(data, '{food}', 'null'::jsonb, true);
  ELSE
    slot := data->'inv'->_index;
    IF jsonb_typeof(slot) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;
    SELECT * INTO definition FROM public.game_runtime_items WHERE id = slot->>'id';
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;

    IF definition.kind = 'food' THEN
      data := jsonb_set(data, '{food}', to_jsonb(slot->>'id'), true);
    ELSIF definition.kind IN ('weapon', 'armor') THEN
      IF coalesce((slot->>'qty')::integer, 1) <> 1 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'legacy_stacked_gear');
      END IF;
      plus := coalesce((slot->>'plus')::integer, 0);
      IF plus < 0 OR plus > 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus'); END IF;
      required_level := public.game_level_for_xp(public.skill_xp(data, definition.equip_skill));
      IF required_level < definition.level_requirement THEN
        RETURN jsonb_build_object(
          'ok', false, 'reason', 'low_level', 'req', definition.level_requirement,
          'skill', definition.equip_skill
        );
      END IF;
      which := definition.kind;
      previous := data->which;
      IF previous IS NULL OR jsonb_typeof(previous) = 'null' THEN
        data := jsonb_set(data, ARRAY['inv', _index::text], 'null'::jsonb, true);
      ELSE
        IF jsonb_typeof(previous) = 'string' THEN
          previous_id := previous #>> '{}';
          previous_plus := 0;
        ELSIF jsonb_typeof(previous) = 'object' THEN
          previous_id := previous->>'id';
          previous_plus := coalesce((previous->>'plus')::integer, 0);
        ELSE
          RETURN jsonb_build_object('ok', false, 'reason', 'invalid_equipped');
        END IF;
        IF previous_id IS NULL OR previous_plus < 0 OR previous_plus > 100
           OR NOT EXISTS (SELECT 1 FROM public.game_runtime_items WHERE id = previous_id) THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'invalid_equipped');
        END IF;
        data := jsonb_set(data, ARRAY['inv', _index::text], jsonb_build_object(
          'id', previous_id, 'qty', 1, 'plus', previous_plus
        ), true);
      END IF;
      data := jsonb_set(data, ARRAY[which], jsonb_build_object('id', slot->>'id', 'plus', plus), true);
    ELSE
      RETURN jsonb_build_object('ok', false, 'reason', 'not_equipment');
    END IF;
  END IF;
  UPDATE public.player_saves SET data = public.clear_stale_food(data), updated_at = now() WHERE user_id = uid;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(data));
END
$$;

CREATE OR REPLACE FUNCTION public.gear_upgrade(_which text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid();
  data jsonb;
  equipped jsonb;
  item_id text;
  definition public.game_runtime_items%ROWTYPE;
  plus integer;
  cost numeric;
  gold numeric;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF public.game_active_content_version() = 'v1' THEN RETURN public.gear_upgrade_v1(_which); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _which NOT IN ('weapon', 'armor') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  equipped := data->_which;
  IF jsonb_typeof(equipped) = 'string' THEN
    item_id := equipped #>> '{}'; plus := 0;
    data := jsonb_set(data, ARRAY[_which], jsonb_build_object('id', item_id, 'plus', 0), true);
  ELSIF jsonb_typeof(equipped) = 'object' THEN
    item_id := equipped->>'id'; plus := coalesce((equipped->>'plus')::integer, 0);
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_equipped');
  END IF;
  IF plus < 0 OR plus > 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus'); END IF;
  IF plus >= 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'max'); END IF;
  SELECT * INTO definition FROM public.game_runtime_items
  WHERE id = item_id AND kind = _which AND NOT stackable;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;
  cost := public.game_upgrade_step_cost(definition.value, plus + 1);
  gold := coalesce((data->>'gold')::numeric, 0);
  IF gold < cost THEN RETURN jsonb_build_object('ok', false, 'reason', 'poor', 'cost', cost); END IF;
  data := jsonb_set(data, '{gold}', to_jsonb(gold - cost), true);
  data := jsonb_set(data, ARRAY[_which, 'plus'], to_jsonb(plus + 1), true);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'cost', cost, 'plus', plus + 1, 'state', public.pl_state(data));
END
$$;

CREATE OR REPLACE FUNCTION public.inv_sell(_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; slot jsonb; definition public.game_runtime_items%ROWTYPE;
  qty integer; plus integer; earned numeric;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF public.game_active_content_version() = 'v1' THEN RETURN public.inv_sell_v1(_index); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  slot := data->'inv'->_index;
  IF jsonb_typeof(slot) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;
  SELECT * INTO definition FROM public.game_runtime_items WHERE id = slot->>'id';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;
  qty := coalesce((slot->>'qty')::integer, 1);
  plus := coalesce((slot->>'plus')::integer, 0);
  IF NOT definition.stackable AND qty <> 1 THEN RETURN jsonb_build_object('ok', false, 'reason', 'legacy_stacked_gear'); END IF;
  IF plus < 0 OR plus > 100 OR (definition.stackable AND plus <> 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus');
  END IF;
  IF definition.kind IN ('weapon', 'armor') THEN
    earned := floor(definition.value * 0.40 + public.game_cumulative_upgrade_spend(definition.value, plus) * 0.15);
  ELSE
    earned := floor(definition.value::numeric * qty);
  END IF;
  data := jsonb_set(data, ARRAY['inv', _index::text], 'null'::jsonb, true);
  data := jsonb_set(data, '{gold}', to_jsonb(coalesce((data->>'gold')::numeric, 0) + earned), true);
  data := public.clear_stale_food(data);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'gold', earned, 'state', public.pl_state(data));
END
$$;

CREATE OR REPLACE FUNCTION public.bank_item(_dir text, _index integer, _qty integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; bank jsonb; items jsonb; inv jsonb; slot jsonb;
  take integer; item_stackable boolean; added jsonb; plus integer;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF public.game_active_content_version() = 'v1' THEN RETURN public.bank_item_v1(_dir, _index, _qty); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _dir NOT IN ('in', 'out') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_dir'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  bank := coalesce(data->'bank', jsonb_build_object('gold', 0, 'items', '[]'::jsonb));
  items := coalesce(bank->'items', '[]'::jsonb);
  inv := coalesce(data->'inv', '[]'::jsonb);
  IF _dir = 'in' THEN
    IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
    slot := inv->_index;
  ELSE
    IF _index < 0 OR _index > 59 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
    slot := items->_index;
  END IF;
  IF jsonb_typeof(slot) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;
  SELECT stackable INTO item_stackable FROM public.game_runtime_items WHERE id = slot->>'id';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;
  plus := coalesce((slot->>'plus')::integer, 0);
  IF plus < 0 OR plus > 100 OR (item_stackable AND plus <> 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus');
  END IF;
  IF NOT item_stackable AND coalesce((slot->>'qty')::integer, 1) <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'legacy_stacked_gear');
  END IF;
  take := least(greatest(1, coalesce(_qty, 1)), coalesce((slot->>'qty')::integer, 1));
  IF NOT item_stackable THEN take := 1; END IF;
  IF _dir = 'in' THEN
    added := public.slot_add(items, 60, slot->>'id', take, plus, item_stackable);
    IF added IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bank_full'); END IF;
    items := added;
    IF coalesce((slot->>'qty')::integer, 1) = take THEN
      inv := jsonb_set(inv, ARRAY[_index::text], 'null'::jsonb, true);
    ELSE
      inv := jsonb_set(inv, ARRAY[_index::text, 'qty'], to_jsonb((slot->>'qty')::integer - take), true);
    END IF;
  ELSE
    added := public.slot_add(inv, 20, slot->>'id', take, plus, item_stackable);
    IF added IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;
    inv := added;
    IF coalesce((slot->>'qty')::integer, 1) = take THEN
      items := jsonb_set(items, ARRAY[_index::text], 'null'::jsonb, true);
    ELSE
      items := jsonb_set(items, ARRAY[_index::text, 'qty'], to_jsonb((slot->>'qty')::integer - take), true);
    END IF;
  END IF;
  data := jsonb_set(data, '{inv}', inv, true);
  data := jsonb_set(data, '{bank}', jsonb_set(bank, '{items}', items, true), true);
  data := public.clear_stale_food(data);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(data));
END
$$;

CREATE OR REPLACE FUNCTION public.consume_food(_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; slot jsonb; heal integer; hp integer; max_hp integer;
  qty integer; healed integer := 0;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF public.game_active_content_version() = 'v1' THEN RETURN public.consume_food_v1(_index); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  slot := data->'inv'->_index;
  IF jsonb_typeof(slot) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;
  SELECT item.heal INTO heal FROM public.game_runtime_items AS item
  WHERE item.id = slot->>'id' AND item.kind = 'food' AND item.heal > 0;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_food'); END IF;
  data := jsonb_set(data, '{food}', to_jsonb(slot->>'id'), true);
  max_hp := public.player_max_hp(data);
  hp := least(max_hp, greatest(0, coalesce((data->>'hp')::integer, max_hp)));
  IF hp < max_hp THEN
    IF NOT public.action_gate(uid, 'action:food', interval '2 seconds') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_fast');
    END IF;
    qty := coalesce((slot->>'qty')::integer, 1);
    healed := least(heal, max_hp - hp);
    IF qty <= 1 THEN
      data := jsonb_set(data, ARRAY['inv', _index::text], 'null'::jsonb, true);
    ELSE
      data := jsonb_set(data, ARRAY['inv', _index::text, 'qty'], to_jsonb(qty - 1), true);
    END IF;
    data := jsonb_set(data, '{hp}', to_jsonb(hp + healed), true);
    data := public.clear_stale_food(data);
  END IF;
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'healed', healed, 'food_used', healed > 0, 'state', public.pl_state(data));
END
$$;

CREATE OR REPLACE FUNCTION public.quest_action(_action text, _quest text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; active_id text; definition public.game_runtime_quests%ROWTYPE;
  next_inv jsonb; completed jsonb; reward jsonb; player_level integer;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF public.game_active_content_version() = 'v1' THEN RETURN public.quest_action_v1(_action, _quest); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _action NOT IN ('accept', 'abandon', 'claim') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_action'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  active_id := data#>>'{quest,id}';
  completed := coalesce(data->'completed', '[]'::jsonb);
  IF _action = 'accept' THEN
    IF active_id IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_active'); END IF;
    SELECT * INTO definition FROM public.game_runtime_quests WHERE id = _quest;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
    IF completed @> jsonb_build_array(_quest) THEN RETURN jsonb_build_object('ok', false, 'reason', 'completed'); END IF;
    player_level := public.game_level_for_xp(public.skill_xp(data, definition.xp_skill));
    IF player_level < definition.level_requirement THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'low_level', 'req', definition.level_requirement, 'skill', definition.xp_skill);
    END IF;
    data := jsonb_set(data, '{quest}', jsonb_build_object('id', _quest, 'progress', 0), true);
  ELSIF _action = 'abandon' THEN
    data := jsonb_set(data, '{quest}', 'null'::jsonb, true);
  ELSE
    IF active_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_quest'); END IF;
    SELECT * INTO definition FROM public.game_runtime_quests WHERE id = active_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
    IF coalesce((data#>>'{quest,progress}')::integer, 0) < definition.count THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_ready');
    END IF;
    next_inv := data->'inv';
    FOR reward IN SELECT value FROM jsonb_array_elements(definition.reward_items) AS rewards(value) LOOP
      IF reward->>'item_id' IS NULL OR coalesce((reward->>'qty')::integer, 0) <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_reward');
      END IF;
      next_inv := public.inv_add(next_inv, reward->>'item_id', (reward->>'qty')::integer);
      IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;
    END LOOP;
    data := jsonb_set(data, '{inv}', next_inv, true);
    data := jsonb_set(data, '{gold}', to_jsonb(coalesce((data->>'gold')::numeric, 0) + definition.gold), true);
    data := public.grant_skill_xp(data, definition.xp_skill, definition.xp);
    data := jsonb_set(data, '{completed}', completed || jsonb_build_array(active_id), true);
    data := jsonb_set(data, '{quest}', 'null'::jsonb, true);
  END IF;
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(data));
END
$$;

CREATE OR REPLACE FUNCTION public.sell_all_resources()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; inv jsonb; slot jsonb; definition public.game_runtime_items%ROWTYPE;
  i integer; earned numeric := 0;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF public.game_active_content_version() = 'v1' THEN RETURN public.sell_all_resources_v1(); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  inv := coalesce(data->'inv', '[]'::jsonb);
  IF jsonb_array_length(inv) > 0 THEN
    FOR i IN 0..jsonb_array_length(inv) - 1 LOOP
      slot := inv->i;
      IF jsonb_typeof(slot) <> 'object' THEN CONTINUE; END IF;
      SELECT * INTO definition FROM public.game_runtime_items WHERE id = slot->>'id';
      IF FOUND AND definition.kind = 'resource' THEN
        earned := earned + definition.value::numeric * coalesce((slot->>'qty')::integer, 1);
        inv := jsonb_set(inv, ARRAY[i::text], 'null'::jsonb, true);
      END IF;
    END LOOP;
  END IF;
  IF earned <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'nothing'); END IF;
  data := jsonb_set(data, '{inv}', inv, true);
  data := jsonb_set(data, '{gold}', to_jsonb(coalesce((data->>'gold')::numeric, 0) + earned), true);
  data := public.clear_stale_food(data);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'earned', earned, 'state', public.pl_state(data));
END
$$;

CREATE OR REPLACE FUNCTION public.use_potion(_item text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE uid uuid := auth.uid(); definition public.game_runtime_items%ROWTYPE; data jsonb; next_inv jsonb;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF public.game_active_content_version() = 'v1' THEN RETURN public.use_potion_v1(_item); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO definition FROM public.game_runtime_items WHERE id = _item;
  IF NOT FOUND OR definition.kind <> 'potion' OR definition.dmg_boost <= 0 OR definition.boost_hits <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_potion');
  END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  next_inv := public.inv_remove(data->'inv', _item, 1);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing_item'); END IF;
  data := jsonb_set(data, '{inv}', next_inv, true);
  data := jsonb_set(data, '{buff}', jsonb_build_object(
    'dmg', definition.dmg_boost, 'hits', definition.boost_hits, 'item', _item
  ), true);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'buff', data->'buff', 'state', public.pl_state(data));
END
$$;

CREATE OR REPLACE FUNCTION public.craft_item(_recipe text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); recipe public.game_runtime_recipes%ROWTYPE; save jsonb;
  inv jsonb; next_inv jsonb; input record; before_level integer; after_level integer;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF public.game_active_content_version() = 'v1' THEN RETURN public.craft_item_v1(_recipe); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO recipe FROM public.game_runtime_recipes WHERE id = _recipe;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  IF public.game_level_for_xp(public.skill_xp(save, recipe.skill)) < recipe.level_requirement THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'low_level', 'req', recipe.level_requirement, 'skill', recipe.skill);
  END IF;
  IF NOT public.action_gate(uid, 'craft', make_interval(secs => greatest(recipe.time_s * 0.5, 0.4))) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast');
  END IF;
  inv := coalesce(save->'inv', '[]'::jsonb);
  FOR input IN
    SELECT item_id, qty FROM public.game_runtime_recipe_inputs WHERE recipe_id = recipe.id ORDER BY item_id
  LOOP
    next_inv := public.inv_remove(inv, input.item_id, input.qty);
    IF next_inv IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'missing_materials', 'item', input.item_id);
    END IF;
    inv := next_inv;
  END LOOP;
  next_inv := public.inv_add(inv, recipe.output_item_id, recipe.output_qty);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;
  before_level := public.game_level_for_xp(public.skill_xp(save, recipe.skill));
  save := jsonb_set(save, '{inv}', next_inv, true);
  save := public.grant_skill_xp(save, recipe.skill, recipe.xp);
  after_level := public.game_level_for_xp(public.skill_xp(save, recipe.skill));
  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object(
    'ok', true, 'out', recipe.output_item_id, 'out_qty', recipe.output_qty,
    'skill', recipe.skill, 'xp', recipe.xp, 'leveled', after_level > before_level,
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills')
  );
END
$$;

CREATE OR REPLACE FUNCTION public.market_expire()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  listing public.market_listings%ROWTYPE;
  save jsonb;
  next_inv jsonb;
  definition public.game_runtime_items%ROWTYPE;
BEGIN
  FOR listing IN
    SELECT * FROM public.market_listings WHERE expires_at <= now() FOR UPDATE SKIP LOCKED
  LOOP
    IF listing.content_version <> public.game_active_content_version() THEN
      UPDATE public.market_listings SET expires_at = now() + interval '1 day' WHERE id = listing.id;
      CONTINUE;
    END IF;
    IF listing.seller_id IS NULL THEN
      DELETE FROM public.market_listings WHERE id = listing.id;
      CONTINUE;
    END IF;
    SELECT * INTO definition FROM public.game_runtime_items WHERE id = listing.item_id;
    IF NOT FOUND OR (definition.stackable AND listing.plus <> 0)
       OR (NOT definition.stackable AND listing.qty <> 1) THEN
      UPDATE public.market_listings SET expires_at = now() + interval '1 day' WHERE id = listing.id;
      CONTINUE;
    END IF;
    SELECT data INTO save FROM public.player_saves WHERE user_id = listing.seller_id FOR UPDATE;
    IF save IS NULL THEN
      UPDATE public.market_listings SET expires_at = now() + interval '1 day' WHERE id = listing.id;
      CONTINUE;
    END IF;
    next_inv := public.slot_add(save->'inv', 20, listing.item_id, listing.qty, listing.plus, definition.stackable);
    IF next_inv IS NULL THEN
      UPDATE public.market_listings SET expires_at = now() + interval '1 day' WHERE id = listing.id;
      CONTINUE;
    END IF;
    save := jsonb_set(save, '{inv}', next_inv, true);
    UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = listing.seller_id;
    DELETE FROM public.market_listings WHERE id = listing.id;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.market_browse()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  save jsonb;
  active_version text := public.game_active_content_version();
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.market_expire();
  SELECT data INTO save FROM public.player_saves WHERE user_id = uid;
  RETURN jsonb_build_object(
    'ok', true,
    'listings', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', listing.id, 'item', listing.item_id, 'qty', listing.qty,
        'price', listing.price, 'plus', listing.plus, 'seller', listing.seller_name,
        'mine', (listing.seller_id = uid), 'created_at', listing.created_at,
        'expires_at', listing.expires_at
      ))
      FROM (
        SELECT * FROM public.market_listings
        WHERE content_version = active_version
        ORDER BY created_at DESC LIMIT 300
      ) AS listing
    ), '[]'::jsonb),
    'trades', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', trade.id, 'item', trade.item_id, 'qty', trade.qty,
        'price', trade.price, 'plus', trade.plus, 'seller', trade.seller_name,
        'buyer', trade.buyer_name, 'at', trade.created_at
      ))
      FROM (
        SELECT * FROM public.market_trades
        WHERE content_version = active_version
        ORDER BY created_at DESC LIMIT 30
      ) AS trade
    ), '[]'::jsonb),
    'prices', coalesce((
      SELECT jsonb_agg(jsonb_build_object('item', price.item_id, 'plus', price.plus, 'price', price.price))
      FROM public.market_prices AS price
      WHERE price.content_version = active_version
    ), '[]'::jsonb),
    'state', CASE WHEN save IS NULL THEN NULL ELSE
      jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills') END
  );
END
$$;

CREATE OR REPLACE FUNCTION public.market_list(
  _item text, _qty integer, _price integer, _plus integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid();
  data jsonb;
  next_inv jsonb;
  mine integer;
  definition public.game_runtime_items%ROWTYPE;
  plus integer := coalesce(_plus, 0);
  active_version text := public.game_active_content_version();
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _qty IS NULL OR _qty < 1 OR _qty > 100000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_qty'); END IF;
  IF _price IS NULL OR _price < 1 OR _price > 10000000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_price'); END IF;
  IF plus < 0 OR plus > 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus'); END IF;
  SELECT * INTO definition FROM public.game_runtime_items WHERE id = _item;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;
  IF NOT definition.tradable THEN RETURN jsonb_build_object('ok', false, 'reason', 'untradable'); END IF;
  IF definition.stackable AND plus <> 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus'); END IF;
  IF NOT definition.stackable AND _qty <> 1 THEN RETURN jsonb_build_object('ok', false, 'reason', 'gear_qty'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  SELECT count(*) INTO mine FROM public.market_listings WHERE seller_id = uid;
  IF mine >= 24 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_many_listings'); END IF;
  IF NOT public.action_gate(uid, 'market', interval '0.5 seconds') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast');
  END IF;
  IF NOT definition.stackable AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(data->'inv', '[]'::jsonb)) AS slots(slot)
    WHERE jsonb_typeof(slot) = 'object'
      AND slot->>'id' = _item
      AND coalesce((slot->>'plus')::integer, 0) = plus
      AND coalesce((slot->>'qty')::integer, 1) <> 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'legacy_stacked_gear');
  END IF;
  next_inv := public.mk_inv_take(data->'inv', _item, plus, _qty);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing_items'); END IF;
  data := jsonb_set(data, '{inv}', next_inv, true);
  data := public.clear_stale_food(data);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.market_listings
    (seller_id, seller_name, content_version, item_id, qty, price, plus, expires_at)
  VALUES
    (uid, public.market_player_name(uid), active_version, _item, _qty, _price, plus, now() + interval '14 days');
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(data));
END
$$;

CREATE OR REPLACE FUNCTION public.market_cancel(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); listing public.market_listings%ROWTYPE; data jsonb;
  next_inv jsonb; definition public.game_runtime_items%ROWTYPE;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO listing FROM public.market_listings WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR listing.seller_id IS DISTINCT FROM uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yours');
  END IF;
  IF listing.content_version <> public.game_active_content_version() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_content_version');
  END IF;
  SELECT * INTO definition FROM public.game_runtime_items WHERE id = listing.item_id;
  IF NOT FOUND OR (definition.stackable AND listing.plus <> 0)
     OR (NOT definition.stackable AND listing.qty <> 1) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_listing');
  END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  next_inv := public.slot_add(data->'inv', 20, listing.item_id, listing.qty, listing.plus, definition.stackable);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;
  data := jsonb_set(data, '{inv}', next_inv, true);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  DELETE FROM public.market_listings WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(data));
END
$$;

CREATE OR REPLACE FUNCTION public.market_buy(_id uuid, _qty integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); listing public.market_listings%ROWTYPE; definition public.game_runtime_items%ROWTYPE;
  buyer_data jsonb; seller_data jsonb; next_inv jsonb; wanted integer;
  gross numeric; fee numeric; payout numeric; buyer_name text;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.market_expire();
  SELECT * INTO listing FROM public.market_listings WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'gone'); END IF;
  IF listing.content_version <> public.game_active_content_version() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_content_version');
  END IF;
  IF listing.seller_id = uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'own_listing'); END IF;
  SELECT * INTO definition FROM public.game_runtime_items WHERE id = listing.item_id;
  IF NOT FOUND OR NOT definition.tradable THEN RETURN jsonb_build_object('ok', false, 'reason', 'untradable'); END IF;
  IF listing.plus < 0 OR listing.plus > 100 OR (definition.stackable AND listing.plus <> 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_listing');
  END IF;
  IF NOT definition.stackable AND listing.qty <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_listing');
  END IF;
  wanted := least(greatest(coalesce(_qty, 1), 1), listing.qty);
  IF NOT definition.stackable THEN wanted := 1; END IF;
  gross := listing.price::numeric * wanted::numeric;
  IF gross <= 0 OR gross > 1000000000000::numeric THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_total');
  END IF;
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
  next_inv := public.slot_add(buyer_data->'inv', 20, listing.item_id, wanted, listing.plus, definition.stackable);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;
  buyer_data := jsonb_set(buyer_data, '{inv}', next_inv, true);
  buyer_data := jsonb_set(buyer_data, '{gold}', to_jsonb((buyer_data->>'gold')::numeric - gross), true);
  seller_data := jsonb_set(seller_data, '{gold}', to_jsonb(coalesce((seller_data->>'gold')::numeric, 0) + payout), true);
  UPDATE public.player_saves SET data = buyer_data, updated_at = now() WHERE user_id = uid;
  UPDATE public.player_saves SET data = seller_data, updated_at = now() WHERE user_id = listing.seller_id;
  IF wanted >= listing.qty THEN
    DELETE FROM public.market_listings WHERE id = _id;
  ELSE
    UPDATE public.market_listings SET qty = qty - wanted, updated_at = now() WHERE id = _id;
  END IF;
  buyer_name := public.market_player_name(uid);
  INSERT INTO public.market_trades
    (content_version, item_id, qty, price, plus, seller_name, buyer_name)
  VALUES
    (listing.content_version, listing.item_id, wanted, listing.price, listing.plus, listing.seller_name, buyer_name);
  INSERT INTO public.market_prices (content_version, item_id, plus, price, updated_at)
  VALUES (listing.content_version, listing.item_id, listing.plus, listing.price, now())
  ON CONFLICT (content_version, item_id, plus)
  DO UPDATE SET price = EXCLUDED.price, updated_at = now();
  DELETE FROM public.market_trades WHERE created_at < now() - interval '1 day';
  RETURN jsonb_build_object(
    'ok', true, 'spent', gross, 'item', listing.item_id, 'qty', wanted,
    'content_version', listing.content_version, 'state', public.pl_state(buyer_data)
  );
END
$$;

-- pl_state now depends on active-version level logic and must not claim to be
-- immutable. Its JSON shape is unchanged for both old and dual clients.
ALTER FUNCTION public.pl_state(jsonb) STABLE;

REVOKE ALL ON FUNCTION public.player_sync(jsonb, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_set_username(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gear_equip(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gear_upgrade(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inv_drop(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inv_sell(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bank_gold(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bank_item(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_food(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.player_recover() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quest_action(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sell_all_resources() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.use_potion(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.craft_item(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.harvest_node(integer, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fish_cast(integer, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attack_monster(integer, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.market_browse() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.market_list(text, integer, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.market_buy(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.market_cancel(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.market_expire() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.player_sync(jsonb, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_set_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gear_equip(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gear_upgrade(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inv_drop(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inv_sell(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bank_gold(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bank_item(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_food(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.player_recover() TO authenticated;
GRANT EXECUTE ON FUNCTION public.quest_action(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sell_all_resources() TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_potion(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.craft_item(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.harvest_node(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fish_cast(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attack_monster(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_browse() TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_list(text, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_buy(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_cancel(uuid) TO authenticated;

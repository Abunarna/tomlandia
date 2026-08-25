-- Gate 2: inventory invariants, health settlement, food and quests.

CREATE OR REPLACE FUNCTION public.action_gate(_uid uuid, _key text, _wait interval)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (_uid, _key, now() + _wait)
  ON CONFLICT (user_id, key) DO UPDATE
    SET next_at = EXCLUDED.next_at
    WHERE public.world_cooldowns.next_at <= now();

  -- INSERT/UPDATE affects zero rows when another transaction still owns the
  -- cooldown, so FOUND is an atomic success flag even for a first-use race.
  RETURN FOUND;
END $$;

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

  SELECT game_items.heal INTO heal
  FROM public.game_items
  WHERE id = selected AND kind = 'food' AND coalesce(game_items.heal, 0) > 0;
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
END $$;

CREATE OR REPLACE FUNCTION public.settle_incoming_damage(_uid uuid, _data jsonb, _taken integer, _killer text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  data jsonb := _data;
  max_hp integer := public.player_max_hp(_data);
  hp integer;
  food_result jsonb;
  lost_gold bigint := 0;
  death jsonb := 'null'::jsonb;
BEGIN
  hp := least(max_hp, greatest(0, coalesce((data->>'hp')::integer, max_hp) - greatest(0, coalesce(_taken, 0))));
  data := jsonb_set(data, '{hp}', to_jsonb(hp), true);

  food_result := public.try_auto_eat(_uid, data);
  data := food_result->'data';
  hp := coalesce((data->>'hp')::integer, hp);

  IF hp <= 0 THEN
    lost_gold := floor(coalesce((data->>'gold')::numeric, 0) * 0.10)::bigint;
    data := jsonb_set(data, '{gold}', to_jsonb(greatest(0::numeric, coalesce((data->>'gold')::numeric, 0) - lost_gold)), true);
    data := jsonb_set(data, '{hp}', to_jsonb(ceil(max_hp / 2.0)::integer), true);
    data := jsonb_set(data, '{px}', '1064'::jsonb, true);
    data := jsonb_set(data, '{py}', '2195'::jsonb, true);
    INSERT INTO public.player_positions (user_id, x, y, updated_at)
    VALUES (_uid, 1064, 2195, now())
    ON CONFLICT (user_id) DO UPDATE
      SET x = EXCLUDED.x, y = EXCLUDED.y, updated_at = EXCLUDED.updated_at;
    death := jsonb_build_object(
      'at', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint,
      'reason', format('%s struck you down. A villager rescued you at half health; you lost %s gold (10%%).', _killer, lost_gold),
      'lost_gold', lost_gold
    );
  END IF;

  RETURN jsonb_build_object(
    'data', data,
    'death', death,
    'food_used', coalesce((food_result->>'used')::boolean, false)
  );
END $$;

REVOKE ALL ON FUNCTION public.action_gate(uuid, text, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.try_auto_eat(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_incoming_damage(uuid, jsonb, integer, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gear and container actions
-- ---------------------------------------------------------------------------

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
  definition record;
  previous jsonb;
  previous_id text;
  previous_plus integer;
  which text;
  plus integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < -1 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;

  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  IF _index = -1 THEN
    data := jsonb_set(data, '{food}', 'null'::jsonb, true);
  ELSE
    slot := data->'inv'->_index;
    IF jsonb_typeof(slot) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;
    SELECT * INTO definition FROM public.game_items WHERE id = slot->>'id';
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;

    IF definition.kind = 'food' THEN
      data := jsonb_set(data, '{food}', to_jsonb(slot->>'id'), true);
    ELSIF definition.kind IN ('weapon', 'armor') THEN
      IF coalesce((slot->>'qty')::integer, 1) <> 1 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'legacy_stacked_gear');
      END IF;
      plus := coalesce((slot->>'plus')::integer, 0);
      IF plus < 0 OR plus > 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus'); END IF;
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
           OR NOT EXISTS (SELECT 1 FROM public.game_items WHERE id = previous_id) THEN
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
END $$;

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
  base numeric;
  plus integer;
  cost numeric;
  gold numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _which NOT IN ('weapon', 'armor') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  equipped := data->_which;
  IF jsonb_typeof(equipped) = 'string' THEN
    item_id := equipped #>> '{}';
    plus := 0;
    data := jsonb_set(data, ARRAY[_which], jsonb_build_object('id', item_id, 'plus', 0), true);
  ELSIF jsonb_typeof(equipped) = 'object' THEN
    item_id := equipped->>'id';
    plus := coalesce((equipped->>'plus')::integer, 0);
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_equipped');
  END IF;
  IF plus < 0 OR plus > 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus'); END IF;
  IF plus >= 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'max'); END IF;

  SELECT coalesce(attack, defense, 1) INTO base FROM public.game_items WHERE id = item_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;
  cost := round((25 + base * 0.6) * power(2::numeric, floor(plus / 5)) * (1 + (plus % 5) * 0.25));
  gold := coalesce((data->>'gold')::numeric, 0);
  IF gold < cost THEN RETURN jsonb_build_object('ok', false, 'reason', 'poor', 'cost', cost); END IF;

  data := jsonb_set(data, '{gold}', to_jsonb(gold - cost), true);
  data := jsonb_set(data, ARRAY[_which, 'plus'], to_jsonb(plus + 1), true);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'cost', cost, 'plus', plus + 1, 'state', public.pl_state(data));
END $$;

CREATE OR REPLACE FUNCTION public.inv_drop(_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE uid uuid := auth.uid(); data jsonb; slot jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  slot := data->'inv'->_index;
  IF jsonb_typeof(slot) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;
  data := jsonb_set(data, ARRAY['inv', _index::text], 'null'::jsonb, true);
  data := public.clear_stale_food(data);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'item', slot->>'id', 'state', public.pl_state(data));
END $$;

CREATE OR REPLACE FUNCTION public.inv_sell(_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; slot jsonb; definition public.game_items%ROWTYPE;
  qty integer; plus integer; earned numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  slot := data->'inv'->_index;
  IF jsonb_typeof(slot) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;
  SELECT * INTO definition FROM public.game_items WHERE id = slot->>'id';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;
  qty := coalesce((slot->>'qty')::integer, 1);
  plus := coalesce((slot->>'plus')::integer, 0);
  IF NOT definition.stackable AND qty <> 1 THEN RETURN jsonb_build_object('ok', false, 'reason', 'legacy_stacked_gear'); END IF;
  IF plus < 0 OR plus > 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus'); END IF;
  earned := greatest(0, floor(definition.value::numeric * qty * (1 + 0.1 * plus)));
  data := jsonb_set(data, ARRAY['inv', _index::text], 'null'::jsonb, true);
  data := jsonb_set(data, '{gold}', to_jsonb(coalesce((data->>'gold')::numeric, 0) + earned), true);
  data := public.clear_stale_food(data);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'gold', earned, 'state', public.pl_state(data));
END $$;

-- Move gold with arbitrary-precision arithmetic. The original routine used
-- int4 locals, which overflowed for successful long-lived characters.
CREATE OR REPLACE FUNCTION public.bank_gold(_dir text, _amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; bank jsonb;
  purse numeric; vault numeric; amount numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _dir NOT IN ('in', 'out') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_dir'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  bank := coalesce(data->'bank', jsonb_build_object('gold', 0, 'items', '[]'::jsonb));
  purse := greatest(0, coalesce((data->>'gold')::numeric, 0));
  vault := greatest(0, coalesce((bank->>'gold')::numeric, 0));
  amount := greatest(0, coalesce(_amount, 0)::numeric);
  IF _dir = 'in' THEN
    amount := least(amount, purse);
    purse := purse - amount;
    vault := vault + amount;
  ELSE
    amount := least(amount, vault);
    vault := vault - amount;
    purse := purse + amount;
  END IF;
  IF amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'nothing'); END IF;
  data := jsonb_set(data, '{gold}', to_jsonb(purse), true);
  data := jsonb_set(data, '{bank}', jsonb_set(bank, '{gold}', to_jsonb(vault), true), true);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(data));
END $$;

CREATE OR REPLACE FUNCTION public.bank_item(_dir text, _index integer, _qty integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; bank jsonb; items jsonb; inv jsonb; slot jsonb;
  take integer; stackable boolean; added jsonb; plus integer;
BEGIN
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
  SELECT game_items.stackable INTO stackable FROM public.game_items WHERE id = slot->>'id';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;
  plus := coalesce((slot->>'plus')::integer, 0);
  IF plus < 0 OR plus > 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus'); END IF;
  IF NOT stackable AND coalesce((slot->>'qty')::integer, 1) <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'legacy_stacked_gear');
  END IF;
  take := least(greatest(1, coalesce(_qty, 1)), coalesce((slot->>'qty')::integer, 1));
  IF NOT stackable THEN take := 1; END IF;

  IF _dir = 'in' THEN
    added := public.slot_add(items, 60, slot->>'id', take, plus, stackable);
    IF added IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bank_full'); END IF;
    items := added;
    IF coalesce((slot->>'qty')::integer, 1) = take THEN
      inv := jsonb_set(inv, ARRAY[_index::text], 'null'::jsonb, true);
    ELSE
      inv := jsonb_set(inv, ARRAY[_index::text, 'qty'], to_jsonb((slot->>'qty')::integer - take), true);
    END IF;
  ELSE
    added := public.slot_add(inv, 20, slot->>'id', take, plus, stackable);
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
END $$;

-- ---------------------------------------------------------------------------
-- Food, recovery, quest and resource-sale RPCs
-- ---------------------------------------------------------------------------

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
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  slot := data->'inv'->_index;
  IF jsonb_typeof(slot) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;
  SELECT game_items.heal INTO heal FROM public.game_items WHERE id = slot->>'id' AND kind = 'food';
  IF NOT FOUND OR coalesce(heal, 0) <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_food'); END IF;

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
END $$;

CREATE OR REPLACE FUNCTION public.player_recover()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; max_hp integer; hp integer; food_result jsonb;
  combat_until timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT next_at INTO combat_until FROM public.world_cooldowns WHERE user_id = uid AND key = 'combat:last';
  IF combat_until IS NOT NULL AND now() < combat_until THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'in_combat');
  END IF;
  IF NOT public.action_gate(uid, 'action:recovery', interval '2.5 seconds') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast');
  END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  max_hp := public.player_max_hp(data);
  hp := least(max_hp, greatest(0, coalesce((data->>'hp')::integer, max_hp)));
  hp := least(max_hp, hp + 1 + floor(max_hp * 0.01)::integer);
  data := jsonb_set(data, '{hp}', to_jsonb(hp), true);
  food_result := public.try_auto_eat(uid, data);
  data := food_result->'data';
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object(
    'ok', true,
    'food_used', coalesce((food_result->>'used')::boolean, false),
    'state', public.pl_state(data)
  );
END $$;

CREATE OR REPLACE FUNCTION public.quest_action(_action text, _quest text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; active_id text; definition public.game_quests%ROWTYPE;
  next_inv jsonb; completed jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _action NOT IN ('accept', 'abandon', 'claim') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_action'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  active_id := data#>>'{quest,id}';
  completed := coalesce(data->'completed', '[]'::jsonb);

  IF _action = 'accept' THEN
    IF active_id IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_active'); END IF;
    SELECT * INTO definition FROM public.game_quests WHERE id = _quest;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
    IF completed @> jsonb_build_array(_quest) THEN RETURN jsonb_build_object('ok', false, 'reason', 'completed'); END IF;
    data := jsonb_set(data, '{quest}', jsonb_build_object('id', _quest, 'progress', 0), true);
  ELSIF _action = 'abandon' THEN
    data := jsonb_set(data, '{quest}', 'null'::jsonb, true);
  ELSE
    IF active_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_quest'); END IF;
    SELECT * INTO definition FROM public.game_quests WHERE id = active_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
    IF coalesce((data#>>'{quest,progress}')::integer, 0) < definition.target_count THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_ready');
    END IF;
    IF definition.reward_item IS NOT NULL THEN
      next_inv := public.inv_add(data->'inv', definition.reward_item, 1);
      IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;
      data := jsonb_set(data, '{inv}', next_inv, true);
    END IF;
    data := jsonb_set(data, '{gold}', to_jsonb(coalesce((data->>'gold')::numeric, 0) + definition.gold), true);
    data := public.grant_skill_xp(data, definition.xp_skill, definition.xp);
    data := jsonb_set(data, '{completed}', completed || jsonb_build_array(active_id), true);
    data := jsonb_set(data, '{quest}', 'null'::jsonb, true);
  END IF;

  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(data));
END $$;

CREATE OR REPLACE FUNCTION public.sell_all_resources()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; inv jsonb; slot jsonb; definition public.game_items%ROWTYPE;
  i integer; earned numeric := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  inv := coalesce(data->'inv', '[]'::jsonb);
  IF jsonb_array_length(inv) > 0 THEN
    FOR i IN 0..jsonb_array_length(inv) - 1 LOOP
      slot := inv->i;
      IF jsonb_typeof(slot) <> 'object' THEN CONTINUE; END IF;
      SELECT * INTO definition FROM public.game_items WHERE id = slot->>'id';
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
END $$;

CREATE OR REPLACE FUNCTION public.use_potion(_item text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE uid uuid := auth.uid(); definition public.game_items%ROWTYPE; data jsonb; next_inv jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO definition FROM public.game_items WHERE id = _item;
  IF NOT FOUND OR definition.kind <> 'potion' OR coalesce(definition.dmg_boost, 0) <= 0 OR coalesce(definition.boost_hits, 0) <= 0 THEN
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
END $$;

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

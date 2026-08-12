-- Helper: the server-owned slice of a save row returned to the client.
CREATE OR REPLACE FUNCTION public.pl_state(_d jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'inv', coalesce(_d->'inv', '[]'::jsonb),
    'gold', coalesce(_d->'gold', '0'::jsonb),
    'skills', coalesce(_d->'skills', '{}'::jsonb),
    'weapon', _d->'weapon',
    'armor', _d->'armor',
    'food', _d->'food',
    'bank', coalesce(_d->'bank', jsonb_build_object('gold', 0, 'items', '[]'::jsonb))
  )
$$;

-- Helper: add a stack into a fixed-size slot array (stacking by item id, like the client).
CREATE OR REPLACE FUNCTION public.slot_add(_arr jsonb, _size int, _id text, _qty int, _plus int, _stackable boolean)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE i int; el jsonb;
BEGIN
  IF _stackable THEN
    FOR i IN 0.._size - 1 LOOP
      el := _arr->i;
      IF el IS NOT NULL AND el <> 'null'::jsonb AND el->>'id' = _id THEN
        RETURN jsonb_set(_arr, ARRAY[i::text],
          jsonb_set(el, '{qty}', to_jsonb(coalesce((el->>'qty')::int, 0) + _qty)));
      END IF;
    END LOOP;
  END IF;
  FOR i IN 0.._size - 1 LOOP
    el := _arr->i;
    IF el IS NULL OR el = 'null'::jsonb THEN
      RETURN jsonb_set(_arr, ARRAY[i::text],
        jsonb_build_object('id', _id, 'qty', _qty, 'plus', _plus), true);
    END IF;
  END LOOP;
  RETURN NULL; -- container full
END $$;

REVOKE ALL ON FUNCTION public.pl_state(jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.slot_add(jsonb, int, text, int, int, boolean) FROM public, anon, authenticated;

-- Equip / unequip (or set a snack) atomically under a row lock.
CREATE OR REPLACE FUNCTION public.gear_equip(_index int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  d jsonb; slot jsonb; def record; prev jsonb; which text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;

  SELECT data INTO d FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  slot := d->'inv'->_index;
  IF slot IS NULL OR slot = 'null'::jsonb THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;

  SELECT * INTO def FROM public.game_items WHERE id = slot->>'id';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;

  IF def.kind = 'food' THEN
    d := jsonb_set(d, '{food}', to_jsonb(slot->>'id'), true);
  ELSIF def.kind IN ('weapon', 'armor') THEN
    which := def.kind;
    prev := d->which;
    d := jsonb_set(d, ARRAY[which], jsonb_build_object(
      'id', slot->>'id', 'plus', coalesce((slot->>'plus')::int, 0)), true);
    IF prev IS NULL OR prev = 'null'::jsonb THEN
      d := jsonb_set(d, ARRAY['inv', _index::text], 'null'::jsonb, true);
    ELSE
      d := jsonb_set(d, ARRAY['inv', _index::text], jsonb_build_object(
        'id', prev->>'id', 'qty', 1, 'plus', coalesce((prev->>'plus')::int, 0)), true);
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'not_equipment');
  END IF;

  UPDATE public.player_saves SET data = d WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(d));
END $$;

-- Upgrade the equipped weapon/armor (+1), paying gold, atomically.
CREATE OR REPLACE FUNCTION public.gear_upgrade(_which text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  d jsonb; eq jsonb; base numeric; plus int; cost int; gold int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _which NOT IN ('weapon', 'armor') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;

  SELECT data INTO d FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  eq := d->_which;
  IF eq IS NULL OR eq = 'null'::jsonb THEN RETURN jsonb_build_object('ok', false, 'reason', 'nothing_equipped'); END IF;

  plus := coalesce((eq->>'plus')::int, 0);
  IF plus >= 25 THEN RETURN jsonb_build_object('ok', false, 'reason', 'max'); END IF;

  SELECT coalesce(attack, defense, 1) INTO base FROM public.game_items WHERE id = eq->>'id';
  IF base IS NULL THEN base := 1; END IF;

  cost := round((25 + base * 0.6) * power(2, floor(plus / 5)) * (1 + (plus % 5) * 0.25));
  gold := coalesce((d->>'gold')::int, 0);
  IF gold < cost THEN RETURN jsonb_build_object('ok', false, 'reason', 'poor', 'cost', cost); END IF;

  d := jsonb_set(d, '{gold}', to_jsonb(gold - cost), true);
  d := jsonb_set(d, ARRAY[_which, 'plus'], to_jsonb(plus + 1), true);

  UPDATE public.player_saves SET data = d WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'cost', cost, 'plus', plus + 1, 'state', public.pl_state(d));
END $$;

-- Discard a bag stack.
CREATE OR REPLACE FUNCTION public.inv_drop(_index int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d jsonb; slot jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;

  SELECT data INTO d FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  slot := d->'inv'->_index;
  IF slot IS NULL OR slot = 'null'::jsonb THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;

  d := jsonb_set(d, ARRAY['inv', _index::text], 'null'::jsonb, true);
  UPDATE public.player_saves SET data = d WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'item', slot->>'id', 'state', public.pl_state(d));
END $$;

-- Move gold between purse and bank.
CREATE OR REPLACE FUNCTION public.bank_gold(_dir text, _amount int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d jsonb; bank jsonb; purse int; vault int; amt int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _dir NOT IN ('in', 'out') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_dir'); END IF;

  SELECT data INTO d FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  bank := coalesce(d->'bank', jsonb_build_object('gold', 0, 'items', '[]'::jsonb));
  purse := coalesce((d->>'gold')::int, 0);
  vault := coalesce((bank->>'gold')::int, 0);
  amt := greatest(0, coalesce(_amount, 0));

  IF _dir = 'in' THEN
    amt := least(amt, purse);
    purse := purse - amt; vault := vault + amt;
  ELSE
    amt := least(amt, vault);
    vault := vault - amt; purse := purse + amt;
  END IF;
  IF amt <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'nothing'); END IF;

  d := jsonb_set(d, '{gold}', to_jsonb(purse), true);
  d := jsonb_set(d, '{bank}', jsonb_set(bank, '{gold}', to_jsonb(vault), true), true);
  UPDATE public.player_saves SET data = d WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(d));
END $$;

-- Move an item stack between bag and bank.
CREATE OR REPLACE FUNCTION public.bank_item(_dir text, _index int, _qty int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  d jsonb; bank jsonb; items jsonb; inv jsonb; slot jsonb; take int; stackable boolean; added jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _dir NOT IN ('in', 'out') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_dir'); END IF;

  SELECT data INTO d FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  bank := coalesce(d->'bank', jsonb_build_object('gold', 0, 'items', '[]'::jsonb));
  items := coalesce(bank->'items', '[]'::jsonb);
  inv := coalesce(d->'inv', '[]'::jsonb);

  IF _dir = 'in' THEN
    IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
    slot := inv->_index;
  ELSE
    IF _index < 0 OR _index > 59 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;
    slot := items->_index;
  END IF;
  IF slot IS NULL OR slot = 'null'::jsonb THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;

  take := least(greatest(1, coalesce(_qty, 1)), coalesce((slot->>'qty')::int, 1));
  SELECT game_items.stackable INTO stackable FROM public.game_items WHERE id = slot->>'id';
  stackable := coalesce(stackable, true);

  IF _dir = 'in' THEN
    added := public.slot_add(items, 60, slot->>'id', take, coalesce((slot->>'plus')::int, 0), stackable);
    IF added IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bank_full'); END IF;
    items := added;
    IF coalesce((slot->>'qty')::int, 1) - take <= 0 THEN
      inv := jsonb_set(inv, ARRAY[_index::text], 'null'::jsonb, true);
    ELSE
      inv := jsonb_set(inv, ARRAY[_index::text],
        jsonb_set(slot, '{qty}', to_jsonb(coalesce((slot->>'qty')::int, 1) - take)), true);
    END IF;
  ELSE
    added := public.slot_add(inv, 20, slot->>'id', take, coalesce((slot->>'plus')::int, 0), stackable);
    IF added IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;
    inv := added;
    IF coalesce((slot->>'qty')::int, 1) - take <= 0 THEN
      items := jsonb_set(items, ARRAY[_index::text], 'null'::jsonb, true);
    ELSE
      items := jsonb_set(items, ARRAY[_index::text],
        jsonb_set(slot, '{qty}', to_jsonb(coalesce((slot->>'qty')::int, 1) - take)), true);
    END IF;
  END IF;

  d := jsonb_set(d, '{inv}', inv, true);
  d := jsonb_set(d, '{bank}', jsonb_set(bank, '{items}', items, true), true);
  UPDATE public.player_saves SET data = d WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(d));
END $$;

REVOKE ALL ON FUNCTION public.gear_equip(int) FROM public, anon;
REVOKE ALL ON FUNCTION public.gear_upgrade(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.inv_drop(int) FROM public, anon;
REVOKE ALL ON FUNCTION public.bank_gold(text, int) FROM public, anon;
REVOKE ALL ON FUNCTION public.bank_item(text, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gear_equip(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gear_upgrade(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inv_drop(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bank_gold(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bank_item(text, int, int) TO authenticated;

-- Equipment, snack and bank are server-owned now: a stale client copy must not
-- overwrite them during a conflicting cloud save.
CREATE OR REPLACE FUNCTION public.player_sync(_data jsonb, _rev bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  cur_data jsonb;
  cur_rev bigint;
  merged jsonb;
  conflicted boolean := false;
  k text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_data');
  END IF;

  SELECT data, rev INTO cur_data, cur_rev
    FROM public.player_saves WHERE user_id = uid FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.player_saves (user_id, data) VALUES (uid, _data);
    SELECT data, rev INTO cur_data, cur_rev FROM public.player_saves WHERE user_id = uid;
    RETURN jsonb_build_object('ok', true, 'rev', cur_rev, 'conflict', false, 'data', cur_data);
  END IF;

  IF _rev IS NOT NULL AND _rev = cur_rev THEN
    merged := _data;
  ELSE
    conflicted := true;
    merged := cur_data;
    FOREACH k IN ARRAY ARRAY['v','px','py','hp','quest','completed','discovered','clock'] LOOP
      IF _data ? k THEN merged := jsonb_set(merged, ARRAY[k], _data->k, true); END IF;
    END LOOP;
  END IF;

  UPDATE public.player_saves SET data = merged WHERE user_id = uid;
  SELECT data, rev INTO cur_data, cur_rev FROM public.player_saves WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'rev', cur_rev, 'conflict', conflicted, 'data', cur_data);
END $$;
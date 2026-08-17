CREATE OR REPLACE FUNCTION public.slot_add(_arr jsonb, _size int, _id text, _qty int, _plus int, _stackable boolean)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE i int; el jsonb;
BEGIN
  -- Everything stacks now; gear only merges when the upgrade level matches.
  FOR i IN 0.._size - 1 LOOP
    el := _arr->i;
    IF el IS NOT NULL AND el <> 'null'::jsonb AND el->>'id' = _id
       AND coalesce((el->>'plus')::int, 0) = coalesce(_plus, 0) THEN
      RETURN jsonb_set(_arr, ARRAY[i::text],
        jsonb_set(el, '{qty}', to_jsonb(coalesce((el->>'qty')::int, 0) + _qty)));
    END IF;
  END LOOP;
  FOR i IN 0.._size - 1 LOOP
    el := _arr->i;
    IF el IS NULL OR el = 'null'::jsonb THEN
      RETURN jsonb_set(_arr, ARRAY[i::text],
        jsonb_build_object('id', _id, 'qty', _qty, 'plus', coalesce(_plus, 0)), true);
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.inv_add(_inv jsonb, _item text, _qty integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE inv jsonb := coalesce(_inv, '[]'::jsonb); i int; s jsonb;
BEGIN
  WHILE jsonb_array_length(inv) < 20 LOOP inv := inv || 'null'::jsonb; END LOOP;
  FOR i IN 0 .. jsonb_array_length(inv) - 1 LOOP
    s := inv->i;
    IF jsonb_typeof(s) = 'object' AND s->>'id' = _item
       AND coalesce((s->>'plus')::int, 0) = 0 THEN
      RETURN jsonb_set(inv, ARRAY[i::text], jsonb_set(s, '{qty}', to_jsonb(((s->>'qty')::int + _qty))));
    END IF;
  END LOOP;
  FOR i IN 0 .. jsonb_array_length(inv) - 1 LOOP
    IF jsonb_typeof(inv->i) <> 'object' THEN
      RETURN jsonb_set(inv, ARRAY[i::text], jsonb_build_object('id', _item, 'qty', _qty, 'plus', 0));
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.gear_equip(_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  d jsonb; slot jsonb; def record; prev jsonb; which text; qty int; inv jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < -1 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;

  SELECT data INTO d FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  IF _index = -1 THEN
    d := jsonb_set(d, '{food}', 'null'::jsonb, true);
    UPDATE public.player_saves SET data = d WHERE user_id = uid;
    RETURN jsonb_build_object('ok', true, 'state', public.pl_state(d));
  END IF;

  slot := d->'inv'->_index;
  IF slot IS NULL OR slot = 'null'::jsonb THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;

  SELECT * INTO def FROM public.game_items WHERE id = slot->>'id';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;

  IF def.kind = 'food' THEN
    d := jsonb_set(d, '{food}', to_jsonb(slot->>'id'), true);
  ELSIF def.kind IN ('weapon', 'armor') THEN
    which := def.kind;
    prev := d->which;
    qty := coalesce((slot->>'qty')::int, 1);
    IF qty > 1 THEN
      d := jsonb_set(d, ARRAY['inv', _index::text], jsonb_set(slot, '{qty}', to_jsonb(qty - 1)));
      IF prev IS NOT NULL AND prev <> 'null'::jsonb THEN
        inv := public.slot_add(d->'inv', 20, prev->>'id', 1, coalesce((prev->>'plus')::int, 0), true);
        IF inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;
        d := jsonb_set(d, '{inv}', inv);
      END IF;
    ELSIF prev IS NULL OR prev = 'null'::jsonb THEN
      d := jsonb_set(d, ARRAY['inv', _index::text], 'null'::jsonb, true);
    ELSE
      d := jsonb_set(d, ARRAY['inv', _index::text], jsonb_build_object(
        'id', prev->>'id', 'qty', 1, 'plus', coalesce((prev->>'plus')::int, 0)), true);
    END IF;
    d := jsonb_set(d, ARRAY[which], jsonb_build_object(
      'id', slot->>'id', 'plus', coalesce((slot->>'plus')::int, 0)), true);
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'not_equipment');
  END IF;

  UPDATE public.player_saves SET data = d WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(d));
END $function$;
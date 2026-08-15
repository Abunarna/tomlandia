CREATE OR REPLACE FUNCTION public.gear_equip(_index integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  d jsonb; slot jsonb; def record; prev jsonb; which text;
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
END $function$;
CREATE OR REPLACE FUNCTION public.inv_sell(_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); d jsonb; slot jsonb; val integer; plus integer; qty integer; earned integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index < 0 OR _index > 19 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;

  SELECT data INTO d FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  slot := d->'inv'->_index;
  IF slot IS NULL OR slot = 'null'::jsonb THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;

  SELECT value INTO val FROM public.game_items WHERE id = slot->>'id';
  IF val IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;

  qty := COALESCE((slot->>'qty')::int, 1);
  plus := COALESCE((slot->>'plus')::int, 0);
  earned := GREATEST(0, floor(val * qty * (1 + 0.1 * plus))::int);

  d := jsonb_set(d, ARRAY['inv', _index::text], 'null'::jsonb, true);
  d := jsonb_set(d, '{gold}', to_jsonb(COALESCE((d->>'gold')::int, 0) + earned), true);
  UPDATE public.player_saves SET data = d WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'gold', earned, 'state', public.pl_state(d));
END $$;

REVOKE ALL ON FUNCTION public.inv_sell(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.inv_sell(integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.gear_upgrade(_which text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  d jsonb; eq jsonb; base numeric; plus int; cost bigint; gold int; c numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _which NOT IN ('weapon', 'armor') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot'); END IF;

  SELECT data INTO d FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  eq := d->_which;
  IF eq IS NULL OR eq = 'null'::jsonb THEN RETURN jsonb_build_object('ok', false, 'reason', 'nothing_equipped'); END IF;

  plus := coalesce((eq->>'plus')::int, 0);
  IF plus >= 1000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'max'); END IF;

  SELECT coalesce(attack, defense, 1) INTO base FROM public.game_items WHERE id = eq->>'id';
  IF base IS NULL THEN base := 1; END IF;

  -- cost doubles every 5 upgrade levels, forever
  c := (25 + base * 0.6) * power(2::numeric, floor(plus / 5)) * (1 + (plus % 5) * 0.25);
  IF c > 9223372036854775000::numeric THEN cost := 9223372036854775000; ELSE cost := round(c); END IF;

  gold := coalesce((d->>'gold')::int, 0);
  IF gold < cost THEN RETURN jsonb_build_object('ok', false, 'reason', 'poor', 'cost', cost); END IF;

  d := jsonb_set(d, '{gold}', to_jsonb(gold - cost), true);
  d := jsonb_set(d, ARRAY[_which, 'plus'], to_jsonb(plus + 1), true);

  UPDATE public.player_saves SET data = d WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'cost', cost, 'plus', plus + 1, 'state', public.pl_state(d));
END $$;
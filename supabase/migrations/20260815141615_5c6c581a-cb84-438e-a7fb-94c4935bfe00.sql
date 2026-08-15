-- see /tmp/mig.sql
CREATE OR REPLACE FUNCTION public.equip_stat(_data jsonb, _which text, _stat text)
RETURNS numeric LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE e jsonb; eid text; plus int := 0; base numeric := 0;
BEGIN
  e := _data->_which;
  IF e IS NULL OR jsonb_typeof(e) = 'null' THEN RETURN 0; END IF;
  IF jsonb_typeof(e) = 'string' THEN eid := e #>> '{}';
  ELSE eid := e->>'id'; plus := least(greatest(coalesce((e->>'plus')::int, 0), 0), 1000);
  END IF;
  IF _stat = 'speed' THEN
    SELECT coalesce(gi.speed, 0) INTO base FROM public.game_items gi WHERE gi.id = eid;
    RETURN coalesce(base, 0);
  ELSIF _stat = 'attack' THEN SELECT coalesce(gi.attack, 0) INTO base FROM public.game_items gi WHERE gi.id = eid;
  ELSE SELECT coalesce(gi.defense, 0) INTO base FROM public.game_items gi WHERE gi.id = eid;
  END IF;
  RETURN round(coalesce(base, 0) * (1 + plus * 0.05) * 10) / 10;
END $$;

REVOKE ALL ON FUNCTION public.equip_stat(jsonb, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gear_upgrade(_which text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  d jsonb; eq jsonb; base numeric; plus int; capped int; cost bigint; gold int; c numeric;
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

  capped := least(plus, 25);
  c := (25 + base * 0.6) * power(2, floor(capped / 5)) * (1 + (capped % 5) * 0.25);
  IF plus > 25 THEN c := c * (1 + (plus - 25) * 0.35); END IF;
  cost := round(c);

  gold := coalesce((d->>'gold')::int, 0);
  IF gold < cost THEN RETURN jsonb_build_object('ok', false, 'reason', 'poor', 'cost', cost); END IF;

  d := jsonb_set(d, '{gold}', to_jsonb(gold - cost), true);
  d := jsonb_set(d, ARRAY[_which, 'plus'], to_jsonb(plus + 1), true);

  UPDATE public.player_saves SET data = d WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'cost', cost, 'plus', plus + 1, 'state', public.pl_state(d));
END $$;
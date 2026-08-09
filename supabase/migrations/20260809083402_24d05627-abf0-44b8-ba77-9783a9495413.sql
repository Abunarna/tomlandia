
CREATE OR REPLACE FUNCTION public.fish_cast(_spot integer, _x numeric, _y numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  sp public.game_fishing_spots%ROWTYPE;
  save jsonb;
  cd timestamptz;
  lvl int;
  t numeric;
  lo int;
  hi int;
  f record;
  total numeric := 0;
  roll numeric;
  acc numeric := 0;
  caught text;
  caught_xp numeric := 0;
  next_inv jsonb;
  before_lvl int;
  after_lvl int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.track_position(uid, _x, _y) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;

  SELECT * INTO sp FROM public.game_fishing_spots WHERE id = _spot;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF sqrt(power(_x - sp.x, 2) + power(_y - sp.y, 2)) > 70 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;

  SELECT next_at INTO cd FROM public.world_cooldowns WHERE user_id = uid AND key = 'fish:' || _spot;
  IF cd IS NOT NULL AND now() < cd THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast');
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'fish:' || _spot, now() + interval '2.4 seconds')
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  lvl := public.xp_level(public.skill_xp(save, 'fishing'));

  IF lvl <= 1 THEN lo := 1; hi := 1; t := 0;
  ELSIF lvl < 15 THEN lo := 1; hi := 2; t := (lvl - 1) / 14.0;
  ELSIF lvl < 40 THEN lo := 2; hi := 3; t := (lvl - 15) / 25.0;
  ELSIF lvl < 70 THEN lo := 3; hi := 4; t := (lvl - 40) / 30.0;
  ELSIF lvl < 100 THEN lo := 4; hi := 5; t := (lvl - 70) / 30.0;
  ELSE lo := 5; hi := 5; t := 0;
  END IF;

  SELECT sum((1 - t) * (ARRAY[w1, w15, w40, w70, w100])[lo] + t * (ARRAY[w1, w15, w40, w70, w100])[hi])
    INTO total FROM public.game_fish;
  IF total IS NULL OR total <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_fish'); END IF;

  roll := random() * total;
  FOR f IN
    SELECT item_id, xp,
           ((1 - t) * (ARRAY[w1, w15, w40, w70, w100])[lo] + t * (ARRAY[w1, w15, w40, w70, w100])[hi]) AS weight
      FROM public.game_fish ORDER BY xp
  LOOP
    acc := acc + f.weight;
    IF roll <= acc THEN
      caught := f.item_id;
      caught_xp := f.xp;
      EXIT;
    END IF;
  END LOOP;
  IF caught IS NULL THEN
    SELECT item_id, xp INTO caught, caught_xp FROM public.game_fish ORDER BY xp LIMIT 1;
  END IF;

  next_inv := public.inv_add(save->'inv', caught, 1);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;

  before_lvl := lvl;
  save := jsonb_set(save, '{inv}', next_inv);
  save := public.grant_skill_xp(save, 'fishing', caught_xp);
  after_lvl := public.xp_level(public.skill_xp(save, 'fishing'));

  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true, 'item', caught, 'qty', 1, 'skill', 'fishing', 'xp', caught_xp,
    'leveled', after_lvl > before_lvl, 'level', after_lvl,
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills')
  );
END $$;
REVOKE ALL ON FUNCTION public.fish_cast(integer, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fish_cast(integer, numeric, numeric) TO authenticated;

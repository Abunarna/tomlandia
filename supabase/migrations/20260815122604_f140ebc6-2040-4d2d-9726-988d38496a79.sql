CREATE OR REPLACE FUNCTION public.fish_cast(_spot integer, _x numeric, _y numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  sp public.game_fishing_spots%ROWTYPE;
  save jsonb;
  cd timestamptz;
  lvl int;
  t numeric;
  f record;
  start_pct numeric[] := ARRAY[90, 4, 3, 2, 1];
  end_pct numeric[] := ARRAY[20, 20, 20, 20, 20];
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
  t := (LEAST(GREATEST(lvl, 1), 100) - 1) / 99.0;

  roll := random() * 100;
  FOR f IN
    SELECT item_id, xp, row_number() OVER (ORDER BY xp) AS rank
      FROM public.game_fish
  LOOP
    acc := acc + (start_pct[f.rank] + t * (end_pct[f.rank] - start_pct[f.rank]));
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
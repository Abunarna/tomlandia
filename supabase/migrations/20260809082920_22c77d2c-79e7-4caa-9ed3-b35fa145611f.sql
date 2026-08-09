
-- fishing spots (jetty deck ends) -------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_fishing_spots (
  id int PRIMARY KEY,
  x numeric NOT NULL,
  y numeric NOT NULL,
  lake text NOT NULL
);
GRANT SELECT ON public.game_fishing_spots TO authenticated;
GRANT ALL ON public.game_fishing_spots TO service_role;
ALTER TABLE public.game_fishing_spots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fishing spots readable" ON public.game_fishing_spots;
CREATE POLICY "fishing spots readable" ON public.game_fishing_spots FOR SELECT TO authenticated USING (true);

DELETE FROM public.game_fishing_spots;
INSERT INTO public.game_fishing_spots (id, x, y, lake) VALUES
  (1, 362.9, 686.4, 'fields'),
  (2, 240.2, 717.4, 'fields'),
  (3, 1558.1, 267.0, 'forest'),
  (4, 1475.5, 237.0, 'forest'),
  (5, 1193.9, 1697.0, 'winter'),
  (6, 2445.6, 1225.7, 'evil');

-- catch table ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_fish (
  item_id text PRIMARY KEY,
  xp numeric NOT NULL,
  w1 numeric NOT NULL,
  w15 numeric NOT NULL,
  w40 numeric NOT NULL,
  w70 numeric NOT NULL,
  w100 numeric NOT NULL
);
GRANT SELECT ON public.game_fish TO authenticated;
GRANT ALL ON public.game_fish TO service_role;
ALTER TABLE public.game_fish ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fish table readable" ON public.game_fish;
CREATE POLICY "fish table readable" ON public.game_fish FOR SELECT TO authenticated USING (true);

DELETE FROM public.game_fish;
INSERT INTO public.game_fish (item_id, xp, w1, w15, w40, w70, w100) VALUES
  ('river_minnow', 15, 70, 45, 25, 12, 5),
  ('silver_trout', 45, 25, 35, 30, 22, 12),
  ('golden_koi', 140, 4, 15, 28, 30, 23),
  ('deepwater_eel', 380, 1, 4, 13, 26, 35),
  ('starlight_salmon', 900, 0, 1, 4, 10, 25);

-- potion metadata -----------------------------------------------------------
ALTER TABLE public.game_items ADD COLUMN IF NOT EXISTS dmg_boost numeric;
ALTER TABLE public.game_items ADD COLUMN IF NOT EXISTS boost_hits int;

-- fishing action ------------------------------------------------------------
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

  -- linear interpolation between the 1 / 15 / 40 / 70 / 100 weight columns
  IF lvl <= 1 THEN lo := 1; hi := 1; t := 0;
  ELSIF lvl < 15 THEN lo := 1; hi := 2; t := (lvl - 1) / 14.0;
  ELSIF lvl < 40 THEN lo := 2; hi := 3; t := (lvl - 15) / 25.0;
  ELSIF lvl < 70 THEN lo := 3; hi := 4; t := (lvl - 40) / 30.0;
  ELSIF lvl < 100 THEN lo := 4; hi := 5; t := (lvl - 70) / 30.0;
  ELSE lo := 5; hi := 5; t := 0;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _fish_roll (item_id text, xp numeric, weight numeric) ON COMMIT DROP;
  DELETE FROM _fish_roll;
  INSERT INTO _fish_roll (item_id, xp, weight)
  SELECT g.item_id, g.xp,
         (1 - t) * (ARRAY[g.w1, g.w15, g.w40, g.w70, g.w100])[lo]
         + t * (ARRAY[g.w1, g.w15, g.w40, g.w70, g.w100])[hi]
  FROM public.game_fish g;

  SELECT sum(weight) INTO total FROM _fish_roll;
  IF total IS NULL OR total <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_fish'); END IF;

  roll := random() * total;
  FOR f IN SELECT * FROM _fish_roll ORDER BY xp LOOP
    acc := acc + f.weight;
    IF roll <= acc THEN
      caught := f.item_id;
      caught_xp := f.xp;
      EXIT;
    END IF;
  END LOOP;
  IF caught IS NULL THEN
    SELECT item_id, xp INTO caught, caught_xp FROM _fish_roll ORDER BY xp LIMIT 1;
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

-- potion use ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.use_potion(_item text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  it public.game_items%ROWTYPE;
  save jsonb;
  next_inv jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO it FROM public.game_items WHERE id = _item;
  IF NOT FOUND OR it.kind <> 'potion' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_potion');
  END IF;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  next_inv := public.inv_remove(save->'inv', _item, 1);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing_item'); END IF;

  save := jsonb_set(save, '{inv}', next_inv);
  save := jsonb_set(
    save, '{buff}',
    jsonb_build_object('dmg', coalesce(it.dmg_boost, 0), 'hits', coalesce(it.boost_hits, 0), 'item', _item),
    true
  );
  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true, 'buff', save->'buff',
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills')
  );
END $$;
REVOKE ALL ON FUNCTION public.use_potion(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.use_potion(text) TO authenticated;

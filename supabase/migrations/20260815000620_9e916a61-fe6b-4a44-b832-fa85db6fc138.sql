
CREATE TABLE IF NOT EXISTS public.player_save_backups (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  rev bigint,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS player_save_backups_user_idx ON public.player_save_backups (user_id, created_at DESC);

GRANT SELECT ON public.player_save_backups TO authenticated;
GRANT ALL ON public.player_save_backups TO service_role;
ALTER TABLE public.player_save_backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players can view their own backups" ON public.player_save_backups;
CREATE POLICY "Players can view their own backups" ON public.player_save_backups
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Total skill xp in a save, used to detect a "fresh character" payload.
CREATE OR REPLACE FUNCTION public.save_total_xp(_d jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(coalesce((value->>'xp')::numeric, 0)), 0)
  FROM jsonb_each(coalesce(_d->'skills', '{}'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.save_total_xp(jsonb) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_is_fresh(_d jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT public.save_total_xp(_d) <= 0
     AND coalesce((_d->>'gold')::numeric, 0) <= 25
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(_d->'inv', '[]'::jsonb)) e
       WHERE e IS NOT NULL AND e <> 'null'::jsonb
     )
$$;
REVOKE ALL ON FUNCTION public.save_is_fresh(jsonb) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.player_sync(_data jsonb, _rev bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  cur_data jsonb;
  cur_rev bigint;
  merged jsonb;
  conflicted boolean := false;
  take_economy boolean;
  k text;
  cur_xp numeric;
  new_xp numeric;
  last_backup timestamptz;
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

  -- The client may only rewrite the economy when it is provably up to date AND
  -- its payload is not a blank/new character sitting on top of real progress.
  take_economy := _rev IS NOT NULL
                  AND _rev = cur_rev
                  AND NOT (public.save_is_fresh(_data) AND NOT public.save_is_fresh(cur_data));
  conflicted := NOT take_economy;

  merged := cur_data;

  -- Fields the client alone owns: position, health, quests, exploration, clock.
  FOREACH k IN ARRAY ARRAY['v','px','py','hp','quest','completed','discovered','clock'] LOOP
    IF _data ? k THEN merged := jsonb_set(merged, ARRAY[k], _data->k, true); END IF;
  END LOOP;

  IF take_economy THEN
    FOREACH k IN ARRAY ARRAY['inv','gold','skills'] LOOP
      IF _data ? k THEN merged := jsonb_set(merged, ARRAY[k], _data->k, true); END IF;
    END LOOP;

    -- Skill xp is monotonic: a sync can never lower it.
    FOR k IN SELECT jsonb_object_keys(coalesce(cur_data->'skills', '{}'::jsonb)) LOOP
      cur_xp := coalesce((cur_data->'skills'->k->>'xp')::numeric, 0);
      new_xp := coalesce((merged->'skills'->k->>'xp')::numeric, 0);
      IF new_xp < cur_xp THEN
        merged := jsonb_set(merged, ARRAY['skills', k],
          jsonb_build_object('xp', cur_xp), true);
      END IF;
    END LOOP;
  END IF;

  -- weapon / armor / food / bank are only ever written by the dedicated
  -- server actions (gear_equip, gear_upgrade, bank_*), never by a sync.

  -- Rolling safety net: snapshot at most one backup every 2 minutes.
  SELECT max(created_at) INTO last_backup
    FROM public.player_save_backups WHERE user_id = uid;
  IF last_backup IS NULL OR last_backup < now() - interval '2 minutes' THEN
    INSERT INTO public.player_save_backups (user_id, rev, data)
    VALUES (uid, cur_rev, cur_data);
    DELETE FROM public.player_save_backups
     WHERE user_id = uid
       AND id NOT IN (
         SELECT id FROM public.player_save_backups
          WHERE user_id = uid ORDER BY created_at DESC LIMIT 40);
  END IF;

  UPDATE public.player_saves SET data = merged WHERE user_id = uid;
  SELECT data, rev INTO cur_data, cur_rev FROM public.player_saves WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'rev', cur_rev, 'conflict', conflicted, 'data', cur_data);
END $$;

REVOKE ALL ON FUNCTION public.player_sync(jsonb, bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.player_sync(jsonb, bigint) TO authenticated;

-- Leaderboard levels never regress.
CREATE OR REPLACE FUNCTION public.sync_player_scores()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uname text := public.market_player_name(NEW.user_id);
  total int := 0;
  k text;
  lvl int;
BEGIN
  FOR k IN SELECT jsonb_object_keys(coalesce(NEW.data->'skills', '{}'::jsonb)) LOOP
    lvl := public.xp_level(public.skill_xp(NEW.data, k));
    total := total + lvl;
    INSERT INTO public.player_scores (user_id, skill, level, username, updated_at)
    VALUES (NEW.user_id, k, lvl, uname, now())
    ON CONFLICT (user_id, skill) DO UPDATE
      SET level = greatest(public.player_scores.level, EXCLUDED.level),
          username = EXCLUDED.username, updated_at = now();
  END LOOP;

  INSERT INTO public.player_scores (user_id, skill, level, username, updated_at)
  VALUES (NEW.user_id, 'total', greatest(total, 1), uname, now())
  ON CONFLICT (user_id, skill) DO UPDATE
    SET level = greatest(public.player_scores.level, EXCLUDED.level),
        username = EXCLUDED.username, updated_at = now();

  RETURN NEW;
END $$;

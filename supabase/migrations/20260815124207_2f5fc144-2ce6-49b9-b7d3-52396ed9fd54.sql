CREATE OR REPLACE FUNCTION public.player_sync(_data jsonb, _rev bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  take_economy := _rev IS NOT NULL
                  AND _rev = cur_rev
                  AND NOT (public.save_is_fresh(_data) AND NOT public.save_is_fresh(cur_data));
  conflicted := NOT take_economy;

  merged := cur_data;

  FOREACH k IN ARRAY ARRAY['v','px','py','hp','quest','completed','discovered','clock','autoEatAt'] LOOP
    IF _data ? k THEN merged := jsonb_set(merged, ARRAY[k], _data->k, true); END IF;
  END LOOP;

  IF take_economy THEN
    FOREACH k IN ARRAY ARRAY['inv','gold','skills'] LOOP
      IF _data ? k THEN merged := jsonb_set(merged, ARRAY[k], _data->k, true); END IF;
    END LOOP;

    FOR k IN SELECT jsonb_object_keys(coalesce(cur_data->'skills', '{}'::jsonb)) LOOP
      cur_xp := coalesce((cur_data->'skills'->k->>'xp')::numeric, 0);
      new_xp := coalesce((merged->'skills'->k->>'xp')::numeric, 0);
      IF new_xp < cur_xp THEN
        merged := jsonb_set(merged, ARRAY['skills', k],
          jsonb_build_object('xp', cur_xp), true);
      END IF;
    END LOOP;
  END IF;

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
END $function$;
ALTER TABLE public.player_saves ADD COLUMN IF NOT EXISTS rev bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_player_save_rev()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.rev := coalesce(OLD.rev, 0) + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS player_saves_bump_rev ON public.player_saves;
CREATE TRIGGER player_saves_bump_rev
BEFORE UPDATE ON public.player_saves
FOR EACH ROW EXECUTE FUNCTION public.bump_player_save_rev();

CREATE OR REPLACE FUNCTION public.player_sync(_data jsonb, _rev bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur_data jsonb;
  cur_rev bigint;
  merged jsonb;
  conflicted boolean := false;
  k text;
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

  IF _rev IS NOT NULL AND _rev = cur_rev THEN
    merged := _data;
  ELSE
    -- Stale client copy: keep the server-owned economy fields (inv, gold, skills, buff)
    -- and only take the fields the client alone ever changes.
    conflicted := true;
    merged := cur_data;
    FOREACH k IN ARRAY ARRAY['v','px','py','hp','quest','completed','discovered','clock',
                             'weapon','armor','food','bank'] LOOP
      IF _data ? k THEN merged := jsonb_set(merged, ARRAY[k], _data->k, true); END IF;
    END LOOP;
  END IF;

  UPDATE public.player_saves SET data = merged WHERE user_id = uid;
  SELECT data, rev INTO cur_data, cur_rev FROM public.player_saves WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'rev', cur_rev, 'conflict', conflicted, 'data', cur_data);
END $$;

REVOKE ALL ON FUNCTION public.player_sync(jsonb, bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.player_sync(jsonb, bigint) TO authenticated;
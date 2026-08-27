-- Temporary compatibility bridge for clients still rendering audited legacy rows.
-- Legacy rows share the current production placements while the UUID V2 reader
-- rolls out. Use the server-tracked player position so a stale client action
-- coordinate cannot reject an otherwise in-range swing.
CREATE OR REPLACE FUNCTION public.attack_monster(_id integer, _x numeric, _y numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pos public.player_positions%ROWTYPE;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO pos FROM public.player_positions WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_far'); END IF;
  RETURN public.attack_monster_v1(_id, pos.x, pos.y);
END
$$;

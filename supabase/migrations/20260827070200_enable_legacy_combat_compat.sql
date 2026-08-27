-- Temporary compatibility bridge for clients still rendering audited legacy rows.
-- Legacy rows share the current production placements while the UUID V2 reader
-- rolls out; keep normal maintenance enforcement but do not reject solely
-- because the active world contract is V2.
CREATE OR REPLACE FUNCTION public.attack_monster(_id integer, _x numeric, _y numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  RETURN public.attack_monster_v1(_id, _x, _y);
END
$$;

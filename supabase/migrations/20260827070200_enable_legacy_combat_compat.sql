-- Temporary compatibility bridge for clients still rendering legacy static rows.
-- Resolve actions from the authenticated player's tracked server position and,
-- if a stale static ID is absent or out of range, use the nearest in-range
-- legacy row. Final combat range validation remains in attack_monster_v1.
CREATE OR REPLACE FUNCTION public.attack_monster(_id integer, _x numeric, _y numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pos public.player_positions%ROWTYPE;
  resolved_id integer;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO pos FROM public.player_positions WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_far'); END IF;
  SELECT id INTO resolved_id FROM public.world_monsters
  WHERE id = _id AND respawn_at IS NULL
    AND sqrt(power(pos.x - x, 2) + power(pos.y - y, 2)) <= 120;
  IF NOT FOUND THEN
    SELECT id INTO resolved_id FROM public.world_monsters
    WHERE respawn_at IS NULL
      AND sqrt(power(pos.x - x, 2) + power(pos.y - y, 2)) <= 120
    ORDER BY sqrt(power(pos.x - x, 2) + power(pos.y - y, 2)), id
    LIMIT 1;
  END IF;
  IF resolved_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  RETURN public.attack_monster_v1(resolved_id, pos.x, pos.y);
END
$$;

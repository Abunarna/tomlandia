-- V6 public combat entry points.
--
-- Canonical source for the public SECURITY DEFINER wrappers that V6 corrects.
-- Inlined verbatim into the generated step-3 activation migration by
-- scripts/v6/build-migrations.mjs. Do not hand-patch the emitted SQL.
--
-- Regression fixed here: public.attack_boss asserted the *legacy V1 world
-- contract* (game_assert_action_allowed(true)), so under any non-v1 release —
-- V5 today, V6 after activation — every boss swing from the normal client
-- failed with 'legacy_world_contract_disabled'. The boss fight has no legacy
-- world dependency: attack_boss_v1 reads the authoritative world_boss row and
-- boss_position_at(), not the frozen v1 world tables.
--
-- The gate itself is NOT removed. game_assert_action_allowed(false) still
-- enforces maintenance mode and the minimum client protocol; only the
-- legacy-world-contract branch is switched off, matching every other
-- non-legacy entry point.
--
-- The signature and client contract are unchanged, attack_boss_v1 stays
-- non-public, and this wrapper remains the only client entry point.

CREATE OR REPLACE FUNCTION public.attack_boss(
  _x numeric, _y numeric, _bx numeric, _by numeric, _passive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  RETURN public.attack_boss_v1(_x, _y, _bx, _by, _passive);
END
$$;

REVOKE ALL ON FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) TO authenticated;

-- attack_boss_v1 is authoritative and must never be callable by a client role.
REVOKE ALL ON FUNCTION public.attack_boss_v1(numeric, numeric, numeric, numeric, boolean)
FROM PUBLIC, anon, authenticated;

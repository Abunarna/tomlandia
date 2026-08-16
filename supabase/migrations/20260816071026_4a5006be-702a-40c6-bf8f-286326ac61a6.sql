-- 1. Fix mutable search_path on helper functions
ALTER FUNCTION public.pl_state(jsonb) SET search_path = public;
ALTER FUNCTION public.save_is_fresh(jsonb) SET search_path = public;
ALTER FUNCTION public.save_total_xp(jsonb) SET search_path = public;
ALTER FUNCTION public.slot_add(jsonb, integer, text, integer, integer, boolean) SET search_path = public;

-- 2. Lock down function execution: revoke broad access from API roles
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.sig);
  END LOOP;
END $$;

-- 3. Re-grant only the player-facing RPCs, to signed-in users only
GRANT EXECUTE ON FUNCTION public.leaderboard(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_browse() TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_buy(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_cancel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_list(text, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attack_monster(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bank_gold(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bank_item(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.craft_item(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fish_cast(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gear_equip(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gear_upgrade(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.harvest_node(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inv_drop(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inv_sell(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_potion(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.player_sync(jsonb, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_position(uuid, numeric, numeric) TO authenticated;
-- 1. Views must run with the querying user's permissions/RLS.
ALTER VIEW public.game_runtime_items SET (security_invoker = true);

-- 2. Pin an immutable search_path on the remaining helper functions.
ALTER FUNCTION public.pl_state(jsonb) SET search_path = public;
ALTER FUNCTION public.slot_add(jsonb, integer, text, integer, integer, boolean) SET search_path = public;

-- 3. Release-status SECURITY DEFINER helpers are only used by signed-in gameplay.
REVOKE EXECUTE ON FUNCTION public.game_runtime_status() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.game_world_runtime_status() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.game_runtime_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_world_runtime_status() TO authenticated;
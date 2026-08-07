REVOKE ALL ON FUNCTION public.track_position(uuid, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_player_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_top_up_npc() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.track_position(uuid, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_player_name(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_top_up_npc() TO service_role;

REVOKE ALL ON FUNCTION public.equip_stat(jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_skill_xp(jsonb, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_add(jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_remove(jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_count(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.skill_xp(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xp_level(numeric) FROM PUBLIC, anon, authenticated;
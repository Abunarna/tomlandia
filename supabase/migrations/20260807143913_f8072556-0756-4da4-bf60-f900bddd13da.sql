REVOKE ALL ON FUNCTION public.harvest_node(integer, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attack_monster(integer, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.craft_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.harvest_node(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attack_monster(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.craft_item(text) TO authenticated;

REVOKE ALL ON FUNCTION public.track_position(uuid, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xp_level(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_count(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_add(jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inv_remove(jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.skill_xp(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_skill_xp(jsonb, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equip_stat(jsonb, text, text) FROM PUBLIC, anon, authenticated;
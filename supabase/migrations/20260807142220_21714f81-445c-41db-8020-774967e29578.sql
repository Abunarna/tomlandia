REVOKE ALL ON public.world_nodes FROM anon;
REVOKE ALL ON public.world_monsters FROM anon;
REVOKE ALL ON public.world_cooldowns FROM anon;
REVOKE ALL ON public.world_cooldowns FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.world_nodes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.world_monsters FROM authenticated;
GRANT SELECT ON public.world_nodes TO authenticated;
GRANT SELECT ON public.world_monsters TO authenticated;
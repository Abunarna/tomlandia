-- The V2 client persists bounded combat coordinates through this SECURITY
-- DEFINER routine. Keep anonymous callers denied and grant only signed-in users.
REVOKE ALL ON FUNCTION public.track_position(uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_position(uuid, numeric, numeric) TO authenticated;

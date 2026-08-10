CREATE TABLE public.player_scores (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  username text NOT NULL DEFAULT 'Adventurer',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill)
);

GRANT SELECT ON public.player_scores TO authenticated;
GRANT ALL ON public.player_scores TO service_role;

ALTER TABLE public.player_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in players can read the leaderboard"
  ON public.player_scores FOR SELECT TO authenticated USING (true);

CREATE INDEX player_scores_rank_idx ON public.player_scores (skill, level DESC);

CREATE OR REPLACE FUNCTION public.sync_player_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uname text := public.market_player_name(NEW.user_id);
  total int := 0;
  k text;
  lvl int;
BEGIN
  FOR k IN SELECT jsonb_object_keys(coalesce(NEW.data->'skills', '{}'::jsonb)) LOOP
    lvl := public.xp_level(public.skill_xp(NEW.data, k));
    total := total + lvl;
    INSERT INTO public.player_scores (user_id, skill, level, username, updated_at)
    VALUES (NEW.user_id, k, lvl, uname, now())
    ON CONFLICT (user_id, skill) DO UPDATE
      SET level = EXCLUDED.level, username = EXCLUDED.username, updated_at = now();
  END LOOP;

  INSERT INTO public.player_scores (user_id, skill, level, username, updated_at)
  VALUES (NEW.user_id, 'total', greatest(total, 1), uname, now())
  ON CONFLICT (user_id, skill) DO UPDATE
    SET level = EXCLUDED.level, username = EXCLUDED.username, updated_at = now();

  RETURN NEW;
END $$;

CREATE TRIGGER player_saves_sync_scores
AFTER INSERT OR UPDATE OF data ON public.player_saves
FOR EACH ROW EXECUTE FUNCTION public.sync_player_scores();

-- Backfill existing players
INSERT INTO public.player_scores (user_id, skill, level, username)
SELECT ps.user_id, s.key, public.xp_level((s.value->>'xp')::numeric), public.market_player_name(ps.user_id)
FROM public.player_saves ps, jsonb_each(coalesce(ps.data->'skills', '{}'::jsonb)) s
ON CONFLICT (user_id, skill) DO UPDATE SET level = EXCLUDED.level;

INSERT INTO public.player_scores (user_id, skill, level, username)
SELECT ps.user_id, 'total',
       greatest(coalesce((SELECT sum(public.xp_level((s.value->>'xp')::numeric))
                          FROM jsonb_each(coalesce(ps.data->'skills', '{}'::jsonb)) s), 0), 1),
       public.market_player_name(ps.user_id)
FROM public.player_saves ps
ON CONFLICT (user_id, skill) DO UPDATE SET level = EXCLUDED.level;

CREATE OR REPLACE FUNCTION public.leaderboard(_skill text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  top jsonb;
  me jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'rank', r.rnk, 'name', r.username, 'score', r.level, 'me', r.user_id = uid
         ) ORDER BY r.rnk, r.username), '[]'::jsonb)
    INTO top
  FROM (
    SELECT user_id, username, level, rank() OVER (ORDER BY level DESC) AS rnk
    FROM public.player_scores WHERE skill = _skill
  ) r
  WHERE r.rnk <= 10;

  SELECT jsonb_build_object('rank', r.rnk, 'name', r.username, 'score', r.level, 'me', true)
    INTO me
  FROM (
    SELECT user_id, username, level, rank() OVER (ORDER BY level DESC) AS rnk
    FROM public.player_scores WHERE skill = _skill
  ) r
  WHERE r.user_id = uid;

  RETURN jsonb_build_object('ok', true, 'skill', _skill, 'top', top, 'me', me);
END $$;

REVOKE ALL ON FUNCTION public.sync_player_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard(text) TO authenticated;
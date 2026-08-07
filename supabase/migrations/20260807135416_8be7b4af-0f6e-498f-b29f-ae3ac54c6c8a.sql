CREATE TABLE public.player_saves (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_saves TO authenticated;
GRANT ALL ON public.player_saves TO service_role;

ALTER TABLE public.player_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own save"
  ON public.player_saves FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Players can create their own save"
  ON public.player_saves FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players can update their own save"
  ON public.player_saves FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players can delete their own save"
  ON public.player_saves FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
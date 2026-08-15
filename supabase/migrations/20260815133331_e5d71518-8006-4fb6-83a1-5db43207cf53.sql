DELETE FROM public.player_scores WHERE user_id IN (
  SELECT id FROM public.profiles WHERE username_lower IN (
    'cloud8153','cloud2394','cloud3981','pres9287','p9tester','mktalpha1','mktbeta1','logintest5648','tomtest8686a','tomtest8686b'
  )
);
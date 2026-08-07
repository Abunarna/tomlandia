CREATE OR REPLACE FUNCTION public.market_top_up_npc()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  npc_count int;
  names text[] := ARRAY['Pip','Coinmaster Odo','Rook','Mabel','Sigrid','Master Alric','Lira','Wandering Tess','Old Hollis','Fenwick'];
  it record;
BEGIN
  DELETE FROM public.market_listings ml
   USING public.game_items gi
   WHERE ml.is_npc AND gi.id = ml.item_id AND gi.kind IN ('weapon','armor');

  SELECT count(*) INTO npc_count FROM public.market_listings WHERE is_npc;
  IF npc_count >= 8 THEN RETURN; END IF;

  FOR it IN
    SELECT gi.id, gi.value, gi.stackable
    FROM public.game_items gi
    WHERE gi.value > 0 AND gi.kind NOT IN ('weapon','armor')
    ORDER BY random()
    LIMIT (8 - npc_count)
  LOOP
    INSERT INTO public.market_listings (seller_name, is_npc, item_id, qty, price)
    VALUES (
      names[1 + floor(random() * array_length(names, 1))::int],
      true,
      it.id,
      CASE WHEN it.stackable THEN 1 + floor(random() * 10)::int ELSE 1 END,
      greatest(1, round(it.value * (0.9 + random() * 0.5))::int)
    );
  END LOOP;
END $function$;
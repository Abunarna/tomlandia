CREATE OR REPLACE FUNCTION public.market_browse()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  listings jsonb;
  trades jsonb;
  save jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.market_top_up_npc();

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO listings
  FROM (
    SELECT jsonb_build_object(
      'id', ml.id, 'item', ml.item_id, 'qty', ml.qty, 'price', ml.price,
      'seller', ml.seller_name, 'npc', ml.is_npc,
      'mine', ml.seller_id = uid, 'created_at', ml.created_at
    ) AS x
    FROM public.market_listings ml
    ORDER BY ml.created_at DESC
    LIMIT 120
  ) s;

  SELECT coalesce(jsonb_agg(y), '[]'::jsonb) INTO trades
  FROM (
    SELECT jsonb_build_object(
      'id', mt.id, 'item', mt.item_id, 'qty', mt.qty, 'price', mt.price,
      'seller', mt.seller_name, 'buyer', mt.buyer_name, 'at', mt.created_at
    ) AS y
    FROM public.market_trades mt
    ORDER BY mt.created_at DESC
    LIMIT 15
  ) t;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true, 'listings', listings, 'trades', trades,
    'state', CASE WHEN save IS NULL THEN NULL ELSE
      jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills') END
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.market_browse() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.market_browse() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.market_top_up_npc() FROM authenticated;
-- ============ Phase 10: shared marketplace ============

CREATE TABLE public.market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_name text NOT NULL,
  is_npc boolean NOT NULL DEFAULT false,
  item_id text NOT NULL REFERENCES public.game_items(id),
  qty integer NOT NULL CHECK (qty > 0),
  price integer NOT NULL CHECK (price > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.market_listings TO authenticated;
GRANT ALL ON public.market_listings TO service_role;
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players can browse listings"
  ON public.market_listings FOR SELECT TO authenticated USING (true);

CREATE INDEX market_listings_item_idx ON public.market_listings (item_id);
CREATE INDEX market_listings_seller_idx ON public.market_listings (seller_id);

CREATE TABLE public.market_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL,
  qty integer NOT NULL,
  price integer NOT NULL,
  seller_name text NOT NULL,
  buyer_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.market_trades TO authenticated;
GRANT ALL ON public.market_trades TO service_role;
ALTER TABLE public.market_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players can read the trade feed"
  ON public.market_trades FOR SELECT TO authenticated USING (true);

CREATE INDEX market_trades_created_idx ON public.market_trades (created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.market_listings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_trades;

-- ---------- helpers ----------

CREATE OR REPLACE FUNCTION public.market_player_name(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT username FROM public.profiles WHERE id = _uid), 'Adventurer');
$$;
REVOKE EXECUTE ON FUNCTION public.market_player_name(uuid) FROM public, anon, authenticated;

-- Tops the board up with shopkeeper stock so it never feels empty.
CREATE OR REPLACE FUNCTION public.market_top_up_npc()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  npc_count int;
  names text[] := ARRAY['Pip','Coinmaster Odo','Rook','Mabel','Sigrid','Master Alric','Lira','Wandering Tess','Old Hollis','Fenwick'];
  it record;
BEGIN
  SELECT count(*) INTO npc_count FROM public.market_listings WHERE is_npc;
  IF npc_count >= 8 THEN RETURN; END IF;

  FOR it IN
    SELECT gi.id, gi.value, gi.stackable
    FROM public.game_items gi
    WHERE gi.value > 0
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
END $$;
REVOKE EXECUTE ON FUNCTION public.market_top_up_npc() FROM public, anon;

-- ---------- list ----------

CREATE OR REPLACE FUNCTION public.market_list(_item text, _qty integer, _price integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  save jsonb;
  next_inv jsonb;
  mine int;
  cd timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _qty IS NULL OR _qty < 1 OR _qty > 10000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_qty'); END IF;
  IF _price IS NULL OR _price < 1 OR _price > 10000000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_price'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_items WHERE id = _item) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item');
  END IF;

  SELECT count(*) INTO mine FROM public.market_listings WHERE seller_id = uid;
  IF mine >= 12 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_many_listings'); END IF;

  SELECT next_at INTO cd FROM public.world_cooldowns WHERE user_id = uid AND key = 'market';
  IF cd IS NOT NULL AND now() < cd THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_fast'); END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'market', now() + interval '0.5 seconds')
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  next_inv := public.inv_remove(save->'inv', _item, _qty);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing_items'); END IF;

  save := jsonb_set(save, '{inv}', next_inv);
  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;

  INSERT INTO public.market_listings (seller_id, seller_name, item_id, qty, price)
  VALUES (uid, public.market_player_name(uid), _item, _qty, _price);

  RETURN jsonb_build_object('ok', true,
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills'));
END $$;
REVOKE EXECUTE ON FUNCTION public.market_list(text, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.market_list(text, integer, integer) TO authenticated;

-- ---------- cancel ----------

CREATE OR REPLACE FUNCTION public.market_cancel(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  l public.market_listings%ROWTYPE;
  save jsonb;
  next_inv jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO l FROM public.market_listings WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR l.seller_id IS DISTINCT FROM uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yours');
  END IF;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  next_inv := public.inv_add(save->'inv', l.item_id, l.qty);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;

  save := jsonb_set(save, '{inv}', next_inv);
  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;
  DELETE FROM public.market_listings WHERE id = _id;

  RETURN jsonb_build_object('ok', true,
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills'));
END $$;
REVOKE EXECUTE ON FUNCTION public.market_cancel(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.market_cancel(uuid) TO authenticated;

-- ---------- buy ----------

CREATE OR REPLACE FUNCTION public.market_buy(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  l public.market_listings%ROWTYPE;
  save jsonb;
  next_inv jsonb;
  gross int;
  fee int;
  payout int;
  seller_save jsonb;
  buyer_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO l FROM public.market_listings WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'gone'); END IF;
  IF l.seller_id = uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'own_listing'); END IF;

  gross := l.price * l.qty;
  fee := ceil(gross * 0.05)::int;
  payout := gross - fee;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  IF coalesce((save->>'gold')::numeric, 0) < gross THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'poor', 'need', gross);
  END IF;

  next_inv := public.inv_add(save->'inv', l.item_id, l.qty);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;

  save := jsonb_set(save, '{inv}', next_inv);
  save := jsonb_set(save, '{gold}', to_jsonb(coalesce((save->>'gold')::numeric, 0) - gross));
  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;

  IF l.seller_id IS NOT NULL THEN
    SELECT data INTO seller_save FROM public.player_saves WHERE user_id = l.seller_id FOR UPDATE;
    IF seller_save IS NOT NULL THEN
      seller_save := jsonb_set(seller_save, '{gold}',
        to_jsonb(coalesce((seller_save->>'gold')::numeric, 0) + payout));
      UPDATE public.player_saves SET data = seller_save, updated_at = now() WHERE user_id = l.seller_id;
    END IF;
  END IF;

  DELETE FROM public.market_listings WHERE id = _id;

  buyer_name := public.market_player_name(uid);
  INSERT INTO public.market_trades (item_id, qty, price, seller_name, buyer_name)
  VALUES (l.item_id, l.qty, l.price, l.seller_name, buyer_name);

  DELETE FROM public.market_trades
   WHERE created_at < now() - interval '1 day';

  PERFORM public.market_top_up_npc();

  RETURN jsonb_build_object('ok', true, 'spent', gross, 'item', l.item_id, 'qty', l.qty,
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills'));
END $$;
REVOKE EXECUTE ON FUNCTION public.market_buy(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.market_buy(uuid) TO authenticated;

-- ---------- browse ----------

CREATE OR REPLACE FUNCTION public.market_browse()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  listings jsonb;
  trades jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.market_top_up_npc();

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb) INTO listings
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

  RETURN jsonb_build_object('ok', true, 'listings', listings, 'trades', trades);
END $$;
REVOKE EXECUTE ON FUNCTION public.market_browse() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.market_browse() TO authenticated;

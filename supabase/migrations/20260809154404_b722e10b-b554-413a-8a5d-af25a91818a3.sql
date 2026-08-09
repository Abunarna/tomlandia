
DELETE FROM public.market_listings WHERE is_npc;
DROP FUNCTION IF EXISTS public.market_top_up_npc();
ALTER TABLE public.market_listings DROP COLUMN IF EXISTS is_npc;
ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS plus integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days');
ALTER TABLE public.market_trades ADD COLUMN IF NOT EXISTS plus integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS market_listings_expires_idx ON public.market_listings (expires_at);

CREATE TABLE IF NOT EXISTS public.market_prices (
  item_id text NOT NULL,
  plus integer NOT NULL DEFAULT 0,
  price integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, plus)
);
GRANT SELECT ON public.market_prices TO authenticated;
GRANT ALL ON public.market_prices TO service_role;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in players can read last sold prices" ON public.market_prices;
CREATE POLICY "Signed-in players can read last sold prices"
  ON public.market_prices FOR SELECT TO authenticated USING (true);

-- ---------- upgrade-aware inventory helpers ----------

CREATE OR REPLACE FUNCTION public.mk_inv_take(_inv jsonb, _item text, _plus integer, _qty integer)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  arr jsonb := coalesce(_inv, '[]'::jsonb);
  left_to int := _qty;
  i int;
  s jsonb;
  take int;
BEGIN
  FOR i IN 0 .. jsonb_array_length(arr) - 1 LOOP
    EXIT WHEN left_to <= 0;
    s := arr->i;
    IF jsonb_typeof(s) = 'object' AND s->>'id' = _item
       AND coalesce((s->>'plus')::int, 0) = coalesce(_plus, 0) THEN
      take := least(left_to, coalesce((s->>'qty')::int, 0));
      IF take > 0 THEN
        left_to := left_to - take;
        IF coalesce((s->>'qty')::int, 0) - take <= 0 THEN
          arr := jsonb_set(arr, ARRAY[i::text], 'null'::jsonb);
        ELSE
          arr := jsonb_set(arr, ARRAY[i::text, 'qty'], to_jsonb(coalesce((s->>'qty')::int, 0) - take));
        END IF;
      END IF;
    END IF;
  END LOOP;
  IF left_to > 0 THEN RETURN NULL; END IF;
  RETURN arr;
END $$;
REVOKE EXECUTE ON FUNCTION public.mk_inv_take(jsonb, text, integer, integer) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mk_inv_give(_inv jsonb, _item text, _plus integer, _qty integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  arr jsonb := coalesce(_inv, '[]'::jsonb);
  stack boolean;
  left_to int := _qty;
  i int;
  s jsonb;
  plus int := coalesce(_plus, 0);
BEGIN
  SELECT stackable INTO stack FROM public.game_items WHERE id = _item;
  stack := coalesce(stack, false) AND plus = 0;

  IF stack THEN
    FOR i IN 0 .. jsonb_array_length(arr) - 1 LOOP
      s := arr->i;
      IF jsonb_typeof(s) = 'object' AND s->>'id' = _item AND coalesce((s->>'plus')::int, 0) = 0 THEN
        RETURN jsonb_set(arr, ARRAY[i::text, 'qty'], to_jsonb(coalesce((s->>'qty')::int, 0) + left_to));
      END IF;
    END LOOP;
  END IF;

  FOR i IN 0 .. jsonb_array_length(arr) - 1 LOOP
    EXIT WHEN left_to <= 0;
    s := arr->i;
    IF s IS NULL OR jsonb_typeof(s) = 'null' THEN
      IF stack THEN
        arr := jsonb_set(arr, ARRAY[i::text],
          jsonb_build_object('id', _item, 'qty', left_to, 'plus', 0));
        left_to := 0;
      ELSE
        arr := jsonb_set(arr, ARRAY[i::text],
          jsonb_build_object('id', _item, 'qty', 1, 'plus', plus));
        left_to := left_to - 1;
      END IF;
    END IF;
  END LOOP;

  IF left_to > 0 THEN RETURN NULL; END IF;
  RETURN arr;
END $$;
REVOKE EXECUTE ON FUNCTION public.mk_inv_give(jsonb, text, integer, integer) FROM public, anon, authenticated;

-- ---------- expiry sweep ----------

CREATE OR REPLACE FUNCTION public.market_expire()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.market_listings%ROWTYPE;
  save jsonb;
  next_inv jsonb;
BEGIN
  FOR l IN SELECT * FROM public.market_listings WHERE expires_at <= now() FOR UPDATE SKIP LOCKED LOOP
    IF l.seller_id IS NULL THEN
      DELETE FROM public.market_listings WHERE id = l.id;
      CONTINUE;
    END IF;
    SELECT data INTO save FROM public.player_saves WHERE user_id = l.seller_id FOR UPDATE;
    IF save IS NULL THEN
      UPDATE public.market_listings SET expires_at = now() + interval '1 day' WHERE id = l.id;
      CONTINUE;
    END IF;
    next_inv := public.mk_inv_give(save->'inv', l.item_id, l.plus, l.qty);
    IF next_inv IS NULL THEN
      -- bag full: hold the goods safely and try again tomorrow
      UPDATE public.market_listings SET expires_at = now() + interval '1 day' WHERE id = l.id;
      CONTINUE;
    END IF;
    save := jsonb_set(save, '{inv}', next_inv);
    UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = l.seller_id;
    DELETE FROM public.market_listings WHERE id = l.id;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.market_expire() FROM public, anon, authenticated;

-- ---------- browse ----------

CREATE OR REPLACE FUNCTION public.market_browse()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  save jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.market_expire();
  SELECT data INTO save FROM public.player_saves WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'listings', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'item', l.item_id, 'qty', l.qty, 'price', l.price, 'plus', l.plus,
        'seller', l.seller_name, 'mine', (l.seller_id = uid),
        'created_at', l.created_at, 'expires_at', l.expires_at))
      FROM (SELECT * FROM public.market_listings ORDER BY created_at DESC LIMIT 300) l
    ), '[]'::jsonb),
    'trades', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'item', t.item_id, 'qty', t.qty, 'price', t.price, 'plus', t.plus,
        'seller', t.seller_name, 'buyer', t.buyer_name, 'at', t.created_at))
      FROM (SELECT * FROM public.market_trades ORDER BY created_at DESC LIMIT 30) t
    ), '[]'::jsonb),
    'prices', coalesce((
      SELECT jsonb_agg(jsonb_build_object('item', p.item_id, 'plus', p.plus, 'price', p.price))
      FROM public.market_prices p
    ), '[]'::jsonb),
    'state', CASE WHEN save IS NULL THEN NULL ELSE
      jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills') END
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.market_browse() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.market_browse() TO authenticated;

-- ---------- list ----------

DROP FUNCTION IF EXISTS public.market_list(text, integer, integer);

CREATE OR REPLACE FUNCTION public.market_list(_item text, _qty integer, _price integer, _plus integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  save jsonb;
  next_inv jsonb;
  mine int;
  cd timestamptz;
  plus int := greatest(0, coalesce(_plus, 0));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _qty IS NULL OR _qty < 1 OR _qty > 100000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_qty'); END IF;
  IF _price IS NULL OR _price < 1 OR _price > 10000000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_price'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_items WHERE id = _item) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item');
  END IF;

  SELECT count(*) INTO mine FROM public.market_listings WHERE seller_id = uid;
  IF mine >= 24 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_many_listings'); END IF;

  SELECT next_at INTO cd FROM public.world_cooldowns WHERE user_id = uid AND key = 'market';
  IF cd IS NOT NULL AND now() < cd THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_fast'); END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'market', now() + interval '0.5 seconds')
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  next_inv := public.mk_inv_take(save->'inv', _item, plus, _qty);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing_items'); END IF;

  save := jsonb_set(save, '{inv}', next_inv);
  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;

  INSERT INTO public.market_listings (seller_id, seller_name, item_id, qty, price, plus, expires_at)
  VALUES (uid, public.market_player_name(uid), _item, _qty, _price, plus, now() + interval '14 days');

  RETURN jsonb_build_object('ok', true,
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills'));
END $$;
REVOKE EXECUTE ON FUNCTION public.market_list(text, integer, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.market_list(text, integer, integer, integer) TO authenticated;

-- ---------- cancel (upgrade-aware) ----------

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

  next_inv := public.mk_inv_give(save->'inv', l.item_id, l.plus, l.qty);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;

  save := jsonb_set(save, '{inv}', next_inv);
  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;
  DELETE FROM public.market_listings WHERE id = _id;

  RETURN jsonb_build_object('ok', true,
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills'));
END $$;
REVOKE EXECUTE ON FUNCTION public.market_cancel(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.market_cancel(uuid) TO authenticated;

-- ---------- buy (partial purchases) ----------

DROP FUNCTION IF EXISTS public.market_buy(uuid);

CREATE OR REPLACE FUNCTION public.market_buy(_id uuid, _qty integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  l public.market_listings%ROWTYPE;
  save jsonb;
  next_inv jsonb;
  want int;
  gross int;
  fee int;
  payout int;
  seller_save jsonb;
  buyer_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.market_expire();

  SELECT * INTO l FROM public.market_listings WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'gone'); END IF;
  IF l.seller_id = uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'own_listing'); END IF;

  want := least(greatest(coalesce(_qty, 1), 1), l.qty);
  gross := l.price * want;
  fee := ceil(gross * 0.05)::int;
  payout := gross - fee;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  IF coalesce((save->>'gold')::numeric, 0) < gross THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'poor', 'need', gross);
  END IF;

  next_inv := public.mk_inv_give(save->'inv', l.item_id, l.plus, want);
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

  IF want >= l.qty THEN
    DELETE FROM public.market_listings WHERE id = _id;
  ELSE
    UPDATE public.market_listings SET qty = qty - want, updated_at = now() WHERE id = _id;
  END IF;

  buyer_name := public.market_player_name(uid);
  INSERT INTO public.market_trades (item_id, qty, price, plus, seller_name, buyer_name)
  VALUES (l.item_id, want, l.price, l.plus, l.seller_name, buyer_name);

  INSERT INTO public.market_prices (item_id, plus, price, updated_at)
  VALUES (l.item_id, l.plus, l.price, now())
  ON CONFLICT (item_id, plus) DO UPDATE SET price = EXCLUDED.price, updated_at = now();

  DELETE FROM public.market_trades WHERE created_at < now() - interval '1 day';

  RETURN jsonb_build_object('ok', true, 'spent', gross, 'item', l.item_id, 'qty', want,
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills'));
END $$;
REVOKE EXECUTE ON FUNCTION public.market_buy(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.market_buy(uuid, integer) TO authenticated;

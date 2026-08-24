-- Gate 2: overflow-safe marketplace settlement and exact current leaderboards.

CREATE OR REPLACE FUNCTION public.market_list(_item text, _qty integer, _price integer, _plus integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); data jsonb; next_inv jsonb; mine integer; definition public.game_items%ROWTYPE;
  plus integer := coalesce(_plus, 0);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _qty IS NULL OR _qty < 1 OR _qty > 100000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_qty'); END IF;
  IF _price IS NULL OR _price < 1 OR _price > 10000000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_price'); END IF;
  IF plus < 0 OR plus > 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus'); END IF;
  SELECT * INTO definition FROM public.game_items WHERE id = _item;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_item'); END IF;
  IF definition.untradable THEN RETURN jsonb_build_object('ok', false, 'reason', 'untradable'); END IF;
  IF definition.stackable AND plus <> 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plus'); END IF;
  IF NOT definition.stackable AND _qty <> 1 THEN RETURN jsonb_build_object('ok', false, 'reason', 'gear_qty'); END IF;

  -- Serialise a player's listing count, cooldown and inventory beneath the
  -- same save lock. Two tabs can no longer pass the checks simultaneously.
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  SELECT count(*) INTO mine FROM public.market_listings WHERE seller_id = uid;
  IF mine >= 24 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_many_listings'); END IF;
  IF NOT public.action_gate(uid, 'market', interval '0.5 seconds') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast');
  END IF;
  IF NOT definition.stackable AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(data->'inv', '[]'::jsonb)) AS slots(slot)
    WHERE jsonb_typeof(slot) = 'object'
      AND slot->>'id' = _item
      AND coalesce((slot->>'plus')::integer, 0) = plus
      AND coalesce((slot->>'qty')::integer, 1) <> 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'legacy_stacked_gear');
  END IF;
  next_inv := public.mk_inv_take(data->'inv', _item, plus, _qty);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing_items'); END IF;

  data := jsonb_set(data, '{inv}', next_inv, true);
  data := public.clear_stale_food(data);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.market_listings (seller_id, seller_name, item_id, qty, price, plus, expires_at)
  VALUES (uid, public.market_player_name(uid), _item, _qty, _price, plus, now() + interval '14 days');
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(data));
END $$;

CREATE OR REPLACE FUNCTION public.market_cancel(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_variable
DECLARE uid uuid := auth.uid(); listing public.market_listings%ROWTYPE; data jsonb; next_inv jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO listing FROM public.market_listings WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR listing.seller_id IS DISTINCT FROM uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_yours'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  next_inv := public.mk_inv_give(data->'inv', listing.item_id, listing.plus, listing.qty);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;
  data := jsonb_set(data, '{inv}', next_inv, true);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  DELETE FROM public.market_listings WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'state', public.pl_state(data));
END $$;

CREATE OR REPLACE FUNCTION public.market_buy(_id uuid, _qty integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); listing public.market_listings%ROWTYPE; definition public.game_items%ROWTYPE;
  buyer_data jsonb; seller_data jsonb; next_inv jsonb; wanted integer;
  gross numeric; fee numeric; payout numeric; buyer_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.market_expire();
  SELECT * INTO listing FROM public.market_listings WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'gone'); END IF;
  IF listing.seller_id = uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'own_listing'); END IF;
  SELECT * INTO definition FROM public.game_items WHERE id = listing.item_id;
  IF NOT FOUND OR definition.untradable THEN RETURN jsonb_build_object('ok', false, 'reason', 'untradable'); END IF;
  IF listing.plus < 0 OR listing.plus > 100 OR (definition.stackable AND listing.plus <> 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_listing');
  END IF;
  IF NOT definition.stackable AND listing.qty <> 1 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_listing'); END IF;

  wanted := least(greatest(coalesce(_qty, 1), 1), listing.qty);
  IF NOT definition.stackable THEN wanted := 1; END IF;
  gross := listing.price::numeric * wanted::numeric;
  IF gross <= 0 OR gross > 1000000000000::numeric THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_total'); END IF;
  fee := ceil(gross * 0.05);
  payout := gross - fee;

  -- All save rows are locked in UUID order, preventing reciprocal purchases
  -- from deadlocking two player transactions.
  PERFORM 1 FROM public.player_saves
  WHERE user_id IN (uid, listing.seller_id)
  ORDER BY user_id
  FOR UPDATE;
  SELECT data INTO buyer_data FROM public.player_saves WHERE user_id = uid;
  SELECT data INTO seller_data FROM public.player_saves WHERE user_id = listing.seller_id;
  IF buyer_data IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  IF seller_data IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'seller_missing'); END IF;
  IF coalesce((buyer_data->>'gold')::numeric, 0) < gross THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'poor', 'need', gross);
  END IF;
  next_inv := public.mk_inv_give(buyer_data->'inv', listing.item_id, listing.plus, wanted);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;

  buyer_data := jsonb_set(buyer_data, '{inv}', next_inv, true);
  buyer_data := jsonb_set(buyer_data, '{gold}', to_jsonb((buyer_data->>'gold')::numeric - gross), true);
  seller_data := jsonb_set(seller_data, '{gold}', to_jsonb(coalesce((seller_data->>'gold')::numeric, 0) + payout), true);
  UPDATE public.player_saves SET data = buyer_data, updated_at = now() WHERE user_id = uid;
  UPDATE public.player_saves SET data = seller_data, updated_at = now() WHERE user_id = listing.seller_id;

  IF wanted >= listing.qty THEN DELETE FROM public.market_listings WHERE id = _id;
  ELSE UPDATE public.market_listings SET qty = qty - wanted, updated_at = now() WHERE id = _id;
  END IF;
  buyer_name := public.market_player_name(uid);
  INSERT INTO public.market_trades (item_id, qty, price, plus, seller_name, buyer_name)
  VALUES (listing.item_id, wanted, listing.price, listing.plus, listing.seller_name, buyer_name);
  INSERT INTO public.market_prices (item_id, plus, price, updated_at)
  VALUES (listing.item_id, listing.plus, listing.price, now())
  ON CONFLICT (item_id, plus) DO UPDATE SET price = EXCLUDED.price, updated_at = now();
  DELETE FROM public.market_trades WHERE created_at < now() - interval '1 day';
  RETURN jsonb_build_object(
    'ok', true, 'spent', gross, 'item', listing.item_id, 'qty', wanted, 'state', public.pl_state(buyer_data)
  );
END $$;

REVOKE ALL ON FUNCTION public.market_list(text, integer, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.market_cancel(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.market_buy(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_list(text, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_cancel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_buy(uuid, integer) TO authenticated;

-- Rebuild exact current scores. Removed skill keys must not leave stale rows,
-- and no PUBLIC execute grant may bypass authentication.
CREATE OR REPLACE FUNCTION public.sync_player_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE username text := public.market_player_name(NEW.user_id); total integer := 0; skill text; level integer;
BEGIN
  DELETE FROM public.player_scores WHERE user_id = NEW.user_id;
  FOR skill IN SELECT jsonb_object_keys(coalesce(NEW.data->'skills', '{}'::jsonb)) LOOP
    level := public.xp_level(public.skill_xp(NEW.data, skill));
    total := total + level;
    INSERT INTO public.player_scores (user_id, skill, level, username, updated_at)
    VALUES (NEW.user_id, skill, level, username, now());
  END LOOP;
  INSERT INTO public.player_scores (user_id, skill, level, username, updated_at)
  VALUES (NEW.user_id, 'total', greatest(total, 1), username, now());
  RETURN NEW;
END $$;

TRUNCATE public.player_scores;
INSERT INTO public.player_scores (user_id, skill, level, username)
SELECT saves.user_id, skills.key, public.xp_level((skills.value->>'xp')::numeric), public.market_player_name(saves.user_id)
FROM public.player_saves AS saves, jsonb_each(coalesce(saves.data->'skills', '{}'::jsonb)) AS skills;
INSERT INTO public.player_scores (user_id, skill, level, username)
SELECT saves.user_id, 'total', greatest(coalesce((
  SELECT sum(public.xp_level((skills.value->>'xp')::numeric))
  FROM jsonb_each(coalesce(saves.data->'skills', '{}'::jsonb)) AS skills
), 0), 1), public.market_player_name(saves.user_id)
FROM public.player_saves AS saves;

REVOKE ALL ON FUNCTION public.sync_player_scores() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leaderboard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leaderboard(text) TO authenticated;

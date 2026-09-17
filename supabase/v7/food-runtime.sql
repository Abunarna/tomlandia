-- V7 healing-food runtime.
--
-- Canonical source for the authoritative manual-eating entry point. It is
-- inlined verbatim into the generated V7 stage-content migration.
--
-- The repair is generic, never an allowlist: the server resolves the dish from
-- the active runtime catalogue (public.game_runtime_items, which already
-- restricts to the active content version and to active rows), so every food
-- the release publishes works, and anything else is rejected.
--
-- Contract:
--   * authenticated callers only, action gate shared with auto-eat;
--   * the save row is locked FOR UPDATE before any read-modify-write;
--   * healing is capped at max_hp - hp and resolved server-side only;
--   * exactly one item is consumed, atomically, in the same transaction;
--   * a rejection writes nothing at all to the save.
--
-- Auto-eat (public.try_auto_eat) is deliberately untouched by this release.

CREATE OR REPLACE FUNCTION public.consume_food(_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid();
  data jsonb;
  slot jsonb;
  food_id text;
  heal integer;
  hp integer;
  max_hp integer;
  qty integer;
  healed integer := 0;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _index IS NULL OR _index < 0 OR _index > 19 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_slot');
  END IF;

  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  slot := data->'inv'->_index;
  IF jsonb_typeof(slot) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty');
  END IF;
  food_id := slot->>'id';
  IF food_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;

  -- Generic authoritative resolution: active release, active row, real food.
  SELECT item.heal INTO heal
  FROM public.game_runtime_items AS item
  WHERE item.id = food_id AND item.active AND item.kind = 'food' AND item.heal > 0;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_food'); END IF;

  max_hp := public.player_max_hp(data);
  hp := least(max_hp, greatest(0, coalesce((data->>'hp')::integer, max_hp)));
  IF hp >= max_hp THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full_health');
  END IF;
  IF NOT public.action_gate(uid, 'action:food', interval '2 seconds') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast');
  END IF;

  qty := coalesce((slot->>'qty')::integer, 1);
  IF qty <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;

  healed := least(heal, max_hp - hp);
  IF qty <= 1 THEN
    data := jsonb_set(data, ARRAY['inv', _index::text], 'null'::jsonb, true);
  ELSE
    data := jsonb_set(data, ARRAY['inv', _index::text, 'qty'], to_jsonb(qty - 1), true);
  END IF;
  data := jsonb_set(data, '{hp}', to_jsonb(hp + healed), true);
  data := jsonb_set(data, '{food}', to_jsonb(food_id), true);
  data := public.clear_stale_food(data);

  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'healed', healed, 'food_used', true, 'state', public.pl_state(data));
END
$$;

REVOKE ALL ON FUNCTION public.consume_food(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_food(integer) TO authenticated;

-- The retired v1 helper resolved healing from the legacy public.game_items
-- table, which never carried the released dishes. It is no longer reachable
-- from the public entry point above; it stays non-public for rollback only.
REVOKE ALL ON FUNCTION public.consume_food_v1(integer) FROM PUBLIC, anon, authenticated;

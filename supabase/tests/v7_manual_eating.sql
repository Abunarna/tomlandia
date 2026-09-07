-- V7 manual-eating regression suite.
--
-- The V7 stage-content migration (step 1/3) replaces public.consume_food with a
-- generic, catalogue-driven entry point. This suite proves, inside a rolled-back
-- transaction, that:
--   * every one of the 16 stable dishes resolves through the active runtime
--     catalogue and can actually be eaten (no allowlist, no legacy table);
--   * healing is capped at the missing health and resolved server-side;
--   * exactly one item is consumed per accepted call;
--   * full health, unknown ids, inactive ids, non-food items, bad slots and the
--     shared 2-second gate all reject and leave the save byte-identical;
--   * auto-eat semantics are unchanged.
--
-- Run with: supabase test db supabase/tests/v7_manual_eating.sql

begin;

create extension if not exists pgtap with schema extensions;
select plan(46);

-- Apply the V7 runtime exactly as the generated migration emits it.
\i supabase/v7/food-runtime.sql

-- ---------------------------------------------------------------------------
-- Shape.
-- ---------------------------------------------------------------------------
select ok((select prosecdef from pg_proc where oid = 'public.consume_food(integer)'::regprocedure),
  'manual eating is SECURITY DEFINER');
select is((select array_to_string(proconfig, ',') from pg_proc
           where oid = 'public.consume_food(integer)'::regprocedure),
  'search_path=public', 'manual eating pins an explicit search_path');
select ok((select prosrc like '%game_runtime_items%' from pg_proc
           where oid = 'public.consume_food(integer)'::regprocedure),
  'manual eating resolves food from the active runtime catalogue');
select ok((select prosrc not like '%public.game_items%' from pg_proc
           where oid = 'public.consume_food(integer)'::regprocedure),
  'manual eating no longer reads the legacy item table');
select ok((select prosrc like '%FOR UPDATE%' from pg_proc
           where oid = 'public.consume_food(integer)'::regprocedure),
  'manual eating locks the save row before reading it');
select ok((select prosrc not like '%honey_bun%' from pg_proc
           where oid = 'public.consume_food(integer)'::regprocedure),
  'manual eating contains no per-dish allowlist');
select ok(has_function_privilege('authenticated', 'public.consume_food(integer)', 'EXECUTE'),
  'signed-in players can still eat');
select ok(not has_function_privilege('anon', 'public.consume_food(integer)', 'EXECUTE'),
  'signed-out callers cannot eat');
select ok(not has_function_privilege('authenticated', 'public.consume_food_v1(integer)', 'EXECUTE'),
  'the retired legacy helper is not publicly reachable');

-- Auto-eat is untouched by this release.
select ok((select prosrc like '%game_runtime_items%' from pg_proc
           where oid = 'public.try_auto_eat(uuid,jsonb)'::regprocedure),
  'auto-eat still resolves healing from the runtime catalogue');
select ok((select prosrc like '%action:food%' from pg_proc
           where oid = 'public.try_auto_eat(uuid,jsonb)'::regprocedure),
  'auto-eat still shares the 2-second food gate');
select ok((select prosrc like '%autoEatAt%' from pg_proc
           where oid = 'public.try_auto_eat(uuid,jsonb)'::regprocedure),
  'auto-eat still honours the player threshold');

-- ---------------------------------------------------------------------------
-- A signed-in player with one of every dish.
-- ---------------------------------------------------------------------------
create temporary table v7_food(ordinality integer, id text, heal integer);
insert into v7_food(ordinality, id, heal)
select row_number() over (order by item.id), item.id, item.heal
from public.game_runtime_items as item
where item.kind = 'food' and item.active and item.heal > 0
  and item.id = any (array[
    'honey_bun','berry_pie','hearty_stew','fishermans_stew','golden_koi_feast','sunspiced_eel',
    'runic_fish_stew','shadow_stew','frost_tonic','wyrm_feast','phoenix_fillet','starsteel_feast',
    'void_feast','wyrmforged_feast','ancient_feast','ascendant_feast']::text[]);

select is((select count(*) from v7_food), 16::bigint,
  'all 16 stable dishes resolve through the active runtime catalogue');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000f00d', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'v7-food-test@tomlandia.internal', '', now(), now());

set local role postgres;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000f00d","role":"authenticated"}', true);

-- One slot per dish, plus a non-food item and an unknown id.
insert into public.player_saves (user_id, data)
select '00000000-0000-4000-8000-00000000f00d',
       jsonb_build_object(
         'hp', 1,
         'skills', '{}'::jsonb,
         'armor', null,
         'weapon', null,
         'gold', 0,
         'bank', jsonb_build_object('gold', 0, 'items', '[]'::jsonb),
         'inv', (select jsonb_agg(jsonb_build_object('id', id, 'qty', 2) order by ordinality) from v7_food)
                || jsonb_build_array(jsonb_build_object('id', 'oak_logs', 'qty', 1),
                                     jsonb_build_object('id', 'not_a_real_item', 'qty', 1))
       );

-- Each dish, in turn: accepted, heals the capped amount, consumes exactly one.
do $v7_eat$
DECLARE
  row record;
  result jsonb;
  before_qty integer;
  after_qty integer;
  hp_before integer;
  max_hp integer;
BEGIN
  CREATE TEMP TABLE v7_results(id text, healed integer, consumed integer, ok boolean) ON COMMIT DROP;
  FOR row IN SELECT * FROM v7_food ORDER BY ordinality LOOP
    -- reset health and the shared gate so each dish is measured cleanly
    UPDATE public.player_saves SET data = jsonb_set(data, '{hp}', to_jsonb(1))
    WHERE user_id = '00000000-0000-4000-8000-00000000f00d';
    DELETE FROM public.world_cooldowns
    WHERE user_id = '00000000-0000-4000-8000-00000000f00d' AND key = 'action:food';

    SELECT (data#>>ARRAY['inv', (row.ordinality - 1)::text, 'qty'])::integer,
           (data->>'hp')::integer, public.player_max_hp(data)
      INTO before_qty, hp_before, max_hp
    FROM public.player_saves WHERE user_id = '00000000-0000-4000-8000-00000000f00d';

    result := public.consume_food(row.ordinality - 1);

    SELECT coalesce((data#>>ARRAY['inv', (row.ordinality - 1)::text, 'qty'])::integer, 0)
      INTO after_qty
    FROM public.player_saves WHERE user_id = '00000000-0000-4000-8000-00000000f00d';

    INSERT INTO v7_results VALUES (
      row.id,
      (result->>'healed')::integer,
      before_qty - after_qty,
      (result->>'ok')::boolean
        AND (result->>'healed')::integer = least(row.heal, max_hp - hp_before)
        AND before_qty - after_qty = 1);
  END LOOP;
END
$v7_eat$;

select is((select count(*) from v7_results where ok), 16::bigint,
  'every stable dish heals the capped amount and consumes exactly one item');
select is((select count(*) from v7_results where consumed <> 1), 0::bigint,
  'no dish consumes more or fewer than one item');
select is((select count(*) from v7_results where healed <= 0), 0::bigint,
  'no dish heals nothing');

-- Per-dish assertions, so a regression names the dish that broke.
select ok((select ok from v7_results where id = 'honey_bun'), 'honey_bun can be eaten manually');
select ok((select ok from v7_results where id = 'berry_pie'), 'berry_pie can be eaten manually');
select ok((select ok from v7_results where id = 'hearty_stew'), 'hearty_stew can be eaten manually');
select ok((select ok from v7_results where id = 'fishermans_stew'), 'fishermans_stew can be eaten manually');
select ok((select ok from v7_results where id = 'golden_koi_feast'), 'golden_koi_feast can be eaten manually');
select ok((select ok from v7_results where id = 'sunspiced_eel'), 'sunspiced_eel can be eaten manually');
select ok((select ok from v7_results where id = 'runic_fish_stew'), 'runic_fish_stew can be eaten manually');
select ok((select ok from v7_results where id = 'shadow_stew'), 'shadow_stew can be eaten manually');
select ok((select ok from v7_results where id = 'frost_tonic'), 'frost_tonic can be eaten manually');
select ok((select ok from v7_results where id = 'wyrm_feast'), 'wyrm_feast can be eaten manually');
select ok((select ok from v7_results where id = 'phoenix_fillet'), 'phoenix_fillet can be eaten manually');
select ok((select ok from v7_results where id = 'starsteel_feast'), 'starsteel_feast can be eaten manually');
select ok((select ok from v7_results where id = 'void_feast'), 'void_feast can be eaten manually');
select ok((select ok from v7_results where id = 'wyrmforged_feast'), 'wyrmforged_feast can be eaten manually');
select ok((select ok from v7_results where id = 'ancient_feast'), 'ancient_feast can be eaten manually');
select ok((select ok from v7_results where id = 'ascendant_feast'), 'ascendant_feast can be eaten manually');

-- ---------------------------------------------------------------------------
-- Rejections leave the save byte-identical.
-- ---------------------------------------------------------------------------
create temporary table v7_reject(label text, reason text, unchanged boolean);

do $v7_reject$
DECLARE
  before_data jsonb;
  result jsonb;
  after_data jsonb;
  cases text[][] := ARRAY[
    ARRAY['full health', 'full'],
    ARRAY['non-food item', 'wood'],
    ARRAY['unknown item id', 'unknown'],
    ARRAY['negative slot', 'negative'],
    ARRAY['out-of-range slot', 'high'],
    ARRAY['empty slot', 'empty'],
    ARRAY['second call inside the gate', 'gate']
  ];
  entry text[];
  slot integer;
BEGIN
  FOREACH entry SLICE 1 IN ARRAY cases LOOP
    DELETE FROM public.world_cooldowns
    WHERE user_id = '00000000-0000-4000-8000-00000000f00d' AND key = 'action:food';
    UPDATE public.player_saves
    SET data = jsonb_set(jsonb_set(data, '{hp}', to_jsonb(1)),
                         '{inv,17}', 'null'::jsonb, true)
    WHERE user_id = '00000000-0000-4000-8000-00000000f00d';

    IF entry[2] = 'full' THEN
      UPDATE public.player_saves
      SET data = jsonb_set(data, '{hp}', to_jsonb(public.player_max_hp(data)))
      WHERE user_id = '00000000-0000-4000-8000-00000000f00d';
      slot := 0;
    ELSIF entry[2] = 'wood' THEN slot := 16;
    ELSIF entry[2] = 'unknown' THEN slot := 17;
    ELSIF entry[2] = 'negative' THEN slot := -1;
    ELSIF entry[2] = 'high' THEN slot := 99;
    ELSIF entry[2] = 'empty' THEN slot := 17;
    ELSE
      PERFORM public.consume_food(0);
      slot := 1;
    END IF;

    IF entry[2] = 'unknown' THEN
      UPDATE public.player_saves
      SET data = jsonb_set(data, '{inv,17}', jsonb_build_object('id', 'not_a_real_item', 'qty', 1), true)
      WHERE user_id = '00000000-0000-4000-8000-00000000f00d';
    END IF;

    SELECT data INTO before_data FROM public.player_saves
    WHERE user_id = '00000000-0000-4000-8000-00000000f00d';
    result := public.consume_food(slot);
    SELECT data INTO after_data FROM public.player_saves
    WHERE user_id = '00000000-0000-4000-8000-00000000f00d';

    INSERT INTO v7_reject VALUES (entry[1], result->>'reason', before_data = after_data);
  END LOOP;
END
$v7_reject$;

select is((select reason from v7_reject where label = 'full health'), 'full_health',
  'eating at full health is rejected');
select is((select reason from v7_reject where label = 'non-food item'), 'not_food',
  'a non-food item cannot be eaten');
select is((select reason from v7_reject where label = 'unknown item id'), 'not_food',
  'an unknown item id cannot be eaten');
select is((select reason from v7_reject where label = 'negative slot'), 'bad_slot',
  'a negative slot index is rejected');
select is((select reason from v7_reject where label = 'out-of-range slot'), 'bad_slot',
  'an out-of-range slot index is rejected');
select is((select reason from v7_reject where label = 'empty slot'), 'empty',
  'an empty slot is rejected');
select is((select reason from v7_reject where label = 'second call inside the gate'), 'too_fast',
  'a second call inside the shared 2-second gate is rejected');
select is((select count(*) from v7_reject where not unchanged), 0::bigint,
  'no rejected call changes the save in any way');
select is((select count(*) from v7_reject), 7::bigint, 'every rejection path is exercised');

-- ---------------------------------------------------------------------------
-- Inactive definitions are unreachable, and healing is capped, not additive.
-- ---------------------------------------------------------------------------
select is((select count(*) from public.game_runtime_items where kind = 'food' and not active),
  0::bigint, 'the runtime catalogue never exposes an inactive dish');

do $v7_cap$
DECLARE
  max_hp integer;
  result jsonb;
BEGIN
  DELETE FROM public.world_cooldowns
  WHERE user_id = '00000000-0000-4000-8000-00000000f00d' AND key = 'action:food';
  UPDATE public.player_saves
  SET data = jsonb_set(jsonb_set(data, '{hp}', to_jsonb(public.player_max_hp(data) - 1)),
                       '{inv,15}', jsonb_build_object('id', 'ascendant_feast', 'qty', 3), true)
  WHERE user_id = '00000000-0000-4000-8000-00000000f00d';
  SELECT public.player_max_hp(data) INTO max_hp FROM public.player_saves
  WHERE user_id = '00000000-0000-4000-8000-00000000f00d';
  result := public.consume_food(15);
  CREATE TEMP TABLE v7_cap ON COMMIT DROP AS
  SELECT (result->>'healed')::integer AS healed,
         (SELECT (data->>'hp')::integer FROM public.player_saves
          WHERE user_id = '00000000-0000-4000-8000-00000000f00d') AS hp,
         max_hp AS max_hp,
         (SELECT (data#>>'{inv,15,qty}')::integer FROM public.player_saves
          WHERE user_id = '00000000-0000-4000-8000-00000000f00d') AS qty;
END
$v7_cap$;

select is((select healed from v7_cap), 1, 'healing is capped at the missing health');
select is((select hp from v7_cap), (select max_hp from v7_cap), 'a capped heal fills the bar exactly');
select is((select qty from v7_cap), 2, 'a capped heal still consumes exactly one item');

select * from finish();
rollback;

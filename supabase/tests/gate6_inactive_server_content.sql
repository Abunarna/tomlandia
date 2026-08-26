begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'game_release_control', 'release safety control exists independently of activation');
select has_table('public', 'game_content_progression_levels', 'approved versioned progression exists');
select has_view('public', 'game_runtime_items', 'active-version item view exists');
select has_view('public', 'game_runtime_recipes', 'active-version recipe view exists');
select has_view('public', 'game_runtime_recipe_inputs', 'active-version recipe-input view exists');
select has_view('public', 'game_runtime_nodes', 'active-version node view exists');
select has_view('public', 'game_runtime_monsters', 'active-version monster view exists');
select has_view('public', 'game_runtime_quests', 'active-version quest view exists');

select is((select status from public.game_content_versions where content_version = 'v2'), 'staged',
  'Gate 6 migration owns a staged v2 version');
select is((select count(*) from public.game_content_control), 0::bigint,
  'Gate 6 creates no activation control row');
select is((select count(*) from public.game_content_versions where status = 'active'), 0::bigint,
  'Gate 6 activates no canonical version');
select is(public.game_active_content_version(), 'v1', 'empty activation control defaults exactly to v1');
select is(public.game_active_spawn_set_version(), 'v1', 'empty activation control defaults exactly to v1 spawns');
select is((select minimum_client_protocol from public.game_release_control), 1,
  'missing-header old clients remain supported before cutover');
select is((select maintenance_mode from public.game_release_control), false,
  'maintenance mode is off by default');

select is((select count(*) from public.game_content_progression_levels where content_version = 'v2'), 150::bigint,
  'all 150 approved level rows are staged');
select is((select cumulative_xp from public.game_content_progression_levels where content_version = 'v2' and level = 1), 0::bigint,
  'v2 level 1 begins at zero cumulative XP');
select is((select cumulative_xp from public.game_content_progression_levels where content_version = 'v2' and level = 150), 133630835::bigint,
  'v2 level 150 uses the approved cumulative XP');
select is((select xp_to_next from public.game_content_progression_levels where content_version = 'v2' and level = 150), null::bigint,
  'v2 level 150 is terminal');

select is((select count(*) from public.game_runtime_items), (select count(*) from public.game_items),
  'v1 runtime item view is row-for-row complete');
select is((select count(*) from public.game_runtime_recipes), (select count(*) from public.game_recipes),
  'v1 runtime recipe view is row-for-row complete');
select is((select count(*) from public.game_runtime_quests), (select count(*) from public.game_quests),
  'v1 runtime quest view is row-for-row complete');
select is((select count(*) from public.game_runtime_items where content_version <> 'v1'), 0::bigint,
  'staged v2 items are absent from the active item view');
select is((select count(*) from public.game_runtime_items where id = 'ascendant_blade'), 0::bigint,
  'a v2-only item cannot render under v1');
select is(public.active_starter_save()#>>'{weapon,id}', 'wooden_club',
  'v1 starter behavior remains unchanged while v2 is staged');
select is(public.game_level_for_xp(100000), public.xp_level(100000),
  'v1 active-level helper delegates exactly to the live curve');
select is(public.equip_stat('{"weapon":{"id":"steel_sword","plus":31}}'::jsonb, 'weapon', 'attack'),
  round(9::numeric * (1 + 31 * 0.05) * 10) / 10,
  'v1 equipment multiplier remains byte-behavior compatible');

select is(public.game_runtime_status()->>'active_content_version', 'v1',
  'old-client status contract reports v1');
select is((public.game_runtime_status()->>'request_client_protocol')::integer, 1,
  'missing protocol header is treated as old-client protocol 1');
select is((public.game_runtime_status()->>'client_supported')::boolean, true,
  'old client is supported before cutover');
select is(public.game_runtime_catalog()->>'content_version', 'v1',
  'dual-client catalog contract reports v1');
select is(jsonb_array_length(public.game_runtime_catalog()->'items'), (select count(*)::integer from public.game_items),
  'dual-client v1 catalog is complete');

set local role authenticated;
select is((select count(*) from public.game_content_items where content_version = 'v2'), 0::bigint,
  'canonical RLS hides staged v2 item rows from players');
select is((select count(*) from public.game_content_versions where content_version = 'v2'), 0::bigint,
  'canonical RLS hides the staged v2 version record from players');
select is((select count(*) from public.game_runtime_items where id = 'ascendant_blade'), 0::bigint,
  'authenticated runtime view cannot leak a v2-only item under v1');
reset role;

select ok(has_function_privilege('anon', 'public.game_runtime_status()', 'EXECUTE'),
  'anonymous maintenance/version screen can read runtime status');
select ok(has_function_privilege('authenticated', 'public.game_runtime_catalog()', 'EXECUTE'),
  'dual-compatible clients can request the active catalog');
select ok(not has_function_privilege('anon', 'public.game_runtime_catalog()', 'EXECUTE'),
  'anonymous clients cannot download gameplay definitions');
select ok(not has_table_privilege('authenticated', 'public.game_release_control', 'SELECT'),
  'players cannot bypass the status contract to read release control directly');
select ok(not has_table_privilege('authenticated', 'public.game_release_control', 'UPDATE'),
  'players cannot enable or disable maintenance');

with private_routines(signature) as (values
  ('public.player_sync_v1(jsonb,bigint)'),
  ('public.gear_equip_v1(integer)'),
  ('public.craft_item_v1(text)'),
  ('public.attack_monster_v1(integer,numeric,numeric)'),
  ('public.market_buy_v1(uuid,integer)')
)
select ok(not has_function_privilege('authenticated', signature, 'EXECUTE'),
  signature || ' is private behind the Gate 6 dispatcher')
from private_routines;

with guarded_routines(signature) as (values
  ('public.player_sync(jsonb,bigint)'),
  ('public.gear_equip(integer)'),
  ('public.craft_item(text)'),
  ('public.attack_monster(integer,numeric,numeric)'),
  ('public.market_buy(uuid,integer)')
)
select ok(prosrc like '%game_assert_action_allowed%', signature || ' enforces release control')
from guarded_routines
join pg_proc on pg_proc.oid = to_regprocedure(signature);

select ok(prosrc like '%game_assert_action_allowed(true)%',
  'legacy gather dispatcher is v1-only')
from pg_proc where oid = 'public.harvest_node(integer,numeric,numeric)'::regprocedure;
select ok(prosrc like '%game_assert_action_allowed(true)%',
  'legacy fishing dispatcher is v1-only')
from pg_proc where oid = 'public.fish_cast(integer,numeric,numeric)'::regprocedure;
select ok(prosrc like '%game_assert_action_allowed(true)%',
  'legacy monster dispatcher is v1-only')
from pg_proc where oid = 'public.attack_monster(integer,numeric,numeric)'::regprocedure;
select ok(prosrc like '%game_assert_action_allowed(true)%',
  'legacy boss dispatcher is v1-only')
from pg_proc where oid = 'public.attack_boss(numeric,numeric,numeric,numeric,boolean)'::regprocedure;

update public.game_release_control
set maintenance_mode = true, maintenance_message = 'Gate 6 maintenance test', updated_at = now()
where singleton;
select throws_like(
  $$select public.game_assert_action_allowed(false)$$,
  '%game_maintenance%',
  'server rejects gameplay actions during maintenance'
);
update public.game_release_control
set maintenance_mode = false, maintenance_message = '', updated_at = now()
where singleton;

select set_config('request.headers', '{"x-tomlandia-client-protocol":"1"}', true);
update public.game_release_control set minimum_client_protocol = 2 where singleton;
select throws_like(
  $$select public.game_assert_action_allowed(false)$$,
  '%client_update_required%',
  'server rejects a client below the required protocol'
);
select set_config('request.headers', '{"x-tomlandia-client-protocol":"2"}', true);
select lives_ok(
  $$select public.game_assert_action_allowed(false)$$,
  'server accepts a dual-compatible client protocol'
);
update public.game_release_control set minimum_client_protocol = 1 where singleton;
select set_config('request.headers', '{}', true);

-- Even a service-staged v2 listing is invisible through v1 runtime contracts.
insert into public.market_listings
  (seller_name, content_version, item_id, qty, price, plus, expires_at)
values ('Gate 6 fixture', 'v2', 'ascendant_blade', 1, 1, 0, now() + interval '1 day');
select is((select count(*) from public.market_listings where content_version = 'v2'), 1::bigint,
  'version-aware market integrity accepts a real v2-only ID');
select ok(to_regprocedure('public.market_browse_v1()') is not null,
  'preserved v1 browse body remains available only for regression evidence');
select is((select count(*) from public.market_listings where content_version = public.game_active_content_version()), 0::bigint,
  'active-version marketplace filter excludes staged v2 listings');
set local role authenticated;
select is((select count(*) from public.market_listings), 0::bigint,
  'market RLS hides staged v2 listings from authenticated clients');
reset role;
delete from public.market_listings where seller_name = 'Gate 6 fixture';

-- Transactionally simulate activation to prove the same schema is v2-capable.
update public.game_content_versions set status = 'active' where content_version = 'v2';
insert into public.game_content_control
  (active_content_version, active_spawn_set_version, minimum_client_content_version,
   maintenance_mode, maintenance_message, manifest_hash, activation_timestamp, migration_run_id)
values
  ('v2', 'v2', 'v2', false, '',
   'a0d654a993f5a213c6ce667b6fbd29053e0432e351872492b0a6bf3d7b1cff77',
   now(), 'gate6-transactional-test');

select is(public.game_active_content_version(), 'v2', 'selector follows a validated v2 control row');
select is((select count(*) from public.game_runtime_items), 168::bigint,
  'v2 runtime exposes exactly the active item definitions');
select is((select count(*) from public.game_runtime_items where not active), 0::bigint,
  'v2 inactive/retired items remain hidden');
select is((select count(*) from public.game_runtime_recipes), 108::bigint,
  'v2 runtime exposes the complete active recipe graph');
select is((select count(*) from public.game_runtime_monsters), 32::bigint,
  'v2 runtime exposes all regular monster definitions');
select is(public.active_starter_save()#>>'{weapon,id}', 'copper_sword',
  'v2 starter uses the approved Copper Sword');
select is(public.active_starter_save()#>>'{armor,id}', 'cloth_tunic',
  'v2 starter uses the approved Cloth Tunic');
select is(public.game_level_for_xp(133630835), 150,
  'v2 progression caps at approved level 150');
select is(public.game_runtime_catalog()->>'content_version', 'v2',
  'dual-client catalog switches without changing its contract shape');
select is(jsonb_array_length(public.game_runtime_catalog()->'items'), 168,
  'dual-client v2 catalog excludes six inactive definitions');
select throws_like(
  $$select public.game_assert_action_allowed(true)$$,
  '%legacy_world_contract_disabled%',
  'integer-ID world contract fails closed under v2'
);
select lives_ok(
  $$select public.game_assert_action_allowed(false)$$,
  'non-world v2-capable action layer passes the release gate'
);

select * from finish();
rollback;

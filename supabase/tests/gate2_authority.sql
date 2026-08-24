begin;

create extension if not exists pgtap with schema extensions;
select plan(55);

select is((select count(*) from public.game_starter_templates where active), 1::bigint,
  'exactly one server-owned starter template is active');
select is((select (data->>'gold')::integer from public.game_starter_templates where active), 0,
  'starter economy begins at zero gold');
select is((select data#>>'{weapon,id}' from public.game_starter_templates where active), 'wooden_club',
  'starter equipment is server-owned');
select is((select count(*) from public.game_items where id in (
  'minor_venom_draught','goblins_fury_tonic','serpents_bite_elixir','shadow_venom','frostfire_brew'
)), 5::bigint, 'all current potions exist');
select is((select count(*) from public.game_items where id in (
  'minor_venom_draught','goblins_fury_tonic','serpents_bite_elixir','shadow_venom','frostfire_brew'
) and (coalesce(dmg_boost, 0) <= 0 or coalesce(boost_hits, 0) <= 0)), 0::bigint,
  'all current potions have positive effects');

with result as (
  select public.slot_add('[null,null]'::jsonb, 2, 'steel_sword', 2, 7, false) as slots
)
select is((select slots#>>'{0,qty}' from result), '1', 'non-stackable gear occupies one unit per slot');
with result as (
  select public.slot_add('[null,null]'::jsonb, 2, 'steel_sword', 2, 7, false) as slots
)
select is((select slots#>>'{1,qty}' from result), '1', 'a second gear unit occupies a second slot');

select ok(not has_table_privilege('authenticated', 'public.player_saves', 'INSERT'),
  'authenticated cannot insert a save directly');
select ok(not has_table_privilege('authenticated', 'public.player_saves', 'UPDATE'),
  'authenticated cannot update a save directly');
select ok(not has_table_privilege('authenticated', 'public.player_saves', 'DELETE'),
  'authenticated cannot delete a save directly');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  'authenticated cannot desynchronise profile name columns directly');
select ok(not has_function_privilege('authenticated', 'public.track_position(uuid,numeric,numeric)', 'EXECUTE'),
  'authenticated cannot provide an arbitrary position owner');
select ok(not has_function_privilege('anon', 'public.track_position(uuid,numeric,numeric)', 'EXECUTE'),
  'anonymous cannot call the position helper');
select like(prosrc, '%elapsed < 0.25%', 'same-frame movement cannot ratchet the trusted anchor')
from pg_proc where oid = 'public.track_position(uuid,numeric,numeric)'::regprocedure;
select like(prosrc, '%world_cooldowns.next_at <= now()%', 'action cooldown acquisition is atomic')
from pg_proc where oid = 'public.action_gate(uuid,text,interval)'::regprocedure;
select like(prosrc, '%player_positions%', 'death settlement resets the trusted position anchor')
from pg_proc where oid = 'public.settle_incoming_damage(uuid,jsonb,integer,text)'::regprocedure;

select unlike(prosrc, '%_data->''gold''%', 'player_sync ignores client gold')
from pg_proc where oid = 'public.player_sync(jsonb,bigint)'::regprocedure;
select unlike(prosrc, '%_data->''inv''%', 'player_sync ignores client inventory')
from pg_proc where oid = 'public.player_sync(jsonb,bigint)'::regprocedure;
select unlike(prosrc, '%_data->''skills''%', 'player_sync ignores client skills')
from pg_proc where oid = 'public.player_sync(jsonb,bigint)'::regprocedure;
select unlike(prosrc, '%_data->''hp''%', 'player_sync ignores client health')
from pg_proc where oid = 'public.player_sync(jsonb,bigint)'::regprocedure;
select unlike(prosrc, '%_data->''quest''%', 'player_sync ignores client quests')
from pg_proc where oid = 'public.player_sync(jsonb,bigint)'::regprocedure;
select unlike(prosrc, '%_data->''weapon''%', 'player_sync ignores client weapon')
from pg_proc where oid = 'public.player_sync(jsonb,bigint)'::regprocedure;
select unlike(prosrc, '%_data->''bank''%', 'player_sync ignores client bank')
from pg_proc where oid = 'public.player_sync(jsonb,bigint)'::regprocedure;

select like(prosrc, '%''leveled''%', 'attack_monster returns leveled')
from pg_proc where oid = 'public.attack_monster(integer,numeric,numeric)'::regprocedure;
select like(prosrc, '%''state''%', 'attack_monster returns state')
from pg_proc where oid = 'public.attack_monster(integer,numeric,numeric)'::regprocedure;
select like(prosrc, '%''buff''%', 'attack_monster returns buff')
from pg_proc where oid = 'public.attack_monster(integer,numeric,numeric)'::regprocedure;
select unlike(prosrc, '%''levelup''%', 'attack_monster removed legacy levelup')
from pg_proc where oid = 'public.attack_monster(integer,numeric,numeric)'::regprocedure;
select unlike(prosrc, '%''save''%', 'attack_monster never returns a whole save alias')
from pg_proc where oid = 'public.attack_monster(integer,numeric,numeric)'::regprocedure;
select like(prosrc, '%''skipped_loot''%', 'attack_monster reports full-bag skipped loot')
from pg_proc where oid = 'public.attack_monster(integer,numeric,numeric)'::regprocedure;
select like(prosrc, '%15 seconds%', 'monster ownership tags expire')
from pg_proc where oid = 'public.attack_monster(integer,numeric,numeric)'::regprocedure;

select like(prosrc, '%w1%', 'fish_cast reads level-1 stored weights')
from pg_proc where oid = 'public.fish_cast(integer,numeric,numeric)'::regprocedure;
select like(prosrc, '%w15%', 'fish_cast reads level-15 stored weights')
from pg_proc where oid = 'public.fish_cast(integer,numeric,numeric)'::regprocedure;
select like(prosrc, '%w40%', 'fish_cast reads level-40 stored weights')
from pg_proc where oid = 'public.fish_cast(integer,numeric,numeric)'::regprocedure;
select like(prosrc, '%w70%', 'fish_cast reads level-70 stored weights')
from pg_proc where oid = 'public.fish_cast(integer,numeric,numeric)'::regprocedure;
select like(prosrc, '%w100%', 'fish_cast reads level-100 stored weights')
from pg_proc where oid = 'public.fish_cast(integer,numeric,numeric)'::regprocedure;
select unlike(prosrc, '%start_pct%', 'fish_cast removed misleading hard-coded weight arrays')
from pg_proc where oid = 'public.fish_cast(integer,numeric,numeric)'::regprocedure;

select is((select count(*) from public.game_boss_path_points), 181::bigint,
  'DESOLATUS server path matches the 181-point client loop');
select ok((select x is not null and y is not null from public.boss_position_at('2026-08-24T00:00:00Z')),
  'DESOLATUS has a deterministic server position at a fixed time');
select unlike(prosrc, '%tungsten_ore%', 'DESOLATUS no longer grants a retired Tungsten reward')
from pg_proc where oid = 'public.attack_boss(numeric,numeric,numeric,numeric,boolean)'::regprocedure;
select like(prosrc, '%boss_position_at%', 'DESOLATUS combat reads the server path')
from pg_proc where oid = 'public.attack_boss(numeric,numeric,numeric,numeric,boolean)'::regprocedure;

select like(prosrc, '%gross numeric%', 'market multiplication is evaluated as numeric')
from pg_proc where oid = 'public.market_buy(uuid,integer)'::regprocedure;
select like(prosrc, '%untradable%', 'market buy enforces server tradability')
from pg_proc where oid = 'public.market_buy(uuid,integer)'::regprocedure;
select ok(not has_function_privilege('public', 'public.leaderboard(text)', 'EXECUTE'),
  'leaderboard has no PUBLIC execute grant');

with routines(name, signature) as (values
  ('consume_food', 'public.consume_food(integer)'),
  ('player_recover', 'public.player_recover()'),
  ('quest_action', 'public.quest_action(text,text)'),
  ('sell_all_resources', 'public.sell_all_resources()')
)
select ok(to_regprocedure(signature) is not null, name || ' exists') from routines order by name;

with routines(name, signature) as (values
  ('consume_food', 'public.consume_food(integer)'),
  ('player_recover', 'public.player_recover()'),
  ('quest_action', 'public.quest_action(text,text)'),
  ('sell_all_resources', 'public.sell_all_resources()')
)
select ok(has_function_privilege('authenticated', signature, 'EXECUTE'),
  'authenticated can execute ' || name) from routines order by name;

with routines(name, signature) as (values
  ('consume_food', 'public.consume_food(integer)'),
  ('player_recover', 'public.player_recover()'),
  ('quest_action', 'public.quest_action(text,text)'),
  ('sell_all_resources', 'public.sell_all_resources()')
)
select ok(not has_function_privilege('anon', signature, 'EXECUTE'),
  'anonymous cannot execute ' || name) from routines order by name;

select * from finish();
rollback;

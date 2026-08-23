begin;

create extension if not exists pgtap with schema extensions;
select plan(39);

-- A zero-to-head reset must leave every application RPC present and inspectable.
with application_rpcs(name, signature) as (
  values
    ('harvest_node', 'public.harvest_node(integer,numeric,numeric)'),
    ('attack_monster', 'public.attack_monster(integer,numeric,numeric)'),
    ('attack_boss', 'public.attack_boss(numeric,numeric,numeric,numeric,boolean)'),
    ('craft_item', 'public.craft_item(text)'),
    ('fish_cast', 'public.fish_cast(integer,numeric,numeric)'),
    ('use_potion', 'public.use_potion(text)'),
    ('gear_equip', 'public.gear_equip(integer)'),
    ('gear_upgrade', 'public.gear_upgrade(text)'),
    ('inv_drop', 'public.inv_drop(integer)'),
    ('inv_sell', 'public.inv_sell(integer)'),
    ('bank_gold', 'public.bank_gold(text,integer)'),
    ('bank_item', 'public.bank_item(text,integer,integer)'),
    ('market_browse', 'public.market_browse()'),
    ('market_list', 'public.market_list(text,integer,integer,integer)'),
    ('market_buy', 'public.market_buy(uuid,integer)'),
    ('market_cancel', 'public.market_cancel(uuid)'),
    ('leaderboard', 'public.leaderboard(text)'),
    ('player_sync', 'public.player_sync(jsonb,bigint)')
)
select ok(to_regprocedure(signature) is not null, name || ' exists after zero-to-head migration')
from application_rpcs
order by name;

with application_rpcs(name, signature) as (
  values
    ('harvest_node', 'public.harvest_node(integer,numeric,numeric)'),
    ('attack_monster', 'public.attack_monster(integer,numeric,numeric)'),
    ('attack_boss', 'public.attack_boss(numeric,numeric,numeric,numeric,boolean)'),
    ('craft_item', 'public.craft_item(text)'),
    ('fish_cast', 'public.fish_cast(integer,numeric,numeric)'),
    ('use_potion', 'public.use_potion(text)'),
    ('gear_equip', 'public.gear_equip(integer)'),
    ('gear_upgrade', 'public.gear_upgrade(text)'),
    ('inv_drop', 'public.inv_drop(integer)'),
    ('inv_sell', 'public.inv_sell(integer)'),
    ('bank_gold', 'public.bank_gold(text,integer)'),
    ('bank_item', 'public.bank_item(text,integer,integer)'),
    ('market_browse', 'public.market_browse()'),
    ('market_list', 'public.market_list(text,integer,integer,integer)'),
    ('market_buy', 'public.market_buy(uuid,integer)'),
    ('market_cancel', 'public.market_cancel(uuid)'),
    ('leaderboard', 'public.leaderboard(text)'),
    ('player_sync', 'public.player_sync(jsonb,bigint)')
)
select is(
  pg_get_function_result(to_regprocedure(signature)::oid),
  'jsonb',
  name || ' final routine returns jsonb'
)
from application_rpcs
order by name;

select ok(
  (select count(*) >= 39 from supabase_migrations.schema_migrations),
  'all baseline migrations were recorded from zero'
);

select ok(
  length(pg_get_functiondef('public.attack_monster(integer,numeric,numeric)'::regprocedure)) > 100,
  'final attack_monster routine is inspectable'
);

select ok(
  length(pg_get_functiondef('public.use_potion(text)'::regprocedure)) > 100,
  'final use_potion routine is inspectable'
);

select * from finish();
rollback;

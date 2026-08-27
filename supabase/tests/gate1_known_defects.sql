begin;

create extension if not exists pgtap with schema extensions;
select plan(46);

create temporary view gate1_attack_final_return as
select regexp_replace(
  prosrc,
  E'.*RETURN\\s+jsonb_build_object\\s*\\(',
  '',
  's'
) as body
from pg_proc
where oid = coalesce(
  to_regprocedure('public.attack_monster_v1(integer,numeric,numeric)'),
  'public.attack_monster(integer,numeric,numeric)'::regprocedure
);

-- Gate 2 must standardise the final success object, not add another partial patch.
select ok(body like '%''leveled''%', 'attack_monster returns canonical leveled key') from gate1_attack_final_return;
select ok(body like '%''state''%', 'attack_monster returns canonical state key') from gate1_attack_final_return;
select ok(body like '%''buff''%', 'attack_monster returns canonical buff key') from gate1_attack_final_return;
select ok(body not like '%''levelup''%', 'attack_monster no longer returns legacy levelup key') from gate1_attack_final_return;
select ok(body not like '%''save''%', 'attack_monster no longer returns legacy whole-save key') from gate1_attack_final_return;

select is(
  (
    select count(*)
    from public.game_items
    where id in (
      'minor_venom_draught',
      'goblins_fury_tonic',
      'serpents_bite_elixir',
      'shadow_venom',
      'frostfire_brew'
    )
  ),
  5::bigint,
  'all five current potion IDs exist'
);

select is(
  (
    select count(*)
    from public.game_items
    where id in (
      'minor_venom_draught',
      'goblins_fury_tonic',
      'serpents_bite_elixir',
      'shadow_venom',
      'frostfire_brew'
    )
      and (dmg_boost is null or boost_hits is null)
  ),
  0::bigint,
  'current potion effect columns are never null'
);

select is(
  (
    select count(*)
    from public.game_items
    where id in (
      'minor_venom_draught',
      'goblins_fury_tonic',
      'serpents_bite_elixir',
      'shadow_venom',
      'frostfire_brew'
    )
      and (coalesce(dmg_boost, 0) <= 0 or coalesce(boost_hits, 0) <= 0)
  ),
  0::bigint,
  'current potion effects are positive'
);

-- Authentication is enforced both in routine code and in execute privileges.
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
select ok(
  has_function_privilege('authenticated', signature, 'EXECUTE'),
  'authenticated can execute ' || name
)
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
select ok(
  not has_function_privilege('anon', signature, 'EXECUTE'),
  'anonymous cannot execute ' || name
)
from application_rpcs
order by name;

select ok(
  not has_function_privilege('anon', 'public.track_position(uuid,numeric,numeric)', 'EXECUTE'),
  'anonymous cannot execute internal track_position helper'
);

select ok(
  has_function_privilege('authenticated', 'public.track_position(uuid,numeric,numeric)', 'EXECUTE'),
  'authenticated can execute identity-bound track_position'
);

select * from finish();
rollback;

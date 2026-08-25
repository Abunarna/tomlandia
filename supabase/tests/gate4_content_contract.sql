begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'game_content_versions', 'version registry exists');
select has_table('public', 'game_content_control', 'single active-version control exists');
select has_table('public', 'game_content_tiers', 'versioned tier registry exists');
select has_table('public', 'game_content_items', 'versioned item definitions exist');
select has_table('public', 'game_content_recipes', 'versioned recipes exist');
select has_table('public', 'game_content_recipe_inputs', 'versioned recipe inputs exist');
select has_table('public', 'game_content_nodes', 'versioned node definitions exist');
select has_table('public', 'game_content_monsters', 'versioned monster definitions exist');
select has_table('public', 'game_content_monster_loot', 'versioned monster loot exists');
select has_table('public', 'game_content_fish', 'versioned fish rules exist');
select has_table('public', 'game_content_fishing_spots', 'versioned fishing spots exist');
select has_table('public', 'game_content_quests', 'versioned quests exist');
select has_table('public', 'game_content_bosses', 'versioned boss definitions exist');
select has_table('public', 'game_content_spawns', 'stable versioned spawns exist');
select has_table('public', 'game_content_migration_rules', 'versioned migration rules exist');

select has_column('public', 'game_content_items', 'content_version', 'items carry content version');
select has_column('public', 'game_content_items', 'active', 'items carry active state');
select has_column('public', 'game_content_items', 'tier_index', 'items carry ordinal tier index');
select has_column('public', 'game_content_items', 'level_requirement', 'items carry gameplay level');
select has_column('public', 'game_content_items', 'family', 'items carry icon family');
select has_column('public', 'game_content_items', 'icon_key', 'items carry a canonical UI icon key');
select has_column('public', 'game_content_items', 'colour', 'items carry canonical colour');
select has_column('public', 'game_content_items', 'rarity', 'items carry rarity');
select has_column('public', 'game_content_items', 'tradable', 'items carry positive tradability');
select has_column('public', 'game_content_items', 'boost_hits', 'items carry required potion duration stat');
select has_column('public', 'game_content_monsters', 'level_requirement', 'monster level is explicit');
select has_column('public', 'game_content_monsters', 'visual', 'monster sprite geometry and fallback are canonical');
select has_column('public', 'game_content_quests', 'description', 'quest descriptions are canonical');
select has_column('public', 'game_content_versions', 'starter_loadout', 'starter loadout is versioned content');
select has_column('public', 'game_content_versions', 'mechanics', 'approved mechanics are versioned content');
select has_column('public', 'game_content_recipes', 'station', 'recipe station is canonical');
select has_column('public', 'game_content_spawns', 'spawn_id', 'spawns use stable UUID identity');
select has_column('public', 'game_content_spawns', 'spawn_set_version', 'spawns own a spawn-set version');
select has_column('public', 'game_content_versions', 'uuid_namespace', 'version records retain the UUIDv5 namespace');
select has_column('public', 'game_content_spawns', 'biome', 'spawns own a biome');
select has_column('public', 'game_content_spawns', 'subzone', 'spawns own a sub-zone');

select has_column('public', 'market_listings', 'content_version', 'listings capture content version');
select has_column('public', 'market_trades', 'content_version', 'trades capture content version');
select has_column('public', 'market_prices', 'content_version', 'last-price rows capture content version');
select is(
  (
    select string_agg(a.attname, ',' order by key_columns.ordinality)
    from pg_constraint c
    cross join lateral unnest(c.conkey) with ordinality as key_columns(attnum, ordinality)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key_columns.attnum
    where c.conrelid = 'public.market_prices'::regclass and c.contype = 'p'
  ),
  'content_version,item_id,plus',
  'market price primary key prevents v1/v2 history collision'
);

select is((select count(*) from public.game_content_versions), 0::bigint,
  'Gate 4 activates no content version');
select is((select count(*) from public.game_content_control), 0::bigint,
  'Gate 4 creates no active control row');
select is((select count(*) from public.game_content_versions where status = 'active'), 0::bigint,
  'Gate 4 leaves v2 inactive');

select ok(to_regprocedure('public.game_validate_content_version(text)') is not null,
  'deferred content validator exists');
select ok(to_regprocedure('public.game_assert_content_version(text)') is not null,
  'hard content assertion exists');
select ok(not has_function_privilege('authenticated', 'public.game_validate_content_version(text)', 'EXECUTE'),
  'players cannot invoke internal content validation');
select ok(not has_function_privilege('authenticated', 'public.game_assert_content_version(text)', 'EXECUTE'),
  'players cannot invoke internal content assertion');
select ok(prosrc like '%unsupported_content_version%',
  'legacy market buy fails closed for a staged v2 listing')
from pg_proc where oid = 'public.market_buy(uuid,integer)'::regprocedure;
select ok(prosrc like '%content_version, item_id, plus%',
  'market settlement writes the composite versioned price key')
from pg_proc where oid = 'public.market_buy(uuid,integer)'::regprocedure;

insert into public.game_content_versions
  (content_version, spawn_set_version, uuid_namespace, manifest_hash, status, starter_loadout, mechanics, player_notice)
values (
  'gate4_test_v1',
  'gate4_test_spawns_v1',
  'bf50882c-ad8a-57ab-bb73-3ea3dd8fcb5c',
  repeat('a', 64),
  'staged',
  '{"weapon_item_id":"copper_sword","armor_item_id":"cloth_tunic","plus":0}'::jsonb,
  '{"approved_balance_model_hash":"e1fbe19aac61014b38885ce38cd16d9a12e3852f24858301a2588c65fba4a640","max_level":150,"max_plus":100,"market_fee_pct":5,"weapon_multiplier_rule":"1 + 2% * min(plus, 50) + 0.5% * max(plus - 50, 0)","light_attack_multiplier_rule":"1 + 5% * min(plus, 20) + 1% * max(plus - 20, 0)","defense_multiplier_rule":"1 + 0.1% * plus","upgrade_cost_rule":"round_to_5(max(25, item_value * (0.08 + 3.4 * sqrt(next_plus))))","gear_resale_rule":"floor(item_value * 0.40 + cumulative_upgrade_spend * 0.15)","fishing_xp_curve":[{"tier_index":1,"level_requirement":1,"xp_per_action":3},{"tier_index":2,"level_requirement":10,"xp_per_action":6},{"tier_index":3,"level_requirement":20,"xp_per_action":17},{"tier_index":4,"level_requirement":30,"xp_per_action":40},{"tier_index":5,"level_requirement":40,"xp_per_action":102},{"tier_index":6,"level_requirement":50,"xp_per_action":331},{"tier_index":7,"level_requirement":60,"xp_per_action":588},{"tier_index":8,"level_requirement":70,"xp_per_action":660},{"tier_index":9,"level_requirement":80,"xp_per_action":753},{"tier_index":10,"level_requirement":90,"xp_per_action":844},{"tier_index":11,"level_requirement":100,"xp_per_action":935},{"tier_index":12,"level_requirement":110,"xp_per_action":1025},{"tier_index":13,"level_requirement":120,"xp_per_action":1113},{"tier_index":14,"level_requirement":130,"xp_per_action":1208},{"tier_index":15,"level_requirement":140,"xp_per_action":1312},{"tier_index":16,"level_requirement":150,"xp_per_action":1413}]}'::jsonb,
  '{"title":"Test","summary":"Test staging only","details":["No activation"]}'::jsonb
);

insert into public.game_content_tiers
  (content_version, tier_index, level_requirement, theme, palette)
values
  ('gate4_test_v1',1,1,'Copper','{"primary":"#B87333","secondary":"#E0A070","accent":"#FFF1D6"}'),
  ('gate4_test_v1',2,10,'Bronze','{"primary":"#CD7F32","secondary":"#D9A066","accent":"#FFF0D0"}'),
  ('gate4_test_v1',3,20,'Iron','{"primary":"#8E959C","secondary":"#B0A49B","accent":"#F0F2F4"}'),
  ('gate4_test_v1',4,30,'Steel','{"primary":"#6F8194","secondary":"#CDD8E6","accent":"#F5FAFF"}'),
  ('gate4_test_v1',5,40,'Mithril','{"primary":"#5F91C7","secondary":"#A8CDEE","accent":"#EAF6FF"}'),
  ('gate4_test_v1',6,50,'Sunsteel','{"primary":"#E3A82B","secondary":"#F5D78A","accent":"#FFF8D8"}'),
  ('gate4_test_v1',7,60,'Runite','{"primary":"#2C9D8C","secondary":"#95E6D6","accent":"#E2FFF9"}'),
  ('gate4_test_v1',8,70,'Shadowsteel','{"primary":"#50406C","secondary":"#9B86BD","accent":"#E9DFFF"}'),
  ('gate4_test_v1',9,80,'Froststeel','{"primary":"#4B8BAA","secondary":"#8FD6EE","accent":"#E7FAFF"}'),
  ('gate4_test_v1',10,90,'Wyrmsteel','{"primary":"#7B4F45","secondary":"#C38A77","accent":"#FFE6DE"}'),
  ('gate4_test_v1',11,100,'Glacial','{"primary":"#78AFCB","secondary":"#DCECF7","accent":"#FFFFFF"}'),
  ('gate4_test_v1',12,110,'Starsteel','{"primary":"#5368B9","secondary":"#AAB8F0","accent":"#F3F5FF"}'),
  ('gate4_test_v1',13,120,'Voidsteel','{"primary":"#321F4D","secondary":"#8061A9","accent":"#E9DCFF"}'),
  ('gate4_test_v1',14,130,'Wyrmforged','{"primary":"#8D3F35","secondary":"#D9795D","accent":"#FFE0D5"}'),
  ('gate4_test_v1',15,140,'Ancient','{"primary":"#81703D","secondary":"#C6B86E","accent":"#FFF6C9"}'),
  ('gate4_test_v1',16,150,'Ascendant','{"primary":"#7E55C7","secondary":"#C9A8FF","accent":"#FFF0FF"}');

insert into public.game_content_items
  (content_version,id,name,active,tier_index,level_requirement,kind,family,icon_key,colour,rarity,tradable,stackable,value,equip_skill,attack,defense,heal,speed,dmg_boost,boost_hits)
values
  ('gate4_test_v1','copper_ore','Copper Ore',true,1,1,'resource','ore','copper_ore','#B87333','common',true,true,6,null,0,0,0,0,0,0),
  ('gate4_test_v1','copper_bar','Copper Bar',true,1,1,'material','bar','copper_bar','#E0A070','common',true,true,18,null,0,0,0,0,0,0),
  ('gate4_test_v1','copper_sword','Copper Sword',true,1,1,'weapon','weapon','copper_sword','#E0A070','common',true,false,70,'combat',6,0,0,0,0,0),
  ('gate4_test_v1','cloth_tunic','Cloth Tunic',true,1,1,'armor','armor','cloth_tunic','#F2C6D8','common',true,false,18,'combat',1,3.3,0,0.04,0,0),
  ('gate4_test_v1','goblin_charm','Goblin Charm',true,1,1,'trophy','charm','goblin_charm','#A7D97F','uncommon',true,true,14,null,0,0,0,0,0,0),
  ('gate4_test_v1','river_minnow','River Minnow',true,1,1,'resource','fish','river_minnow','#9FC9D8','common',true,true,8,null,0,0,0,0,0,0),
  ('gate4_test_v1','ascendant_core','Ascendant Core',true,16,150,'trophy','core','ascendant_core','#C9A8FF','legendary',true,true,10000,null,0,0,0,0,0,0);

insert into public.game_content_recipes
  (content_version,id,active,tier_index,level_requirement,station,skill,output_item_id,output_qty,xp,time_s)
values ('gate4_test_v1','smelt_copper_bar',true,1,1,'smelt','smithing','copper_bar',1,22,1.6);
insert into public.game_content_recipe_inputs (content_version,recipe_id,item_id,qty)
values ('gate4_test_v1','smelt_copper_bar','copper_ore',2);
insert into public.game_content_nodes
  (content_version,kind,name,active,tier_index,level_requirement,skill,item_id,xp,gather_s,respawn_s,max_charges,cluster_min,shape,family,colour,visual_key)
values ('gate4_test_v1','copper_rock','Copper Rock',true,1,1,'mining','copper_ore',18,3.2,9,4,6,'rock','rock','#B87333','copper_rock');
insert into public.game_content_monsters
  (content_version,kind,name,active,tier_index,level_requirement,hp,attack,defense,xp,gold_min,gold_max,respawn_s,visual_key,visual)
values ('gate4_test_v1','goblin','Goblin',true,1,1,22,5,2,34,4,12,15,'goblin',
  '{"asset_key":"goblin","asset_path":"sprites/creatures/goblin.png","source_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","padded_sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","canvas":{"width":108,"height":166},"pivot":{"x":54,"y":162},"visual_bounds":{"left":4,"top":4,"right":104,"bottom":162},"click_bounds":{"left":4,"top":4,"right":104,"bottom":162},"render_scale":1,"ground_offset_y":16,"motion_profile":"static_front_facing_bob","fallback":{"body":"#A7D97F","accent":"#6FAE52","size":1,"ears":"horns"}}'::jsonb);
insert into public.game_content_monster_loot
  (content_version,monster_kind,ordinal,item_id,chance,qty_min,qty_max,channel,xp)
values ('gate4_test_v1','goblin',0,'goblin_charm',0.35,1,1,'drop',0);
insert into public.game_content_fish
  (content_version,item_id,active,tier_index,level_requirement,xp,weights)
values ('gate4_test_v1','river_minnow',true,1,1,12,'[{"level":1,"weight":1},{"level":150,"weight":1}]');
insert into public.game_content_fishing_spots
  (content_version,id,active,biome,subzone,x,y,fish_item_ids)
values ('gate4_test_v1','fields_pond',true,'fields','grand_haven_outskirts',330,2780,'["river_minnow"]');
insert into public.game_content_quests
  (content_version,id,name,description,active,tier_index,level_requirement,kind,target_id,count,gold,xp_skill,xp,reward_items)
values ('gate4_test_v1','goblin_trouble','Goblin Trouble','Goblins raid the east fields. Defeat 5.',true,1,1,'kill','goblin',5,20,'combat',50,'[{"item_id":"copper_bar","qty":1}]');
insert into public.game_content_bosses
  (content_version,id,name,active,level_requirement,hp,attack,defense,respawn_s,visual_key,reward_mode,target_contributors,minimum_damage,xp_pool,xp_per_player_cap,gold_pool_min,gold_pool_max,gold_per_player_cap_min,gold_per_player_cap_max,rewards)
values ('gate4_test_v1','desolatus','DESOLATUS',true,150,100000,500,250,3600,'desolatus_procedural','fixed_pool_proportional_damage_with_per_player_cap',4,1000,4000,1000,2000,4000,500,1000,'[]');
insert into public.game_content_spawns
  (spawn_id,content_version,spawn_set_version,entity_type,kind,ordinal,active,biome,subzone,x,y)
values
  ('23f4f507-571e-5d66-88c5-cf96b740fb50','gate4_test_v1','gate4_test_spawns_v1','node','copper_rock',0,true,'fields','grand_haven_outskirts',250,210),
  ('dd069d6c-9024-5afe-b5e6-b78956d0dda1','gate4_test_v1','gate4_test_spawns_v1','monster','goblin',0,true,'fields','grand_haven_outskirts',980,700);
insert into public.game_content_migration_rules
  (content_version,from_id,action,to_id,captured_value_required,notice_key)
values ('gate4_test_v1','wooden_club','replace','copper_sword',false,'wooden_club_replaced');

update public.game_content_versions
set mechanics = jsonb_set(mechanics, '{weapon_multiplier_rule}', to_jsonb('tampered'::text))
where content_version = 'gate4_test_v1';
select is(
  (select count(*) from public.game_validate_content_version('gate4_test_v1') where issue_code = 'invalid_mechanics'),
  1::bigint,
  'database validator rejects drift from the owner-approved Gate 3 mechanics'
);
update public.game_content_versions
set mechanics = jsonb_set(
  mechanics,
  '{weapon_multiplier_rule}',
  to_jsonb('1 + 2% * min(plus, 50) + 0.5% * max(plus - 50, 0)'::text)
)
where content_version = 'gate4_test_v1';

update public.game_content_versions
set starter_loadout = jsonb_set(starter_loadout, '{plus}', '1'::jsonb)
where content_version = 'gate4_test_v1';
select is(
  (select count(*) from public.game_validate_content_version('gate4_test_v1') where issue_code = 'invalid_starter_loadout'),
  1::bigint,
  'database validator rejects drift from the locked +0 starter loadout'
);
update public.game_content_versions
set starter_loadout = jsonb_set(starter_loadout, '{plus}', '0'::jsonb)
where content_version = 'gate4_test_v1';

insert into public.game_content_spawns
  (spawn_id,content_version,spawn_set_version,entity_type,kind,ordinal,active,biome,subzone,x,y)
values ('6f7b054d-fad4-59a2-bb51-fd60be17ae0b','gate4_test_v1','gate4_test_spawns_v1','node','missing_rock',1,true,'fields','grand_haven_outskirts',300,210);

select is(
  (select count(*) from public.game_validate_content_version('gate4_test_v1')),
  1::bigint,
  'deferred validator reports a polymorphic dangling spawn reference'
);
select is(
  (select issue_code from public.game_validate_content_version('gate4_test_v1')),
  'inactive_node_spawn',
  'deferred validator identifies the dangling node spawn'
);
select throws_like(
  $$select public.game_assert_content_version('gate4_test_v1')$$,
  '%content_integrity_violation%',
  'hard assertion blocks invalid staged content'
);

delete from public.game_content_spawns where spawn_id = '6f7b054d-fad4-59a2-bb51-fd60be17ae0b';
select is(
  (select count(*) from public.game_validate_content_version('gate4_test_v1')),
  0::bigint,
  'complete closed fixture has zero content integrity violations'
);
select lives_ok(
  $$select public.game_assert_content_version('gate4_test_v1')$$,
  'hard assertion accepts a complete staged manifest'
);
select lives_ok(
  $$update public.game_content_versions set status = 'active' where content_version = 'gate4_test_v1'$$,
  'activation trigger accepts only a complete manifest'
);
select ok(
  (select activated_at is not null from public.game_content_versions where content_version = 'gate4_test_v1'),
  'activation trigger records activation time'
);
select lives_ok(
  $$insert into public.game_content_control
      (active_content_version,active_spawn_set_version,minimum_client_content_version,maintenance_mode,maintenance_message,manifest_hash,activation_timestamp,migration_run_id)
    values ('gate4_test_v1','gate4_test_spawns_v1','gate4_test_v1',false,'',repeat('a',64),now(),'gate4-test-run')$$,
  'control guard accepts a matching active version, spawn set and hash'
);
select is((select active_content_version from public.game_content_control), 'gate4_test_v1',
  'single control row points at the validated active version');

select * from finish();
rollback;

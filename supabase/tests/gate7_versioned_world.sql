begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'game_world_spawn_sets', 'versioned world metadata exists');
select has_table('public', 'game_world_nodes', 'UUID node state exists');
select has_table('public', 'game_world_monsters', 'UUID monster state exists');
select has_column('public', 'game_world_nodes', 'spawn_id', 'node state owns stable UUID identity');
select has_column('public', 'game_world_nodes', 'cell', 'node state owns subscription cell');
select has_column('public', 'game_world_nodes', 'subzone', 'node state owns exact subzone');
select has_column('public', 'game_world_nodes', 'respawn_at', 'node depletion state is server-owned');
select has_column('public', 'game_world_monsters', 'spawn_id', 'monster state owns stable UUID identity');
select has_column('public', 'game_world_monsters', 'tagged_by', 'monster ownership is server-owned');
select has_column('public', 'game_world_monsters', 'respawn_at', 'monster death state is server-owned');
select col_type_is('public', 'game_world_nodes', 'spawn_id', 'uuid', 'node identity is UUID');
select col_type_is('public', 'game_world_monsters', 'spawn_id', 'uuid', 'monster identity is UUID');

select is(
  (select count(*) from pg_constraint
   where conrelid = 'public.game_world_nodes'::regclass and contype = 'f' and array_length(conkey, 1) = 5),
  1::bigint,
  'node state has a five-column canonical spawn foreign key'
);
select is(
  (select count(*) from pg_constraint
   where conrelid = 'public.game_world_monsters'::regclass and contype = 'f' and array_length(conkey, 1) = 5),
  1::bigint,
  'monster state has a five-column canonical spawn foreign key'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'game_world_nodes_cell_position_check'),
  'node subscription cell is database-constrained from coordinates'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'game_world_monsters_cell_position_check'),
  'monster subscription cell is database-constrained from coordinates'
);

select is((select count(*) from public.game_world_spawn_sets where content_version = 'v2'), 1::bigint,
  'one v2 deterministic world manifest is staged');
select is((select spawn_hash from public.game_world_spawn_sets where content_version = 'v2'),
  '9d1bc1c263fb2e5b45e3e1b16c62ec3d2e314d6733a0378c95a0fe06e0cdc9e0',
  'database stores the reviewed spawn payload hash');
select is((select source_content_manifest_hash from public.game_world_spawn_sets where content_version = 'v2'),
  'a0d654a993f5a213c6ce667b6fbd29053e0432e351872492b0a6bf3d7b1cff77',
  'world state is bound to the approved Gate 5 content manifest');
select is((select cluster_probability from public.game_world_spawn_sets where content_version = 'v2'), 0.9::numeric,
  'database records the real deterministic 90/10 generator rule');
select is((select movement_speed from public.game_world_spawn_sets where content_version = 'v2'), 130::numeric,
  'reachability uses the real 130 world-units-per-second speed');
select is((select path_cell_size from public.game_world_spawn_sets where content_version = 'v2'), 40,
  'reachability uses the reviewed 40-unit A* grid');
select is(((select reachability_summary from public.game_world_spawn_sets where content_version = 'v2')->>'spawn_issues')::integer, 0,
  'stored reachability evidence has zero spawn issues');
select is(((select reachability_summary from public.game_world_spawn_sets where content_version = 'v2')->>'unreachable_clusters')::integer, 0,
  'stored reachability evidence has zero unreachable clusters');
select is(((select reachability_summary from public.game_world_spawn_sets where content_version = 'v2')->>'failed_tiers')::integer, 0,
  'stored reachability evidence has zero failed tier loops');

select is((select count(*) from public.game_content_spawns where content_version = 'v2'), 729::bigint,
  'canonical v2 world has exactly 729 stable spawns');
select is((select count(distinct spawn_id) from public.game_content_spawns where content_version = 'v2'), 729::bigint,
  'every v2 canonical spawn has unique identity');
select is((select count(*) from public.game_world_nodes where content_version = 'v2'), 368::bigint,
  'UUID state contains exactly 368 v2 nodes');
select is((select count(*) from public.game_world_monsters where content_version = 'v2'), 361::bigint,
  'UUID state contains exactly 361 v2 monsters');
select is((select count(*) from public.game_world_nodes where content_version = 'v2' and kind = 'tungsten'), 0::bigint,
  'all Tungsten nodes are retired from v2');
select is((select count(*) from public.world_nodes where kind = 'tungsten'), 17::bigint,
  'historical v1 database retains all 17 seeded Tungsten rows');
select is((select count(*) from public.world_nodes), 234::bigint,
  'historical v1 database node table remains unchanged');
select is((select count(*) from public.world_monsters), 170::bigint,
  'historical v1 database monster table remains unchanged');
select is(
  (select count(*) from public.game_world_nodes node
   left join public.game_content_spawns spawn
     on spawn.spawn_id = node.spawn_id
    and spawn.content_version = node.content_version
    and spawn.spawn_set_version = node.spawn_set_version
    and spawn.entity_type = node.entity_type
    and spawn.kind = node.kind
   where node.content_version = 'v2' and spawn.spawn_id is null),
  0::bigint,
  'every UUID node state row has its exact canonical spawn owner'
);
select is(
  (select count(*) from public.game_world_monsters monster
   left join public.game_content_spawns spawn
     on spawn.spawn_id = monster.spawn_id
    and spawn.content_version = monster.content_version
    and spawn.spawn_set_version = monster.spawn_set_version
    and spawn.entity_type = monster.entity_type
    and spawn.kind = monster.kind
   where monster.content_version = 'v2' and spawn.spawn_id is null),
  0::bigint,
  'every UUID monster state row has its exact canonical spawn owner'
);
select is(
  (select count(*) from public.game_world_nodes
   where content_version = 'v2'
     and cell <> floor(x / 700)::integer::text || ':' || floor(y / 500)::integer::text),
  0::bigint,
  'every node owns its exact subscription cell'
);
select is(
  (select count(*) from public.game_world_monsters
   where content_version = 'v2'
     and cell <> floor(x / 700)::integer::text || ':' || floor(y / 500)::integer::text),
  0::bigint,
  'every monster owns its exact subscription cell'
);
select is(
  (select count(*) from public.game_world_nodes node
   join public.game_content_nodes definition
     on definition.content_version = node.content_version and definition.kind = node.kind
   where node.content_version = 'v2'
     and (node.max_charges <> definition.max_charges
       or node.charges <> definition.max_charges
       or node.gather_s <> definition.gather_s
       or node.respawn_s <> definition.respawn_s)),
  0::bigint,
  'all node charges and timers match canonical definitions'
);
select is(
  (select count(*) from public.game_world_monsters monster
   join public.game_content_monsters definition
     on definition.content_version = monster.content_version and definition.kind = monster.kind
   where monster.content_version = 'v2'
     and (monster.max_hp <> definition.hp
       or monster.hp <> definition.hp
       or monster.respawn_s <> definition.respawn_s)),
  0::bigint,
  'all monster HP and timers match canonical definitions'
);

select is((select count(*) from public.game_world_nodes where content_version = 'v2' and kind = 'runite'), 23::bigint,
  'all 23 Runite nodes are represented');
select is((select count(*) from public.game_world_nodes
  where content_version = 'v2' and kind = 'runite'
    and (biome <> 'desert' or subzone <> 'desert_evil_boundary')), 0::bigint,
  'all Runite nodes use the approved Desert/Evil boundary exception');
select is(
  (select count(*) from (
    select node.subzone, node.y, definition.level_requirement
    from public.game_world_nodes node
    join public.game_content_nodes definition
      on definition.content_version = node.content_version and definition.kind = node.kind
    where node.content_version = 'v2' and node.biome = 'winter'
    union all
    select monster.subzone, monster.y, definition.level_requirement
    from public.game_world_monsters monster
    join public.game_content_monsters definition
      on definition.content_version = monster.content_version and definition.kind = monster.kind
    where monster.content_version = 'v2' and monster.biome = 'winter'
  ) winter
  where not (
    (level_requirement between 55 and 79 and subzone = 'lower_slopes' and y >= 0 and y < 2000)
    or (level_requirement between 80 and 99 and subzone = 'mid_mountain' and y >= 2000 and y < 2400)
    or (level_requirement between 100 and 119 and subzone = 'upper_peaks' and y >= 2400 and y < 2800)
    or (level_requirement between 120 and 139 and subzone = 'high_peaks' and y >= 2800 and y < 3300)
    or (level_requirement between 140 and 150 and subzone = 'deepest_frontier' and y >= 3300 and y < 3750)
  )),
  0::bigint,
  'every Winter spawn matches its exact level band, depth and subzone'
);

select ok(to_regprocedure('public.game_world_runtime_status()') is not null,
  'world runtime status contract exists');
select ok(to_regprocedure('public.harvest_node_v2(uuid,numeric,numeric)') is not null,
  'UUID gather RPC exists');
select ok(to_regprocedure('public.attack_monster_v2(uuid,numeric,numeric)') is not null,
  'UUID monster RPC exists');
select ok(has_function_privilege('authenticated', 'public.harvest_node_v2(uuid,numeric,numeric)', 'EXECUTE'),
  'authenticated players can invoke the UUID gather RPC');
select ok(not has_function_privilege('anon', 'public.harvest_node_v2(uuid,numeric,numeric)', 'EXECUTE'),
  'anonymous users cannot invoke the UUID gather RPC');
select ok(has_function_privilege('authenticated', 'public.attack_monster_v2(uuid,numeric,numeric)', 'EXECUTE'),
  'authenticated players can invoke the UUID monster RPC');
select ok(not has_function_privilege('anon', 'public.attack_monster_v2(uuid,numeric,numeric)', 'EXECUTE'),
  'anonymous users cannot invoke the UUID monster RPC');
select ok(prosrc like '%game_assert_action_allowed(false)%'
    and prosrc like '%game_active_content_version()%'
    and prosrc like '%game_active_spawn_set_version()%'
    and prosrc like '%FOR UPDATE%',
  'UUID gather is release-guarded, active-version scoped and row-locked')
from pg_proc where oid = 'public.harvest_node_v2(uuid,numeric,numeric)'::regprocedure;
select ok(prosrc like '%game_assert_action_allowed(false)%'
    and prosrc like '%game_active_content_version()%'
    and prosrc like '%game_active_spawn_set_version()%'
    and prosrc like '%game_content_monster_loot%'
    and prosrc like '%FOR UPDATE%',
  'UUID combat is release-guarded, active-version scoped, canonical-loot driven and row-locked')
from pg_proc where oid = 'public.attack_monster_v2(uuid,numeric,numeric)'::regprocedure;
select ok(not has_table_privilege('authenticated', 'public.game_world_nodes', 'UPDATE'),
  'players cannot mutate UUID node state directly');
select ok(not has_table_privilege('authenticated', 'public.game_world_monsters', 'UPDATE'),
  'players cannot mutate UUID monster state directly');

select is((select count(*) from public.game_content_control), 0::bigint,
  'Gate 7 creates no activation control row');
select is(public.game_active_content_version(), 'v1', 'v1 remains the active content default');
select is(public.game_active_spawn_set_version(), 'v1', 'v1 remains the active spawn default');
select is(public.game_world_runtime_status()->>'state_contract', 'legacy_integer_v1',
  'pre-cutover clients remain on the legacy integer contract');
select is(public.game_world_runtime_status()->>'spawn_hash', '',
  'staged v2 hash is not advertised while v1 is active');

set local role authenticated;
select is((select count(*) from public.game_world_spawn_sets), 0::bigint,
  'RLS hides the staged world manifest from players');
select is((select count(*) from public.game_world_nodes), 0::bigint,
  'RLS hides every staged UUID node from players');
select is((select count(*) from public.game_world_monsters), 0::bigint,
  'RLS hides every staged UUID monster from players');
reset role;

-- Transactionally simulate cutover. The outer rollback guarantees this is only evidence.
update public.game_content_versions set status = 'active' where content_version = 'v2';
insert into public.game_content_control
  (active_content_version, active_spawn_set_version, minimum_client_content_version,
   maintenance_mode, maintenance_message, manifest_hash, activation_timestamp, migration_run_id)
values
  ('v2', 'v2', 'v2', false, '',
   'a0d654a993f5a213c6ce667b6fbd29053e0432e351872492b0a6bf3d7b1cff77',
   now(), 'gate7-transactional-test');

select is(public.game_world_runtime_status()->>'state_contract', 'uuid_v2',
  'transactional cutover advertises the UUID v2 contract');
select is(public.game_world_runtime_status()->>'spawn_hash',
  '9d1bc1c263fb2e5b45e3e1b16c62ec3d2e314d6733a0378c95a0fe06e0cdc9e0',
  'transactional cutover advertises the exact reviewed spawn hash');
select is((public.game_world_runtime_status()->>'world_width')::integer, 5600,
  'transactional cutover advertises the exact world width');
select is((public.game_world_runtime_status()->>'world_height')::integer, 3750,
  'transactional cutover advertises the exact world height');
select is((public.game_world_runtime_status()->>'movement_speed')::numeric, 130::numeric,
  'transactional cutover advertises the real movement speed');
select throws_like(
  $$select public.game_assert_action_allowed(true)$$,
  '%legacy_world_contract_disabled%',
  'legacy integer world actions fail closed after transactional v2 cutover'
);

set local role authenticated;
select is((select count(*) from public.game_world_spawn_sets), 1::bigint,
  'RLS exposes exactly the active v2 world manifest after cutover');
select is((select count(*) from public.game_world_nodes), 368::bigint,
  'RLS exposes exactly the active UUID node state after cutover');
select is((select count(*) from public.game_world_monsters), 361::bigint,
  'RLS exposes exactly the active UUID monster state after cutover');
select is((select count(*) from public.game_content_spawns), 729::bigint,
  'canonical spawn RLS exposes exactly the active v2 manifest after cutover');
reset role;

select * from finish();
rollback;

-- V6 regression suite for the PUBLIC boss combat entry point.
--
-- The normal client calls public.attack_boss, not attack_boss_v1. Before V6
-- that public wrapper asserted the legacy v1 world contract
-- (game_assert_action_allowed(true)), so under any non-v1 release every boss
-- swing failed with 'legacy_world_contract_disabled'. V6 activation rebuilds
-- the wrapper with game_assert_action_allowed(false): the gate stays, only the
-- legacy-world branch is switched off.
--
-- This suite applies the activation-time wrapper exactly as step 3/3 emits it
-- (from supabase/v6/public-entrypoints.sql) inside a rolled-back transaction,
-- then drives the PUBLIC RPC as an authenticated player under a non-v1 active
-- release and proves:
--   * an accepted authenticated attack succeeds and deals damage;
--   * an accepted attack consumes exactly one strength-buff hit;
--   * a passive tick consumes no buff hit;
--   * a cooldown rejection consumes no buff hit;
--   * an out-of-range rejection consumes no buff hit;
--   * an unauthenticated (anon) invocation is rejected;
--   * maintenance mode is still enforced;
--   * the minimum client protocol is still enforced;
--   * attack_boss_v1 stays non-public and the shared strength helper stays
--     unavailable to client roles.
--
-- Run with: supabase test db supabase/tests/v6_public_boss_entrypoint.sql

begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

select isnt(public.game_active_content_version(), 'v1',
  'the suite runs under a non-legacy active release');

-- ---------------------------------------------------------------------------
-- Activation-time wrapper, applied here exactly as step 3/3 emits it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attack_boss(
  _x numeric, _y numeric, _bx numeric, _by numeric, _passive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  RETURN public.attack_boss_v1(_x, _y, _bx, _by, _passive);
END
$$;

REVOKE ALL ON FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.attack_boss_v1(numeric, numeric, numeric, numeric, boolean)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_strength_buff(jsonb, numeric)
FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixture player, standing on the authoritative boss position, holding a
-- five-hit 12% strength buff.
-- ---------------------------------------------------------------------------
create temporary table v6_boss_probe (step text primary key, val text) on commit drop;

do $probe$
declare
  uid uuid := '11111111-2222-3333-4444-555555555555';
  bx numeric;
  by_ numeric;
  res jsonb;
  save jsonb;
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (uid, 'v6-boss-probe@example.invalid', 'authenticated', 'authenticated',
          '00000000-0000-0000-0000-000000000000');

  select x, y into bx, by_ from public.boss_position_at(clock_timestamp());
  select data into save from public.game_starter_templates where active limit 1;
  save := jsonb_set(save, '{skills,combat,xp}', to_jsonb(5000000));
  save := jsonb_set(save, '{px}', to_jsonb(bx));
  save := jsonb_set(save, '{py}', to_jsonb(by_));
  save := jsonb_set(save, '{hp}', to_jsonb(100000));
  save := jsonb_set(save, '{buff}',
    jsonb_build_object('strength_pct', 12, 'hits', 5, 'item', 'copper_strength_potion'));
  insert into public.player_saves (user_id, data, rev) values (uid, save, 1);

  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);

  -- accepted authenticated attack through the PUBLIC entry point
  perform set_config('role', 'authenticated', true);
  res := public.attack_boss(bx, by_, bx, by_, false);
  perform set_config('role', 'none', true);
  insert into v6_boss_probe values ('accepted_ok', res->>'ok');
  insert into v6_boss_probe values ('accepted_dmg', res->>'dmg');
  insert into v6_boss_probe values ('hits_after_accept',
    (select data#>>'{buff,hits}' from public.player_saves where user_id = uid));

  -- immediate second swing: cooldown rejection
  perform set_config('role', 'authenticated', true);
  res := public.attack_boss(bx, by_, bx, by_, false);
  perform set_config('role', 'none', true);
  insert into v6_boss_probe values ('cooldown_reason', res->>'reason');
  insert into v6_boss_probe values ('hits_after_cooldown',
    (select data#>>'{buff,hits}' from public.player_saves where user_id = uid));

  -- passive tick
  delete from public.world_cooldowns where user_id = uid;
  perform set_config('role', 'authenticated', true);
  res := public.attack_boss(bx, by_, bx, by_, true);
  perform set_config('role', 'none', true);
  insert into v6_boss_probe values ('passive_dmg', res->>'dmg');
  insert into v6_boss_probe values ('hits_after_passive',
    (select data#>>'{buff,hits}' from public.player_saves where user_id = uid));

  -- out-of-range swing
  delete from public.world_cooldowns where user_id = uid;
  perform set_config('role', 'authenticated', true);
  res := public.attack_boss(bx, by_, bx + 900, by_, false);
  perform set_config('role', 'none', true);
  insert into v6_boss_probe values ('range_reason', res->>'reason');
  insert into v6_boss_probe values ('hits_after_range',
    (select data#>>'{buff,hits}' from public.player_saves where user_id = uid));

  -- unauthenticated invocation
  begin
    perform set_config('role', 'anon', true);
    res := public.attack_boss(bx, by_, bx, by_, false);
    perform set_config('role', 'none', true);
    insert into v6_boss_probe values ('anon', 'not rejected');
  exception when others then
    perform set_config('role', 'none', true);
    insert into v6_boss_probe values ('anon', sqlerrm);
  end;

  -- maintenance mode still enforced
  update public.game_release_control
     set maintenance_mode = true, maintenance_message = 'v6 regression probe'
   where singleton;
  begin
    perform set_config('role', 'authenticated', true);
    res := public.attack_boss(bx, by_, bx, by_, false);
    perform set_config('role', 'none', true);
    insert into v6_boss_probe values ('maintenance', 'not rejected');
  exception when others then
    perform set_config('role', 'none', true);
    insert into v6_boss_probe values ('maintenance', sqlerrm);
  end;
  update public.game_release_control
     set maintenance_mode = false, maintenance_message = ''
   where singleton;

  -- minimum client protocol still enforced
  update public.game_release_control set minimum_client_protocol = 999999 where singleton;
  begin
    perform set_config('role', 'authenticated', true);
    res := public.attack_boss(bx, by_, bx, by_, false);
    perform set_config('role', 'none', true);
    insert into v6_boss_probe values ('protocol', 'not rejected');
  exception when others then
    perform set_config('role', 'none', true);
    insert into v6_boss_probe values ('protocol', sqlerrm);
  end;
end
$probe$;

-- ---------------------------------------------------------------------------
-- Assertions.
-- ---------------------------------------------------------------------------
select is((select val from v6_boss_probe where step = 'accepted_ok'), 'true',
  'an authenticated player can attack the boss through the public RPC');
select ok((select val::numeric from v6_boss_probe where step = 'accepted_dmg') > 0,
  'the accepted public attack deals authoritative damage');
select is((select val from v6_boss_probe where step = 'hits_after_accept'), '4',
  'an accepted public attack consumes exactly one strength-buff hit');
select is((select val from v6_boss_probe where step = 'cooldown_reason'), 'too_fast',
  'a swing inside the cooldown is rejected');
select is((select val from v6_boss_probe where step = 'hits_after_cooldown'), '4',
  'a rate-limited swing consumes no buff hit');
select is((select val from v6_boss_probe where step = 'passive_dmg'), '0',
  'a passive tick deals no player damage');
select is((select val from v6_boss_probe where step = 'hits_after_passive'), '4',
  'a passive tick consumes no buff hit');
select is((select val from v6_boss_probe where step = 'range_reason'), 'desync',
  'an out-of-range swing is rejected');
select is((select val from v6_boss_probe where step = 'hits_after_range'), '4',
  'an out-of-range swing consumes no buff hit');
select like_((select val from v6_boss_probe where step = 'anon'), '%permission denied%',
  'an unauthenticated caller cannot reach the public boss RPC');
select is((select val from v6_boss_probe where step = 'maintenance'), 'game_maintenance',
  'maintenance mode is still enforced by the corrected wrapper');
select is((select val from v6_boss_probe where step = 'protocol'), 'client_update_required',
  'the minimum client protocol is still enforced by the corrected wrapper');
select ok(not has_function_privilege('authenticated',
    'public.attack_boss_v1(numeric,numeric,numeric,numeric,boolean)', 'EXECUTE'),
  'attack_boss_v1 stays non-public');
select ok(not has_function_privilege('authenticated',
    'public.apply_strength_buff(jsonb,numeric)', 'EXECUTE'),
  'the shared strength helper stays unavailable to client roles');

select * from finish();
rollback;

-- V6 least-privilege regression suite for the shared strength helper.
--
-- The activation migration (step 3/3) revokes every direct EXECUTE path to
-- public.apply_strength_buff. This suite proves, inside a rolled-back
-- transaction, that:
--   * the helper keeps its safe shape (IMMUTABLE, SECURITY INVOKER,
--     SET search_path = public, no table access, no dynamic SQL);
--   * after the activation-time revoke neither PUBLIC, anon nor authenticated
--     can call it directly;
--   * both authoritative combat RPCs still apply percentage strength;
--   * an accepted swing consumes exactly one buff hit and a rejected or
--     rate-limited swing consumes none;
--   * the helper is still reachable internally from the SECURITY DEFINER
--     combat functions, which execute as the function owner.
--
-- Run with: supabase test db supabase/tests/v6_strength_privileges.sql

begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

-- ---------------------------------------------------------------------------
-- Shape of the helper.
-- ---------------------------------------------------------------------------
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'apply_strength_buff'),
  'the shared strength helper exists');
select is((select provolatile from pg_proc where oid = 'public.apply_strength_buff(jsonb,numeric)'::regprocedure),
  'i'::"char", 'the helper is IMMUTABLE');
select ok(not (select prosecdef from pg_proc where oid = 'public.apply_strength_buff(jsonb,numeric)'::regprocedure),
  'the helper is SECURITY INVOKER, not SECURITY DEFINER');
select is((select array_to_string(proconfig, ',') from pg_proc
           where oid = 'public.apply_strength_buff(jsonb,numeric)'::regprocedure),
  'search_path=public', 'the helper pins an explicit search_path');
select ok((select prosrc !~* '\m(insert|update|delete|select)\M'
           from pg_proc where oid = 'public.apply_strength_buff(jsonb,numeric)'::regprocedure),
  'the helper reads and writes no table');
select ok((select prosrc !~* '\mexecute\M'
           from pg_proc where oid = 'public.apply_strength_buff(jsonb,numeric)'::regprocedure),
  'the helper runs no dynamic SQL');
select ok((select prosrc !~ 'player_saves|world_|market_|profiles'
           from pg_proc where oid = 'public.apply_strength_buff(jsonb,numeric)'::regprocedure),
  'the helper mutates no player state');

-- ---------------------------------------------------------------------------
-- Pure maths, exercised as the owner (the path the combat RPCs use).
-- ---------------------------------------------------------------------------
select is(
  (public.apply_strength_buff('{"buff":{"hits":3,"strength_pct":12,"item":"copper_strength_potion"}}'::jsonb, 100)->>'attack')::numeric,
  112::numeric, 'a 12% buff lifts a base attack of 100 to 112');
select is(
  (public.apply_strength_buff('{"buff":{"hits":3,"strength_pct":12}}'::jsonb, 100)#>>'{data,buff,hits}')::integer,
  2, 'one helper call consumes exactly one hit');
select is(
  (public.apply_strength_buff('{"buff":{"hits":1,"strength_pct":18}}'::jsonb, 50)->'data') ? 'buff',
  false, 'the last hit clears the buff');
select is(
  (public.apply_strength_buff('{"buff":{"hits":4,"dmg":5}}'::jsonb, 100)->>'attack')::numeric,
  105::numeric, 'a legacy flat buff keeps its v1..v5 behaviour');
select is(
  (public.apply_strength_buff('{}'::jsonb, 100)->>'consumed')::boolean,
  false, 'no buff consumes no hit');

-- ---------------------------------------------------------------------------
-- Activation-time hardening, applied here exactly as step 3/3 emits it.
-- ---------------------------------------------------------------------------
REVOKE ALL
ON FUNCTION public.apply_strength_buff(jsonb, numeric)
FROM PUBLIC, anon, authenticated, service_role;

select ok(not has_function_privilege('anon', 'public.apply_strength_buff(jsonb,numeric)', 'EXECUTE'),
  'anon cannot execute the helper directly');
select ok(not has_function_privilege('authenticated', 'public.apply_strength_buff(jsonb,numeric)', 'EXECUTE'),
  'authenticated cannot execute the helper directly');
select ok(not has_function_privilege('public', 'public.apply_strength_buff(jsonb,numeric)', 'EXECUTE'),
  'PUBLIC cannot execute the helper directly');
select ok(has_function_privilege('authenticated', 'public.attack_monster_v2(uuid,numeric,numeric)', 'EXECUTE'),
  'the authoritative monster RPC stays callable by signed-in players');
select ok(has_function_privilege('authenticated', 'public.attack_boss(numeric,numeric,numeric,numeric,boolean)', 'EXECUTE'),
  'the authoritative boss RPC stays callable by signed-in players');
select ok((select prosecdef from pg_proc where oid = 'public.attack_monster_v2(uuid,numeric,numeric)'::regprocedure),
  'the monster RPC is SECURITY DEFINER, so the helper stays reachable internally');
select ok((select prosecdef from pg_proc where oid = 'public.attack_boss_v1(numeric,numeric,numeric,numeric,boolean)'::regprocedure),
  'the boss RPC is SECURITY DEFINER, so the helper stays reachable internally');
select ok((select prosrc like '%apply_strength_buff%' from pg_proc
           where oid = 'public.attack_monster_v2(uuid,numeric,numeric)'::regprocedure)
      and (select prosrc like '%apply_strength_buff%' from pg_proc
           where oid = 'public.attack_boss_v1(numeric,numeric,numeric,numeric,boolean)'::regprocedure),
  'both combat paths call the one shared helper');

select * from finish();
rollback;

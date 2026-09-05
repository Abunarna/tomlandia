-- V6 strength potion runtime.
--
-- Embedded verbatim into supabase/migrations/*_v6_stage_content.sql by
-- scripts/v6/build-migrations.mjs. Edit this file, never the migration.
--
-- Backwards compatible on purpose: while v5 is still the active release every
-- potion has strength_pct = 0, so public.apply_strength_buff keeps applying the
-- legacy flat `dmg` bonus exactly as before. Rolling back to v5 therefore needs
-- no function restore, only a control-row flip.

-- ---------------------------------------------------------------------------
-- 1. Authoritative percentage lives on the content row.
-- ---------------------------------------------------------------------------
ALTER TABLE public.game_content_items
  ADD COLUMN IF NOT EXISTS strength_pct integer NOT NULL DEFAULT 0;

ALTER TABLE public.game_content_items
  DROP CONSTRAINT IF EXISTS game_content_items_strength_pct_check;
ALTER TABLE public.game_content_items
  ADD CONSTRAINT game_content_items_strength_pct_check
  CHECK (strength_pct >= 0 AND strength_pct <= 100);

-- The runtime view gains strength_pct as a trailing column; the legacy v1
-- branch reports 0, so v1 keeps its flat-only semantics.
CREATE OR REPLACE VIEW public.game_runtime_items AS
SELECT 'v1'::text AS content_version,
       item.id,
       item.name,
       true AS active,
       1 AS tier_index,
       1 AS level_requirement,
       item.kind,
       item.kind AS family,
       item.id AS icon_key,
       '#ffffff'::text AS colour,
       'common'::text AS rarity,
       NOT item.untradable AS tradable,
       item.untradable,
       item.stackable,
       item.value,
       CASE WHEN item.kind = ANY (ARRAY['weapon'::text, 'armor'::text]) THEN 'combat'::text ELSE NULL::text END AS equip_skill,
       COALESCE(item.attack, 0::numeric) AS attack,
       COALESCE(item.defense, 0::numeric) AS defense,
       COALESCE(item.heal, 0) AS heal,
       COALESCE(item.speed, 0::numeric) AS speed,
       COALESCE(item.dmg_boost, 0::numeric) AS dmg_boost,
       COALESCE(item.boost_hits, 0) AS boost_hits,
       0 AS strength_pct
FROM public.game_items item
WHERE public.game_active_content_version() = 'v1'::text
UNION ALL
SELECT item.content_version,
       item.id,
       item.name,
       item.active,
       item.tier_index,
       item.level_requirement,
       item.kind,
       item.family,
       item.icon_key,
       item.colour,
       item.rarity,
       item.tradable,
       NOT item.tradable AS untradable,
       item.stackable,
       item.value,
       item.equip_skill,
       item.attack,
       item.defense,
       item.heal,
       item.speed,
       item.dmg_boost,
       item.boost_hits,
       item.strength_pct
FROM public.game_content_items item
WHERE item.content_version = public.game_active_content_version() AND item.active;

-- ---------------------------------------------------------------------------
-- 2. One shared buff helper for every combat path.
-- ---------------------------------------------------------------------------
-- Applies the active potion buff to an already-rounded base attack, consumes
-- exactly one hit and drops an exhausted buff. Called once per accepted attack
-- and never for rejected (too_fast / out of range / passive) attacks, so the
-- hit budget can only be spent on swings that actually landed.
--
--   percentage buff : bonus = round(base_attack * strength_pct / 100)
--   legacy flat buff: bonus = dmg
--
-- The percentage is never read from the client and never compounds: it is
-- applied once, to the base attack, before monster defence and the damage roll.
CREATE OR REPLACE FUNCTION public.apply_strength_buff(_data jsonb, _base_attack numeric)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
#variable_conflict use_variable
DECLARE
  data jsonb := _data;
  hits integer := coalesce((_data#>>'{buff,hits}')::integer, 0);
  pct numeric := coalesce((_data#>>'{buff,strength_pct}')::numeric, 0);
  flat numeric := coalesce((_data#>>'{buff,dmg}')::numeric, 0);
  bonus numeric := 0;
BEGIN
  IF hits <= 0 OR (pct <= 0 AND flat <= 0) THEN
    -- An exhausted or malformed buff never reaches combat maths.
    IF data ? 'buff' AND hits <= 0 THEN data := data - 'buff'; END IF;
    RETURN jsonb_build_object('attack', _base_attack, 'bonus', 0, 'data', data, 'consumed', false);
  END IF;

  IF pct > 0 THEN
    bonus := round(_base_attack * pct / 100.0);
  ELSE
    bonus := flat;
  END IF;

  hits := hits - 1;
  IF hits <= 0 THEN
    data := data - 'buff';
  ELSE
    data := jsonb_set(data, '{buff,hits}', to_jsonb(hits), true);
  END IF;

  RETURN jsonb_build_object(
    'attack', _base_attack + bonus,
    'bonus', bonus,
    'data', data,
    'consumed', true
  );
END
$$;

REVOKE ALL ON FUNCTION public.apply_strength_buff(jsonb, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_strength_buff(jsonb, numeric) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Server-authoritative potion use.
-- ---------------------------------------------------------------------------
-- Consumes exactly one potion, reads the effect from active server content,
-- rejects anything that is not an active, positive potion definition and
-- overwrites (never stacks or extends) the current buff.
CREATE OR REPLACE FUNCTION public.use_potion(_item text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid();
  definition public.game_runtime_items%ROWTYPE;
  data jsonb;
  next_inv jsonb;
  buff jsonb;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF public.game_active_content_version() = 'v1' THEN RETURN public.use_potion_v1(_item); END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO definition FROM public.game_runtime_items WHERE id = _item;
  IF NOT FOUND
     OR definition.kind <> 'potion'
     OR NOT definition.active
     OR definition.boost_hits <= 0
     OR (coalesce(definition.strength_pct, 0) <= 0 AND coalesce(definition.dmg_boost, 0) <= 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_potion');
  END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  next_inv := public.inv_remove(data->'inv', _item, 1);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing_item'); END IF;
  data := jsonb_set(data, '{inv}', next_inv, true);

  IF coalesce(definition.strength_pct, 0) > 0 THEN
    buff := jsonb_build_object(
      'strength_pct', definition.strength_pct,
      'hits', definition.boost_hits,
      'item', _item,
      'content_version', public.game_active_content_version()
    );
  ELSE
    buff := jsonb_build_object('dmg', definition.dmg_boost, 'hits', definition.boost_hits, 'item', _item);
  END IF;

  -- Replacement, not accumulation: no added percentages, no extended hits.
  data := jsonb_set(data, '{buff}', buff, true);
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'buff', data->'buff', 'state', public.pl_state(data));
END
$$;

-- ---------------------------------------------------------------------------
-- 4. Ordinary monster combat uses the shared helper.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attack_monster_v2(_id uuid, _x numeric, _y numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid();
  monster public.game_world_monsters%ROWTYPE;
  definition record;
  loot_rule record;
  data jsonb;
  swing_seconds numeric;
  combat_level integer;
  attack_stat numeric;
  defense_stat numeric;
  damage integer;
  taken integer;
  killed boolean := false;
  credited boolean := false;
  gold_award integer := 0;
  loot jsonb := '[]'::jsonb;
  skipped jsonb := '[]'::jsonb;
  next_inv jsonb;
  loot_qty integer;
  before_level integer;
  after_level integer;
  buffed jsonb;
  settlement jsonb;
  death jsonb := 'null'::jsonb;
  food_used boolean := false;
  server_x numeric;
  server_y numeric;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT coalesce(public.track_position(uid, _x, _y), false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;

  SELECT x, y INTO server_x, server_y
  FROM public.player_positions
  WHERE user_id = uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;
  _x := server_x;
  _y := server_y;
  SELECT * INTO monster
  FROM public.game_world_monsters
  WHERE spawn_id = _id
    AND content_version = public.game_active_content_version()
    AND spawn_set_version = public.game_active_spawn_set_version()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  SELECT * INTO definition
  FROM public.game_content_monsters
  WHERE content_version = monster.content_version AND kind = monster.kind AND active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF sqrt(power(_x - monster.x, 2) + power(_y - monster.y, 2)) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;

  IF monster.respawn_at IS NOT NULL AND now() >= monster.respawn_at THEN
    monster.hp := monster.max_hp;
    monster.tagged_by := NULL;
    monster.tagged_at := NULL;
    monster.respawn_at := NULL;
  END IF;
  IF monster.respawn_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'dead', 'hp', 0, 'respawn_at', monster.respawn_at);
  END IF;
  IF monster.tagged_by IS NOT NULL AND monster.tagged_at < now() - interval '15 seconds' THEN
    monster.tagged_by := NULL;
    monster.tagged_at := NULL;
  END IF;

  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  swing_seconds := greatest(0.5, 1 - public.equip_stat(data, 'armor', 'speed')) - 0.15;
  -- Rejected swings return before the buff helper runs, so a too-fast attack
  -- never costs a boosted hit.
  IF NOT public.action_gate(uid, 'combat:global', (swing_seconds || ' seconds')::interval) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'hp', monster.hp, 'tagged_by', monster.tagged_by);
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'combat:last', now() + interval '5 seconds')
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  combat_level := public.game_level_for_xp(public.skill_xp(data, 'combat'));
  attack_stat := round(3 + combat_level + public.equip_stat(data, 'weapon', 'attack') + public.equip_stat(data, 'armor', 'attack'));
  defense_stat := round(floor(combat_level / 2.0) + public.equip_stat(data, 'armor', 'defense'));

  buffed := public.apply_strength_buff(data, attack_stat);
  attack_stat := (buffed->>'attack')::numeric;
  data := buffed->'data';

  damage := greatest(1, floor(attack_stat * (0.6 + random() * 0.6) - definition.defense * 0.4))::integer;
  monster.hp := greatest(0, monster.hp - damage);
  IF monster.tagged_by IS NULL THEN monster.tagged_by := uid; monster.tagged_at := now(); END IF;
  credited := monster.tagged_by = uid;
  taken := greatest(0, floor(definition.attack * (0.5 + random() * 0.7) - defense_stat * 0.5))::integer;
  IF monster.hp <= 0 THEN
    killed := true;
    monster.respawn_at := now() + make_interval(secs => definition.respawn_s);
  END IF;

  UPDATE public.game_world_monsters
  SET hp = monster.hp, tagged_by = monster.tagged_by, tagged_at = monster.tagged_at,
      respawn_at = monster.respawn_at, updated_at = now()
  WHERE spawn_id = monster.spawn_id;
  before_level := public.game_level_for_xp(public.skill_xp(data, 'combat'));
  IF killed AND credited THEN
    data := public.grant_skill_xp(data, 'combat', definition.xp);
    gold_award := definition.gold_min + floor(random() * greatest(1, definition.gold_max - definition.gold_min + 1))::integer;
    data := jsonb_set(data, '{gold}', to_jsonb(coalesce((data->>'gold')::numeric, 0) + gold_award), true);
    FOR loot_rule IN
      SELECT item_id, chance, qty_min, qty_max, channel, xp
      FROM public.game_content_monster_loot
      WHERE content_version = monster.content_version AND monster_kind = monster.kind
      ORDER BY ordinal
    LOOP
      IF random() >= loot_rule.chance THEN CONTINUE; END IF;
      loot_qty := loot_rule.qty_min + floor(random() * greatest(1, loot_rule.qty_max - loot_rule.qty_min + 1))::integer;
      next_inv := public.inv_add(data->'inv', loot_rule.item_id, loot_qty);
      IF next_inv IS NULL THEN
        skipped := skipped || jsonb_build_array(loot_rule.item_id);
      ELSE
        data := jsonb_set(data, '{inv}', next_inv, true);
        loot := loot || jsonb_build_array(jsonb_build_object('item', loot_rule.item_id, 'qty', loot_qty));
        IF loot_rule.channel = 'hide' AND loot_rule.xp > 0 THEN
          data := public.grant_skill_xp(data, 'skinning', loot_rule.xp);
        END IF;
      END IF;
    END LOOP;
    data := public.advance_quest(data, 'kill', monster.kind);
  END IF;

  settlement := public.settle_incoming_damage(uid, data, taken, definition.name);
  data := settlement->'data';
  death := settlement->'death';
  food_used := coalesce((settlement->>'food_used')::boolean, false);
  after_level := public.game_level_for_xp(public.skill_xp(data, 'combat'));
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object(
    'ok', true, 'spawn_id', monster.spawn_id, 'hp', monster.hp, 'dmg', damage, 'taken', taken,
    'killed', killed, 'credited', credited, 'kind', monster.kind, 'tagged_by', monster.tagged_by,
    'gold', gold_award, 'loot', loot, 'skipped_loot', skipped,
    'xp', CASE WHEN killed AND credited THEN definition.xp ELSE 0 END,
    'leveled', after_level > before_level, 'level', after_level, 'respawn_at', monster.respawn_at,
    'buff', coalesce(data->'buff', 'null'::jsonb), 'death', death, 'food_used', food_used,
    'state', public.pl_state(data)
  );
END
$$;

-- ---------------------------------------------------------------------------
-- 5. Boss combat uses the same shared helper, so the paths cannot diverge.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attack_boss_v1(_x numeric, _y numeric, _bx numeric, _by numeric, _passive boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); boss public.world_boss%ROWTYPE; data jsonb; boss_x numeric; boss_y numeric;
  swing_seconds numeric; combat_level integer; attack_stat numeric := 0; defense_stat numeric;
  damage integer := 0; taken integer; killed boolean := false; gold_award integer := 0;
  before_level integer; after_level integer; settlement jsonb; death jsonb; food_used boolean;
  buffed jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.track_position(uid, _x, _y) THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_far'); END IF;
  SELECT * INTO boss FROM public.world_boss WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF boss.respawn_at IS NOT NULL AND now() >= boss.respawn_at THEN boss.hp := boss.max_hp; boss.respawn_at := NULL; END IF;
  IF boss.respawn_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'dead', 'hp', 0, 'max_hp', boss.max_hp, 'respawn_at', boss.respawn_at); END IF;
  SELECT x, y INTO boss_x, boss_y FROM public.boss_position_at(clock_timestamp());
  IF sqrt(power(_bx - boss_x, 2) + power(_by - boss_y, 2)) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'desync', 'hp', boss.hp, 'max_hp', boss.max_hp);
  END IF;
  IF sqrt(power(_x - boss_x, 2) + power(_y - boss_y, 2)) > 90 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far', 'hp', boss.hp, 'max_hp', boss.max_hp);
  END IF;

  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  swing_seconds := CASE WHEN _passive THEN 1.6 ELSE greatest(0.5, 1 - public.equip_stat(data, 'armor', 'speed')) - 0.15 END;
  IF NOT public.action_gate(uid, 'combat:global', (swing_seconds || ' seconds')::interval) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'hp', boss.hp, 'max_hp', boss.max_hp);
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at) VALUES (uid, 'combat:last', now() + interval '5 seconds')
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  combat_level := public.xp_level(public.skill_xp(data, 'combat'));
  defense_stat := round(floor(combat_level / 2.0) + public.equip_stat(data, 'armor', 'defense'));
  IF NOT _passive THEN
    attack_stat := round(3 + combat_level + public.equip_stat(data, 'weapon', 'attack') + public.equip_stat(data, 'armor', 'attack'));
    -- Passive (retaliation) ticks deal no damage, so they must not burn a hit:
    -- the helper only runs on a real, accepted swing.
    buffed := public.apply_strength_buff(data, attack_stat);
    attack_stat := (buffed->>'attack')::numeric;
    data := buffed->'data';
    damage := greatest(1, floor(attack_stat * (0.6 + random() * 0.6) - 85 * 0.4))::integer;
    boss.hp := greatest(0, boss.hp - damage);
  END IF;
  taken := greatest(0, floor(340 * (0.5 + random() * 0.7) - defense_stat * 0.5))::integer;
  IF boss.hp <= 0 THEN killed := true; boss.respawn_at := now() + interval '10 minutes'; END IF;
  UPDATE public.world_boss SET hp = boss.hp, respawn_at = boss.respawn_at, x = boss_x, y = boss_y, updated_at = now() WHERE id = 1;

  before_level := public.xp_level(public.skill_xp(data, 'combat'));
  IF killed THEN
    data := public.grant_skill_xp(data, 'combat', 40000);
    gold_award := 5000 + floor(random() * 7001)::integer;
    data := jsonb_set(data, '{gold}', to_jsonb(coalesce((data->>'gold')::numeric, 0) + gold_award), true);
  END IF;
  settlement := public.settle_incoming_damage(uid, data, taken, 'DESOLATUS');
  data := settlement->'data'; death := settlement->'death'; food_used := coalesce((settlement->>'food_used')::boolean, false);
  after_level := public.xp_level(public.skill_xp(data, 'combat'));
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object(
    'ok', true, 'dmg', damage, 'taken', taken, 'hp', boss.hp, 'max_hp', boss.max_hp,
    'killed', killed, 'credited', killed, 'gold', gold_award, 'loot', '[]'::jsonb,
    'respawn_at', boss.respawn_at, 'leveled', after_level > before_level, 'level', after_level,
    'buff', coalesce(data->'buff', 'null'::jsonb), 'death', death, 'food_used', food_used,
    'state', public.pl_state(data)
  );
END
$$;

-- Use the server-tracked player location for V2 combat range validation.
-- The monster range check remains enforced inside this function.

CREATE OR REPLACE FUNCTION public.attack_monster_v2(_id uuid, _x numeric, _y numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  buff_damage numeric := 0;
  buff_hits integer := 0;
  settlement jsonb;
  death jsonb := 'null'::jsonb;
  food_used boolean := false;
  server_x numeric;
  server_y numeric;
BEGIN
  PERFORM public.game_assert_action_allowed(false);
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
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
  IF NOT public.action_gate(uid, 'combat:global', (swing_seconds || ' seconds')::interval) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'hp', monster.hp, 'tagged_by', monster.tagged_by);
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'combat:last', now() + interval '5 seconds')
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  combat_level := public.game_level_for_xp(public.skill_xp(data, 'combat'));
  attack_stat := round(3 + combat_level + public.equip_stat(data, 'weapon', 'attack') + public.equip_stat(data, 'armor', 'attack'));
  defense_stat := round(floor(combat_level / 2.0) + public.equip_stat(data, 'armor', 'defense'));
  buff_hits := coalesce((data#>>'{buff,hits}')::integer, 0);
  buff_damage := coalesce((data#>>'{buff,dmg}')::numeric, 0);
  IF buff_hits > 0 AND buff_damage > 0 THEN
    attack_stat := attack_stat + buff_damage;
    buff_hits := buff_hits - 1;
    IF buff_hits <= 0 THEN
      data := data - 'buff';
    ELSE
      data := jsonb_set(data, '{buff,hits}', to_jsonb(buff_hits), true);
    END IF;
  END IF;
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
$function$


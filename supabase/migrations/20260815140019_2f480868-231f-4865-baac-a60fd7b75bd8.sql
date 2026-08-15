CREATE OR REPLACE FUNCTION public.attack_boss(_x numeric, _y numeric, _bx numeric, _by numeric, _passive boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  b public.world_boss%ROWTYPE;
  save jsonb;
  cd timestamptz;
  swing_s numeric;
  combat_lvl int;
  atk numeric;
  def_stat numeric;
  dmg int := 0;
  taken int := 0;
  killed boolean := false;
  gold_award int := 0;
  loot jsonb := '[]'::jsonb;
  next_inv jsonb;
  before_lvl int;
  after_lvl int;
  drift numeric;
  elapsed numeric;
  -- mirrors src/game/boss.ts
  boss_attack numeric := 340;
  boss_defense numeric := 85;
  boss_speed numeric := 32.5;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.track_position(uid, _x, _y) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;

  SELECT * INTO b FROM public.world_boss WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;

  IF b.respawn_at IS NOT NULL AND now() >= b.respawn_at THEN
    b.hp := b.max_hp;
    b.respawn_at := NULL;
  END IF;
  IF b.respawn_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'dead', 'hp', 0, 'max_hp', b.max_hp, 'respawn_at', b.respawn_at);
  END IF;

  elapsed := GREATEST(0, EXTRACT(EPOCH FROM (now() - b.updated_at)));
  IF elapsed < 20 AND (b.x <> 0 OR b.y <> 0) THEN
    drift := sqrt(power(_bx - b.x, 2) + power(_by - b.y, 2));
    IF drift > boss_speed * elapsed + 300 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'desync', 'hp', b.hp, 'max_hp', b.max_hp);
    END IF;
  END IF;

  -- his reach now matches a player's normal melee range (34px), with slack for lag
  IF sqrt(power(_x - _bx, 2) + power(_y - _by, 2)) > 90 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far', 'hp', b.hp, 'max_hp', b.max_hp);
  END IF;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  swing_s := greatest(0.5, 1 - public.equip_stat(save, 'armor', 'speed')) - 0.15;
  IF _passive THEN swing_s := 1.6; END IF;

  SELECT next_at INTO cd FROM public.world_cooldowns WHERE user_id = uid AND key = CASE WHEN _passive THEN 'boss:aggro' ELSE 'boss:swing' END;
  IF cd IS NOT NULL AND now() < cd THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'hp', b.hp, 'max_hp', b.max_hp);
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, CASE WHEN _passive THEN 'boss:aggro' ELSE 'boss:swing' END, now() + (swing_s || ' seconds')::interval)
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  combat_lvl := public.xp_level(public.skill_xp(save, 'combat'));
  def_stat := round(floor(combat_lvl / 2.0) + public.equip_stat(save, 'armor', 'defense'));

  IF NOT _passive THEN
    atk := round(3 + combat_lvl
      + public.equip_stat(save, 'weapon', 'attack')
      + public.equip_stat(save, 'armor', 'attack'));
    IF coalesce((save#>>'{buff,hits}')::int, 0) > 0 THEN
      atk := atk + coalesce((save#>>'{buff,dmg}')::numeric, 0);
      IF coalesce((save#>>'{buff,hits}')::int, 0) - 1 <= 0 THEN
        save := save - 'buff';
      ELSE
        save := jsonb_set(save, '{buff,hits}', to_jsonb(coalesce((save#>>'{buff,hits}')::int, 0) - 1));
      END IF;
    END IF;
    dmg := greatest(1, floor(atk * (0.6 + random() * 0.6) - boss_defense * 0.4))::int;
    b.hp := greatest(0, b.hp - dmg);
  END IF;

  taken := greatest(0, floor(boss_attack * (0.5 + random() * 0.7) - def_stat * 0.5))::int;

  IF b.hp <= 0 THEN
    killed := true;
    b.respawn_at := now() + interval '10 minutes';
  END IF;

  UPDATE public.world_boss
    SET hp = b.hp, respawn_at = b.respawn_at, x = _bx, y = _by, updated_at = now()
    WHERE id = 1;

  before_lvl := public.xp_level(public.skill_xp(save, 'combat'));
  IF killed THEN
    save := public.grant_skill_xp(save, 'combat', 40000);
    gold_award := 5000 + floor(random() * 7001)::int;
    save := jsonb_set(save, '{gold}', to_jsonb(coalesce((save->>'gold')::int, 0) + gold_award));
    next_inv := public.inv_add(save->'inv', 'tungsten_ore', 5);
    IF next_inv IS NOT NULL THEN
      save := jsonb_set(save, '{inv}', next_inv);
      loot := jsonb_build_array(jsonb_build_object('item', 'tungsten_ore', 'qty', 5));
    END IF;
  END IF;
  after_lvl := public.xp_level(public.skill_xp(save, 'combat'));

  UPDATE public.player_saves SET data = save, rev = rev + 1, updated_at = now() WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'dmg', dmg,
    'taken', taken,
    'hp', b.hp,
    'max_hp', b.max_hp,
    'killed', killed,
    'credited', killed,
    'gold', gold_award,
    'loot', loot,
    'respawn_at', b.respawn_at,
    'leveled', after_lvl > before_lvl,
    'state', jsonb_build_object(
      'inv', save->'inv',
      'gold', (save->>'gold')::int,
      'skills', save->'skills'
    )
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.attack_monster(_id integer, _x numeric, _y numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  m public.world_monsters%ROWTYPE;
  d public.game_monster_defs%ROWTYPE;
  save jsonb;
  cd timestamptz;
  swing_s numeric;
  combat_lvl int;
  atk numeric;
  def_stat numeric;
  dmg int;
  taken int;
  killed boolean := false;
  credited boolean := false;
  gold_award int := 0;
  loot jsonb := '[]'::jsonb;
  next_inv jsonb;
  before_lvl int;
  after_lvl int;
  buff_dmg numeric := 0;
  buff_hits int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.track_position(uid, _x, _y) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;

  SELECT * INTO m FROM public.world_monsters WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  SELECT * INTO d FROM public.game_monster_defs WHERE kind = m.kind;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;

  IF sqrt(power(_x - m.x, 2) + power(_y - m.y, 2)) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;

  IF m.respawn_at IS NOT NULL AND now() >= m.respawn_at THEN
    m.hp := m.max_hp;
    m.tagged_by := NULL;
    m.tagged_at := NULL;
    m.respawn_at := NULL;
  END IF;
  IF m.respawn_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'dead', 'hp', 0, 'respawn_at', m.respawn_at);
  END IF;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  -- Swing interval must match the client formula: max(0.5, 1 - armor speed bonus).
  -- 0.15s of network slack is subtracted so honest fast clients aren't rejected.
  swing_s := greatest(0.5, 1 - public.equip_stat(save, 'armor', 'speed')) - 0.15;

  SELECT next_at INTO cd FROM public.world_cooldowns WHERE user_id = uid AND key = 'mob:' || _id;
  IF cd IS NOT NULL AND now() < cd THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'hp', m.hp, 'tagged_by', m.tagged_by);
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'mob:' || _id, now() + (swing_s || ' seconds')::interval)
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  combat_lvl := public.xp_level(public.skill_xp(save, 'combat'));
  -- Mirrors the client: weapon attack plus any offensive armor (cloth/leather line).
  atk := round(3 + combat_lvl
    + public.equip_stat(save, 'weapon', 'attack')
    + public.equip_stat(save, 'armor', 'attack'));
  def_stat := round(floor(combat_lvl / 2.0) + public.equip_stat(save, 'armor', 'defense'));

  buff_hits := coalesce((save#>>'{buff,hits}')::int, 0);
  buff_dmg := coalesce((save#>>'{buff,dmg}')::numeric, 0);
  IF buff_hits > 0 AND buff_dmg > 0 THEN
    atk := atk + buff_dmg;
    buff_hits := buff_hits - 1;
    IF buff_hits <= 0 THEN
      save := save - 'buff';
      buff_hits := 0;
    ELSE
      save := jsonb_set(save, '{buff,hits}', to_jsonb(buff_hits));
    END IF;
  END IF;

  dmg := greatest(1, floor(atk * (0.6 + random() * 0.6) - d.defense * 0.4))::int;
  m.hp := greatest(0, m.hp - dmg);

  IF m.tagged_by IS NULL THEN
    m.tagged_by := uid;
    m.tagged_at := now();
  END IF;
  credited := (m.tagged_by = uid);

  taken := greatest(0, floor(d.attack * (0.5 + random() * 0.7) - def_stat * 0.5))::int;

  IF m.hp <= 0 THEN
    killed := true;
    m.respawn_at := now() + interval '12 seconds';
  END IF;

  UPDATE public.world_monsters SET hp = m.hp, tagged_by = m.tagged_by, tagged_at = m.tagged_at,
    respawn_at = m.respawn_at, updated_at = now() WHERE id = m.id;

  before_lvl := public.xp_level(public.skill_xp(save, 'combat'));
  IF killed AND credited THEN
    save := public.grant_skill_xp(save, 'combat', d.xp);
    gold_award := d.gold_min + floor(random() * greatest(1, d.gold_max - d.gold_min + 1))::int;
    save := jsonb_set(save, '{gold}', to_jsonb(coalesce((save->>'gold')::int, 0) + gold_award));
    next_inv := save->'inv';
    IF d.drop_item IS NOT NULL AND random() < d.drop_chance THEN
      next_inv := public.inv_add(next_inv, d.drop_item, 1);
      loot := loot || jsonb_build_array(jsonb_build_object('id', d.drop_item, 'qty', 1));
    END IF;
    IF d.hide_item IS NOT NULL THEN
      next_inv := public.inv_add(next_inv, d.hide_item, 1);
      loot := loot || jsonb_build_array(jsonb_build_object('id', d.hide_item, 'qty', 1));
      IF d.hide_xp > 0 THEN save := public.grant_skill_xp(save, 'skinning', d.hide_xp); END IF;
    END IF;
    save := jsonb_set(save, '{inv}', next_inv);
  END IF;
  after_lvl := public.xp_level(public.skill_xp(save, 'combat'));

  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true, 'hp', m.hp, 'dmg', dmg, 'taken', taken, 'killed', killed,
    'credited', credited, 'tagged_by', m.tagged_by, 'gold', gold_award,
    'loot', loot, 'xp', CASE WHEN killed AND credited THEN d.xp ELSE 0 END,
    'levelup', after_lvl > before_lvl, 'level', after_lvl,
    'respawn_at', m.respawn_at, 'save', save
  );
END $function$;

REVOKE ALL ON FUNCTION public.attack_monster(integer, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attack_monster(integer, numeric, numeric) TO authenticated;
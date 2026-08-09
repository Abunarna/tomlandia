ALTER TABLE public.game_items ADD COLUMN IF NOT EXISTS speed numeric;

UPDATE public.game_items SET speed = v.s
FROM (VALUES
  ('cloth_tunic', 0.04),
  ('leather_vest', 0.07),
  ('linen_robe', 0.10),
  ('mystic_robe', 0.16)
) AS v(id, s)
WHERE public.game_items.id = v.id;

CREATE OR REPLACE FUNCTION public.equip_stat(_data jsonb, _which text, _stat text)
RETURNS numeric LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE e jsonb; eid text; plus int := 0; base numeric := 0;
BEGIN
  e := _data->_which;
  IF e IS NULL OR jsonb_typeof(e) = 'null' THEN RETURN 0; END IF;
  IF jsonb_typeof(e) = 'string' THEN eid := e #>> '{}';
  ELSE eid := e->>'id'; plus := least(greatest(coalesce((e->>'plus')::int, 0), 0), 25);
  END IF;
  IF _stat = 'speed' THEN
    SELECT coalesce(gi.speed, 0) INTO base FROM public.game_items gi WHERE gi.id = eid;
    RETURN coalesce(base, 0);
  ELSIF _stat = 'attack' THEN SELECT coalesce(gi.attack, 0) INTO base FROM public.game_items gi WHERE gi.id = eid;
  ELSE SELECT coalesce(gi.defense, 0) INTO base FROM public.game_items gi WHERE gi.id = eid;
  END IF;
  RETURN round(coalesce(base, 0) * (1 + plus * 0.05) * 10) / 10;
END $$;

REVOKE ALL ON FUNCTION public.equip_stat(jsonb, text, text) FROM PUBLIC, anon, authenticated;

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
  atk := round(3 + combat_lvl + public.equip_stat(save, 'weapon', 'attack'));
  def_stat := round(floor(combat_lvl / 2.0) + public.equip_stat(save, 'armor', 'defense'));

  buff_hits := coalesce((save#>>'{buff,hits}')::int, 0);
  buff_dmg := coalesce((save#>>'{buff,dmg}')::numeric, 0);
  IF buff_hits > 0 AND buff_dmg > 0 THEN
    atk := atk + buff_dmg;
    buff_hits := buff_hits - 1;
    IF buff_hits <= 0 THEN
      save := save - 'buff';
      buff_hits := 0;
      buff_dmg := 0;
    ELSE
      save := jsonb_set(save, '{buff,hits}', to_jsonb(buff_hits));
    END IF;
  ELSE
    buff_hits := 0;
    buff_dmg := 0;
    IF save ? 'buff' THEN save := save - 'buff'; END IF;
  END IF;

  dmg := greatest(1, round(atk - d.defense / 2.0))::int;
  taken := greatest(1, round(d.attack - def_stat / 2.0))::int;

  IF m.tagged_by IS NULL THEN
    m.tagged_by := uid;
    m.tagged_at := now();
  END IF;

  m.hp := greatest(0, m.hp - dmg);
  IF m.hp = 0 THEN
    killed := true;
    credited := m.tagged_by = uid;
    m.respawn_at := now() + interval '12 seconds';
  END IF;

  UPDATE public.world_monsters
     SET hp = m.hp, tagged_by = m.tagged_by, tagged_at = m.tagged_at,
         respawn_at = m.respawn_at, updated_at = now()
   WHERE id = _id;

  before_lvl := combat_lvl;
  IF killed AND credited THEN
    gold_award := d.gold_min + floor(random() * (d.gold_max - d.gold_min + 1))::int;
    save := jsonb_set(save, '{gold}', to_jsonb(coalesce((save->>'gold')::numeric, 0) + gold_award));

    IF d.drop_item IS NOT NULL AND random() < d.drop_chance THEN
      next_inv := public.inv_add(save->'inv', d.drop_item, 1);
      IF next_inv IS NOT NULL THEN
        save := jsonb_set(save, '{inv}', next_inv);
        loot := loot || jsonb_build_array(jsonb_build_object('item', d.drop_item, 'qty', 1));
      END IF;
    END IF;

    IF d.hide_item IS NOT NULL THEN
      next_inv := public.inv_add(save->'inv', d.hide_item, 1);
      IF next_inv IS NOT NULL THEN
        save := jsonb_set(save, '{inv}', next_inv);
        loot := loot || jsonb_build_array(jsonb_build_object('item', d.hide_item, 'qty', 1));
        save := public.grant_skill_xp(save, 'skinning', d.hide_xp);
      END IF;
    END IF;

    save := public.grant_skill_xp(save, 'combat', d.xp);
  END IF;

  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;
  after_lvl := public.xp_level(public.skill_xp(save, 'combat'));

  RETURN jsonb_build_object(
    'ok', true, 'dmg', dmg, 'taken', taken, 'hp', m.hp, 'max_hp', m.max_hp,
    'killed', killed, 'credited', credited, 'kind', m.kind,
    'gold', gold_award, 'loot', loot,
    'xp', CASE WHEN killed AND credited THEN d.xp ELSE 0 END,
    'leveled', after_lvl > before_lvl,
    'tagged_by', m.tagged_by, 'respawn_at', m.respawn_at,
    'buff', jsonb_build_object('dmg', buff_dmg, 'hits', buff_hits),
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills')
  );
END $function$;
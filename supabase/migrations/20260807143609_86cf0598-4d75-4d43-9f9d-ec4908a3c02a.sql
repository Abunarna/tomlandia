-- ============================================================
-- Phase 9 — server-authoritative actions
-- ============================================================

CREATE TABLE public.game_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  value integer NOT NULL DEFAULT 0,
  kind text NOT NULL,
  stackable boolean NOT NULL DEFAULT true,
  attack numeric,
  defense numeric,
  heal integer
);
GRANT SELECT ON public.game_items TO authenticated;
GRANT ALL ON public.game_items TO service_role;
ALTER TABLE public.game_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players can read item definitions" ON public.game_items FOR SELECT TO authenticated USING (true);

CREATE TABLE public.game_node_defs (
  kind text PRIMARY KEY,
  name text NOT NULL,
  skill text NOT NULL,
  item_id text NOT NULL,
  xp integer NOT NULL,
  req integer NOT NULL DEFAULT 1,
  time_s numeric NOT NULL DEFAULT 3
);
GRANT SELECT ON public.game_node_defs TO authenticated;
GRANT ALL ON public.game_node_defs TO service_role;
ALTER TABLE public.game_node_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players can read node definitions" ON public.game_node_defs FOR SELECT TO authenticated USING (true);

CREATE TABLE public.game_monster_defs (
  kind text PRIMARY KEY,
  name text NOT NULL,
  hp integer NOT NULL,
  attack integer NOT NULL,
  defense integer NOT NULL,
  xp integer NOT NULL,
  gold_min integer NOT NULL DEFAULT 0,
  gold_max integer NOT NULL DEFAULT 0,
  drop_item text,
  drop_chance numeric NOT NULL DEFAULT 0,
  hide_item text,
  hide_xp integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.game_monster_defs TO authenticated;
GRANT ALL ON public.game_monster_defs TO service_role;
ALTER TABLE public.game_monster_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players can read monster definitions" ON public.game_monster_defs FOR SELECT TO authenticated USING (true);

CREATE TABLE public.game_recipes (
  id text PRIMARY KEY,
  skill text NOT NULL,
  out_item text NOT NULL,
  out_qty integer NOT NULL DEFAULT 1,
  req integer NOT NULL DEFAULT 1,
  xp integer NOT NULL DEFAULT 0,
  time_s numeric NOT NULL DEFAULT 2
);
GRANT SELECT ON public.game_recipes TO authenticated;
GRANT ALL ON public.game_recipes TO service_role;
ALTER TABLE public.game_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players can read recipes" ON public.game_recipes FOR SELECT TO authenticated USING (true);

CREATE TABLE public.game_recipe_inputs (
  recipe_id text NOT NULL REFERENCES public.game_recipes(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  qty integer NOT NULL,
  PRIMARY KEY (recipe_id, item_id)
);
GRANT SELECT ON public.game_recipe_inputs TO authenticated;
GRANT ALL ON public.game_recipe_inputs TO service_role;
ALTER TABLE public.game_recipe_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players can read recipe inputs" ON public.game_recipe_inputs FOR SELECT TO authenticated USING (true);

CREATE TABLE public.player_positions (
  user_id uuid PRIMARY KEY,
  x numeric NOT NULL,
  y numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.player_positions TO service_role;
ALTER TABLE public.player_positions ENABLE ROW LEVEL SECURITY;

-- ---------------- helpers ----------------

CREATE OR REPLACE FUNCTION public.xp_level(_xp numeric)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE lvl int := 1; rem numeric := greatest(coalesce(_xp, 0), 0); need numeric;
BEGIN
  need := floor(100 * power(1.15, lvl));
  WHILE rem >= need AND lvl < 500 LOOP
    rem := rem - need;
    lvl := lvl + 1;
    need := floor(100 * power(1.15, lvl));
  END LOOP;
  RETURN lvl;
END $$;

CREATE OR REPLACE FUNCTION public.inv_count(_inv jsonb, _item text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(sum((s->>'qty')::int), 0)::int
  FROM jsonb_array_elements(coalesce(_inv, '[]'::jsonb)) s
  WHERE jsonb_typeof(s) = 'object' AND s->>'id' = _item;
$$;

CREATE OR REPLACE FUNCTION public.inv_add(_inv jsonb, _item text, _qty integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE inv jsonb := coalesce(_inv, '[]'::jsonb); stackable boolean; i int; s jsonb;
BEGIN
  SELECT coalesce(gi.stackable, true) INTO stackable FROM public.game_items gi WHERE gi.id = _item;
  WHILE jsonb_array_length(inv) < 20 LOOP inv := inv || 'null'::jsonb; END LOOP;
  IF coalesce(stackable, true) THEN
    FOR i IN 0 .. jsonb_array_length(inv) - 1 LOOP
      s := inv->i;
      IF jsonb_typeof(s) = 'object' AND s->>'id' = _item THEN
        RETURN jsonb_set(inv, ARRAY[i::text], jsonb_set(s, '{qty}', to_jsonb(((s->>'qty')::int + _qty))));
      END IF;
    END LOOP;
  END IF;
  FOR i IN 0 .. jsonb_array_length(inv) - 1 LOOP
    IF jsonb_typeof(inv->i) <> 'object' THEN
      RETURN jsonb_set(inv, ARRAY[i::text], jsonb_build_object('id', _item, 'qty', _qty, 'plus', 0));
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.inv_remove(_inv jsonb, _item text, _qty integer)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE inv jsonb := coalesce(_inv, '[]'::jsonb); left_qty int := _qty; i int; s jsonb; take int;
BEGIN
  IF public.inv_count(inv, _item) < _qty THEN RETURN NULL; END IF;
  FOR i IN 0 .. jsonb_array_length(inv) - 1 LOOP
    EXIT WHEN left_qty <= 0;
    s := inv->i;
    IF jsonb_typeof(s) = 'object' AND s->>'id' = _item THEN
      take := least(left_qty, (s->>'qty')::int);
      left_qty := left_qty - take;
      IF (s->>'qty')::int - take <= 0 THEN
        inv := jsonb_set(inv, ARRAY[i::text], 'null'::jsonb);
      ELSE
        inv := jsonb_set(inv, ARRAY[i::text], jsonb_set(s, '{qty}', to_jsonb(((s->>'qty')::int - take))));
      END IF;
    END IF;
  END LOOP;
  RETURN inv;
END $$;

CREATE OR REPLACE FUNCTION public.skill_xp(_data jsonb, _skill text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce((_data->'skills'->_skill->>'xp')::numeric, 0);
$$;

CREATE OR REPLACE FUNCTION public.grant_skill_xp(_data jsonb, _skill text, _amount numeric)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_set(
    coalesce(_data, '{}'::jsonb),
    ARRAY['skills', _skill],
    jsonb_build_object('xp', public.skill_xp(_data, _skill) + _amount),
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.equip_stat(_data jsonb, _which text, _stat text)
RETURNS numeric LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE e jsonb; eid text; plus int := 0; base numeric := 0;
BEGIN
  e := _data->_which;
  IF e IS NULL OR jsonb_typeof(e) = 'null' THEN RETURN 0; END IF;
  IF jsonb_typeof(e) = 'string' THEN eid := e #>> '{}';
  ELSE eid := e->>'id'; plus := least(greatest(coalesce((e->>'plus')::int, 0), 0), 25);
  END IF;
  IF _stat = 'attack' THEN SELECT coalesce(gi.attack, 0) INTO base FROM public.game_items gi WHERE gi.id = eid;
  ELSE SELECT coalesce(gi.defense, 0) INTO base FROM public.game_items gi WHERE gi.id = eid;
  END IF;
  RETURN round(coalesce(base, 0) * (1 + plus * 0.05) * 10) / 10;
END $$;

CREATE OR REPLACE FUNCTION public.track_position(_uid uuid, _x numeric, _y numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev public.player_positions%ROWTYPE; elapsed numeric; allowed numeric; ok boolean := true;
BEGIN
  SELECT * INTO prev FROM public.player_positions WHERE user_id = _uid FOR UPDATE;
  IF FOUND THEN
    elapsed := extract(epoch FROM (now() - prev.updated_at));
    allowed := 400 * elapsed + 600;
    IF sqrt(power(_x - prev.x, 2) + power(_y - prev.y, 2)) > allowed THEN ok := false; END IF;
  END IF;
  INSERT INTO public.player_positions (user_id, x, y, updated_at)
  VALUES (_uid, _x, _y, now())
  ON CONFLICT (user_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, updated_at = now();
  RETURN ok;
END $$;

-- ---------------- actions ----------------

DROP FUNCTION IF EXISTS public.harvest_node(integer);

CREATE OR REPLACE FUNCTION public.harvest_node(_id integer, _x numeric, _y numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  n public.world_nodes%ROWTYPE;
  d public.game_node_defs%ROWTYPE;
  save jsonb;
  cd timestamptz;
  next_inv jsonb;
  before_lvl int;
  after_lvl int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.track_position(uid, _x, _y) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;

  SELECT * INTO n FROM public.world_nodes WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  SELECT * INTO d FROM public.game_node_defs WHERE kind = n.kind;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;

  IF sqrt(power(_x - n.x, 2) + power(_y - n.y, 2)) > 70 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far');
  END IF;

  IF n.respawn_at IS NOT NULL AND now() < n.respawn_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'depleted', 'charges', 0, 'respawn_at', n.respawn_at);
  END IF;
  IF n.respawn_at IS NOT NULL THEN
    n.charges := n.max_charges;
    n.respawn_at := NULL;
  END IF;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  IF public.xp_level(public.skill_xp(save, d.skill)) < d.req THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'low_level', 'req', d.req, 'skill', d.skill);
  END IF;

  SELECT next_at INTO cd FROM public.world_cooldowns WHERE user_id = uid AND key = 'node:' || _id;
  IF cd IS NOT NULL AND now() < cd THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'charges', n.charges, 'respawn_at', n.respawn_at);
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'node:' || _id, now() + make_interval(secs => d.time_s * 0.7))
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  next_inv := public.inv_add(save->'inv', d.item_id, 1);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;

  before_lvl := public.xp_level(public.skill_xp(save, d.skill));
  save := jsonb_set(save, '{inv}', next_inv);
  save := public.grant_skill_xp(save, d.skill, d.xp);
  after_lvl := public.xp_level(public.skill_xp(save, d.skill));

  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;

  n.charges := greatest(0, n.charges - 1);
  IF n.charges = 0 THEN n.respawn_at := now() + make_interval(secs => n.respawn_s); END IF;
  UPDATE public.world_nodes
     SET charges = n.charges, respawn_at = n.respawn_at, updated_at = now()
   WHERE id = _id;

  RETURN jsonb_build_object(
    'ok', true, 'charges', n.charges, 'respawn_at', n.respawn_at,
    'item', d.item_id, 'qty', 1, 'skill', d.skill, 'xp', d.xp,
    'leveled', after_lvl > before_lvl, 'level', after_lvl,
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills')
  );
END $$;

DROP FUNCTION IF EXISTS public.damage_monster(integer, integer);

CREATE OR REPLACE FUNCTION public.attack_monster(_id integer, _x numeric, _y numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  m public.world_monsters%ROWTYPE;
  d public.game_monster_defs%ROWTYPE;
  save jsonb;
  cd timestamptz;
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

  SELECT next_at INTO cd FROM public.world_cooldowns WHERE user_id = uid AND key = 'mob:' || _id;
  IF cd IS NOT NULL AND now() < cd THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'hp', m.hp, 'tagged_by', m.tagged_by);
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'mob:' || _id, now() + interval '0.85 seconds')
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  combat_lvl := public.xp_level(public.skill_xp(save, 'combat'));
  atk := round(3 + combat_lvl + public.equip_stat(save, 'weapon', 'attack'));
  def_stat := round(floor(combat_lvl / 2.0) + public.equip_stat(save, 'armor', 'defense'));
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
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills')
  );
END $$;

CREATE OR REPLACE FUNCTION public.craft_item(_recipe text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  r public.game_recipes%ROWTYPE;
  save jsonb;
  cd timestamptz;
  inv jsonb;
  next_inv jsonb;
  inp record;
  before_lvl int;
  after_lvl int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO r FROM public.game_recipes WHERE id = _recipe;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;

  SELECT next_at INTO cd FROM public.world_cooldowns WHERE user_id = uid AND key = 'craft';
  IF cd IS NOT NULL AND now() < cd THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast');
  END IF;

  SELECT data INTO save FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF save IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;

  IF public.xp_level(public.skill_xp(save, r.skill)) < r.req THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'low_level', 'req', r.req, 'skill', r.skill);
  END IF;

  inv := coalesce(save->'inv', '[]'::jsonb);
  FOR inp IN SELECT item_id, qty FROM public.game_recipe_inputs WHERE recipe_id = r.id LOOP
    next_inv := public.inv_remove(inv, inp.item_id, inp.qty);
    IF next_inv IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'missing_materials', 'item', inp.item_id);
    END IF;
    inv := next_inv;
  END LOOP;

  next_inv := public.inv_add(inv, r.out_item, r.out_qty);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;

  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'craft', now() + make_interval(secs => greatest(r.time_s * 0.5, 0.4)))
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  before_lvl := public.xp_level(public.skill_xp(save, r.skill));
  save := jsonb_set(save, '{inv}', next_inv);
  save := public.grant_skill_xp(save, r.skill, r.xp);
  after_lvl := public.xp_level(public.skill_xp(save, r.skill));

  UPDATE public.player_saves SET data = save, updated_at = now() WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true, 'out', r.out_item, 'out_qty', r.out_qty, 'skill', r.skill, 'xp', r.xp,
    'leveled', after_lvl > before_lvl,
    'state', jsonb_build_object('inv', save->'inv', 'gold', save->'gold', 'skills', save->'skills')
  );
END $$;

-- ---------------- reference data ----------------

INSERT INTO public.game_items (id, name, value, kind, stackable, attack, defense, heal) VALUES ('copper_ore', 'Copper Ore', 6, 'resource', true, NULL, NULL, NULL),('iron_ore', 'Iron Ore', 14, 'resource', true, NULL, NULL, NULL),('sandstone', 'Sandstone', 22, 'resource', true, NULL, NULL, NULL),('mithril_ore', 'Mithril Ore', 40, 'resource', true, NULL, NULL, NULL),('cursed_shard', 'Cursed Shard', 70, 'resource', true, NULL, NULL, NULL),('runite_ore', 'Runite Ore', 110, 'resource', true, NULL, NULL, NULL),('tungsten_ore', 'Tungsten Ore', 150, 'resource', true, NULL, NULL, NULL),('oak_logs', 'Oak Logs', 5, 'resource', true, NULL, NULL, NULL),('willow_logs', 'Willow Logs', 12, 'resource', true, NULL, NULL, NULL),('maple_logs', 'Maple Logs', 20, 'resource', true, NULL, NULL, NULL),('palm_logs', 'Palm Logs', 34, 'resource', true, NULL, NULL, NULL),('cursed_bark', 'Cursed Bark', 62, 'resource', true, NULL, NULL, NULL),('frostpine_logs', 'Frostpine Logs', 100, 'resource', true, NULL, NULL, NULL),('flax', 'Flax', 4, 'resource', true, NULL, NULL, NULL),('meadow_berries', 'Meadow Berries', 7, 'resource', true, NULL, NULL, NULL),('forest_herbs', 'Forest Herbs', 16, 'resource', true, NULL, NULL, NULL),('desert_bloom', 'Desert Bloom', 30, 'resource', true, NULL, NULL, NULL),('gloomcap', 'Gloomcap', 58, 'resource', true, NULL, NULL, NULL),('frost_lichen', 'Frost Lichen', 95, 'resource', true, NULL, NULL, NULL),('feather', 'Feather', 2, 'resource', true, NULL, NULL, NULL),('goblin_charm', 'Goblin Charm', 14, 'resource', true, NULL, NULL, NULL),('raw_hide', 'Raw Hide', 10, 'resource', true, NULL, NULL, NULL),('thick_hide', 'Thick Hide', 28, 'resource', true, NULL, NULL, NULL),('scale_hide', 'Scaled Hide', 55, 'resource', true, NULL, NULL, NULL),('shadow_pelt', 'Shadow Pelt', 90, 'resource', true, NULL, NULL, NULL),('frost_pelt', 'Frost Pelt', 140, 'resource', true, NULL, NULL, NULL),('copper_bar', 'Copper Bar', 18, 'material', true, NULL, NULL, NULL),('iron_bar', 'Iron Bar', 40, 'material', true, NULL, NULL, NULL),('mithril_bar', 'Mithril Bar', 100, 'material', true, NULL, NULL, NULL),('runite_bar', 'Runite Bar', 260, 'material', true, NULL, NULL, NULL),('tungsten_bar', 'Tungsten Bar', 380, 'material', true, NULL, NULL, NULL),('light_leather', 'Light Leather', 30, 'material', true, NULL, NULL, NULL),('thick_leather', 'Thick Leather', 78, 'material', true, NULL, NULL, NULL),('shadow_leather', 'Shadow Leather', 210, 'material', true, NULL, NULL, NULL),('linen_cloth', 'Linen Cloth', 22, 'material', true, NULL, NULL, NULL),('herb_weave', 'Herb Weave', 70, 'material', true, NULL, NULL, NULL),('mystic_cloth', 'Mystic Cloth', 200, 'material', true, NULL, NULL, NULL),('wooden_club', 'Wooden Club', 15, 'weapon', false, 2, NULL, NULL),('bronze_dagger', 'Bronze Dagger', 40, 'weapon', false, 4, NULL, NULL),('copper_sword', 'Copper Sword', 70, 'weapon', false, 6, NULL, NULL),('steel_sword', 'Steel Sword', 150, 'weapon', false, 9, NULL, NULL),('mithril_blade', 'Mithril Blade', 380, 'weapon', false, 16, NULL, NULL),('runite_greatsword', 'Runite Greatsword', 900, 'weapon', false, 26, NULL, NULL),('tungsten_maul', 'Tungsten Maul', 1500, 'weapon', false, 38, NULL, NULL),('sunspire_wand', 'Sunspire Wand', 700, 'weapon', false, 22, NULL, NULL),('cloth_tunic', 'Cloth Tunic', 18, 'armor', false, NULL, 2, NULL),('leather_vest', 'Leather Vest', 45, 'armor', false, NULL, 4, NULL),('linen_robe', 'Linen Robe', 90, 'armor', false, NULL, 6, NULL),('iron_mail', 'Iron Mail', 170, 'armor', false, NULL, 9, NULL),('mithril_plate', 'Mithril Plate', 420, 'armor', false, NULL, 16, NULL),('mystic_robe', 'Mystic Robe', 640, 'armor', false, NULL, 21, NULL),('runite_plate', 'Runite Plate', 980, 'armor', false, NULL, 27, NULL),('frostguard_plate', 'Frostguard Plate', 1600, 'armor', false, NULL, 38, NULL),('honey_bun', 'Honey Bun', 12, 'food', true, NULL, NULL, 14),('berry_pie', 'Berry Pie', 34, 'food', true, NULL, NULL, 45),('hearty_stew', 'Hearty Stew', 90, 'food', true, NULL, NULL, 120),('frost_tonic', 'Frost Tonic', 180, 'food', true, NULL, NULL, 300);

INSERT INTO public.game_node_defs (kind, name, skill, item_id, xp, req, time_s) VALUES ('copper', 'Copper Rock', 'mining', 'copper_ore', 18, 1, 3.2),('oak', 'Oak Tree', 'woodcutting', 'oak_logs', 16, 1, 3),('flax', 'Flax Patch', 'gathering', 'flax', 14, 1, 2.4),('berries', 'Berry Bush', 'gathering', 'meadow_berries', 20, 3, 2.8),('iron', 'Iron Rock', 'mining', 'iron_ore', 42, 15, 4),('willow', 'Willow Tree', 'woodcutting', 'willow_logs', 38, 15, 3.8),('maple', 'Maple Tree', 'woodcutting', 'maple_logs', 60, 28, 4.4),('herbs', 'Herb Cluster', 'gathering', 'forest_herbs', 48, 18, 3.4),('sandstone', 'Sandstone Vein', 'mining', 'sandstone', 90, 40, 4.6),('mithril', 'Mithril Vein', 'mining', 'mithril_ore', 140, 50, 5.4),('palm', 'Desert Palm', 'woodcutting', 'palm_logs', 120, 45, 5),('bloom', 'Desert Bloom', 'gathering', 'desert_bloom', 110, 42, 4),('cursed_rock', 'Cursed Rock', 'mining', 'cursed_shard', 240, 70, 6),('cursed_tree', 'Cursed Tree', 'woodcutting', 'cursed_bark', 230, 70, 6),('gloomcap', 'Gloomcap', 'gathering', 'gloomcap', 210, 68, 4.8),('runite', 'Runite Vein', 'mining', 'runite_ore', 420, 100, 7),('tungsten', 'Tungsten Vein', 'mining', 'tungsten_ore', 520, 110, 7.6),('frostpine', 'Frostpine', 'woodcutting', 'frostpine_logs', 400, 100, 6.8),('lichen', 'Frost Lichen', 'gathering', 'frost_lichen', 380, 98, 5.4);

INSERT INTO public.game_monster_defs (kind, name, hp, attack, defense, xp, gold_min, gold_max, drop_item, drop_chance, hide_item, hide_xp) VALUES ('chicken', 'Chicken', 8, 2, 0, 12, 1, 4, 'feather', 0.7, NULL, 0),('goblin', 'Goblin', 22, 5, 2, 34, 4, 12, 'goblin_charm', 0.35, 'raw_hide', 16),('wolf', 'Meadow Wolf', 60, 11, 5, 95, 10, 24, 'raw_hide', 0.6, 'raw_hide', 40),('bear', 'Honey Bear', 130, 20, 10, 210, 22, 48, 'thick_hide', 0.5, 'thick_hide', 85),('serpent', 'Sand Serpent', 260, 34, 18, 430, 45, 95, 'scale_hide', 0.5, 'scale_hide', 170),('bandit', 'Dune Bandit', 320, 42, 22, 520, 70, 160, 'desert_bloom', 0.4, 'scale_hide', 190),('wraith', 'Pale Wraith', 620, 68, 34, 980, 120, 250, 'gloomcap', 0.45, 'shadow_pelt', 330),('shadow_beast', 'Shadow Beast', 820, 84, 42, 1300, 160, 320, 'shadow_pelt', 0.55, 'shadow_pelt', 400),('yeti', 'Fluffy Yeti', 1500, 130, 62, 2400, 280, 520, 'frost_pelt', 0.55, 'frost_pelt', 720),('frost_giant', 'Frost Giant', 2200, 165, 80, 3400, 400, 780, 'tungsten_ore', 0.4, 'frost_pelt', 900);

INSERT INTO public.game_recipes (id, skill, out_item, out_qty, req, xp, time_s) VALUES ('copper_bar', 'smithing', 'copper_bar', 1, 1, 22, 1.6),('iron_bar', 'smithing', 'iron_bar', 1, 15, 55, 1.8),('mithril_bar', 'smithing', 'mithril_bar', 1, 40, 150, 2.2),('runite_bar', 'smithing', 'runite_bar', 1, 70, 420, 2.6),('tungsten_bar', 'smithing', 'tungsten_bar', 1, 100, 620, 3),('copper_sword', 'smithing', 'copper_sword', 1, 5, 90, 2.4),('steel_sword', 'smithing', 'steel_sword', 1, 20, 220, 2.6),('iron_mail', 'smithing', 'iron_mail', 1, 24, 260, 2.8),('mithril_blade', 'smithing', 'mithril_blade', 1, 45, 620, 3),('mithril_plate', 'smithing', 'mithril_plate', 1, 50, 700, 3.2),('runite_greatsword', 'smithing', 'runite_greatsword', 1, 75, 1500, 3.4),('runite_plate', 'smithing', 'runite_plate', 1, 80, 1700, 3.6),('tungsten_maul', 'smithing', 'tungsten_maul', 1, 105, 2600, 3.8),('frostguard_plate', 'smithing', 'frostguard_plate', 1, 110, 3000, 4),('light_leather', 'skinning', 'light_leather', 1, 1, 30, 1.6),('thick_leather', 'skinning', 'thick_leather', 1, 25, 110, 2),('shadow_leather', 'skinning', 'shadow_leather', 1, 65, 460, 2.4),('linen_cloth', 'tailoring', 'linen_cloth', 1, 1, 26, 1.6),('herb_weave', 'tailoring', 'herb_weave', 1, 22, 120, 2),('mystic_cloth', 'tailoring', 'mystic_cloth', 1, 60, 520, 2.4),('leather_vest', 'tailoring', 'leather_vest', 1, 6, 90, 2.2),('linen_robe', 'tailoring', 'linen_robe', 1, 14, 180, 2.4),('mystic_robe', 'tailoring', 'mystic_robe', 1, 66, 900, 3);

INSERT INTO public.game_recipe_inputs (recipe_id, item_id, qty) VALUES ('copper_bar', 'copper_ore', 2),('iron_bar', 'iron_ore', 2),('mithril_bar', 'mithril_ore', 2),('mithril_bar', 'sandstone', 1),('runite_bar', 'runite_ore', 2),('runite_bar', 'cursed_shard', 1),('tungsten_bar', 'tungsten_ore', 2),('tungsten_bar', 'runite_bar', 1),('copper_sword', 'copper_bar', 3),('steel_sword', 'iron_bar', 3),('steel_sword', 'oak_logs', 1),('iron_mail', 'iron_bar', 4),('mithril_blade', 'mithril_bar', 3),('mithril_blade', 'palm_logs', 1),('mithril_plate', 'mithril_bar', 4),('runite_greatsword', 'runite_bar', 4),('runite_greatsword', 'frostpine_logs', 1),('runite_plate', 'runite_bar', 5),('tungsten_maul', 'tungsten_bar', 4),('frostguard_plate', 'tungsten_bar', 5),('frostguard_plate', 'frost_pelt', 2),('light_leather', 'raw_hide', 3),('thick_leather', 'thick_hide', 3),('shadow_leather', 'shadow_pelt', 3),('shadow_leather', 'scale_hide', 1),('linen_cloth', 'flax', 3),('herb_weave', 'forest_herbs', 3),('herb_weave', 'linen_cloth', 1),('mystic_cloth', 'gloomcap', 2),('mystic_cloth', 'herb_weave', 2),('leather_vest', 'light_leather', 3),('linen_robe', 'linen_cloth', 3),('linen_robe', 'light_leather', 1),('mystic_robe', 'mystic_cloth', 3),('mystic_robe', 'shadow_leather', 1);
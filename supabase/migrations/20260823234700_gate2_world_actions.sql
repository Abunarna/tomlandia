-- Gate 2: authoritative world actions, deterministic DESOLATUS position,
-- expiring monster tags, full-bag-safe loot and stored fishing weights.

CREATE TABLE IF NOT EXISTS public.game_boss_path_points (
  seq integer PRIMARY KEY,
  x numeric NOT NULL,
  y numeric NOT NULL
);
REVOKE ALL ON public.game_boss_path_points FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.game_boss_path_points TO service_role;
ALTER TABLE public.game_boss_path_points ENABLE ROW LEVEL SECURITY;

DELETE FROM public.game_boss_path_points;
INSERT INTO public.game_boss_path_points (seq, x, y) VALUES
  (0, 2800, 1875),
  (1, 2809.728625, 2184.150853),
  (2, 2465.054053, 2202.08715),
  (3, 2687.545742, 2172.881255),
  (4, 2369.257579, 2436.848833),
  (5, 1890.516831, 2192.942096),
  (6, 2196.005282, 2351.689218),
  (7, 2443.729517, 2340.225862),
  (8, 2555.4836, 2083.577532),
  (9, 3021.000457, 2022.22983),
  (10, 2621.683089, 2069.201056),
  (11, 2458.214951, 1839.294239),
  (12, 2702.471597, 1677.064064),
  (13, 2421.659014, 1535.444503),
  (14, 3280.943952, 1518.48015),
  (15, 3382.443782, 1859.333907),
  (16, 2807.028493, 1662.747561),
  (17, 2592.994448, 1300.748392),
  (18, 2636.371893, 1591.485424),
  (19, 2424.726122, 1894.331058),
  (20, 2601.35745, 2280.358606),
  (21, 2800.443831, 2113.377856),
  (22, 2513.036042, 2060.743466),
  (23, 2339.979717, 2457.46302),
  (24, 2005.035905, 2301.267658),
  (25, 2063.28822, 1938.072366),
  (26, 1911.766619, 2475.048216),
  (27, 2265.514371, 2377.691448),
  (28, 1687.39598, 2003.707233),
  (29, 1959.986567, 2163.219978),
  (30, 2003.452099, 2446.406718),
  (31, 1695.925457, 2173.969251),
  (32, 2149.919998, 2445.185552),
  (33, 2505.014327, 2276.152057),
  (34, 2312.515002, 1662.55502),
  (35, 2654.027948, 1850.660748),
  (36, 2396.587399, 1997.263041),
  (37, 2788.306649, 1568.225513),
  (38, 3061.819488, 1861.473362),
  (39, 2632.665213, 1855.236116),
  (40, 2810.947135, 1471.686029),
  (41, 2582.181247, 1745.353463),
  (42, 3104.012511, 1382.625325),
  (43, 3647.324236, 1383.49686),
  (44, 3899.426225, 1435.449447),
  (45, 3709.446196, 1198.057004),
  (46, 3586.541358, 1477.154679),
  (47, 3509.146913, 1255.517372),
  (48, 4190.60251, 1258.159906),
  (49, 3543.030028, 1298.932457),
  (50, 3497.326324, 1662.419738),
  (51, 3748.493109, 1219.972863),
  (52, 3207.096666, 1432.55995),
  (53, 3528.175584, 926.123129),
  (54, 3667.172816, 448.740012),
  (55, 3610.544838, 833.484235),
  (56, 3841.374974, 843.928311),
  (57, 3931.543014, 1068.327278),
  (58, 4336.274456, 552.57538),
  (59, 4803.266224, 881.823929),
  (60, 4156.736746, 427.261903),
  (61, 3926.915131, 529.838375),
  (62, 4114.356014, 135.469264),
  (63, 4208.797563, 347.282071),
  (64, 3734.864741, 693.733282),
  (65, 3688.046449, 1168.827585),
  (66, 3658.341114, 448.932948),
  (67, 3839.947307, 1011.347077),
  (68, 3721.906451, 321.789799),
  (69, 3158.547277, 273.590336),
  (70, 2525.611829, 226.433618),
  (71, 2667.049008, 558.821469),
  (72, 2510.086391, 186.845411),
  (73, 2426.695851, 528.554058),
  (74, 2716.783723, 491.982561),
  (75, 2396.389285, 806.670864),
  (76, 2689.915372, 868.32324),
  (77, 2151.476069, 527.537283),
  (78, 2441.80491, 829.979252),
  (79, 2177.35392, 550.750106),
  (80, 2556.272415, 491.312524),
  (81, 2359.976679, 1260.603771),
  (82, 2738.336802, 1467.074039),
  (83, 2899.633331, 1652.749158),
  (84, 3124.216216, 1763.553212),
  (85, 3526.269756, 1802.981512),
  (86, 3402.297327, 1351.312289),
  (87, 3943.498665, 797.417312),
  (88, 3518.581173, 1420.27977),
  (89, 3716.122889, 1159.660022),
  (90, 3797.896856, 1416.696516),
  (91, 3716.122889, 1159.660022),
  (92, 3518.581173, 1420.27977),
  (93, 3943.498665, 797.417312),
  (94, 3402.297327, 1351.312289),
  (95, 3526.269756, 1802.981512),
  (96, 3124.216216, 1763.553212),
  (97, 2899.633331, 1652.749158),
  (98, 2738.336802, 1467.074039),
  (99, 2359.976679, 1260.603771),
  (100, 2556.272415, 491.312524),
  (101, 2177.35392, 550.750106),
  (102, 2441.80491, 829.979252),
  (103, 2151.476069, 527.537283),
  (104, 2689.915372, 868.32324),
  (105, 2396.389285, 806.670864),
  (106, 2716.783723, 491.982561),
  (107, 2426.695851, 528.554058),
  (108, 2510.086391, 186.845411),
  (109, 2667.049008, 558.821469),
  (110, 2525.611829, 226.433618),
  (111, 3158.547277, 273.590336),
  (112, 3721.906451, 321.789799),
  (113, 3839.947307, 1011.347077),
  (114, 3658.341114, 448.932948),
  (115, 3688.046449, 1168.827585),
  (116, 3734.864741, 693.733282),
  (117, 4208.797563, 347.282071),
  (118, 4114.356014, 135.469264),
  (119, 3926.915131, 529.838375),
  (120, 4156.736746, 427.261903),
  (121, 4803.266224, 881.823929),
  (122, 4336.274456, 552.57538),
  (123, 3931.543014, 1068.327278),
  (124, 3841.374974, 843.928311),
  (125, 3610.544838, 833.484235),
  (126, 3667.172816, 448.740012),
  (127, 3528.175584, 926.123129),
  (128, 3207.096666, 1432.55995),
  (129, 3748.493109, 1219.972863),
  (130, 3497.326324, 1662.419738),
  (131, 3543.030028, 1298.932457),
  (132, 4190.60251, 1258.159906),
  (133, 3509.146913, 1255.517372),
  (134, 3586.541358, 1477.154679),
  (135, 3709.446196, 1198.057004),
  (136, 3899.426225, 1435.449447),
  (137, 3647.324236, 1383.49686),
  (138, 3104.012511, 1382.625325),
  (139, 2582.181247, 1745.353463),
  (140, 2810.947135, 1471.686029),
  (141, 2632.665213, 1855.236116),
  (142, 3061.819488, 1861.473362),
  (143, 2788.306649, 1568.225513),
  (144, 2396.587399, 1997.263041),
  (145, 2654.027948, 1850.660748),
  (146, 2312.515002, 1662.55502),
  (147, 2505.014327, 2276.152057),
  (148, 2149.919998, 2445.185552),
  (149, 1695.925457, 2173.969251),
  (150, 2003.452099, 2446.406718),
  (151, 1959.986567, 2163.219978),
  (152, 1687.39598, 2003.707233),
  (153, 2265.514371, 2377.691448),
  (154, 1911.766619, 2475.048216),
  (155, 2063.28822, 1938.072366),
  (156, 2005.035905, 2301.267658),
  (157, 2339.979717, 2457.46302),
  (158, 2513.036042, 2060.743466),
  (159, 2800.443831, 2113.377856),
  (160, 2601.35745, 2280.358606),
  (161, 2424.726122, 1894.331058),
  (162, 2636.371893, 1591.485424),
  (163, 2592.994448, 1300.748392),
  (164, 2807.028493, 1662.747561),
  (165, 3382.443782, 1859.333907),
  (166, 3280.943952, 1518.48015),
  (167, 2421.659014, 1535.444503),
  (168, 2702.471597, 1677.064064),
  (169, 2458.214951, 1839.294239),
  (170, 2621.683089, 2069.201056),
  (171, 3021.000457, 2022.22983),
  (172, 2555.4836, 2083.577532),
  (173, 2443.729517, 2340.225862),
  (174, 2196.005282, 2351.689218),
  (175, 1890.516831, 2192.942096),
  (176, 2369.257579, 2436.848833),
  (177, 2687.545742, 2172.881255),
  (178, 2465.054053, 2202.08715),
  (179, 2809.728625, 2184.150853),
  (180, 2800, 1875);

CREATE OR REPLACE FUNCTION public.boss_position_at(_at timestamptz)
RETURNS TABLE(x numeric, y numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total_distance numeric; travelled numeric; leg record; start_distance numeric; ratio numeric;
BEGIN
  WITH raw AS (
    SELECT points.seq,
           points.x AS x1,
           points.y AS y1,
           lead(points.x) OVER (ORDER BY points.seq) AS x2,
           lead(points.y) OVER (ORDER BY points.seq) AS y2
    FROM public.game_boss_path_points AS points
  ), lengths AS (
    SELECT *, sqrt(power(x2 - x1, 2) + power(y2 - y1, 2)) AS len FROM raw WHERE x2 IS NOT NULL
  )
  SELECT sum(len) INTO total_distance FROM lengths;
  IF total_distance IS NULL OR total_distance <= 0 THEN RETURN QUERY SELECT 2800::numeric, 1875::numeric; RETURN; END IF;
  travelled := mod(extract(epoch FROM _at)::numeric * 32.5, total_distance);

  WITH raw AS (
    SELECT points.seq,
           points.x AS x1,
           points.y AS y1,
           lead(points.x) OVER (ORDER BY points.seq) AS x2,
           lead(points.y) OVER (ORDER BY points.seq) AS y2
    FROM public.game_boss_path_points AS points
  ), lengths AS (
    SELECT *, sqrt(power(x2 - x1, 2) + power(y2 - y1, 2)) AS len FROM raw WHERE x2 IS NOT NULL
  ), legs AS (
    SELECT *, sum(len) OVER (ORDER BY seq) AS end_distance FROM lengths
  )
  SELECT * INTO leg FROM legs WHERE end_distance >= travelled ORDER BY seq LIMIT 1;
  start_distance := leg.end_distance - leg.len;
  ratio := greatest(0, least(1, (travelled - start_distance) / greatest(leg.len, 0.000001)));
  RETURN QUERY SELECT leg.x1 + (leg.x2 - leg.x1) * ratio, leg.y1 + (leg.y2 - leg.y1) * ratio;
END $$;

REVOKE ALL ON FUNCTION public.boss_position_at(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.harvest_node(_id integer, _x numeric, _y numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); node public.world_nodes%ROWTYPE; definition public.game_node_defs%ROWTYPE;
  data jsonb; next_inv jsonb; before_level integer; after_level integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.track_position(uid, _x, _y) THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_far'); END IF;
  SELECT * INTO node FROM public.world_nodes WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  SELECT * INTO definition FROM public.game_node_defs WHERE kind = node.kind;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF sqrt(power(_x - node.x, 2) + power(_y - node.y, 2)) > 70 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_far'); END IF;
  IF node.respawn_at IS NOT NULL AND now() < node.respawn_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'depleted', 'charges', 0, 'respawn_at', node.respawn_at);
  END IF;
  IF node.respawn_at IS NOT NULL THEN node.charges := node.max_charges; node.respawn_at := NULL; END IF;

  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  IF public.xp_level(public.skill_xp(data, definition.skill)) < definition.req THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'low_level', 'req', definition.req, 'skill', definition.skill);
  END IF;
  IF NOT public.action_gate(uid, 'action:gather', make_interval(secs => definition.time_s * 0.7)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'charges', node.charges, 'respawn_at', node.respawn_at);
  END IF;
  next_inv := public.inv_add(data->'inv', definition.item_id, 1);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;

  before_level := public.xp_level(public.skill_xp(data, definition.skill));
  data := jsonb_set(data, '{inv}', next_inv, true);
  data := public.grant_skill_xp(data, definition.skill, definition.xp);
  data := public.advance_quest(data, 'gather', definition.item_id);
  after_level := public.xp_level(public.skill_xp(data, definition.skill));
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;

  node.charges := greatest(0, node.charges - 1);
  IF node.charges = 0 THEN node.respawn_at := now() + make_interval(secs => node.respawn_s); END IF;
  UPDATE public.world_nodes SET charges = node.charges, respawn_at = node.respawn_at, updated_at = now() WHERE id = _id;
  RETURN jsonb_build_object(
    'ok', true, 'charges', node.charges, 'respawn_at', node.respawn_at,
    'item', definition.item_id, 'qty', 1, 'skill', definition.skill, 'xp', definition.xp,
    'leveled', after_level > before_level, 'level', after_level, 'state', public.pl_state(data)
  );
END $$;

CREATE OR REPLACE FUNCTION public.fish_cast(_spot integer, _x numeric, _y numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); spot public.game_fishing_spots%ROWTYPE; data jsonb; level integer;
  fish record; total numeric := 0; roll numeric; accumulated numeric := 0; caught text; caught_xp numeric := 0;
  next_inv jsonb; before_level integer; after_level integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.track_position(uid, _x, _y) THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_far'); END IF;
  SELECT * INTO spot FROM public.game_fishing_spots WHERE id = _spot;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF sqrt(power(_x - spot.x, 2) + power(_y - spot.y, 2)) > 70 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_far'); END IF;
  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  -- Match harvest lock order (position -> save -> shared gather cooldown) so a
  -- simultaneous fishing cast and node harvest cannot deadlock one another.
  IF NOT public.action_gate(uid, 'action:gather', interval '2.4 seconds') THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_fast'); END IF;
  level := public.xp_level(public.skill_xp(data, 'fishing'));

  FOR fish IN
    SELECT item_id, xp,
      CASE
        WHEN level <= 1 THEN w1
        WHEN level < 15 THEN w1 + (w15 - w1) * (level - 1) / 14.0
        WHEN level < 40 THEN w15 + (w40 - w15) * (level - 15) / 25.0
        WHEN level < 70 THEN w40 + (w70 - w40) * (level - 40) / 30.0
        WHEN level < 100 THEN w70 + (w100 - w70) * (level - 70) / 30.0
        ELSE w100
      END AS weight
    FROM public.game_fish ORDER BY xp
  LOOP total := total + greatest(0, fish.weight); END LOOP;
  IF total <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_fish'); END IF;
  roll := random() * total;
  FOR fish IN
    SELECT item_id, xp,
      CASE
        WHEN level <= 1 THEN w1
        WHEN level < 15 THEN w1 + (w15 - w1) * (level - 1) / 14.0
        WHEN level < 40 THEN w15 + (w40 - w15) * (level - 15) / 25.0
        WHEN level < 70 THEN w40 + (w70 - w40) * (level - 40) / 30.0
        WHEN level < 100 THEN w70 + (w100 - w70) * (level - 70) / 30.0
        ELSE w100
      END AS weight
    FROM public.game_fish ORDER BY xp
  LOOP
    accumulated := accumulated + greatest(0, fish.weight);
    IF roll <= accumulated THEN caught := fish.item_id; caught_xp := fish.xp; EXIT; END IF;
  END LOOP;
  IF caught IS NULL THEN SELECT item_id, xp INTO caught, caught_xp FROM public.game_fish ORDER BY xp LIMIT 1; END IF;
  next_inv := public.inv_add(data->'inv', caught, 1);
  IF next_inv IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bag_full'); END IF;
  before_level := level;
  data := jsonb_set(data, '{inv}', next_inv, true);
  data := public.grant_skill_xp(data, 'fishing', caught_xp);
  data := public.advance_quest(data, 'gather', caught);
  after_level := public.xp_level(public.skill_xp(data, 'fishing'));
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object(
    'ok', true, 'item', caught, 'qty', 1, 'skill', 'fishing', 'xp', caught_xp,
    'leveled', after_level > before_level, 'level', after_level, 'state', public.pl_state(data)
  );
END $$;

CREATE OR REPLACE FUNCTION public.attack_monster(_id integer, _x numeric, _y numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); monster public.world_monsters%ROWTYPE; definition public.game_monster_defs%ROWTYPE;
  data jsonb; swing_seconds numeric; combat_level integer; attack_stat numeric; defense_stat numeric;
  damage integer; taken integer; killed boolean := false; credited boolean := false; gold_award integer := 0;
  loot jsonb := '[]'::jsonb; skipped jsonb := '[]'::jsonb; next_inv jsonb;
  before_level integer; after_level integer; buff_damage numeric := 0; buff_hits integer := 0;
  settlement jsonb; death jsonb := 'null'::jsonb; food_used boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.track_position(uid, _x, _y) THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_far'); END IF;
  SELECT * INTO monster FROM public.world_monsters WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  SELECT * INTO definition FROM public.game_monster_defs WHERE kind = monster.kind;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF sqrt(power(_x - monster.x, 2) + power(_y - monster.y, 2)) > 120 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_far'); END IF;

  IF monster.respawn_at IS NOT NULL AND now() >= monster.respawn_at THEN
    monster.hp := monster.max_hp; monster.tagged_by := NULL; monster.tagged_at := NULL; monster.respawn_at := NULL;
  END IF;
  IF monster.respawn_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'dead', 'hp', 0, 'respawn_at', monster.respawn_at);
  END IF;
  IF monster.tagged_by IS NOT NULL AND monster.tagged_at < now() - interval '15 seconds' THEN
    monster.tagged_by := NULL; monster.tagged_at := NULL;
  END IF;

  SELECT player_saves.data INTO data FROM public.player_saves WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_save'); END IF;
  swing_seconds := greatest(0.5, 1 - public.equip_stat(data, 'armor', 'speed')) - 0.15;
  IF NOT public.action_gate(uid, 'combat:global', (swing_seconds || ' seconds')::interval) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'hp', monster.hp, 'tagged_by', monster.tagged_by);
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at) VALUES (uid, 'combat:last', now() + interval '5 seconds')
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  combat_level := public.xp_level(public.skill_xp(data, 'combat'));
  attack_stat := round(3 + combat_level + public.equip_stat(data, 'weapon', 'attack') + public.equip_stat(data, 'armor', 'attack'));
  defense_stat := round(floor(combat_level / 2.0) + public.equip_stat(data, 'armor', 'defense'));
  buff_hits := coalesce((data#>>'{buff,hits}')::integer, 0);
  buff_damage := coalesce((data#>>'{buff,dmg}')::numeric, 0);
  IF buff_hits > 0 AND buff_damage > 0 THEN
    attack_stat := attack_stat + buff_damage; buff_hits := buff_hits - 1;
    IF buff_hits <= 0 THEN data := data - 'buff'; ELSE data := jsonb_set(data, '{buff,hits}', to_jsonb(buff_hits), true); END IF;
  END IF;
  damage := greatest(1, floor(attack_stat * (0.6 + random() * 0.6) - definition.defense * 0.4))::integer;
  monster.hp := greatest(0, monster.hp - damage);
  IF monster.tagged_by IS NULL THEN monster.tagged_by := uid; monster.tagged_at := now(); END IF;
  credited := monster.tagged_by = uid;
  taken := greatest(0, floor(definition.attack * (0.5 + random() * 0.7) - defense_stat * 0.5))::integer;
  IF monster.hp <= 0 THEN killed := true; monster.respawn_at := now() + interval '12 seconds'; END IF;

  UPDATE public.world_monsters SET hp = monster.hp, tagged_by = monster.tagged_by, tagged_at = monster.tagged_at,
    respawn_at = monster.respawn_at, updated_at = now() WHERE id = monster.id;
  before_level := public.xp_level(public.skill_xp(data, 'combat'));
  IF killed AND credited THEN
    data := public.grant_skill_xp(data, 'combat', definition.xp);
    gold_award := definition.gold_min + floor(random() * greatest(1, definition.gold_max - definition.gold_min + 1))::integer;
    data := jsonb_set(data, '{gold}', to_jsonb(coalesce((data->>'gold')::numeric, 0) + gold_award), true);
    IF definition.drop_item IS NOT NULL AND random() < definition.drop_chance THEN
      next_inv := public.inv_add(data->'inv', definition.drop_item, 1);
      IF next_inv IS NULL THEN skipped := skipped || jsonb_build_array(definition.drop_item);
      ELSE data := jsonb_set(data, '{inv}', next_inv, true); loot := loot || jsonb_build_array(jsonb_build_object('item', definition.drop_item, 'qty', 1)); END IF;
    END IF;
    IF definition.hide_item IS NOT NULL THEN
      next_inv := public.inv_add(data->'inv', definition.hide_item, 1);
      IF next_inv IS NULL THEN skipped := skipped || jsonb_build_array(definition.hide_item);
      ELSE
        data := jsonb_set(data, '{inv}', next_inv, true);
        loot := loot || jsonb_build_array(jsonb_build_object('item', definition.hide_item, 'qty', 1));
        IF definition.hide_xp > 0 THEN data := public.grant_skill_xp(data, 'skinning', definition.hide_xp); END IF;
      END IF;
    END IF;
    data := public.advance_quest(data, 'kill', monster.kind);
  END IF;

  settlement := public.settle_incoming_damage(uid, data, taken, definition.name);
  data := settlement->'data'; death := settlement->'death'; food_used := coalesce((settlement->>'food_used')::boolean, false);
  after_level := public.xp_level(public.skill_xp(data, 'combat'));
  UPDATE public.player_saves SET data = data, updated_at = now() WHERE user_id = uid;
  RETURN jsonb_build_object(
    'ok', true, 'hp', monster.hp, 'dmg', damage, 'taken', taken, 'killed', killed,
    'credited', credited, 'kind', monster.kind, 'tagged_by', monster.tagged_by, 'gold', gold_award,
    'loot', loot, 'skipped_loot', skipped, 'xp', CASE WHEN killed AND credited THEN definition.xp ELSE 0 END,
    'leveled', after_level > before_level, 'level', after_level, 'respawn_at', monster.respawn_at,
    'buff', coalesce(data->'buff', 'null'::jsonb), 'death', death, 'food_used', food_used,
    'state', public.pl_state(data)
  );
END $$;

CREATE OR REPLACE FUNCTION public.attack_boss(_x numeric, _y numeric, _bx numeric, _by numeric, _passive boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_variable
DECLARE
  uid uuid := auth.uid(); boss public.world_boss%ROWTYPE; data jsonb; boss_x numeric; boss_y numeric;
  swing_seconds numeric; combat_level integer; attack_stat numeric := 0; defense_stat numeric;
  damage integer := 0; taken integer; killed boolean := false; gold_award integer := 0;
  before_level integer; after_level integer; settlement jsonb; death jsonb; food_used boolean;
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
    IF coalesce((data#>>'{buff,hits}')::integer, 0) > 0 THEN
      attack_stat := attack_stat + coalesce((data#>>'{buff,dmg}')::numeric, 0);
      IF (data#>>'{buff,hits}')::integer <= 1 THEN data := data - 'buff';
      ELSE data := jsonb_set(data, '{buff,hits}', to_jsonb((data#>>'{buff,hits}')::integer - 1), true); END IF;
    END IF;
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
    -- DESOLATUS intentionally has no item drop until Gate 3 assigns a
    -- non-retired reward; this removes the old Tungsten coupling safely.
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
END $$;

REVOKE ALL ON FUNCTION public.harvest_node(integer, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fish_cast(integer, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attack_monster(integer, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.harvest_node(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fish_cast(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attack_monster(integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attack_boss(numeric, numeric, numeric, numeric, boolean) TO authenticated;

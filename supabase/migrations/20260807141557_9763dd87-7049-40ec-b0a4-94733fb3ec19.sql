CREATE TABLE public.world_nodes (
  id int PRIMARY KEY,
  cell text NOT NULL,
  kind text NOT NULL,
  x int NOT NULL,
  y int NOT NULL,
  charges int NOT NULL,
  max_charges int NOT NULL,
  respawn_s int NOT NULL,
  gather_s numeric NOT NULL,
  respawn_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.world_nodes TO authenticated;
GRANT ALL ON public.world_nodes TO service_role;
ALTER TABLE public.world_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players can see shared nodes" ON public.world_nodes FOR SELECT TO authenticated USING (true);
CREATE INDEX world_nodes_cell_idx ON public.world_nodes (cell);

CREATE TABLE public.world_monsters (
  id int PRIMARY KEY,
  cell text NOT NULL,
  kind text NOT NULL,
  x int NOT NULL,
  y int NOT NULL,
  hp int NOT NULL,
  max_hp int NOT NULL,
  tagged_by uuid,
  tagged_at timestamptz,
  respawn_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.world_monsters TO authenticated;
GRANT ALL ON public.world_monsters TO service_role;
ALTER TABLE public.world_monsters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players can see shared monsters" ON public.world_monsters FOR SELECT TO authenticated USING (true);
CREATE INDEX world_monsters_cell_idx ON public.world_monsters (cell);

CREATE TABLE public.world_cooldowns (
  user_id uuid NOT NULL,
  key text NOT NULL,
  next_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, key)
);
GRANT ALL ON public.world_cooldowns TO service_role;
ALTER TABLE public.world_cooldowns ENABLE ROW LEVEL SECURITY;

INSERT INTO public.world_nodes (id,cell,kind,x,y,charges,max_charges,respawn_s,gather_s) VALUES
(0,'0:0','copper',250,210,4,4,9,3.2),
(1,'0:0','copper',350,320,4,4,9,3.2),
(2,'0:0','copper',180,400,4,4,9,3.2),
(3,'1:1','copper',1180,800,4,4,9,3.2),
(4,'1:0','oak',980,200,4,4,8,3),
(5,'1:0','oak',1120,330,4,4,8,3),
(6,'1:0','oak',880,380,4,4,8,3),
(7,'0:1','oak',240,830,4,4,8,3),
(8,'0:1','flax',430,620,4,4,7,2.4),
(9,'0:1','flax',520,560,4,4,7,2.4),
(10,'0:0','flax',150,250,4,4,7,2.4),
(11,'1:1','berries',1000,900,4,4,8,2.8),
(12,'1:1','berries',880,620,4,4,8,2.8),
(13,'2:0','iron',1620,260,4,4,11,4),
(14,'2:0','iron',1720,480,4,4,11,4),
(15,'2:1','iron',1580,700,4,4,11,4),
(16,'3:1','iron',2300,820,4,4,11,4),
(17,'2:0','willow',2020,200,4,4,10,3.8),
(18,'3:0','willow',2160,300,4,4,10,3.8),
(19,'2:0','willow',1920,420,4,4,10,3.8),
(20,'3:0','maple',2450,240,4,4,12,4.4),
(21,'3:0','maple',2580,460,4,4,12,4.4),
(22,'3:1','maple',2380,640,4,4,12,4.4),
(23,'2:1','herbs',1820,780,4,4,10,3.4),
(24,'2:1','herbs',2040,860,4,4,10,3.4),
(25,'3:1','herbs',2600,800,4,4,10,3.4),
(26,'4:0','sandstone',3040,240,4,4,12,4.6),
(27,'4:0','sandstone',3200,420,4,4,12,4.6),
(28,'4:1','sandstone',3000,700,4,4,12,4.6),
(29,'5:0','mithril',3880,300,4,4,15,5.4),
(30,'5:1','mithril',3980,620,4,4,15,5.4),
(31,'5:1','mithril',3700,820,4,4,15,5.4),
(32,'4:1','palm',3420,780,4,4,14,5),
(33,'5:1','palm',3580,860,4,4,14,5),
(34,'4:0','bloom',3320,200,4,4,12,4),
(35,'4:1','bloom',3140,880,4,4,12,4),
(36,'0:2','runite',260,1260,4,4,20,7),
(37,'0:2','runite',420,1420,4,4,20,7),
(38,'0:3','runite',220,1720,4,4,20,7),
(39,'1:2','tungsten',1080,1300,4,4,22,7.6),
(40,'1:3','tungsten',1160,1700,4,4,22,7.6),
(41,'0:2','frostpine',640,1220,4,4,19,6.8),
(42,'1:2','frostpine',780,1380,4,4,19,6.8),
(43,'0:3','frostpine',560,1700,4,4,19,6.8),
(44,'1:3','lichen',900,1860,4,4,16,5.4),
(45,'0:3','lichen',340,1900,4,4,16,5.4),
(46,'2:2','cursed_rock',1700,1300,4,4,17,6),
(47,'2:3','cursed_rock',1920,1620,4,4,17,6),
(48,'4:2','cursed_rock',2900,1400,4,4,17,6),
(49,'3:2','cursed_tree',2220,1240,4,4,17,6),
(50,'3:3','cursed_tree',2480,1520,4,4,17,6),
(51,'4:3','cursed_tree',3300,1700,4,4,17,6),
(52,'2:3','gloomcap',2040,1840,4,4,14,4.8),
(53,'4:2','gloomcap',3100,1240,4,4,14,4.8),
(54,'5:3','gloomcap',3600,1600,4,4,14,4.8);

INSERT INTO public.world_monsters (id,cell,kind,x,y,hp,max_hp) VALUES
(0,'0:1','chicken',560,780,8,8),
(1,'0:1','chicken',660,850,8,8),
(2,'0:1','chicken',470,880,8,8),
(3,'1:1','chicken',760,720,8,8),
(4,'1:1','goblin',980,700,22,22),
(5,'1:1','goblin',1120,620,22,22),
(6,'1:1','goblin',1050,860,22,22),
(7,'2:0','wolf',1780,180,60,60),
(8,'2:0','wolf',1920,300,60,60),
(9,'2:1','wolf',1660,560,60,60),
(10,'3:1','wolf',2100,620,60,60),
(11,'3:0','bear',2300,400,130,130),
(12,'3:1','bear',2500,700,130,130),
(13,'3:1','bear',2220,900,130,130),
(14,'4:1','serpent',3200,560,260,260),
(15,'4:0','serpent',3360,400,260,260),
(16,'4:1','serpent',3100,860,260,260),
(17,'5:0','bandit',3680,200,320,320),
(18,'5:1','bandit',3820,500,320,320),
(19,'5:1','bandit',3560,640,320,320),
(20,'2:2','wraith',1820,1460,620,620),
(21,'3:3','wraith',2300,1700,620,620),
(22,'4:2','wraith',2800,1200,620,620),
(23,'3:3','shadow_beast',2600,1820,820,820),
(24,'4:2','shadow_beast',3200,1460,820,820),
(25,'5:2','shadow_beast',3800,1300,820,820),
(26,'0:3','yeti',520,1500,1500,1500),
(27,'1:3','yeti',820,1620,1500,1500),
(28,'0:3','yeti',640,1880,1500,1500),
(29,'1:2','frost_giant',1000,1480,2200,2200),
(30,'1:3','frost_giant',1240,1880,2200,2200);

CREATE OR REPLACE FUNCTION public.harvest_node(_id int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  n public.world_nodes%ROWTYPE;
  cd timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO n FROM public.world_nodes WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;

  IF n.respawn_at IS NOT NULL AND now() < n.respawn_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'depleted', 'charges', 0, 'respawn_at', n.respawn_at);
  END IF;
  IF n.respawn_at IS NOT NULL THEN
    n.charges := n.max_charges;
    n.respawn_at := NULL;
  END IF;

  SELECT next_at INTO cd FROM public.world_cooldowns WHERE user_id = uid AND key = 'node:' || _id;
  IF cd IS NOT NULL AND now() < cd THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_fast', 'charges', n.charges, 'respawn_at', n.respawn_at);
  END IF;
  INSERT INTO public.world_cooldowns (user_id, key, next_at)
  VALUES (uid, 'node:' || _id, now() + make_interval(secs => n.gather_s * 0.7))
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  n.charges := greatest(0, n.charges - 1);
  IF n.charges = 0 THEN
    n.respawn_at := now() + make_interval(secs => n.respawn_s);
  END IF;

  UPDATE public.world_nodes
     SET charges = n.charges, respawn_at = n.respawn_at, updated_at = now()
   WHERE id = _id;

  RETURN jsonb_build_object('ok', true, 'charges', n.charges, 'respawn_at', n.respawn_at, 'kind', n.kind);
END;
$$;
REVOKE ALL ON FUNCTION public.harvest_node(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.harvest_node(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.harvest_node(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.harvest_node(int) TO service_role;

CREATE OR REPLACE FUNCTION public.damage_monster(_id int, _dmg int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  m public.world_monsters%ROWTYPE;
  cd timestamptz;
  dmg int := least(greatest(coalesce(_dmg, 0), 1), 400);
  killed boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO m FROM public.world_monsters WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing'); END IF;

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
  VALUES (uid, 'mob:' || _id, now() + interval '0.8 seconds')
  ON CONFLICT (user_id, key) DO UPDATE SET next_at = EXCLUDED.next_at;

  IF m.tagged_by IS NULL THEN
    m.tagged_by := uid;
    m.tagged_at := now();
  END IF;

  m.hp := greatest(0, m.hp - dmg);
  IF m.hp = 0 THEN
    killed := true;
    m.respawn_at := now() + interval '12 seconds';
  END IF;

  UPDATE public.world_monsters
     SET hp = m.hp, tagged_by = m.tagged_by, tagged_at = m.tagged_at,
         respawn_at = m.respawn_at, updated_at = now()
   WHERE id = _id;

  RETURN jsonb_build_object(
    'ok', true, 'hp', m.hp, 'max_hp', m.max_hp, 'killed', killed,
    'credited', killed AND m.tagged_by = uid,
    'tagged_by', m.tagged_by, 'respawn_at', m.respawn_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.damage_monster(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.damage_monster(int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.damage_monster(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.damage_monster(int, int) TO service_role;

ALTER TABLE public.world_nodes REPLICA IDENTITY FULL;
ALTER TABLE public.world_monsters REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.world_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.world_monsters;
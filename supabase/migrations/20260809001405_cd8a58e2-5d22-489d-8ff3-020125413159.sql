INSERT INTO public.game_items (id, name, value, kind, stackable, attack, defense, heal) VALUES
 ('river_minnow','River Minnow',8,'resource',true,NULL,NULL,NULL),
 ('silver_trout','Silver Trout',24,'resource',true,NULL,NULL,NULL),
 ('golden_koi','Golden Koi',65,'resource',true,NULL,NULL,NULL),
 ('deepwater_eel','Deepwater Eel',150,'resource',true,NULL,NULL,NULL),
 ('starlight_salmon','Starlight Salmon',320,'resource',true,NULL,NULL,NULL),
 ('phoenix_fillet','Phoenix Fillet',700,'food',true,NULL,NULL,650),
 ('minor_venom_draught','Minor Venom Draught',35,'potion',true,NULL,NULL,NULL),
 ('goblins_fury_tonic','Goblin''s Fury Tonic',90,'potion',true,NULL,NULL,NULL),
 ('serpents_bite_elixir','Serpent''s Bite Elixir',220,'potion',true,NULL,NULL,NULL),
 ('shadow_venom','Shadow Venom',480,'potion',true,NULL,NULL,NULL),
 ('frostfire_brew','Frostfire Brew',900,'potion',true,NULL,NULL,NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, value = EXCLUDED.value, kind = EXCLUDED.kind, heal = EXCLUDED.heal;

INSERT INTO public.game_recipes (id, skill, out_item, out_qty, req, xp, time_s) VALUES
 ('bronze_dagger','smithing','bronze_dagger',1,3,60,2.2),
 ('sunspire_wand','smithing','sunspire_wand',1,45,640,3),
 ('honey_bun','cooking','honey_bun',1,1,30,1.6),
 ('berry_pie','cooking','berry_pie',1,15,110,2),
 ('hearty_stew','cooking','hearty_stew',1,40,340,2.4),
 ('frost_tonic','cooking','frost_tonic',1,70,900,2.8),
 ('phoenix_fillet','cooking','phoenix_fillet',1,100,2200,3.2),
 ('minor_venom_draught','alchemy','minor_venom_draught',1,1,40,1.8),
 ('goblins_fury_tonic','alchemy','goblins_fury_tonic',1,20,180,2.2),
 ('serpents_bite_elixir','alchemy','serpents_bite_elixir',1,45,520,2.6),
 ('shadow_venom','alchemy','shadow_venom',1,75,1400,3),
 ('frostfire_brew','alchemy','frostfire_brew',1,105,3000,3.4)
ON CONFLICT (id) DO UPDATE SET skill = EXCLUDED.skill, out_item = EXCLUDED.out_item, out_qty = EXCLUDED.out_qty, req = EXCLUDED.req, xp = EXCLUDED.xp, time_s = EXCLUDED.time_s;

INSERT INTO public.game_recipe_inputs (recipe_id, item_id, qty) VALUES
 ('bronze_dagger','copper_bar',2),('bronze_dagger','willow_logs',1),('bronze_dagger','goblin_charm',1),
 ('sunspire_wand','mithril_bar',2),('sunspire_wand','willow_logs',2),('sunspire_wand','feather',2),
 ('mithril_blade','maple_logs',1),
 ('tungsten_maul','cursed_bark',1),
 ('linen_cloth','meadow_berries',1),
 ('mystic_cloth','desert_bloom',1),
 ('mystic_robe','frost_lichen',1),
 ('honey_bun','river_minnow',2),
 ('berry_pie','silver_trout',2),('berry_pie','feather',1),
 ('hearty_stew','golden_koi',2),('hearty_stew','goblin_charm',1),
 ('frost_tonic','deepwater_eel',2),('frost_tonic','thick_leather',1),
 ('phoenix_fillet','starlight_salmon',3),('phoenix_fillet','frost_pelt',1),
 ('minor_venom_draught','raw_hide',2),
 ('goblins_fury_tonic','goblin_charm',2),('goblins_fury_tonic','thick_hide',1),
 ('serpents_bite_elixir','scale_hide',2),
 ('shadow_venom','shadow_pelt',2),('shadow_venom','feather',1),
 ('frostfire_brew','frost_pelt',2),('frostfire_brew','goblin_charm',1)
ON CONFLICT (recipe_id, item_id) DO UPDATE SET qty = EXCLUDED.qty;
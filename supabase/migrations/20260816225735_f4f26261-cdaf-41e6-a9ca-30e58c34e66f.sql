insert into public.game_recipe_inputs (recipe_id, item_id, qty) values
('bronze_dagger','ram_horn',1),
('steel_sword','boar_tusk',1),
('iron_mail','lynx_claw',1),
('mithril_blade','jackal_fang',1),
('mithril_plate','scorpion_stinger',1),
('runite_greatsword','ghoul_essence',1),
('runite_plate','reaper_bone',1),
('tungsten_maul','frost_fang',1),
('frostguard_plate','wraith_ice_core',1);

insert into public.game_recipes (id, skill, out_item, out_qty, req, xp, time_s)
values ('wyrmscale_plate','smithing','wyrmscale_plate',1,120,3600,4.2);

insert into public.game_recipe_inputs (recipe_id, item_id, qty) values
('wyrmscale_plate','tungsten_bar',6),
('wyrmscale_plate','wyrm_scale',3);
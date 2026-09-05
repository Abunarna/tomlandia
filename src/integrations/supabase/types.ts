export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      game_boss_path_points: {
        Row: {
          seq: number
          x: number
          y: number
        }
        Insert: {
          seq: number
          x: number
          y: number
        }
        Update: {
          seq?: number
          x?: number
          y?: number
        }
        Relationships: []
      }
      game_content_bosses: {
        Row: {
          active: boolean
          attack: number
          content_version: string
          defense: number
          gold_per_player_cap_max: number
          gold_per_player_cap_min: number
          gold_pool_max: number
          gold_pool_min: number
          hp: number
          id: string
          level_requirement: number
          minimum_damage: number
          name: string
          respawn_s: number
          reward_mode: string
          rewards: Json
          target_contributors: number
          visual_key: string
          xp_per_player_cap: number
          xp_pool: number
        }
        Insert: {
          active: boolean
          attack: number
          content_version: string
          defense: number
          gold_per_player_cap_max: number
          gold_per_player_cap_min: number
          gold_pool_max: number
          gold_pool_min: number
          hp: number
          id: string
          level_requirement: number
          minimum_damage: number
          name: string
          respawn_s: number
          reward_mode: string
          rewards: Json
          target_contributors: number
          visual_key: string
          xp_per_player_cap: number
          xp_pool: number
        }
        Update: {
          active?: boolean
          attack?: number
          content_version?: string
          defense?: number
          gold_per_player_cap_max?: number
          gold_per_player_cap_min?: number
          gold_pool_max?: number
          gold_pool_min?: number
          hp?: number
          id?: string
          level_requirement?: number
          minimum_damage?: number
          name?: string
          respawn_s?: number
          reward_mode?: string
          rewards?: Json
          target_contributors?: number
          visual_key?: string
          xp_per_player_cap?: number
          xp_pool?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_content_bosses_content_version_fkey"
            columns: ["content_version"]
            isOneToOne: false
            referencedRelation: "game_content_versions"
            referencedColumns: ["content_version"]
          },
        ]
      }
      game_content_control: {
        Row: {
          activation_timestamp: string
          active_content_version: string
          active_spawn_set_version: string
          maintenance_message: string
          maintenance_mode: boolean
          manifest_hash: string
          migration_run_id: string
          minimum_client_content_version: string
          singleton: boolean
        }
        Insert: {
          activation_timestamp: string
          active_content_version: string
          active_spawn_set_version: string
          maintenance_message: string
          maintenance_mode: boolean
          manifest_hash: string
          migration_run_id: string
          minimum_client_content_version: string
          singleton?: boolean
        }
        Update: {
          activation_timestamp?: string
          active_content_version?: string
          active_spawn_set_version?: string
          maintenance_message?: string
          maintenance_mode?: boolean
          manifest_hash?: string
          migration_run_id?: string
          minimum_client_content_version?: string
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "game_content_control_active_content_version_active_spawn_s_fkey"
            columns: ["active_content_version", "active_spawn_set_version"]
            isOneToOne: false
            referencedRelation: "game_content_versions"
            referencedColumns: ["content_version", "spawn_set_version"]
          },
          {
            foreignKeyName: "game_content_control_minimum_client_content_version_fkey"
            columns: ["minimum_client_content_version"]
            isOneToOne: false
            referencedRelation: "game_content_versions"
            referencedColumns: ["content_version"]
          },
        ]
      }
      game_content_fish: {
        Row: {
          active: boolean
          content_version: string
          item_id: string
          level_requirement: number
          tier_index: number
          weights: Json
          xp: number
        }
        Insert: {
          active: boolean
          content_version: string
          item_id: string
          level_requirement: number
          tier_index: number
          weights: Json
          xp: number
        }
        Update: {
          active?: boolean
          content_version?: string
          item_id?: string
          level_requirement?: number
          tier_index?: number
          weights?: Json
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_content_fish_content_version_item_id_fkey"
            columns: ["content_version", "item_id"]
            isOneToOne: true
            referencedRelation: "game_content_items"
            referencedColumns: ["content_version", "id"]
          },
          {
            foreignKeyName: "game_content_fish_tier_band_fkey"
            columns: ["content_version", "tier_index"]
            isOneToOne: false
            referencedRelation: "game_content_tiers"
            referencedColumns: ["content_version", "tier_index"]
          },
        ]
      }
      game_content_fishing_spots: {
        Row: {
          active: boolean
          biome: string
          content_version: string
          fish_item_ids: Json
          id: string
          subzone: string
          x: number
          y: number
        }
        Insert: {
          active: boolean
          biome: string
          content_version: string
          fish_item_ids: Json
          id: string
          subzone: string
          x: number
          y: number
        }
        Update: {
          active?: boolean
          biome?: string
          content_version?: string
          fish_item_ids?: Json
          id?: string
          subzone?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_content_fishing_spots_content_version_fkey"
            columns: ["content_version"]
            isOneToOne: false
            referencedRelation: "game_content_versions"
            referencedColumns: ["content_version"]
          },
        ]
      }
      game_content_items: {
        Row: {
          active: boolean
          attack: number
          boost_hits: number
          colour: string
          content_version: string
          defense: number
          dmg_boost: number
          equip_skill: string | null
          family: string
          heal: number
          icon_key: string
          id: string
          kind: string
          level_requirement: number
          name: string
          rarity: string
          speed: number
          stackable: boolean
          strength_pct: number
          tier_index: number
          tradable: boolean
          value: number
        }
        Insert: {
          active: boolean
          attack: number
          boost_hits: number
          colour: string
          content_version: string
          defense: number
          dmg_boost: number
          equip_skill?: string | null
          family: string
          heal: number
          icon_key: string
          id: string
          kind: string
          level_requirement: number
          name: string
          rarity: string
          speed: number
          stackable: boolean
          strength_pct?: number
          tier_index: number
          tradable: boolean
          value: number
        }
        Update: {
          active?: boolean
          attack?: number
          boost_hits?: number
          colour?: string
          content_version?: string
          defense?: number
          dmg_boost?: number
          equip_skill?: string | null
          family?: string
          heal?: number
          icon_key?: string
          id?: string
          kind?: string
          level_requirement?: number
          name?: string
          rarity?: string
          speed?: number
          stackable?: boolean
          strength_pct?: number
          tier_index?: number
          tradable?: boolean
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_content_items_tier_band_fkey"
            columns: ["content_version", "tier_index"]
            isOneToOne: false
            referencedRelation: "game_content_tiers"
            referencedColumns: ["content_version", "tier_index"]
          },
        ]
      }
      game_content_migration_rules: {
        Row: {
          action: string
          captured_value_required: boolean
          content_version: string
          equipped_action: string | null
          from_id: string
          notice_key: string
          to_id: string | null
          unequipped_action: string | null
        }
        Insert: {
          action: string
          captured_value_required: boolean
          content_version: string
          equipped_action?: string | null
          from_id: string
          notice_key: string
          to_id?: string | null
          unequipped_action?: string | null
        }
        Update: {
          action?: string
          captured_value_required?: boolean
          content_version?: string
          equipped_action?: string | null
          from_id?: string
          notice_key?: string
          to_id?: string | null
          unequipped_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_content_migration_rules_content_version_fkey"
            columns: ["content_version"]
            isOneToOne: false
            referencedRelation: "game_content_versions"
            referencedColumns: ["content_version"]
          },
        ]
      }
      game_content_monster_loot: {
        Row: {
          chance: number
          channel: string
          content_version: string
          item_id: string
          monster_kind: string
          ordinal: number
          qty_max: number
          qty_min: number
          xp: number
        }
        Insert: {
          chance: number
          channel: string
          content_version: string
          item_id: string
          monster_kind: string
          ordinal: number
          qty_max: number
          qty_min: number
          xp: number
        }
        Update: {
          chance?: number
          channel?: string
          content_version?: string
          item_id?: string
          monster_kind?: string
          ordinal?: number
          qty_max?: number
          qty_min?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_content_monster_loot_content_version_item_id_fkey"
            columns: ["content_version", "item_id"]
            isOneToOne: false
            referencedRelation: "game_content_items"
            referencedColumns: ["content_version", "id"]
          },
          {
            foreignKeyName: "game_content_monster_loot_content_version_monster_kind_fkey"
            columns: ["content_version", "monster_kind"]
            isOneToOne: false
            referencedRelation: "game_content_monsters"
            referencedColumns: ["content_version", "kind"]
          },
        ]
      }
      game_content_monsters: {
        Row: {
          active: boolean
          attack: number
          content_version: string
          defense: number
          gold_max: number
          gold_min: number
          hp: number
          kind: string
          level_requirement: number
          name: string
          respawn_s: number
          tier_index: number
          visual: Json
          visual_key: string
          xp: number
        }
        Insert: {
          active: boolean
          attack: number
          content_version: string
          defense: number
          gold_max: number
          gold_min: number
          hp: number
          kind: string
          level_requirement: number
          name: string
          respawn_s: number
          tier_index: number
          visual: Json
          visual_key: string
          xp: number
        }
        Update: {
          active?: boolean
          attack?: number
          content_version?: string
          defense?: number
          gold_max?: number
          gold_min?: number
          hp?: number
          kind?: string
          level_requirement?: number
          name?: string
          respawn_s?: number
          tier_index?: number
          visual?: Json
          visual_key?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_content_monsters_tier_band_fkey"
            columns: ["content_version", "tier_index"]
            isOneToOne: false
            referencedRelation: "game_content_tiers"
            referencedColumns: ["content_version", "tier_index"]
          },
        ]
      }
      game_content_nodes: {
        Row: {
          active: boolean
          cluster_min: number
          colour: string
          content_version: string
          family: string
          gather_s: number
          item_id: string
          kind: string
          level_requirement: number
          max_charges: number
          name: string
          respawn_s: number
          shape: string
          skill: string
          tier_index: number
          visual_key: string
          xp: number
        }
        Insert: {
          active: boolean
          cluster_min: number
          colour: string
          content_version: string
          family: string
          gather_s: number
          item_id: string
          kind: string
          level_requirement: number
          max_charges: number
          name: string
          respawn_s: number
          shape: string
          skill: string
          tier_index: number
          visual_key: string
          xp: number
        }
        Update: {
          active?: boolean
          cluster_min?: number
          colour?: string
          content_version?: string
          family?: string
          gather_s?: number
          item_id?: string
          kind?: string
          level_requirement?: number
          max_charges?: number
          name?: string
          respawn_s?: number
          shape?: string
          skill?: string
          tier_index?: number
          visual_key?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_content_nodes_content_version_item_id_fkey"
            columns: ["content_version", "item_id"]
            isOneToOne: false
            referencedRelation: "game_content_items"
            referencedColumns: ["content_version", "id"]
          },
          {
            foreignKeyName: "game_content_nodes_tier_band_fkey"
            columns: ["content_version", "tier_index"]
            isOneToOne: false
            referencedRelation: "game_content_tiers"
            referencedColumns: ["content_version", "tier_index"]
          },
        ]
      }
      game_content_progression_levels: {
        Row: {
          content_version: string
          cumulative_xp: number
          level: number
          xp_to_next: number | null
        }
        Insert: {
          content_version: string
          cumulative_xp: number
          level: number
          xp_to_next?: number | null
        }
        Update: {
          content_version?: string
          cumulative_xp?: number
          level?: number
          xp_to_next?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_content_progression_levels_content_version_fkey"
            columns: ["content_version"]
            isOneToOne: false
            referencedRelation: "game_content_versions"
            referencedColumns: ["content_version"]
          },
        ]
      }
      game_content_quests: {
        Row: {
          active: boolean
          content_version: string
          count: number
          description: string
          gold: number
          id: string
          kind: string
          level_requirement: number
          name: string
          reward_items: Json
          target_id: string
          tier_index: number
          xp: number
          xp_skill: string
        }
        Insert: {
          active: boolean
          content_version: string
          count: number
          description: string
          gold: number
          id: string
          kind: string
          level_requirement: number
          name: string
          reward_items: Json
          target_id: string
          tier_index: number
          xp: number
          xp_skill: string
        }
        Update: {
          active?: boolean
          content_version?: string
          count?: number
          description?: string
          gold?: number
          id?: string
          kind?: string
          level_requirement?: number
          name?: string
          reward_items?: Json
          target_id?: string
          tier_index?: number
          xp?: number
          xp_skill?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_content_quests_tier_band_fkey"
            columns: ["content_version", "tier_index"]
            isOneToOne: false
            referencedRelation: "game_content_tiers"
            referencedColumns: ["content_version", "tier_index"]
          },
        ]
      }
      game_content_recipe_inputs: {
        Row: {
          content_version: string
          item_id: string
          qty: number
          recipe_id: string
        }
        Insert: {
          content_version: string
          item_id: string
          qty: number
          recipe_id: string
        }
        Update: {
          content_version?: string
          item_id?: string
          qty?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_content_recipe_inputs_content_version_item_id_fkey"
            columns: ["content_version", "item_id"]
            isOneToOne: false
            referencedRelation: "game_content_items"
            referencedColumns: ["content_version", "id"]
          },
          {
            foreignKeyName: "game_content_recipe_inputs_content_version_recipe_id_fkey"
            columns: ["content_version", "recipe_id"]
            isOneToOne: false
            referencedRelation: "game_content_recipes"
            referencedColumns: ["content_version", "id"]
          },
        ]
      }
      game_content_recipes: {
        Row: {
          active: boolean
          content_version: string
          id: string
          level_requirement: number
          output_item_id: string
          output_qty: number
          skill: string
          station: string
          tier_index: number
          time_s: number
          xp: number
        }
        Insert: {
          active: boolean
          content_version: string
          id: string
          level_requirement: number
          output_item_id: string
          output_qty: number
          skill: string
          station: string
          tier_index: number
          time_s: number
          xp: number
        }
        Update: {
          active?: boolean
          content_version?: string
          id?: string
          level_requirement?: number
          output_item_id?: string
          output_qty?: number
          skill?: string
          station?: string
          tier_index?: number
          time_s?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_content_recipes_content_version_output_item_id_fkey"
            columns: ["content_version", "output_item_id"]
            isOneToOne: false
            referencedRelation: "game_content_items"
            referencedColumns: ["content_version", "id"]
          },
          {
            foreignKeyName: "game_content_recipes_tier_band_fkey"
            columns: ["content_version", "tier_index"]
            isOneToOne: false
            referencedRelation: "game_content_tiers"
            referencedColumns: ["content_version", "tier_index"]
          },
        ]
      }
      game_content_spawns: {
        Row: {
          active: boolean
          biome: string
          content_version: string
          entity_type: string
          kind: string
          ordinal: number
          spawn_id: string
          spawn_set_version: string
          subzone: string
          x: number
          y: number
        }
        Insert: {
          active: boolean
          biome: string
          content_version: string
          entity_type: string
          kind: string
          ordinal: number
          spawn_id: string
          spawn_set_version: string
          subzone: string
          x: number
          y: number
        }
        Update: {
          active?: boolean
          biome?: string
          content_version?: string
          entity_type?: string
          kind?: string
          ordinal?: number
          spawn_id?: string
          spawn_set_version?: string
          subzone?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_content_spawns_content_version_spawn_set_version_fkey"
            columns: ["content_version", "spawn_set_version"]
            isOneToOne: false
            referencedRelation: "game_content_versions"
            referencedColumns: ["content_version", "spawn_set_version"]
          },
        ]
      }
      game_content_tiers: {
        Row: {
          content_version: string
          level_requirement: number
          palette: Json
          theme: string
          tier_index: number
        }
        Insert: {
          content_version: string
          level_requirement: number
          palette: Json
          theme: string
          tier_index: number
        }
        Update: {
          content_version?: string
          level_requirement?: number
          palette?: Json
          theme?: string
          tier_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_content_tiers_content_version_fkey"
            columns: ["content_version"]
            isOneToOne: false
            referencedRelation: "game_content_versions"
            referencedColumns: ["content_version"]
          },
        ]
      }
      game_content_versions: {
        Row: {
          activated_at: string | null
          content_version: string
          created_at: string
          manifest_hash: string
          mechanics: Json
          player_notice: Json
          spawn_set_version: string
          starter_loadout: Json
          status: string
          uuid_namespace: string
        }
        Insert: {
          activated_at?: string | null
          content_version: string
          created_at?: string
          manifest_hash: string
          mechanics?: Json
          player_notice?: Json
          spawn_set_version: string
          starter_loadout?: Json
          status?: string
          uuid_namespace: string
        }
        Update: {
          activated_at?: string | null
          content_version?: string
          created_at?: string
          manifest_hash?: string
          mechanics?: Json
          player_notice?: Json
          spawn_set_version?: string
          starter_loadout?: Json
          status?: string
          uuid_namespace?: string
        }
        Relationships: []
      }
      game_fish: {
        Row: {
          item_id: string
          w1: number
          w100: number
          w15: number
          w40: number
          w70: number
          xp: number
        }
        Insert: {
          item_id: string
          w1: number
          w100: number
          w15: number
          w40: number
          w70: number
          xp: number
        }
        Update: {
          item_id?: string
          w1?: number
          w100?: number
          w15?: number
          w40?: number
          w70?: number
          xp?: number
        }
        Relationships: []
      }
      game_fishing_spots: {
        Row: {
          id: number
          lake: string
          x: number
          y: number
        }
        Insert: {
          id: number
          lake: string
          x: number
          y: number
        }
        Update: {
          id?: number
          lake?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      game_items: {
        Row: {
          attack: number | null
          boost_hits: number | null
          defense: number | null
          dmg_boost: number | null
          heal: number | null
          id: string
          kind: string
          name: string
          speed: number | null
          stackable: boolean
          untradable: boolean
          value: number
        }
        Insert: {
          attack?: number | null
          boost_hits?: number | null
          defense?: number | null
          dmg_boost?: number | null
          heal?: number | null
          id: string
          kind: string
          name: string
          speed?: number | null
          stackable?: boolean
          untradable?: boolean
          value?: number
        }
        Update: {
          attack?: number | null
          boost_hits?: number | null
          defense?: number | null
          dmg_boost?: number | null
          heal?: number | null
          id?: string
          kind?: string
          name?: string
          speed?: number | null
          stackable?: boolean
          untradable?: boolean
          value?: number
        }
        Relationships: []
      }
      game_monster_defs: {
        Row: {
          attack: number
          defense: number
          drop_chance: number
          drop_item: string | null
          gold_max: number
          gold_min: number
          hide_item: string | null
          hide_xp: number
          hp: number
          kind: string
          name: string
          xp: number
        }
        Insert: {
          attack: number
          defense: number
          drop_chance?: number
          drop_item?: string | null
          gold_max?: number
          gold_min?: number
          hide_item?: string | null
          hide_xp?: number
          hp: number
          kind: string
          name: string
          xp: number
        }
        Update: {
          attack?: number
          defense?: number
          drop_chance?: number
          drop_item?: string | null
          gold_max?: number
          gold_min?: number
          hide_item?: string | null
          hide_xp?: number
          hp?: number
          kind?: string
          name?: string
          xp?: number
        }
        Relationships: []
      }
      game_node_defs: {
        Row: {
          item_id: string
          kind: string
          name: string
          req: number
          skill: string
          time_s: number
          xp: number
        }
        Insert: {
          item_id: string
          kind: string
          name: string
          req?: number
          skill: string
          time_s?: number
          xp: number
        }
        Update: {
          item_id?: string
          kind?: string
          name?: string
          req?: number
          skill?: string
          time_s?: number
          xp?: number
        }
        Relationships: []
      }
      game_quests: {
        Row: {
          gold: number
          id: string
          kind: string
          name: string
          reward_item: string | null
          target_count: number
          target_key: string
          xp: number
          xp_skill: string
        }
        Insert: {
          gold: number
          id: string
          kind: string
          name: string
          reward_item?: string | null
          target_count: number
          target_key: string
          xp: number
          xp_skill: string
        }
        Update: {
          gold?: number
          id?: string
          kind?: string
          name?: string
          reward_item?: string | null
          target_count?: number
          target_key?: string
          xp?: number
          xp_skill?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_quests_reward_item_fkey"
            columns: ["reward_item"]
            isOneToOne: false
            referencedRelation: "game_items"
            referencedColumns: ["id"]
          },
        ]
      }
      game_recipe_inputs: {
        Row: {
          item_id: string
          qty: number
          recipe_id: string
        }
        Insert: {
          item_id: string
          qty: number
          recipe_id: string
        }
        Update: {
          item_id?: string
          qty?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_recipe_inputs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "game_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      game_recipes: {
        Row: {
          id: string
          out_item: string
          out_qty: number
          req: number
          skill: string
          time_s: number
          xp: number
        }
        Insert: {
          id: string
          out_item: string
          out_qty?: number
          req?: number
          skill: string
          time_s?: number
          xp?: number
        }
        Update: {
          id?: string
          out_item?: string
          out_qty?: number
          req?: number
          skill?: string
          time_s?: number
          xp?: number
        }
        Relationships: []
      }
      game_release_control: {
        Row: {
          maintenance_message: string
          maintenance_mode: boolean
          minimum_client_content_version: string
          minimum_client_protocol: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          maintenance_message?: string
          maintenance_mode?: boolean
          minimum_client_content_version?: string
          minimum_client_protocol?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          maintenance_message?: string
          maintenance_mode?: boolean
          minimum_client_content_version?: string
          minimum_client_protocol?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      game_starter_templates: {
        Row: {
          active: boolean
          created_at: string
          data: Json
          version: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          data: Json
          version: string
        }
        Update: {
          active?: boolean
          created_at?: string
          data?: Json
          version?: string
        }
        Relationships: []
      }
      game_world_monsters: {
        Row: {
          biome: string
          cell: string
          content_version: string
          entity_type: string
          hp: number
          kind: string
          max_hp: number
          respawn_at: string | null
          respawn_s: number
          spawn_id: string
          spawn_set_version: string
          subzone: string
          tagged_at: string | null
          tagged_by: string | null
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          biome: string
          cell: string
          content_version: string
          entity_type?: string
          hp: number
          kind: string
          max_hp: number
          respawn_at?: string | null
          respawn_s: number
          spawn_id: string
          spawn_set_version: string
          subzone: string
          tagged_at?: string | null
          tagged_by?: string | null
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          biome?: string
          cell?: string
          content_version?: string
          entity_type?: string
          hp?: number
          kind?: string
          max_hp?: number
          respawn_at?: string | null
          respawn_s?: number
          spawn_id?: string
          spawn_set_version?: string
          subzone?: string
          tagged_at?: string | null
          tagged_by?: string | null
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_world_monsters_content_version_kind_fkey"
            columns: ["content_version", "kind"]
            isOneToOne: false
            referencedRelation: "game_content_monsters"
            referencedColumns: ["content_version", "kind"]
          },
          {
            foreignKeyName: "game_world_monsters_content_version_spawn_set_version_fkey"
            columns: ["content_version", "spawn_set_version"]
            isOneToOne: false
            referencedRelation: "game_world_spawn_sets"
            referencedColumns: ["content_version", "spawn_set_version"]
          },
          {
            foreignKeyName: "game_world_monsters_spawn_id_content_version_spawn_set_ver_fkey"
            columns: [
              "spawn_id",
              "content_version",
              "spawn_set_version",
              "entity_type",
              "kind",
            ]
            isOneToOne: false
            referencedRelation: "game_content_spawns"
            referencedColumns: [
              "spawn_id",
              "content_version",
              "spawn_set_version",
              "entity_type",
              "kind",
            ]
          },
        ]
      }
      game_world_nodes: {
        Row: {
          biome: string
          cell: string
          charges: number
          content_version: string
          entity_type: string
          gather_s: number
          kind: string
          max_charges: number
          respawn_at: string | null
          respawn_s: number
          spawn_id: string
          spawn_set_version: string
          subzone: string
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          biome: string
          cell: string
          charges: number
          content_version: string
          entity_type?: string
          gather_s: number
          kind: string
          max_charges: number
          respawn_at?: string | null
          respawn_s: number
          spawn_id: string
          spawn_set_version: string
          subzone: string
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          biome?: string
          cell?: string
          charges?: number
          content_version?: string
          entity_type?: string
          gather_s?: number
          kind?: string
          max_charges?: number
          respawn_at?: string | null
          respawn_s?: number
          spawn_id?: string
          spawn_set_version?: string
          subzone?: string
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_world_nodes_content_version_kind_fkey"
            columns: ["content_version", "kind"]
            isOneToOne: false
            referencedRelation: "game_content_nodes"
            referencedColumns: ["content_version", "kind"]
          },
          {
            foreignKeyName: "game_world_nodes_content_version_spawn_set_version_fkey"
            columns: ["content_version", "spawn_set_version"]
            isOneToOne: false
            referencedRelation: "game_world_spawn_sets"
            referencedColumns: ["content_version", "spawn_set_version"]
          },
          {
            foreignKeyName: "game_world_nodes_spawn_id_content_version_spawn_set_versio_fkey"
            columns: [
              "spawn_id",
              "content_version",
              "spawn_set_version",
              "entity_type",
              "kind",
            ]
            isOneToOne: false
            referencedRelation: "game_content_spawns"
            referencedColumns: [
              "spawn_id",
              "content_version",
              "spawn_set_version",
              "entity_type",
              "kind",
            ]
          },
        ]
      }
      game_world_spawn_sets: {
        Row: {
          cluster_probability: number
          content_version: string
          created_at: string
          model_version: string
          movement_speed: number
          path_cell_size: number
          reachability_summary: Json
          source_content_manifest_hash: string
          spawn_hash: string
          spawn_set_version: string
          winter_geometry: Json
          world_height: number
          world_width: number
        }
        Insert: {
          cluster_probability: number
          content_version: string
          created_at?: string
          model_version: string
          movement_speed: number
          path_cell_size: number
          reachability_summary: Json
          source_content_manifest_hash: string
          spawn_hash: string
          spawn_set_version: string
          winter_geometry: Json
          world_height: number
          world_width: number
        }
        Update: {
          cluster_probability?: number
          content_version?: string
          created_at?: string
          model_version?: string
          movement_speed?: number
          path_cell_size?: number
          reachability_summary?: Json
          source_content_manifest_hash?: string
          spawn_hash?: string
          spawn_set_version?: string
          winter_geometry?: Json
          world_height?: number
          world_width?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_world_spawn_sets_content_version_spawn_set_version_fkey"
            columns: ["content_version", "spawn_set_version"]
            isOneToOne: true
            referencedRelation: "game_content_versions"
            referencedColumns: ["content_version", "spawn_set_version"]
          },
        ]
      }
      market_listings: {
        Row: {
          content_version: string
          created_at: string
          expires_at: string
          id: string
          item_id: string
          plus: number
          price: number
          qty: number
          seller_id: string | null
          seller_name: string
          updated_at: string
        }
        Insert: {
          content_version?: string
          created_at?: string
          expires_at?: string
          id?: string
          item_id: string
          plus?: number
          price: number
          qty: number
          seller_id?: string | null
          seller_name: string
          updated_at?: string
        }
        Update: {
          content_version?: string
          created_at?: string
          expires_at?: string
          id?: string
          item_id?: string
          plus?: number
          price?: number
          qty?: number
          seller_id?: string | null
          seller_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_prices: {
        Row: {
          content_version: string
          item_id: string
          plus: number
          price: number
          updated_at: string
        }
        Insert: {
          content_version?: string
          item_id: string
          plus?: number
          price: number
          updated_at?: string
        }
        Update: {
          content_version?: string
          item_id?: string
          plus?: number
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      market_trades: {
        Row: {
          buyer_name: string
          content_version: string
          created_at: string
          id: string
          item_id: string
          plus: number
          price: number
          qty: number
          seller_name: string
        }
        Insert: {
          buyer_name: string
          content_version?: string
          created_at?: string
          id?: string
          item_id: string
          plus?: number
          price: number
          qty: number
          seller_name: string
        }
        Update: {
          buyer_name?: string
          content_version?: string
          created_at?: string
          id?: string
          item_id?: string
          plus?: number
          price?: number
          qty?: number
          seller_name?: string
        }
        Relationships: []
      }
      player_positions: {
        Row: {
          updated_at: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          updated_at?: string
          user_id: string
          x: number
          y: number
        }
        Update: {
          updated_at?: string
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      player_save_backups: {
        Row: {
          created_at: string
          data: Json
          id: number
          rev: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: number
          rev?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: number
          rev?: number | null
          user_id?: string
        }
        Relationships: []
      }
      player_saves: {
        Row: {
          data: Json
          rev: number
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          rev?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          rev?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_scores: {
        Row: {
          level: number
          skill: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          level?: number
          skill: string
          updated_at?: string
          user_id: string
          username?: string
        }
        Update: {
          level?: number
          skill?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string
          username_lower: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
          username_lower: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
          username_lower?: string
        }
        Relationships: []
      }
      world_boss: {
        Row: {
          hp: number
          id: number
          max_hp: number
          respawn_at: string | null
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          hp: number
          id: number
          max_hp: number
          respawn_at?: string | null
          updated_at?: string
          x?: number
          y?: number
        }
        Update: {
          hp?: number
          id?: number
          max_hp?: number
          respawn_at?: string | null
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      world_cooldowns: {
        Row: {
          key: string
          next_at: string
          user_id: string
        }
        Insert: {
          key: string
          next_at: string
          user_id: string
        }
        Update: {
          key?: string
          next_at?: string
          user_id?: string
        }
        Relationships: []
      }
      world_monsters: {
        Row: {
          cell: string
          hp: number
          id: number
          kind: string
          max_hp: number
          respawn_at: string | null
          tagged_at: string | null
          tagged_by: string | null
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          cell: string
          hp: number
          id: number
          kind: string
          max_hp: number
          respawn_at?: string | null
          tagged_at?: string | null
          tagged_by?: string | null
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          cell?: string
          hp?: number
          id?: number
          kind?: string
          max_hp?: number
          respawn_at?: string | null
          tagged_at?: string | null
          tagged_by?: string | null
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      world_nodes: {
        Row: {
          cell: string
          charges: number
          gather_s: number
          id: number
          kind: string
          max_charges: number
          respawn_at: string | null
          respawn_s: number
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          cell: string
          charges: number
          gather_s: number
          id: number
          kind: string
          max_charges: number
          respawn_at?: string | null
          respawn_s: number
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          cell?: string
          charges?: number
          gather_s?: number
          id?: number
          kind?: string
          max_charges?: number
          respawn_at?: string | null
          respawn_s?: number
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
    }
    Views: {
      game_runtime_fish: {
        Row: {
          active: boolean | null
          content_version: string | null
          item_id: string | null
          level_requirement: number | null
          tier_index: number | null
          weights: Json | null
          xp: number | null
        }
        Relationships: []
      }
      game_runtime_fishing_spots: {
        Row: {
          active: boolean | null
          biome: string | null
          content_version: string | null
          fish_item_ids: Json | null
          id: string | null
          subzone: string | null
          x: number | null
          y: number | null
        }
        Relationships: []
      }
      game_runtime_items: {
        Row: {
          active: boolean | null
          attack: number | null
          boost_hits: number | null
          colour: string | null
          content_version: string | null
          defense: number | null
          dmg_boost: number | null
          equip_skill: string | null
          family: string | null
          heal: number | null
          icon_key: string | null
          id: string | null
          kind: string | null
          level_requirement: number | null
          name: string | null
          rarity: string | null
          speed: number | null
          stackable: boolean | null
          strength_pct: number | null
          tier_index: number | null
          tradable: boolean | null
          untradable: boolean | null
          value: number | null
        }
        Relationships: []
      }
      game_runtime_monster_loot: {
        Row: {
          chance: number | null
          channel: string | null
          content_version: string | null
          item_id: string | null
          monster_kind: string | null
          ordinal: number | null
          qty_max: number | null
          qty_min: number | null
          xp: number | null
        }
        Relationships: []
      }
      game_runtime_monsters: {
        Row: {
          active: boolean | null
          attack: number | null
          content_version: string | null
          defense: number | null
          gold_max: number | null
          gold_min: number | null
          hp: number | null
          kind: string | null
          level_requirement: number | null
          name: string | null
          respawn_s: number | null
          tier_index: number | null
          visual: Json | null
          visual_key: string | null
          xp: number | null
        }
        Relationships: []
      }
      game_runtime_nodes: {
        Row: {
          active: boolean | null
          content_version: string | null
          gather_s: number | null
          item_id: string | null
          kind: string | null
          level_requirement: number | null
          max_charges: number | null
          name: string | null
          respawn_s: number | null
          skill: string | null
          tier_index: number | null
          visual_key: string | null
          xp: number | null
        }
        Relationships: []
      }
      game_runtime_quests: {
        Row: {
          active: boolean | null
          content_version: string | null
          count: number | null
          description: string | null
          gold: number | null
          id: string | null
          kind: string | null
          level_requirement: number | null
          name: string | null
          reward_items: Json | null
          target_id: string | null
          tier_index: number | null
          xp: number | null
          xp_skill: string | null
        }
        Relationships: []
      }
      game_runtime_recipe_inputs: {
        Row: {
          content_version: string | null
          item_id: string | null
          qty: number | null
          recipe_id: string | null
        }
        Relationships: []
      }
      game_runtime_recipes: {
        Row: {
          active: boolean | null
          content_version: string | null
          id: string | null
          level_requirement: number | null
          output_item_id: string | null
          output_qty: number | null
          req: number | null
          skill: string | null
          station: string | null
          tier_index: number | null
          time_s: number | null
          xp: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      action_gate: {
        Args: { _key: string; _uid: string; _wait: string }
        Returns: boolean
      }
      active_starter_save: { Args: never; Returns: Json }
      advance_quest: {
        Args: { _data: Json; _key: string; _kind: string }
        Returns: Json
      }
      apply_strength_buff: {
        Args: { _base_attack: number; _data: Json }
        Returns: Json
      }
      attack_boss: {
        Args: {
          _bx: number
          _by: number
          _passive?: boolean
          _x: number
          _y: number
        }
        Returns: Json
      }
      attack_boss_v1: {
        Args: {
          _bx: number
          _by: number
          _passive?: boolean
          _x: number
          _y: number
        }
        Returns: Json
      }
      attack_monster: {
        Args: { _id: number; _x: number; _y: number }
        Returns: Json
      }
      attack_monster_v1: {
        Args: { _id: number; _x: number; _y: number }
        Returns: Json
      }
      attack_monster_v2: {
        Args: { _id: string; _x: number; _y: number }
        Returns: Json
      }
      bank_gold: { Args: { _amount: number; _dir: string }; Returns: Json }
      bank_gold_v1: { Args: { _amount: number; _dir: string }; Returns: Json }
      bank_item: {
        Args: { _dir: string; _index: number; _qty: number }
        Returns: Json
      }
      bank_item_v1: {
        Args: { _dir: string; _index: number; _qty: number }
        Returns: Json
      }
      boss_position_at: {
        Args: { _at: string }
        Returns: {
          x: number
          y: number
        }[]
      }
      clear_stale_food: { Args: { _data: Json }; Returns: Json }
      consume_food: { Args: { _index: number }; Returns: Json }
      consume_food_v1: { Args: { _index: number }; Returns: Json }
      craft_item: { Args: { _recipe: string }; Returns: Json }
      craft_item_v1: { Args: { _recipe: string }; Returns: Json }
      equip_stat: {
        Args: { _data: Json; _stat: string; _which: string }
        Returns: number
      }
      fish_cast: {
        Args: { _spot: number; _x: number; _y: number }
        Returns: Json
      }
      fish_cast_v1: {
        Args: { _spot: number; _x: number; _y: number }
        Returns: Json
      }
      game_active_content_version: { Args: never; Returns: string }
      game_active_spawn_set_version: { Args: never; Returns: string }
      game_assert_action_allowed: {
        Args: { _legacy_world_contract?: boolean }
        Returns: undefined
      }
      game_assert_content_version: {
        Args: { _content_version: string }
        Returns: undefined
      }
      game_cumulative_upgrade_spend: {
        Args: { _item_value: number; _plus: number }
        Returns: number
      }
      game_level_for_xp: { Args: { _xp: number }; Returns: number }
      game_request_client_protocol: { Args: never; Returns: number }
      game_runtime_catalog: { Args: never; Returns: Json }
      game_runtime_status: { Args: never; Returns: Json }
      game_upgrade_step_cost: {
        Args: { _item_value: number; _next_plus: number }
        Returns: number
      }
      game_validate_content_version: {
        Args: { _content_version: string }
        Returns: {
          detail: string
          issue_code: string
          reference_path: string
        }[]
      }
      game_world_runtime_status: { Args: never; Returns: Json }
      gear_equip: { Args: { _index: number }; Returns: Json }
      gear_equip_v1: { Args: { _index: number }; Returns: Json }
      gear_upgrade: { Args: { _which: string }; Returns: Json }
      gear_upgrade_v1: { Args: { _which: string }; Returns: Json }
      grant_skill_xp: {
        Args: { _amount: number; _data: Json; _skill: string }
        Returns: Json
      }
      harvest_node: {
        Args: { _id: number; _x: number; _y: number }
        Returns: Json
      }
      harvest_node_v1: {
        Args: { _id: number; _x: number; _y: number }
        Returns: Json
      }
      harvest_node_v2: {
        Args: { _id: string; _x: number; _y: number }
        Returns: Json
      }
      inv_add: {
        Args: { _inv: Json; _item: string; _qty: number }
        Returns: Json
      }
      inv_count: { Args: { _inv: Json; _item: string }; Returns: number }
      inv_drop: { Args: { _index: number }; Returns: Json }
      inv_drop_v1: { Args: { _index: number }; Returns: Json }
      inv_remove: {
        Args: { _inv: Json; _item: string; _qty: number }
        Returns: Json
      }
      inv_sell: { Args: { _index: number }; Returns: Json }
      inv_sell_v1: { Args: { _index: number }; Returns: Json }
      leaderboard: { Args: { _skill: string }; Returns: Json }
      market_browse: { Args: never; Returns: Json }
      market_browse_v1: { Args: never; Returns: Json }
      market_buy: { Args: { _id: string; _qty?: number }; Returns: Json }
      market_buy_v1: { Args: { _id: string; _qty?: number }; Returns: Json }
      market_cancel: { Args: { _id: string }; Returns: Json }
      market_cancel_v1: { Args: { _id: string }; Returns: Json }
      market_expire: { Args: never; Returns: undefined }
      market_list: {
        Args: { _item: string; _plus?: number; _price: number; _qty: number }
        Returns: Json
      }
      market_list_v1: {
        Args: { _item: string; _plus?: number; _price: number; _qty: number }
        Returns: Json
      }
      market_player_name: { Args: { _uid: string }; Returns: string }
      mk_inv_give: {
        Args: { _inv: Json; _item: string; _plus: number; _qty: number }
        Returns: Json
      }
      mk_inv_take: {
        Args: { _inv: Json; _item: string; _plus: number; _qty: number }
        Returns: Json
      }
      pl_state: { Args: { _d: Json }; Returns: Json }
      player_max_hp: { Args: { _data: Json }; Returns: number }
      player_recover: { Args: never; Returns: Json }
      player_recover_v1: { Args: never; Returns: Json }
      player_sync: { Args: { _data: Json; _rev?: number }; Returns: Json }
      player_sync_v1: { Args: { _data: Json; _rev?: number }; Returns: Json }
      profile_set_username: { Args: { _username: string }; Returns: Json }
      profile_set_username_v1: { Args: { _username: string }; Returns: Json }
      quest_action: {
        Args: { _action: string; _quest?: string }
        Returns: Json
      }
      quest_action_v1: {
        Args: { _action: string; _quest?: string }
        Returns: Json
      }
      save_is_fresh: { Args: { _d: Json }; Returns: boolean }
      save_total_xp: { Args: { _d: Json }; Returns: number }
      sell_all_resources: { Args: never; Returns: Json }
      sell_all_resources_v1: { Args: never; Returns: Json }
      settle_incoming_damage: {
        Args: { _data: Json; _killer: string; _taken: number; _uid: string }
        Returns: Json
      }
      skill_xp: { Args: { _data: Json; _skill: string }; Returns: number }
      slot_add: {
        Args: {
          _arr: Json
          _id: string
          _plus: number
          _qty: number
          _size: number
          _stackable: boolean
        }
        Returns: Json
      }
      track_position: {
        Args: { _uid: string; _x: number; _y: number }
        Returns: boolean
      }
      try_auto_eat: { Args: { _data: Json; _uid: string }; Returns: Json }
      use_potion: { Args: { _item: string }; Returns: Json }
      use_potion_v1: { Args: { _item: string }; Returns: Json }
      xp_level: { Args: { _xp: number }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      game_items: {
        Row: {
          attack: number | null
          defense: number | null
          heal: number | null
          id: string
          kind: string
          name: string
          stackable: boolean
          value: number
        }
        Insert: {
          attack?: number | null
          defense?: number | null
          heal?: number | null
          id: string
          kind: string
          name: string
          stackable?: boolean
          value?: number
        }
        Update: {
          attack?: number | null
          defense?: number | null
          heal?: number | null
          id?: string
          kind?: string
          name?: string
          stackable?: boolean
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
      player_saves: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
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
      [_ in never]: never
    }
    Functions: {
      attack_monster: {
        Args: { _id: number; _x: number; _y: number }
        Returns: Json
      }
      craft_item: { Args: { _recipe: string }; Returns: Json }
      equip_stat: {
        Args: { _data: Json; _stat: string; _which: string }
        Returns: number
      }
      grant_skill_xp: {
        Args: { _amount: number; _data: Json; _skill: string }
        Returns: Json
      }
      harvest_node: {
        Args: { _id: number; _x: number; _y: number }
        Returns: Json
      }
      inv_add: {
        Args: { _inv: Json; _item: string; _qty: number }
        Returns: Json
      }
      inv_count: { Args: { _inv: Json; _item: string }; Returns: number }
      inv_remove: {
        Args: { _inv: Json; _item: string; _qty: number }
        Returns: Json
      }
      skill_xp: { Args: { _data: Json; _skill: string }; Returns: number }
      track_position: {
        Args: { _uid: string; _x: number; _y: number }
        Returns: boolean
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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

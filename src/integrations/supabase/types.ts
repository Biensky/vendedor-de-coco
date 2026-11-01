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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      combos: {
        Row: {
          active: boolean
          created_at: string
          id: string
          items: Json
          name: string
          price: number
          reward_product_id: string | null
          reward_qty: number
          vendor_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          items?: Json
          name: string
          price?: number
          reward_product_id?: string | null
          reward_qty?: number
          vendor_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          items?: Json
          name?: string
          price?: number
          reward_product_id?: string | null
          reward_qty?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combos_reward_product_id_fkey"
            columns: ["reward_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          customer_id: string
          id: string
          kind: string
          product_id: string
          qty: number
          vendor_id: string
        }
        Insert: {
          customer_id: string
          id?: string
          kind: string
          product_id: string
          qty?: number
          vendor_id?: string
        }
        Update: {
          customer_id?: string
          id?: string
          kind?: string
          product_id?: string
          qty?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          notes: string | null
          stamps: number
          vendor_id: string
          whatsapp: string | null
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          stamps?: number
          vendor_id?: string
          whatsapp?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          stamps?: number
          vendor_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          kind: string
          product_id: string | null
          qty: number
          unit_cost: number
          vendor_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          kind: string
          product_id?: string | null
          qty: number
          unit_cost?: number
          vendor_id?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          kind?: string
          product_id?: string | null
          qty?: number
          unit_cost?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty: {
        Row: {
          active: boolean
          product_id: string | null
          required_qty: number
          reward_product_id: string | null
          reward_qty: number
          vendor_id: string
        }
        Insert: {
          active?: boolean
          product_id?: string | null
          required_qty?: number
          reward_product_id?: string | null
          reward_qty?: number
          vendor_id?: string
        }
        Update: {
          active?: boolean
          product_id?: string | null
          required_qty?: number
          reward_product_id?: string | null
          reward_qty?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_reward_product_id_fkey"
            columns: ["reward_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          cost: number | null
          created_at: string
          id: string
          name: string
          price: number
          vendor_id: string
        }
        Insert: {
          active?: boolean
          cost?: number | null
          created_at?: string
          id?: string
          name: string
          price?: number
          vendor_id?: string
        }
        Update: {
          active?: boolean
          cost?: number | null
          created_at?: string
          id?: string
          name?: string
          price?: number
          vendor_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          business_name: string
          created_at: string
          daily_goal: number
          display_name: string | null
          email: string | null
          establishment_id: string | null
          id: string
          invite_code: string | null
          member_role: string
          plan: Database["public"]["Enums"]["plan_status"]
          plan_expires_at: string
        }
        Insert: {
          active?: boolean
          business_name?: string
          created_at?: string
          daily_goal?: number
          display_name?: string | null
          email?: string | null
          establishment_id?: string | null
          id: string
          invite_code?: string | null
          member_role?: string
          plan?: Database["public"]["Enums"]["plan_status"]
          plan_expires_at?: string
        }
        Update: {
          active?: boolean
          business_name?: string
          created_at?: string
          daily_goal?: number
          display_name?: string | null
          email?: string | null
          establishment_id?: string | null
          id?: string
          invite_code?: string | null
          member_role?: string
          plan?: Database["public"]["Enums"]["plan_status"]
          plan_expires_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          is_reward: boolean
          product_id: string | null
          qty: number
          sale_id: string
          unit_cost: number
          unit_price: number
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_reward?: boolean
          product_id?: string | null
          qty: number
          sale_id: string
          unit_cost?: number
          unit_price?: number
          vendor_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_reward?: boolean
          product_id?: string | null
          qty?: number
          sale_id?: string
          unit_cost?: number
          unit_price?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          combo_id: string | null
          cost: number
          created_at: string
          customer_id: string | null
          id: string
          payment: string
          take_now: boolean
          total: number
          vendor_id: string
        }
        Insert: {
          combo_id?: string | null
          cost?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          payment?: string
          take_now?: boolean
          total?: number
          vendor_id?: string
        }
        Update: {
          combo_id?: string | null
          cost?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          payment?: string
          take_now?: boolean
          total?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_vendors: {
        Args: never
        Returns: {
          business_name: string
          created_at: string
          customers: number
          email: string
          id: string
          plan: Database["public"]["Enums"]["plan_status"]
          plan_expires_at: string
          revenue_month: number
          sales_month: number
          sellers: number
        }[]
      }
      admin_set_plan: {
        Args: {
          _expires: string
          _plan: Database["public"]["Enums"]["plan_status"]
          _vendor: string
        }
        Returns: undefined
      }
      check_invite: { Args: { _code: string }; Returns: string }
      deliver_credit: {
        Args: {
          _customer_id: string
          _kind: string
          _product_id: string
          _qty: number
        }
        Returns: undefined
      }
      est_of: { Args: { _uid: string }; Returns: string }
      gen_code: { Args: never; Returns: string }
      get_public_card: { Args: { _code: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_est_owner: { Args: never; Returns: boolean }
      my_est: { Args: never; Returns: string }
      owner_set_member_active: {
        Args: { _active: boolean; _member: string }
        Returns: undefined
      }
      register_sale: {
        Args: {
          _combo_id: string
          _customer_id: string
          _items: Json
          _payment: string
          _take_now: boolean
        }
        Returns: string
      }
      vendor_is_active: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      plan_status: "trial" | "active" | "suspended"
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
    Enums: {
      app_role: ["admin", "user"],
      plan_status: ["trial", "active", "suspended"],
    },
  },
} as const

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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          employee_id: string | null
          id: string
          shop_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          employee_id?: string | null
          id?: string
          shop_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          employee_id?: string | null
          id?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          shop_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          shop_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_financial_entries: {
        Row: {
          id: string
          shop_id: string
          period_id: string
          entry_type: "expense" | "investment"
          title: string
          category: string | null
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          shop_id: string
          period_id: string
          entry_type: "expense" | "investment"
          title: string
          category?: string | null
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          shop_id?: string
          period_id?: string
          entry_type?: "expense" | "investment"
          title?: string
          category?: string | null
          amount?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_financial_entries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_financial_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "shop_financial_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_financial_periods: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          period_start: string
          period_end: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_start: string
          period_end: string
          shop_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_start?: string
          period_end?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_financial_periods_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_restock_orders: {
        Row: {
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          product_id: string
          quantity_requested: number
          quantity_unit: string
          quantity_unit_amount: number | null
          shop_id: string
          status: "pending" | "confirmed" | "cancelled"
        }
        Insert: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity_requested: number
          quantity_unit?: string
          quantity_unit_amount?: number | null
          shop_id: string
          status?: "pending" | "confirmed" | "cancelled"
        }
        Update: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity_requested?: number
          quantity_unit?: string
          quantity_unit_amount?: number | null
          shop_id?: string
          status?: "pending" | "confirmed" | "cancelled"
        }
        Relationships: [
          {
            foreignKeyName: "stock_restock_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_restock_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          discount_price: number | null
          id: string
          low_stock_threshold: number
          name: string
          pack_size: number | null
          price: number
          price_wholesale_crate: number | null
          shop_id: string
          sku: string
          stock_quantity: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          discount_price?: number | null
          id?: string
          low_stock_threshold?: number
          name: string
          pack_size?: number | null
          price: number
          price_wholesale_crate?: number | null
          shop_id: string
          sku: string
          stock_quantity?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          discount_price?: number | null
          id?: string
          low_stock_threshold?: number
          name?: string
          pack_size?: number | null
          price?: number
          price_wholesale_crate?: number | null
          shop_id?: string
          sku?: string
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_login: string | null
          shop_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_login?: string | null
          shop_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_login?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          accent: string
          contact_info: string | null
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          accent?: string
          contact_info?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          accent?: string
          contact_info?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      transaction_items: {
        Row: {
          id: string
          meta: Json | null
          name_snapshot: string
          product_id: string | null
          quantity: number
          sku_snapshot: string | null
          total: number
          transaction_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          meta?: Json | null
          name_snapshot: string
          product_id?: string | null
          quantity: number
          sku_snapshot?: string | null
          total: number
          transaction_id: string
          unit_price: number
        }
        Update: {
          id?: string
          meta?: Json | null
          name_snapshot?: string
          product_id?: string | null
          quantity?: number
          sku_snapshot?: string | null
          total?: number
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          employee_id: string
          id: string
          payment_mode: string
          ref_id: string | null
          shop_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          employee_id: string
          id?: string
          payment_mode: string
          ref_id?: string | null
          shop_id: string
          total_amount: number
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          employee_id?: string
          id?: string
          payment_mode?: string
          ref_id?: string | null
          shop_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
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
      create_sale: {
        Args: {
          _customer_name: string
          _customer_phone: string
          _items: Json
          _payment_mode: string
          _ref_id: string
        }
        Returns: string
      }
      current_shop_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
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
    Enums: {
      app_role: ["admin", "employee"],
    },
  },
} as const

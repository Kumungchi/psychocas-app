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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_member_id: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_branch_id: string | null
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_member_id?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_branch_id?: string | null
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_member_id?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_branch_id?: string | null
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_logs_entity_branch_id_fkey"
            columns: ["entity_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          city: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      discounts: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          discount_value: string
          id: string
          is_active: boolean
          partner_id: string
          title: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          discount_value: string
          id?: string
          is_active?: boolean
          partner_id: string
          title: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          discount_value?: string
          id?: string
          is_active?: boolean
          partner_id?: string
          title?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      member_whitelist: {
        Row: {
          branch_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          membership_expires_at: string
          notes: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          membership_expires_at: string
          notes?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          membership_expires_at?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_whitelist_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          branch_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
          user_id: string
          whitelist_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          role?: string
          user_id: string
          whitelist_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: string
          user_id?: string
          whitelist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_whitelist_id_fkey"
            columns: ["whitelist_id"]
            isOneToOne: false
            referencedRelation: "member_whitelist"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          branch_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          instagram: string | null
          is_active: boolean
          logo_url: string | null
          name: string
          website: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          logo_url?: string | null
          name: string
          website?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          logo_url?: string | null
          name?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          branch_id: string
          discount_id: string
          id: string
          member_id: string
          partner_id: string
          redeemed_at: string
          token_id: string
        }
        Insert: {
          branch_id: string
          discount_id: string
          id?: string
          member_id: string
          partner_id: string
          redeemed_at?: string
          token_id: string
        }
        Update: {
          branch_id?: string
          discount_id?: string
          id?: string
          member_id?: string
          partner_id?: string
          redeemed_at?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          code: string
          created_at: string
          discount_id: string
          expires_at: string
          id: string
          member_id: string
          redeemed_at: string | null
          token_hash: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_id: string
          expires_at: string
          id?: string
          member_id: string
          redeemed_at?: string | null
          token_hash?: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_id?: string
          expires_at?: string
          id?: string
          member_id?: string
          redeemed_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      redemptions_daily: {
        Row: {
          branch_id: string | null
          day: string | null
          discount_id: string | null
          partner_id: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_member: {
        Args: { approver_user_id: string; member_user_id: string }
        Returns: boolean
      }
      cleanup_expired_tokens: { Args: never; Returns: number }
      current_member_branch_id: { Args: never; Returns: string }
      current_member_role: { Args: never; Returns: string }
      ensure_membership: {
        Args: never
        Returns: {
          branch_id: string
          role: string
          status: string
        }[]
      }
      ensure_membership_from_whitelist: {
        Args: never
        Returns: {
          branch_id: string
          id: string
          role: string
          status: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_branch_manager: { Args: { _branch: string }; Returns: boolean }
      member_branch_id: { Args: { p_member_id: string }; Returns: string }
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

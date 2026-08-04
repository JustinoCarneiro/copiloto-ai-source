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
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          payload: Json | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      cartoes: {
        Row: {
          bandeira: string | null
          cor: string
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number | null
          id: string
          limite: number | null
          nome: string
          tipo: string
          user_id: string
        }
        Insert: {
          bandeira?: string | null
          cor?: string
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          limite?: number | null
          nome: string
          tipo: string
          user_id: string
        }
        Update: {
          bandeira?: string | null
          cor?: string
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          limite?: number | null
          nome?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          cor: string
          created_at: string
          icone: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      contas: {
        Row: {
          categoria_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          destino: string | null
          dia_vencimento: number | null
          id: string
          pago: boolean
          status: string
          tipo: string
          total_parcelas: number | null
          user_id: string
          valor: number
          valor_pago: number
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          destino?: string | null
          dia_vencimento?: number | null
          id?: string
          pago?: boolean
          status?: string
          tipo: string
          total_parcelas?: number | null
          user_id: string
          valor: number
          valor_pago?: number
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          destino?: string | null
          dia_vencimento?: number | null
          id?: string
          pago?: boolean
          status?: string
          tipo?: string
          total_parcelas?: number | null
          user_id?: string
          valor?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          desconto_pct: number
          id: string
          updated_at: string
          uso_max: number | null
          usos: number
          validade: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          desconto_pct: number
          id?: string
          updated_at?: string
          uso_max?: number | null
          usos?: number
          validade?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          desconto_pct?: number
          id?: string
          updated_at?: string
          uso_max?: number | null
          usos?: number
          validade?: string | null
        }
        Relationships: []
      }
      gastos: {
        Row: {
          cartao_id: string | null
          categoria_id: string | null
          created_at: string
          data: string
          descricao: string
          destino: string | null
          forma_pagamento: string | null
          id: string
          parcelas: number
          tipo: string
          user_id: string
          valor: number
          valor_parcela: number | null
        }
        Insert: {
          cartao_id?: string | null
          categoria_id?: string | null
          created_at?: string
          data?: string
          descricao: string
          destino?: string | null
          forma_pagamento?: string | null
          id?: string
          parcelas?: number
          tipo?: string
          user_id: string
          valor: number
          valor_parcela?: number | null
        }
        Update: {
          cartao_id?: string | null
          categoria_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          destino?: string | null
          forma_pagamento?: string | null
          id?: string
          parcelas?: number
          tipo?: string
          user_id?: string
          valor?: number
          valor_parcela?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_historico: {
        Row: {
          changed_at: string
          changes: Json
          gasto_id: string
          id: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          changes: Json
          gasto_id: string
          id?: string
          user_id: string
        }
        Update: {
          changed_at?: string
          changes?: Json
          gasto_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_historico_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: false
            referencedRelation: "gastos"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_conversas: {
        Row: {
          created_at: string
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ia_mensagens: {
        Row: {
          content: string
          conversa_id: string
          created_at: string
          id: string
          role: string
          suggestion: Json | null
          user_id: string
        }
        Insert: {
          content?: string
          conversa_id: string
          created_at?: string
          id?: string
          role: string
          suggestion?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversa_id?: string
          created_at?: string
          id?: string
          role?: string
          suggestion?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "ia_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          cor: string | null
          created_at: string
          data_objetivo: string | null
          icone: string | null
          id: string
          nome: string
          user_id: string
          valor_atual: number
          valor_objetivo: number
        }
        Insert: {
          cor?: string | null
          created_at?: string
          data_objetivo?: string | null
          icone?: string | null
          id?: string
          nome: string
          user_id: string
          valor_atual?: number
          valor_objetivo: number
        }
        Update: {
          cor?: string | null
          created_at?: string
          data_objetivo?: string | null
          icone?: string | null
          id?: string
          nome?: string
          user_id?: string
          valor_atual?: number
          valor_objetivo?: number
        }
        Relationships: []
      }
      pagamentos_contas: {
        Row: {
          conta_id: string
          created_at: string
          data: string
          id: string
          observacao: string | null
          user_id: string
          valor: number
        }
        Insert: {
          conta_id: string
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          user_id: string
          valor: number
        }
        Update: {
          conta_id?: string
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      parcelas: {
        Row: {
          conta_id: string
          created_at: string
          data_vencimento: string
          id: string
          numero: number
          pago: boolean
          user_id: string
          valor: number
        }
        Insert: {
          conta_id: string
          created_at?: string
          data_vencimento: string
          id?: string
          numero: number
          pago?: boolean
          user_id: string
          valor: number
        }
        Update: {
          conta_id?: string
          created_at?: string
          data_vencimento?: string
          id?: string
          numero?: number
          pago?: boolean
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          amount: number | null
          created_at: string
          event: string
          gateway: string
          id: string
          payload: Json | null
          status: string | null
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          event: string
          gateway?: string
          id?: string
          payload?: Json | null
          status?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          event?: string
          gateway?: string
          id?: string
          payload?: Json | null
          status?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked: boolean
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          blocked?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          blocked?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          billing_cycle: string | null
          canceled_at: string | null
          ciclo: string | null
          created_at: string
          customer_id: string | null
          gateway: string
          ia_daily_limit: number | null
          id: string
          last_invoice_url: string | null
          next_due_date: string | null
          payment_method: string | null
          plano: string
          premium_until: string | null
          status: string
          subscription_id: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          billing_cycle?: string | null
          canceled_at?: string | null
          ciclo?: string | null
          created_at?: string
          customer_id?: string | null
          gateway?: string
          ia_daily_limit?: number | null
          id?: string
          last_invoice_url?: string | null
          next_due_date?: string | null
          payment_method?: string | null
          plano?: string
          premium_until?: string | null
          status?: string
          subscription_id?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          billing_cycle?: string | null
          canceled_at?: string | null
          ciclo?: string | null
          created_at?: string
          customer_id?: string | null
          gateway?: string
          ia_daily_limit?: number | null
          id?: string
          last_invoice_url?: string | null
          next_due_date?: string | null
          payment_method?: string | null
          plano?: string
          premium_until?: string | null
          status?: string
          subscription_id?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

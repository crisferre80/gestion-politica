export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ads_grid: {
        Row: {
          ad_id: string | null
          bg_color: string | null
          col: number
          created_at: string | null
          custom_label: string | null
          id: string
          row: number
          size: string
          updated_at: string | null
        }
        Insert: {
          ad_id?: string | null
          bg_color?: string | null
          col: number
          created_at?: string | null
          custom_label?: string | null
          id?: string
          row: number
          size?: string
          updated_at?: string | null
        }
        Update: {
          ad_id?: string | null
          bg_color?: string | null
          col?: number
          created_at?: string | null
          custom_label?: string | null
          id?: string
          row?: number
          size?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_grid_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
        ]
      }
      advertisements: {
        Row: {
          active: boolean | null
          content: string | null
          created_at: string | null
          id: string
          image_url: string | null
          link: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      collection_claims: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          collection_point_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          pickup_time: string | null
          recycler_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          collection_point_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          pickup_time?: string | null
          recycler_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          collection_point_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          pickup_time?: string | null
          recycler_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_claims_collection_point_id_fkey"
            columns: ["collection_point_id"]
            isOneToOne: true
            referencedRelation: "collection_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_claims_recycler_id_fkey"
            columns: ["recycler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collection_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      concentration_points: {
        Row: {
          additional_info: string | null
          address: string | null
          claim_id: string | null
          created_at: string | null
          description: string | null
          district: string | null
          id: string
          lat: number | null
          lng: number | null
          materials: string[] | null
          photo_url: string | null
          pickup_time: string | null
          recycler_id: string | null
          schedule: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          additional_info?: string | null
          address?: string | null
          claim_id?: string | null
          created_at?: string | null
          description?: string | null
          district?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          materials?: string[] | null
          photo_url?: string | null
          pickup_time?: string | null
          recycler_id?: string | null
          schedule?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          additional_info?: string | null
          address?: string | null
          claim_id?: string | null
          created_at?: string | null
          description?: string | null
          district?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          materials?: string[] | null
          photo_url?: string | null
          pickup_time?: string | null
          recycler_id?: string | null
          schedule?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concentration_points_recycler_id_fkey"
            columns: ["recycler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "concentration_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_concentration_points_claim_id"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "collection_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_points_backup: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          original_id: string
          point_data: Json | null
          recycler_id: string
          resident_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          original_id: string
          point_data?: Json | null
          recycler_id: string
          resident_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          original_id?: string
          point_data?: Json | null
          recycler_id?: string
          resident_id?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          type: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          id: string
          read: boolean | null
          receiver_id: string | null
          sender_id: string | null
          sent_at: string | null
        }
        Insert: {
          content: string
          id?: string
          read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
          sent_at?: string | null
        }
        Update: {
          content?: string
          id?: string
          read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          closed: boolean
          content: string
          created_at: string
          id: string
          read: boolean
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          closed?: boolean
          content: string
          created_at?: string
          id?: string
          read?: boolean
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          closed?: boolean
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          alias: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          dni: number | null
          eco_creditos: number
          email: string | null
          id: string
          lat: number | null
          lng: number | null
          materials: string[] | null
          name: string | null
          online: boolean | null
          phone: string | null
          rating_average: number | null
          role: string | null
          total_ratings: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          alias?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          dni?: number | null
          eco_creditos?: number
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          materials?: string[] | null
          name?: string | null
          online?: boolean | null
          phone?: string | null
          rating_average?: number | null
          role?: string | null
          total_ratings?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          alias?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          dni?: number | null
          eco_creditos?: number
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          materials?: string[] | null
          name?: string | null
          online?: boolean | null
          phone?: string | null
          rating_average?: number | null
          role?: string | null
          total_ratings?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      recycler_ratings: {
        Row: {
          collection_claim_id: string | null
          comment: string | null
          created_at: string | null
          id: string
          rater_id: string
          rating: number
          recycler_id: string
          resident_id: string | null
        }
        Insert: {
          collection_claim_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          rater_id: string
          rating: number
          recycler_id: string
          resident_id?: string | null
        }
        Update: {
          collection_claim_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          rater_id?: string
          rating?: number
          recycler_id?: string
          resident_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recycler_ratings_collection_claim_id_fkey"
            columns: ["collection_claim_id"]
            isOneToOne: false
            referencedRelation: "collection_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recycler_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recycler_ratings_recycler_id_fkey"
            columns: ["recycler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recycler_ratings_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recycler_routes: {
        Row: {
          colour: string | null
          created_at: string | null
          id: string
          name: string
          point_ids: string[]
          recycler_id: string | null
        }
        Insert: {
          colour?: string | null
          created_at?: string | null
          id?: string
          name: string
          point_ids: string[]
          recycler_id?: string | null
        }
        Update: {
          colour?: string | null
          created_at?: string | null
          id?: string
          name?: string
          point_ids?: string[]
          recycler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recycler_routes_recycler_id_fkey"
            columns: ["recycler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_statistics: {
        Row: {
          collections_cancelled: number | null
          collections_completed: number | null
          created_at: string | null
          last_active_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          collections_cancelled?: number | null
          collections_completed?: number | null
          created_at?: string | null
          last_active_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          collections_cancelled?: number | null
          collections_completed?: number | null
          created_at?: string | null
          last_active_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_statistics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          color: string
          coordinates: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color: string
          coordinates: Json
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          color?: string
          coordinates?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      backup_and_clear_points: {
        Args: { recycler_id: string }
        Returns: undefined
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

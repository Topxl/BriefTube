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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cancellation_feedbacks: {
        Row: {
          created_at: string
          custom_message: string | null
          id: string
          offer_accepted: boolean
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_message?: string | null
          id?: string
          offer_accepted?: boolean
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_message?: string | null
          id?: string
          offer_accepted?: boolean
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_feedbacks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_lists: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_accounts: {
        Row: {
          deleted_at: string
          email: string
          id: string
        }
        Insert: {
          deleted_at?: string
          email: string
          id?: string
        }
        Update: {
          deleted_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string | null
          id: string
          language: string
          sent_at: string | null
          source: string | null
          status: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          language?: string
          sent_at?: string | null
          source?: string | null
          status?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          language?: string
          sent_at?: string | null
          source?: string | null
          status?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          email_type: string
          id: string
          opened_at: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          email_type: string
          id?: string
          opened_at?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          email_type?: string
          id?: string
          opened_at?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_channels: {
        Row: {
          added_at: string | null
          channel_avatar_url: string | null
          channel_id: string
          channel_name: string
          id: string
          list_id: string
        }
        Insert: {
          added_at?: string | null
          channel_avatar_url?: string | null
          channel_id: string
          channel_name: string
          id?: string
          list_id: string
        }
        Update: {
          added_at?: string | null
          channel_avatar_url?: string | null
          channel_id?: string
          channel_name?: string
          id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_channels_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "channel_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_follows: {
        Row: {
          followed_at: string | null
          list_id: string
          user_id: string
        }
        Insert: {
          followed_at?: string | null
          list_id: string
          user_id: string
        }
        Update: {
          followed_at?: string | null
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_follows_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "channel_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_stars: {
        Row: {
          list_id: string
          starred_at: string | null
          user_id: string
        }
        Insert: {
          list_id: string
          starred_at?: string | null
          user_id: string
        }
        Update: {
          list_id?: string
          starred_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_stars_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "channel_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_stars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_videos: {
        Row: {
          audio_url: string | null
          channel_id: string
          created_at: string | null
          failure_count: number | null
          id: string
          language: string
          metadata: Json | null
          processed_at: string | null
          retry_at: string | null
          retry_count: number | null
          source_language: string | null
          status: string | null
          summary: string | null
          summary_length: number | null
          transcript_cost: number | null
          transcript_length: number | null
          transcript_source: string | null
          transcript_status: string | null
          video_id: string
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          channel_id: string
          created_at?: string | null
          failure_count?: number | null
          id?: string
          language?: string
          metadata?: Json | null
          processed_at?: string | null
          retry_at?: string | null
          retry_count?: number | null
          source_language?: string | null
          status?: string | null
          summary?: string | null
          summary_length?: number | null
          transcript_cost?: number | null
          transcript_length?: number | null
          transcript_source?: string | null
          transcript_status?: string | null
          video_id: string
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          channel_id?: string
          created_at?: string | null
          failure_count?: number | null
          id?: string
          language?: string
          metadata?: Json | null
          processed_at?: string | null
          retry_at?: string | null
          retry_count?: number | null
          source_language?: string | null
          status?: string | null
          summary?: string | null
          summary_length?: number | null
          transcript_cost?: number | null
          transcript_length?: number | null
          transcript_source?: string | null
          transcript_status?: string | null
          video_id?: string
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      processing_queue: {
        Row: {
          attempts: number | null
          channel_id: string
          channel_name: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          priority: number | null
          retry_after: string | null
          started_at: string | null
          status: string | null
          tts_voice: string | null
          user_language: string | null
          video_id: string
          video_title: string | null
          worker_id: string | null
          youtube_url: string
        }
        Insert: {
          attempts?: number | null
          channel_id: string
          channel_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          priority?: number | null
          retry_after?: string | null
          started_at?: string | null
          status?: string | null
          tts_voice?: string | null
          user_language?: string | null
          video_id: string
          video_title?: string | null
          worker_id?: string | null
          youtube_url: string
        }
        Update: {
          attempts?: number | null
          channel_id?: string
          channel_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          priority?: number | null
          retry_after?: string | null
          started_at?: string | null
          status?: string | null
          tts_voice?: string | null
          user_language?: string | null
          video_id?: string
          video_title?: string | null
          worker_id?: string | null
          youtube_url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          email_announcements: boolean | null
          email_newsletter: boolean | null
          favorite_languages: string[]
          id: string
          max_channels: number | null
          notify_new_summaries_push: boolean | null
          onboarding_completed: boolean | null
          preferred_language: string | null
          referral_code: string | null
          referred_by: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          telegram_chat_id: string | null
          telegram_connect_token: string | null
          telegram_connected: boolean | null
          trial_ends_at: string | null
          tts_voice: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          email_announcements?: boolean | null
          email_newsletter?: boolean | null
          favorite_languages?: string[]
          id: string
          max_channels?: number | null
          notify_new_summaries_push?: boolean | null
          onboarding_completed?: boolean | null
          preferred_language?: string | null
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          telegram_chat_id?: string | null
          telegram_connect_token?: string | null
          telegram_connected?: boolean | null
          trial_ends_at?: string | null
          tts_voice?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          email_announcements?: boolean | null
          email_newsletter?: boolean | null
          favorite_languages?: string[]
          id?: string
          max_channels?: number | null
          notify_new_summaries_push?: boolean | null
          onboarding_completed?: boolean | null
          preferred_language?: string | null
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          telegram_chat_id?: string | null
          telegram_connect_token?: string | null
          telegram_connected?: boolean | null
          trial_ends_at?: string | null
          tts_voice?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referee_id: string
          referrer_id: string
          reward_type: string | null
          rewarded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referee_id: string
          referrer_id: string
          reward_type?: string | null
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referee_id?: string
          referrer_id?: string
          reward_type?: string | null
          rewarded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_summaries: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          language: string
          max_views: number | null
          shared_by: string | null
          short_id: string
          video_id: string
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          language?: string
          max_views?: number | null
          shared_by?: string | null
          short_id: string
          video_id: string
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          language?: string
          max_views?: number | null
          shared_by?: string | null
          short_id?: string
          video_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_summaries_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          active: boolean | null
          channel_avatar_url: string | null
          channel_id: string
          channel_name: string
          created_at: string | null
          id: string
          list_id: string | null
          source_type: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          channel_avatar_url?: string | null
          channel_id: string
          channel_name: string
          created_at?: string | null
          id?: string
          list_id?: string | null
          source_type?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          channel_avatar_url?: string | null
          channel_id?: string
          channel_name?: string
          created_at?: string | null
          id?: string
          list_id?: string | null
          source_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "channel_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      websub_subscriptions: {
        Row: {
          channel_id: string
          expires_at: string | null
          status: string | null
          subscribed_at: string | null
        }
        Insert: {
          channel_id: string
          expires_at?: string | null
          status?: string | null
          subscribed_at?: string | null
        }
        Update: {
          channel_id?: string
          expires_at?: string | null
          status?: string | null
          subscribed_at?: string | null
        }
        Relationships: []
      }
      worker_stats: {
        Row: {
          date: string
          deliveries_failed: number
          deliveries_sent: number
          groq_cost: number
          groq_seconds: number
          updated_at: string
          videos_failed: number
          videos_processed: number
        }
        Insert: {
          date: string
          deliveries_failed?: number
          deliveries_sent?: number
          groq_cost?: number
          groq_seconds?: number
          updated_at?: string
          videos_failed?: number
          videos_processed?: number
        }
        Update: {
          date?: string
          deliveries_failed?: number
          deliveries_sent?: number
          groq_cost?: number
          groq_seconds?: number
          updated_at?: string
          videos_failed?: number
          videos_processed?: number
        }
        Relationships: []
      }
    }
    Views: {
      transcript_cost_analytics: {
        Row: {
          avg_cost: number | null
          date: string | null
          groq_count: number | null
          total_chars: number | null
          total_cost: number | null
          total_videos: number | null
          youtube_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      pick_next_processing_job: {
        Args: never
        Returns: {
          attempts: number | null
          channel_id: string
          channel_name: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          priority: number | null
          retry_after: string | null
          started_at: string | null
          status: string | null
          tts_voice: string | null
          user_language: string | null
          video_id: string
          video_title: string | null
          worker_id: string | null
          youtube_url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "processing_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
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
} as const;

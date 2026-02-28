export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      attendee_feedbacks: {
        Row: {
          id: string;
          message: string;
          created_at: string;
          is_analyzed: boolean;
        };
        Insert: {
          id?: string;
          message: string;
          created_at?: string;
          is_analyzed?: boolean;
        };
        Update: {
          id?: string;
          message?: string;
          created_at?: string;
          is_analyzed?: boolean;
        };
        Relationships: [];
      };
      congress_analytics: {
        Row: {
          id: string;
          total_feedbacks: number;
          sentiment_score: Json;
          top_keywords: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          total_feedbacks: number;
          sentiment_score: Json;
          top_keywords: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          total_feedbacks?: number;
          sentiment_score?: Json;
          top_keywords?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      live_polls: {
        Row: {
          id: string;
          question: string;
          options: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          options: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question?: string;
          options?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      live_poll_presets: {
        Row: {
          id: string;
          question: string;
          options: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          options: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question?: string;
          options?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      networking_profiles: {
        Row: {
          id: string;
          full_name: string;
          interest_area: string;
          goal: string;
          contact_info: string | null;
          is_matched: boolean;
          matched_with_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          interest_area: string;
          goal: string;
          contact_info?: string | null;
          is_matched?: boolean;
          matched_with_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          interest_area?: string;
          goal?: string;
          contact_info?: string | null;
          is_matched?: boolean;
          matched_with_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      raffle_participants: {
        Row: {
          id: string;
          full_name: string;
          participant_code: string;
          external_ref: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          participant_code?: string;
          external_ref?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          participant_code?: string;
          external_ref?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      raffle_prizes: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          quantity: number;
          allow_previous_winner: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          quantity?: number;
          allow_previous_winner?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          quantity?: number;
          allow_previous_winner?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      raffle_draws: {
        Row: {
          id: string;
          prize_id: string;
          winner_participant_id: string;
          draw_number: number;
          winner_code_snapshot: string;
          winner_name_snapshot: string;
          drawn_at: string;
        };
        Insert: {
          id?: string;
          prize_id: string;
          winner_participant_id: string;
          draw_number: number;
          winner_code_snapshot: string;
          winner_name_snapshot: string;
          drawn_at?: string;
        };
        Update: {
          id?: string;
          prize_id?: string;
          winner_participant_id?: string;
          draw_number?: number;
          winner_code_snapshot?: string;
          winner_name_snapshot?: string;
          drawn_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      run_raffle_draw: {
        Args: {
          p_prize_id: string;
        };
        Returns: Array<{
          draw_id: string;
          prize_id: string;
          prize_title: string;
          draw_number: number;
          winner_participant_id: string;
          winner_code: string;
          winner_name: string;
          drawn_at: string;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type FeedbackRow = Database["public"]["Tables"]["attendee_feedbacks"]["Row"];
export type AnalyticsRow = Database["public"]["Tables"]["congress_analytics"]["Row"];
export type LivePollRow = Database["public"]["Tables"]["live_polls"]["Row"];
export type LivePollPresetRow = Database["public"]["Tables"]["live_poll_presets"]["Row"];
export type NetworkingProfileRow = Database["public"]["Tables"]["networking_profiles"]["Row"];
export type RaffleParticipantRow = Database["public"]["Tables"]["raffle_participants"]["Row"];
export type RafflePrizeRow = Database["public"]["Tables"]["raffle_prizes"]["Row"];
export type RaffleDrawRow = Database["public"]["Tables"]["raffle_draws"]["Row"];

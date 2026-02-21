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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type FeedbackRow = Database["public"]["Tables"]["attendee_feedbacks"]["Row"];
export type AnalyticsRow = Database["public"]["Tables"]["congress_analytics"]["Row"];
export type NetworkingProfileRow = Database["public"]["Tables"]["networking_profiles"]["Row"];

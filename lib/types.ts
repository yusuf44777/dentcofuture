export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ─── Attendee ────────────────────────────────────────────────────────────────
export type AttendeeRole =
  | "Student"
  | "Clinician"
  | "Academic"
  | "Entrepreneur"
  | "Industry";

export type OutlierBadge =
  | "Innovator"
  | "Artist"
  | "Entrepreneur"
  | "AI Pioneer";

export interface Attendee {
  id: string;
  name: string;
  role: AttendeeRole;
  instagram: string | null;
  linkedin: string | null;
  avatar_url: string | null;
  outlier_score: number;
  points: number;
  created_at: string;
}

// ─── Questions ───────────────────────────────────────────────────────────────
export interface Question {
  id: string;
  attendee_id: string;
  text: string;
  votes: number;
  answered: boolean;
  pinned: boolean;
  session_id: string | null;
  created_at: string;
  attendee?: Pick<Attendee, "name" | "role">;
}

export interface QuestionUpvote {
  id: string;
  question_id: string;
  attendee_id: string;
  created_at: string;
}

// ─── Polls ───────────────────────────────────────────────────────────────────
export interface Poll {
  id: string;
  question: string;
  options: string[];
  results: Record<string, number>;
  active: boolean;
  session_id: string | null;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  attendee_id: string;
  option_index: number;
  created_at: string;
}

// ─── Reactions ───────────────────────────────────────────────────────────────
export type ReactionEmoji = "🔥" | "💡" | "🤯" | "👏" | "❓";

export interface Reaction {
  id: string;
  emoji: ReactionEmoji;
  attendee_id: string;
  session_id: string | null;
  created_at: string;
}

// ─── Networking ──────────────────────────────────────────────────────────────
export type MatchStatus = "pending" | "accepted" | "rejected";

export interface Match {
  id: string;
  attendee_a: string;
  attendee_b: string;
  status: MatchStatus;
  created_at: string;
  other_attendee?: Attendee;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: string;
}

// ─── Sessions ────────────────────────────────────────────────────────────────
export interface Session {
  id: string;
  title: string;
  speaker: string | null;
  start_time: string;
  end_time: string;
  active: boolean;
}

// ─── Stamps / Gamification ───────────────────────────────────────────────────
export type StampType =
  | "joined"
  | "quiz_complete"
  | "question_asked"
  | "poll_voted"
  | "match_made"
  | "game_played"
  | "all_sessions";

export interface Stamp {
  id: string;
  attendee_id: string;
  type: StampType;
  earned_at: string;
}

// ─── Game ─────────────────────────────────────────────────────────────────────
export interface GameScore {
  id: string;
  attendee_id: string;
  score: number;
  wave: number;
  created_at: string;
  attendee?: Pick<Attendee, "name">;
}

// ─── Database (for Supabase typed client) ────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      attendees: {
        Row: Attendee;
        Insert: Omit<Attendee, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Attendee, "id" | "created_at">>;
      };
      questions: {
        Row: Omit<Question, "attendee">;
        Insert: Omit<Question, "id" | "created_at" | "attendee"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Question, "id" | "created_at" | "attendee">>;
      };
      question_upvotes: {
        Row: QuestionUpvote;
        Insert: Omit<QuestionUpvote, "id" | "created_at"> & { id?: string };
        Update: never;
      };
      polls: {
        Row: Poll;
        Insert: Omit<Poll, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Poll, "id" | "created_at">>;
      };
      poll_votes: {
        Row: PollVote;
        Insert: Omit<PollVote, "id" | "created_at"> & { id?: string };
        Update: never;
      };
      reactions: {
        Row: Reaction;
        Insert: Omit<Reaction, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: never;
      };
      matches: {
        Row: Omit<Match, "other_attendee">;
        Insert: Omit<Match, "id" | "created_at" | "other_attendee"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Pick<Match, "status">>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: never;
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, "id"> & { id?: string };
        Update: Partial<Omit<Session, "id">>;
      };
      stamps: {
        Row: Stamp;
        Insert: Omit<Stamp, "id" | "earned_at"> & { id?: string; earned_at?: string };
        Update: never;
      };
      game_scores: {
        Row: Omit<GameScore, "attendee">;
        Insert: Omit<GameScore, "id" | "created_at" | "attendee"> & {
          id?: string;
          created_at?: string;
        };
        Update: never;
      };
      // Legacy tables (old event — kept for API route compatibility)
      networking_profiles: { Row: NetworkingProfileRow; Insert: Partial<NetworkingProfileRow>; Update: Partial<NetworkingProfileRow> };
      networking_profile_actions: { Row: { id: string; actor_profile_id: string; target_profile_id: string; action: string; created_at: string; updated_at: string }; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      raffle_participants: { Row: { id: string; full_name: string; participant_code: string; external_ref: string | null; is_active: boolean; created_at: string; updated_at: string }; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      raffle_prizes: { Row: RafflePrizeRow; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      raffle_draws: { Row: RaffleDrawRow; Insert: Record<string, unknown>; Update: never };
      attendee_feedbacks: { Row: FeedbackRow; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      congress_analytics: { Row: AnalyticsRow; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      live_polls: { Row: { id: string; question: string; options: Json; is_active: boolean; created_at: string; updated_at: string }; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      live_poll_presets: { Row: { id: string; question: string; options: Json; created_at: string; updated_at: string }; Insert: Record<string, unknown>; Update: Record<string, unknown> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ─── Legacy type aliases (backward compat for old API routes) ─────────────────
export interface RaffleDrawRow {
  id: string; prize_id: string; winner_participant_id: string;
  draw_number: number; winner_code_snapshot: string; winner_name_snapshot: string; drawn_at: string;
}
export interface RafflePrizeRow {
  id: string; title: string; description: string | null; quantity: number;
  allow_previous_winner: boolean; is_active: boolean; created_at: string; updated_at: string;
}
export interface FeedbackRow {
  id: string; message: string; created_at: string; is_analyzed: boolean;
}
export interface AnalyticsRow {
  id: string; total_feedbacks: number; sentiment_score: Json; top_keywords: Json; created_at: string;
}
export interface NetworkingProfileRow {
  id: string; full_name: string; headline: string | null; interest_area: string; goal: string;
  profession: string | null; city: string | null; institution_name: string | null;
  years_experience: number | null; bio: string | null;
  topics: Json; collaboration_goals: Json; languages: Json;
  availability: string | null; contact_info: string | null;
  is_visible: boolean; profile_completion_score: number;
  last_active_at: string; is_matched: boolean; matched_with_id: string | null; created_at: string;
}

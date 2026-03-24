export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          organization_id: string
          role: 'admin' | 'recruiter' | 'interviewer'
          calendar_provider: 'google' | 'outlook' | null
          calendar_access_token: string | null
          calendar_refresh_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          organization_id: string
          role?: 'admin' | 'recruiter' | 'interviewer'
          calendar_provider?: 'google' | 'outlook' | null
          calendar_access_token?: string | null
          calendar_refresh_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          organization_id?: string
          role?: 'admin' | 'recruiter' | 'interviewer'
          calendar_provider?: 'google' | 'outlook' | null
          calendar_access_token?: string | null
          calendar_refresh_token?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      external_interviewers: {
        Row: {
          id: string
          user_id: string
          email: string
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      job_posts: {
        Row: {
          id: string
          organization_id: string
          title: string
          description: string | null
          process_id: string
          enabled_stages: Json | null
          custom_stages: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          title: string
          description?: string | null
          process_id: string
          enabled_stages?: Json | null
          custom_stages?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          title?: string
          description?: string | null
          process_id?: string
          enabled_stages?: Json | null
          custom_stages?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      processes: {
        Row: {
          id: string
          organization_id: string
          name: string
          stages: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          stages: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          stages?: Json
          created_at?: string
          updated_at?: string
        }
      }
      candidates: {
        Row: {
          id: string
          job_post_id: string
          name: string
          email: string
          phone: string | null
          status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue'
          current_stage_id: string | null
          token: string
          ai_score: number | null
          ai_summary: string | null
          ai_strengths: string[] | null
          ai_weaknesses: string[] | null
          ai_analysis_status: 'pending' | 'processing' | 'completed' | 'failed' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_post_id: string
          name: string
          email: string
          phone?: string | null
          status?: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue'
          current_stage_id?: string | null
          token?: string
          ai_score?: number | null
          ai_summary?: string | null
          ai_strengths?: string[] | null
          ai_weaknesses?: string[] | null
          ai_analysis_status?: 'pending' | 'processing' | 'completed' | 'failed' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_post_id?: string
          name?: string
          email?: string
          phone?: string | null
          status?: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue'
          current_stage_id?: string | null
          token?: string
          ai_score?: number | null
          ai_summary?: string | null
          ai_strengths?: string[] | null
          ai_weaknesses?: string[] | null
          ai_analysis_status?: 'pending' | 'processing' | 'completed' | 'failed' | null
          created_at?: string
          updated_at?: string
        }
      }
      schedules: {
        Row: {
          id: string
          candidate_id: string
          stage_id: string
          scheduled_at: string
          duration_minutes: number
          status: 'pending' | 'confirmed' | 'rejected' | 'completed'
          interviewer_ids: string[]
          external_interviewer_emails: string[]
          candidate_response: 'accepted' | 'rejected' | 'pending' | null
          beverage_preference: string | null
          google_event_id: string | null
          interviewer_responses: Record<string, string> | null
          workflow_status: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null
          needs_rescheduling: boolean | null
          rescheduling_reason: string | null
          manual_override: boolean | null
          manual_override_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          stage_id: string
          scheduled_at: string
          duration_minutes: number
          status?: 'pending' | 'confirmed' | 'rejected' | 'completed'
          interviewer_ids: string[]
          external_interviewer_emails?: string[]
          candidate_response?: 'accepted' | 'rejected' | 'pending' | null
          beverage_preference?: string | null
          google_event_id?: string | null
          interviewer_responses?: Record<string, string> | null
          workflow_status?: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null
          needs_rescheduling?: boolean | null
          rescheduling_reason?: string | null
          manual_override?: boolean | null
          manual_override_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          stage_id?: string
          scheduled_at?: string
          duration_minutes?: number
          status?: 'pending' | 'confirmed' | 'rejected' | 'completed'
          interviewer_ids?: string[]
          external_interviewer_emails?: string[]
          candidate_response?: 'accepted' | 'rejected' | 'pending' | null
          beverage_preference?: string | null
          google_event_id?: string | null
          interviewer_responses?: Record<string, string> | null
          workflow_status?: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null
          needs_rescheduling?: boolean | null
          rescheduling_reason?: string | null
          manual_override?: boolean | null
          manual_override_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      schedule_options: {
        Row: {
          id: string
          schedule_id: string
          scheduled_at: string
          status: 'pending' | 'selected' | 'rejected'
          google_event_id: string | null
          interviewer_responses: Record<string, string> | null
          is_manual: boolean | null
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          schedule_id: string
          scheduled_at: string
          status?: 'pending' | 'selected' | 'rejected'
          google_event_id?: string | null
          interviewer_responses?: Record<string, string> | null
          is_manual?: boolean | null
          added_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string
          scheduled_at?: string
          status?: 'pending' | 'selected' | 'rejected'
          google_event_id?: string | null
          interviewer_responses?: Record<string, string> | null
          is_manual?: boolean | null
          added_by?: string | null
          created_at?: string
        }
      }
      timeline_events: {
        Row: {
          id: string
          candidate_id: string
          type: 'system_log' | 'schedule_created' | 'schedule_confirmed' | 'schedule_regenerated' | 'schedule_rescheduled' | 'schedule_manually_edited' | 'schedule_option_manually_added' | 'schedule_force_confirmed' | 'stage_changed' | 'email' | 'email_received' | 'comment' | 'comment_created' | 'comment_updated' | 'scorecard' | 'scorecard_created' | 'approval' | 'stage_evaluation' | 'archive' | 'interviewer_response' | 'position_changed'
          content: Json
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          type: 'system_log' | 'schedule_created' | 'schedule_confirmed' | 'schedule_regenerated' | 'schedule_rescheduled' | 'schedule_manually_edited' | 'schedule_option_manually_added' | 'schedule_force_confirmed' | 'stage_changed' | 'email' | 'email_received' | 'comment' | 'comment_created' | 'comment_updated' | 'scorecard' | 'scorecard_created' | 'approval' | 'stage_evaluation' | 'archive' | 'interviewer_response' | 'position_changed'
          content: Json
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          type?: 'system_log' | 'schedule_created' | 'schedule_confirmed' | 'stage_changed'
          content?: Json
          created_by?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

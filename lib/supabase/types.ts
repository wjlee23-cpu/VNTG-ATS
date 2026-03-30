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
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          organization_id: string
          role: 'admin' | 'recruiter' | 'interviewer' | 'hiring_manager'
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
          role?: 'admin' | 'recruiter' | 'interviewer' | 'hiring_manager'
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
          role?: 'admin' | 'recruiter' | 'interviewer' | 'hiring_manager'
          calendar_provider?: 'google' | 'outlook' | null
          calendar_access_token?: string | null
          calendar_refresh_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "external_interviewers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          // 단계별 담당자 매핑(JSONB)
          stage_assignees: Json | null
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
          stage_assignees?: Json | null
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
          stage_assignees?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_posts_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "processes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          id: string
          job_post_id: string
          name: string
          email: string
          phone: string | null
          status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue'
          // 후보자 아카이브 여부
          archived: boolean
          current_stage_id: string | null
          token: string
          // 연봉 정보(문자열로 저장: 예: "1000000" 또는 "100만")
          current_salary: string | null
          expected_salary: string | null
          ai_score: number | null
          ai_summary: string | null
          ai_strengths: string[] | null
          ai_weaknesses: string[] | null
          ai_analysis_status: 'pending' | 'processing' | 'completed' | 'failed' | null
          // 이력서 파싱 결과(JSONB)
          parsed_data: Json | null
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
          archived?: boolean
          current_stage_id?: string | null
          token?: string
          current_salary?: string | null
          expected_salary?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          ai_strengths?: string[] | null
          ai_weaknesses?: string[] | null
          ai_analysis_status?: 'pending' | 'processing' | 'completed' | 'failed' | null
          parsed_data?: Json | null
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
          archived?: boolean
          current_stage_id?: string | null
          token?: string
          current_salary?: string | null
          expected_salary?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          ai_strengths?: string[] | null
          ai_weaknesses?: string[] | null
          ai_analysis_status?: 'pending' | 'processing' | 'completed' | 'failed' | null
          parsed_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_post_id_fkey"
            columns: ["job_post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          id: string
          candidate_id: string
          stage_id: string
          scheduled_at: string
          // 원래 시작/종료 시점(재시도/수정 이력용)
          original_start_date: string | null
          original_end_date: string | null
          duration_minutes: number
          status: 'pending' | 'confirmed' | 'rejected' | 'completed'
          interviewer_ids: string[]
          external_interviewer_emails: string[]
          candidate_response: 'accepted' | 'rejected' | 'pending' | null
          beverage_preference: string | null
          google_event_id: string | null
          interviewer_responses: Json | null
          workflow_status: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null
          needs_rescheduling: boolean | null
          rescheduling_reason: string | null
          manual_override: boolean | null
          manual_override_by: string | null
          // 캘린더 리트라이 횟수(스케줄이 다시 생성/조정되는 경우)
          retry_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          stage_id: string
          scheduled_at: string
          original_start_date?: string | null
          original_end_date?: string | null
          duration_minutes: number
          status?: 'pending' | 'confirmed' | 'rejected' | 'completed'
          interviewer_ids: string[]
          external_interviewer_emails?: string[]
          candidate_response?: 'accepted' | 'rejected' | 'pending' | null
          beverage_preference?: string | null
          google_event_id?: string | null
          interviewer_responses?: Json | null
          workflow_status?: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null
          needs_rescheduling?: boolean | null
          rescheduling_reason?: string | null
          manual_override?: boolean | null
          manual_override_by?: string | null
          retry_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          stage_id?: string
          scheduled_at?: string
          original_start_date?: string | null
          original_end_date?: string | null
          duration_minutes?: number
          status?: 'pending' | 'confirmed' | 'rejected' | 'completed'
          interviewer_ids?: string[]
          external_interviewer_emails?: string[]
          candidate_response?: 'accepted' | 'rejected' | 'pending' | null
          beverage_preference?: string | null
          google_event_id?: string | null
          interviewer_responses?: Json | null
          workflow_status?: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null
          needs_rescheduling?: boolean | null
          rescheduling_reason?: string | null
          manual_override?: boolean | null
          manual_override_by?: string | null
          retry_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_options: {
        Row: {
          id: string
          schedule_id: string
          scheduled_at: string
          status: 'pending' | 'selected' | 'rejected' | 'accepted'
          google_event_id: string | null
          interviewer_responses: Json | null
          is_manual: boolean | null
          added_by: string | null
          // 구글 캘린더 watch 관련 값(푸시/리소스 추적용)
          watch_channel_id: string | null
          watch_resource_id: string | null
          watch_expiration: string | null
          watch_token: string | null
          created_at: string
        }
        Insert: {
          id?: string
          schedule_id: string
          scheduled_at: string
          status?: 'pending' | 'selected' | 'rejected' | 'accepted'
          google_event_id?: string | null
          interviewer_responses?: Json | null
          is_manual?: boolean | null
          added_by?: string | null
          watch_channel_id?: string | null
          watch_resource_id?: string | null
          watch_expiration?: string | null
          watch_token?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string
          scheduled_at?: string
          status?: 'pending' | 'selected' | 'rejected' | 'accepted'
          google_event_id?: string | null
          interviewer_responses?: Json | null
          is_manual?: boolean | null
          added_by?: string | null
          watch_channel_id?: string | null
          watch_resource_id?: string | null
          watch_expiration?: string | null
          watch_token?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_options_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecards: {
        Row: {
          candidate_id: string
          created_at: string
          criteria_scores: Json
          id: string
          interviewer_id: string
          notes: string | null
          overall_rating: number
          schedule_id: string
          strengths: string | null
          submitted_at: string
          updated_at: string
          weaknesses: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          criteria_scores?: Json
          id?: string
          interviewer_id: string
          notes?: string | null
          overall_rating: number
          schedule_id: string
          strengths?: string | null
          submitted_at?: string
          updated_at?: string
          weaknesses?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          criteria_scores?: Json
          id?: string
          interviewer_id?: string
          notes?: string | null
          overall_rating?: number
          schedule_id?: string
          strengths?: string | null
          submitted_at?: string
          updated_at?: string
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scorecards_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scorecards_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scorecards_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_files: {
        Row: {
          candidate_id: string
          created_at: string
          file_type: string
          file_url: string
          id: string
          original_name: string | null
          parsed_data: Json | null
          parsing_status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          file_type: string
          file_url: string
          id?: string
          original_name?: string | null
          parsed_data?: Json | null
          parsing_status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          file_type?: string
          file_url?: string
          id?: string
          original_name?: string | null
          parsed_data?: Json | null
          parsing_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_files_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          offer_currency: string | null
          offer_response_at: string | null
          offer_salary: number
          offer_sent_at: string
          offer_status: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          offer_currency?: string | null
          offer_response_at?: string | null
          offer_salary: number
          offer_sent_at?: string
          offer_status?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          offer_currency?: string | null
          offer_response_at?: string | null
          offer_salary?: number
          offer_sent_at?: string
          offer_status?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          candidate_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          mentioned_user_ids: string[] | null
          parent_comment_id: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          mentioned_user_ids?: string[] | null
          parent_comment_id?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          mentioned_user_ids?: string[] | null
          parent_comment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          body: string | null
          candidate_id: string
          created_at: string
          direction: string
          from_email: string
          id: string
          message_id: string
          received_at: string | null
          sent_at: string | null
          subject: string | null
          synced_at: string
          to_email: string
        }
        Insert: {
          body?: string | null
          candidate_id: string
          created_at?: string
          direction: string
          from_email: string
          id?: string
          message_id: string
          received_at?: string | null
          sent_at?: string | null
          subject?: string | null
          synced_at?: string
          to_email: string
        }
        Update: {
          body?: string | null
          candidate_id?: string
          created_at?: string
          direction?: string
          from_email?: string
          id?: string
          message_id?: string
          received_at?: string | null
          sent_at?: string | null
          subject?: string | null
          synced_at?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_evaluations: {
        Row: {
          candidate_id: string
          created_at: string
          evaluator_id: string
          id: string
          notes: string | null
          result: string
          stage_id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          evaluator_id: string
          id?: string
          notes?: string | null
          result?: string
          stage_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          evaluator_id?: string
          id?: string
          notes?: string | null
          result?: string
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_evaluations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "timeline_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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

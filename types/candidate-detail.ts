/**
 * 후보자 상세 페이지 전용 타입
 * CandidateDetailClient 및 관련 컴포넌트에서 사용
 */

export interface ResumeFile {
  id: string;
  candidate_id: string;
  file_url: string;
  file_type: string;
  original_name?: string | null;
  parsing_status: string;
  parsed_data?: { file_size?: number; [key: string]: unknown };
  created_at: string;
}

export interface Schedule {
  id: string;
  candidate_id: string;
  stage_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed';
  candidate_response: 'accepted' | 'rejected' | 'pending' | null;
  beverage_preference: string | null;
  // 진행 상태(자동화 워크플로우)
  workflow_status: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null;
  // 선택: 자동화 힌트/메타
  interviewer_responses?: Record<string, any> | null;
  google_event_id?: string | null;
  created_at?: string;
}

export interface TimelineEventContent {
  message?: string;
  subject?: string;
  body?: string;
  from_email?: string;
  to_email?: string;
  direction?: string;
  overall_rating?: number;
  rating?: number;
  notes?: string;
  from_stage?: string;
  to_stage?: string;
  previous_status?: string;
  new_status?: string;
  stage_id?: string;
  result?: 'pass' | 'fail' | 'pending';
  stage_name?: string;
  content?: string;
  previous_content?: string;
  archive_reason?: string;
  schedule_options?: Array<{ id: string; scheduled_at: string }>;
  retry_count?: number;
  original_date_range?: { start: string; end: string };
  response?: string;
  interviewer_email?: string;
  option_scheduled_at?: string;
  all_accepted?: boolean;
  previous_job_post_title?: string;
  new_job_post_title?: string;
  previous_rating?: number;
  [key: string]: unknown;
}

export interface TimelineEventCreatedBy {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface TimelineEvent {
  id: string;
  type: string;
  content: TimelineEventContent;
  created_at: string;
  created_by_user?: TimelineEventCreatedBy;
}

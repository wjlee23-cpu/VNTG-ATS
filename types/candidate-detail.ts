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
  /** 타임라인 코멘트 이벤트의 comments.id */
  comment_id?: string;
  /** 코멘트 수정 후 본문 (comment_updated) */
  new_content?: string;
  /** stage_evaluations.id — 타임라인에서 평가 수정 시 사용 */
  evaluation_id?: string;
  /** activity_quote: 인용 원문 타임라인 id */
  quoted_timeline_event_id?: string;
  /** activity_quote: 인용 원문 이메일 id */
  quoted_email_id?: string;
  /** activity_quote: 인용 스냅샷 */
  quoted_snapshot?: {
    source_type?: string;
    excerpt?: string;
    author_display?: string;
    source_created_at?: string | null;
  };
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
  /** 타임라인 행의 작성자 UUID (조인 실패 시에도 평가 매칭에 사용) */
  created_by?: string | null;
  created_by_user?: TimelineEventCreatedBy;
}

/**
 * 후보자(Candidate) 관련 타입 정의
 * 목록/상세 페이지에서 공통 사용
 */

export type CandidateStatus =
  | "pending"
  | "in_progress"
  | "confirmed"
  | "rejected"
  | "issue";

export interface CandidateParsedData {
  match_score?: number;
  skills?: string[];
  experience?: string;
  education?: string;
  location?: string;
  resume_file_name?: string;
  resume_file_size?: number;
  resume_uploaded_at?: string;
  /** 생년월일 등 파싱 결과 (표시용) */
  birth_date?: string;
  portfolio_url?: string;
  github_url?: string;
}

/** DB ai_interview_questions JSONB 항목 */
export interface AiInterviewQuestionItem {
  question: string;
  intent?: string;
}

/** 목록/상세 공통 후보자 타입 (상세 API 응답은 추가 필드 포함) */
export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: CandidateStatus;
  current_stage_id: string | null;
  job_post_id: string;
  ai_score?: number | null;
  parsed_data: CandidateParsedData | null;
  created_at: string;
  job_posts?: {
    id?: string;
    title: string;
    description?: string;
    process_id?: string;
    processes?: {
      id?: string;
      name?: string;
      stages?: Array<{ id: string; name: string; order: number }>;
    };
  };
  /** 상세 조회 시 존재 (목록에서는 없을 수 있음) */
  token?: string;
  resume_file_url?: string | null;
  ai_summary?: string | null;
  ai_strengths?: string[] | null;
  ai_weaknesses?: string[] | null;
  ai_analysis_status?: string | null;
  current_salary?: string | null;
  expected_salary?: string | null;
  skills?: string[] | null;
  /** DB 컬럼 (상세 조회 시) */
  education?: string | null;
  experience?: string | null;
  ai_interview_questions?: AiInterviewQuestionItem[] | null;
}

/** 아카이브 필터용 확장 (archived 목록에서 archive_reason 사용) */
export interface CandidateWithArchiveReason extends Candidate {
  archive_reason?: string;
}

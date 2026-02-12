-- ============================================
-- RecruitOps 완전한 데이터베이스 스키마
-- ============================================
-- 이 파일은 모든 마이그레이션을 통합한 완전한 스키마입니다.
-- Supabase 대시보드의 SQL Editor에서 이 파일 전체를 실행하세요.
-- 
-- 실행 방법:
-- 1. https://app.supabase.com 접속
-- 2. 프로젝트 선택
-- 3. 좌측 메뉴에서 "SQL Editor" 클릭
-- 4. "New query" 클릭
-- 5. 아래 전체 내용을 복사하여 붙여넣기
-- 6. "Run" 버튼 클릭
-- ============================================


-- ============================================
-- 001_initial_schema.sql
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'recruiter' CHECK (role IN ('admin', 'recruiter', 'interviewer')),
  calendar_provider TEXT CHECK (calendar_provider IN ('google', 'outlook')),
  calendar_access_token TEXT,
  calendar_refresh_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processes table
CREATE TABLE processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job posts table
CREATE TABLE job_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidates table
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'confirmed', 'rejected', 'issue')),
  current_stage_id TEXT,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedules table
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'completed')),
  interviewer_ids UUID[] NOT NULL DEFAULT '{}',
  candidate_response TEXT CHECK (candidate_response IN ('accepted', 'rejected', 'pending')),
  beverage_preference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedule options table (AI-generated options)
CREATE TABLE schedule_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Timeline events table
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('system_log', 'schedule_created', 'schedule_confirmed', 'stage_changed')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_job_posts_organization_id ON job_posts(organization_id);
CREATE INDEX idx_candidates_job_post_id ON candidates(job_post_id);
CREATE INDEX idx_candidates_token ON candidates(token);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_schedules_candidate_id ON schedules(candidate_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedule_options_schedule_id ON schedule_options(schedule_id);
CREATE INDEX idx_timeline_events_candidate_id ON timeline_events(candidate_id);
CREATE INDEX idx_timeline_events_created_at ON timeline_events(created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processes_updated_at BEFORE UPDATE ON processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_posts_updated_at BEFORE UPDATE ON job_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Users: Users can view users in their organization
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Users: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Processes: Users can view processes in their organization
CREATE POLICY "Users can view processes in their organization"
  ON processes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Processes: Users can manage processes in their organization
CREATE POLICY "Users can manage processes in their organization"
  ON processes FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Job posts: Users can view job posts in their organization
CREATE POLICY "Users can view job posts in their organization"
  ON job_posts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Job posts: Users can manage job posts in their organization
CREATE POLICY "Users can manage job posts in their organization"
  ON job_posts FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Candidates: Users can view candidates in their organization
CREATE POLICY "Users can view candidates in their organization"
  ON candidates FOR SELECT
  USING (
    job_post_id IN (
      SELECT id FROM job_posts WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Candidates: Users can manage candidates in their organization
CREATE POLICY "Users can manage candidates in their organization"
  ON candidates FOR ALL
  USING (
    job_post_id IN (
      SELECT id FROM job_posts WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Schedules: Users can view schedules for candidates in their organization or if they are an interviewer
CREATE POLICY "Users can view relevant schedules"
  ON schedules FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
    OR auth.uid() = ANY(interviewer_ids)
  );

-- Schedules: Users can manage schedules for candidates in their organization
CREATE POLICY "Users can manage schedules in their organization"
  ON schedules FOR ALL
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Schedule options: Same as schedules
CREATE POLICY "Users can view schedule options"
  ON schedule_options FOR SELECT
  USING (
    schedule_id IN (
      SELECT id FROM schedules WHERE candidate_id IN (
        SELECT id FROM candidates WHERE job_post_id IN (
          SELECT id FROM job_posts WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "Users can manage schedule options"
  ON schedule_options FOR ALL
  USING (
    schedule_id IN (
      SELECT id FROM schedules WHERE candidate_id IN (
        SELECT id FROM candidates WHERE job_post_id IN (
          SELECT id FROM job_posts WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- Timeline events: Users can view timeline events for candidates in their organization
CREATE POLICY "Users can view timeline events"
  ON timeline_events FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Timeline events: Users can create timeline events for candidates in their organization
CREATE POLICY "Users can create timeline events"
  ON timeline_events FOR INSERT
  WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );



-- ============================================
-- 002_phase2_features.sql
-- ============================================

-- Phase 2: 협업 강화 기능 추가
-- Timeline & Scorecard, Email Sync, Comments 기능

-- 1. Timeline Events 타입 확장
-- 기존 타입에 email, comment, scorecard, approval 추가
ALTER TABLE timeline_events 
  DROP CONSTRAINT IF EXISTS timeline_events_type_check;

ALTER TABLE timeline_events
  ADD CONSTRAINT timeline_events_type_check 
  CHECK (type IN (
    'system_log', 
    'schedule_created', 
    'schedule_confirmed', 
    'stage_changed',
    'email',
    'comment',
    'scorecard',
    'approval'
  ));

-- 2. Emails 테이블 (이메일 동기화)
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE, -- 이메일 서버의 고유 ID
  subject TEXT,
  body TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Comments 테이블 (코멘트 및 멘션)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_user_ids UUID[] DEFAULT '{}', -- 멘션된 사용자 ID 배열
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- 대댓글 지원
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Scorecards 테이블 (면접 평가표)
CREATE TABLE scorecards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  criteria_scores JSONB DEFAULT '{}'::jsonb, -- 세부 평가 항목 (예: {"technical": 4, "communication": 5})
  strengths TEXT,
  weaknesses TEXT,
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(schedule_id, interviewer_id) -- 면접당 면접관당 하나의 평가표만
);

-- 인덱스 추가
CREATE INDEX idx_emails_candidate_id ON emails(candidate_id);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_synced_at ON emails(synced_at DESC);
CREATE INDEX idx_emails_direction ON emails(direction);

CREATE INDEX idx_comments_candidate_id ON comments(candidate_id);
CREATE INDEX idx_comments_created_by ON comments(created_by);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
-- 멘션 검색을 위한 GIN 인덱스
CREATE INDEX idx_comments_mentioned_user_ids ON comments USING GIN(mentioned_user_ids);

CREATE INDEX idx_scorecards_schedule_id ON scorecards(schedule_id);
CREATE INDEX idx_scorecards_candidate_id ON scorecards(candidate_id);
CREATE INDEX idx_scorecards_interviewer_id ON scorecards(interviewer_id);
CREATE INDEX idx_scorecards_submitted_at ON scorecards(submitted_at DESC);

-- updated_at 트리거 추가
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scorecards_updated_at BEFORE UPDATE ON scorecards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 활성화
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecards ENABLE ROW LEVEL SECURITY;

-- RLS 정책: Emails
-- 조직 내 사용자는 후보자의 이메일을 조회/생성 가능
CREATE POLICY "Users can view emails in their organization"
  ON emails FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage emails in their organization"
  ON emails FOR ALL
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- RLS 정책: Comments
-- 조직 내 사용자는 후보자의 코멘트를 조회/생성/수정 가능
CREATE POLICY "Users can view comments in their organization"
  ON comments FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create comments in their organization"
  ON comments FOR INSERT
  WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (created_by = auth.uid());

-- RLS 정책: Scorecards
-- 조직 내 사용자는 평가표를 조회 가능
-- 면접관은 자신이 참여한 면접의 평가표를 작성 가능
CREATE POLICY "Users can view scorecards in their organization"
  ON scorecards FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Interviewers can create scorecards for their interviews"
  ON scorecards FOR INSERT
  WITH CHECK (
    interviewer_id = auth.uid()
    AND schedule_id IN (
      SELECT id FROM schedules WHERE auth.uid() = ANY(interviewer_ids)
    )
  );

CREATE POLICY "Interviewers can update their own scorecards"
  ON scorecards FOR UPDATE
  USING (interviewer_id = auth.uid());

-- Timeline Events 업데이트 정책 추가 (기존에 없었음)
CREATE POLICY "Users can update timeline events in their organization"
  ON timeline_events FOR UPDATE
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Scorecard 작성 시 자동으로 Timeline Event 생성하는 함수
CREATE OR REPLACE FUNCTION create_scorecard_timeline_event()
RETURNS TRIGGER AS $$
BEGIN
  -- 평가표가 제출되었을 때만 타임라인 이벤트 생성
  IF NEW.submitted_at IS NOT NULL AND (OLD.submitted_at IS NULL OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at) THEN
    INSERT INTO timeline_events (
      candidate_id,
      type,
      content,
      created_by
    ) VALUES (
      NEW.candidate_id,
      'scorecard',
      jsonb_build_object(
        'scorecard_id', NEW.id,
        'schedule_id', NEW.schedule_id,
        'interviewer_id', NEW.interviewer_id,
        'overall_rating', NEW.overall_rating,
        'criteria_scores', NEW.criteria_scores,
        'strengths', NEW.strengths,
        'weaknesses', NEW.weaknesses
      ),
      NEW.interviewer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scorecard_timeline_event_trigger
  AFTER UPDATE ON scorecards
  FOR EACH ROW
  WHEN (NEW.submitted_at IS NOT NULL)
  EXECUTE FUNCTION create_scorecard_timeline_event();

-- Email 동기화 시 자동으로 Timeline Event 생성하는 함수
CREATE OR REPLACE FUNCTION create_email_timeline_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO timeline_events (
    candidate_id,
    type,
    content,
    created_by
  ) VALUES (
    NEW.candidate_id,
    'email',
    jsonb_build_object(
      'email_id', NEW.id,
      'subject', NEW.subject,
      'direction', NEW.direction,
      'from_email', NEW.from_email,
      'to_email', NEW.to_email,
      'sent_at', NEW.sent_at,
      'received_at', NEW.received_at
    ),
    NULL -- 이메일은 시스템이 동기화하므로 created_by는 NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_timeline_event_trigger
  AFTER INSERT ON emails
  FOR EACH ROW
  EXECUTE FUNCTION create_email_timeline_event();

-- Comment 생성 시 자동으로 Timeline Event 생성하는 함수
CREATE OR REPLACE FUNCTION create_comment_timeline_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO timeline_events (
    candidate_id,
    type,
    content,
    created_by
  ) VALUES (
    NEW.candidate_id,
    'comment',
    jsonb_build_object(
      'comment_id', NEW.id,
      'content', NEW.content,
      'mentioned_user_ids', NEW.mentioned_user_ids,
      'parent_comment_id', NEW.parent_comment_id
    ),
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_timeline_event_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_timeline_event();



-- ============================================
-- 003_phase3_resume_parsing.sql
-- ============================================

-- Phase 3: ATS 완성 - 이력서 파싱 및 데이터 자산화

-- 1. Candidates 테이블에 이력서 관련 필드 추가
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS resume_file_url TEXT,
  ADD COLUMN IF NOT EXISTS parsed_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]'::jsonb, -- 학력 정보 배열
  ADD COLUMN IF NOT EXISTS skills TEXT[], -- 스킬 배열
  ADD COLUMN IF NOT EXISTS experience JSONB DEFAULT '[]'::jsonb, -- 경력 정보 배열
  ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMP WITH TIME ZONE; -- 파싱 완료 시점

-- 2. Resume Files 테이블 (이력서 파일 관리)
CREATE TABLE resume_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL, -- Supabase Storage 경로
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'doc', 'docx')),
  file_size BIGINT, -- 파일 크기 (bytes)
  parsing_status TEXT NOT NULL DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
  parsed_data JSONB DEFAULT '{}'::jsonb, -- AI 파싱 결과 (원본)
  error_message TEXT, -- 파싱 실패 시 에러 메시지
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Application Submissions 테이블 (지원서 제출 내역) - Phase 3 확장
CREATE TABLE application_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL, -- 지원서 제출 후 후보자로 전환될 수 있음
  -- 지원자 정보 (파싱 전에는 candidate_id가 NULL일 수 있음)
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  -- 이력서 정보
  resume_file_id UUID REFERENCES resume_files(id) ON DELETE SET NULL,
  -- 파싱 상태
  parsing_status TEXT NOT NULL DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
  parsed_data JSONB DEFAULT '{}'::jsonb,
  -- 추가 정보
  cover_letter TEXT,
  source TEXT, -- 지원 경로 (예: 'website', 'linkedin', 'referral')
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX idx_candidates_parsed_at ON candidates(parsed_at DESC);
CREATE INDEX idx_candidates_skills ON candidates USING GIN(skills); -- 배열 검색용 GIN 인덱스

CREATE INDEX idx_resume_files_candidate_id ON resume_files(candidate_id);
CREATE INDEX idx_resume_files_parsing_status ON resume_files(parsing_status);
CREATE INDEX idx_resume_files_created_at ON resume_files(created_at DESC);

CREATE INDEX idx_application_submissions_job_post_id ON application_submissions(job_post_id);
CREATE INDEX idx_application_submissions_candidate_id ON application_submissions(candidate_id);
CREATE INDEX idx_application_submissions_email ON application_submissions(email);
CREATE INDEX idx_application_submissions_parsing_status ON application_submissions(parsing_status);
CREATE INDEX idx_application_submissions_submitted_at ON application_submissions(submitted_at DESC);

-- updated_at 트리거 추가
CREATE TRIGGER update_resume_files_updated_at BEFORE UPDATE ON resume_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_application_submissions_updated_at BEFORE UPDATE ON application_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 활성화
ALTER TABLE resume_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_submissions ENABLE ROW LEVEL SECURITY;

-- RLS 정책: Resume Files
-- 조직 내 사용자는 후보자의 이력서 파일을 조회 가능
CREATE POLICY "Users can view resume files in their organization"
  ON resume_files FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage resume files in their organization"
  ON resume_files FOR ALL
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- RLS 정책: Application Submissions
-- 조직 내 사용자는 채용 공고의 지원서를 조회 가능
CREATE POLICY "Users can view application submissions in their organization"
  ON application_submissions FOR SELECT
  USING (
    job_post_id IN (
      SELECT id FROM job_posts WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage application submissions in their organization"
  ON application_submissions FOR ALL
  USING (
    job_post_id IN (
      SELECT id FROM job_posts WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- 이력서 파싱 완료 시 Candidates 테이블 업데이트하는 함수
CREATE OR REPLACE FUNCTION update_candidate_from_resume_parsing()
RETURNS TRIGGER AS $$
DECLARE
  parsed_name TEXT;
  parsed_email TEXT;
  parsed_phone TEXT;
  parsed_education JSONB;
  parsed_skills TEXT[];
  parsed_experience JSONB;
BEGIN
  -- 파싱이 완료되었고, parsed_data가 있는 경우
  IF NEW.parsing_status = 'completed' AND NEW.parsed_data IS NOT NULL AND jsonb_typeof(NEW.parsed_data) = 'object' THEN
    -- parsed_data에서 정보 추출
    parsed_name := NEW.parsed_data->>'name';
    parsed_email := NEW.parsed_data->>'email';
    parsed_phone := NEW.parsed_data->>'phone';
    parsed_education := COALESCE(NEW.parsed_data->'education', '[]'::jsonb);
    parsed_skills := ARRAY(SELECT jsonb_array_elements_text(NEW.parsed_data->'skills'));
    parsed_experience := COALESCE(NEW.parsed_data->'experience', '[]'::jsonb);
    
    -- Candidates 테이블 업데이트
    UPDATE candidates
    SET
      parsed_data = NEW.parsed_data,
      education = parsed_education,
      skills = parsed_skills,
      experience = parsed_experience,
      parsed_at = NOW()
    WHERE id = NEW.candidate_id
      AND (parsed_at IS NULL OR parsed_at < NEW.updated_at); -- 최신 파싱 결과만 반영
    
    -- 이름, 이메일, 전화번호가 있고 기존 값이 비어있는 경우에만 업데이트
    IF parsed_name IS NOT NULL AND parsed_name != '' THEN
      UPDATE candidates
      SET name = COALESCE(NULLIF(name, ''), parsed_name)
      WHERE id = NEW.candidate_id AND (name IS NULL OR name = '');
    END IF;
    
    IF parsed_email IS NOT NULL AND parsed_email != '' THEN
      UPDATE candidates
      SET email = COALESCE(NULLIF(email, ''), parsed_email)
      WHERE id = NEW.candidate_id AND (email IS NULL OR email = '');
    END IF;
    
    IF parsed_phone IS NOT NULL AND parsed_phone != '' THEN
      UPDATE candidates
      SET phone = COALESCE(NULLIF(phone, ''), parsed_phone)
      WHERE id = NEW.candidate_id AND (phone IS NULL OR phone = '');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resume_file_parsing_complete_trigger
  AFTER UPDATE ON resume_files
  FOR EACH ROW
  WHEN (NEW.parsing_status = 'completed' AND OLD.parsing_status != 'completed')
  EXECUTE FUNCTION update_candidate_from_resume_parsing();

-- Application Submission에서 Candidate로 전환하는 함수 (선택적)
-- 지원서가 승인되어 후보자로 전환될 때 사용
CREATE OR REPLACE FUNCTION convert_submission_to_candidate(
  submission_id UUID
)
RETURNS UUID AS $$
DECLARE
  new_candidate_id UUID;
  submission_record RECORD;
BEGIN
  SELECT * INTO submission_record
  FROM application_submissions
  WHERE id = submission_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application submission not found';
  END IF;
  
  -- Candidate 생성
  INSERT INTO candidates (
    job_post_id,
    name,
    email,
    phone,
    status,
    resume_file_url,
    parsed_data,
    education,
    skills,
    experience,
    parsed_at
  )
  SELECT
    submission_record.job_post_id,
    COALESCE(submission_record.name, submission_record.parsed_data->>'name'),
    submission_record.email,
    COALESCE(submission_record.phone, submission_record.parsed_data->>'phone'),
    'pending',
    (SELECT file_url FROM resume_files WHERE id = submission_record.resume_file_id),
    submission_record.parsed_data,
    COALESCE(submission_record.parsed_data->'education', '[]'::jsonb),
    ARRAY(SELECT jsonb_array_elements_text(submission_record.parsed_data->'skills')),
    COALESCE(submission_record.parsed_data->'experience', '[]'::jsonb),
    CASE WHEN submission_record.parsing_status = 'completed' THEN NOW() ELSE NULL END
  RETURNING id INTO new_candidate_id;
  
  -- Application submission에 candidate_id 연결
  UPDATE application_submissions
  SET candidate_id = new_candidate_id
  WHERE id = submission_id;
  
  RETURN new_candidate_id;
END;
$$ LANGUAGE plpgsql;



-- ============================================
-- RecruitOps 완전한 데이터베이스 스키마
-- Phase 1, 2, 3 모든 기능 포함
-- ============================================

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 텍스트 검색용

-- ============================================
-- 1. 핵심 엔티티 (Core Entities)
-- ============================================

-- Organizations (조직)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (사용자)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'recruiter' CHECK (role IN ('admin', 'recruiter', 'interviewer')),
  calendar_provider TEXT CHECK (calendar_provider IN ('google', 'outlook')),
  calendar_access_token TEXT,
  calendar_refresh_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Processes (채용 프로세스 템플릿)
CREATE TABLE processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Job Posts (채용 공고)
CREATE TABLE job_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. 후보자 관리 (Candidate Management)
-- ============================================

-- Candidates (후보자)
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'confirmed', 'rejected', 'issue')),
  current_stage_id TEXT,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  resume_file_url TEXT,
  parsed_data JSONB,
  education TEXT,
  skills TEXT[],
  experience TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. 일정 관리 (Schedule Management)
-- ============================================

-- Schedules (면접 일정)
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'completed')),
  interviewer_ids UUID[] NOT NULL DEFAULT '{}',
  candidate_response TEXT CHECK (candidate_response IN ('accepted', 'rejected', 'pending')),
  beverage_preference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schedule Options (AI 생성 일정 옵션)
CREATE TABLE schedule_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. 타임라인 및 협업 (Timeline & Collaboration)
-- ============================================

-- Timeline Events (타임라인 이벤트)
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('system_log', 'schedule_created', 'schedule_confirmed', 'stage_changed', 'email', 'comment', 'scorecard', 'approval')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emails (이메일) - Phase 2
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE,
  subject TEXT,
  body TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments (코멘트) - Phase 2
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_user_ids UUID[] DEFAULT '{}',
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. 평가 (Evaluation) - Phase 2
-- ============================================

-- Scorecards (면접 평가표)
CREATE TABLE scorecards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  criteria_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  strengths TEXT,
  weaknesses TEXT,
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 6. 이력서 파싱 (Resume Parsing) - Phase 3
-- ============================================

-- Resume Files (이력서 파일)
CREATE TABLE resume_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'doc', 'docx')),
  parsing_status TEXT NOT NULL DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
  parsed_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Application Submissions (지원서 제출) - Phase 3
CREATE TABLE application_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  submitted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 인덱스 생성
-- ============================================

-- Organizations
CREATE INDEX idx_organizations_created_at ON organizations(created_at DESC);

-- Users
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- Processes
CREATE INDEX idx_processes_organization_id ON processes(organization_id);

-- Job Posts
CREATE INDEX idx_job_posts_organization_id ON job_posts(organization_id);
CREATE INDEX idx_job_posts_process_id ON job_posts(process_id);

-- Candidates
CREATE INDEX idx_candidates_job_post_id ON candidates(job_post_id);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_token ON candidates(token);
CREATE INDEX idx_candidates_email ON candidates(email);

-- Schedules
CREATE INDEX idx_schedules_candidate_id ON schedules(candidate_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_scheduled_at ON schedules(scheduled_at);
CREATE INDEX idx_schedules_interviewer_ids ON schedules USING GIN(interviewer_ids);

-- Schedule Options
CREATE INDEX idx_schedule_options_schedule_id ON schedule_options(schedule_id);
CREATE INDEX idx_schedule_options_status ON schedule_options(status);

-- Timeline Events
CREATE INDEX idx_timeline_events_candidate_id ON timeline_events(candidate_id);
CREATE INDEX idx_timeline_events_created_at ON timeline_events(created_at DESC);
CREATE INDEX idx_timeline_events_type ON timeline_events(type);

-- Emails
CREATE INDEX idx_emails_candidate_id ON emails(candidate_id);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_synced_at ON emails(synced_at DESC);

-- Comments
CREATE INDEX idx_comments_candidate_id ON comments(candidate_id);
CREATE INDEX idx_comments_created_by ON comments(created_by);
CREATE INDEX idx_comments_mentioned_user_ids ON comments USING GIN(mentioned_user_ids);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);

-- Scorecards
CREATE INDEX idx_scorecards_schedule_id ON scorecards(schedule_id);
CREATE INDEX idx_scorecards_candidate_id ON scorecards(candidate_id);
CREATE INDEX idx_scorecards_interviewer_id ON scorecards(interviewer_id);

-- Resume Files
CREATE INDEX idx_resume_files_candidate_id ON resume_files(candidate_id);
CREATE INDEX idx_resume_files_parsing_status ON resume_files(parsing_status);

-- Application Submissions
CREATE INDEX idx_application_submissions_job_post_id ON application_submissions(job_post_id);
CREATE INDEX idx_application_submissions_candidate_id ON application_submissions(candidate_id);
CREATE INDEX idx_application_submissions_status ON application_submissions(status);

-- ============================================
-- 자동 업데이트 함수
-- ============================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
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

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scorecards_updated_at BEFORE UPDATE ON scorecards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resume_files_updated_at BEFORE UPDATE ON resume_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_application_submissions_updated_at BEFORE UPDATE ON application_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) 설정
-- ============================================

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert own organization data" ON organizations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own organization data" ON organizations
  FOR UPDATE USING (
    id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete own organization data" ON organizations
  FOR DELETE USING (
    id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON users
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (id = auth.uid());

-- Processes
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON processes
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert own organization data" ON processes
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own organization data" ON processes
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete own organization data" ON processes
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Job Posts
ALTER TABLE job_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON job_posts
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert own organization data" ON job_posts
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own organization data" ON job_posts
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete own organization data" ON job_posts
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Candidates
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON candidates
  FOR SELECT USING (
    job_post_id IN (
      SELECT id FROM job_posts 
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Candidates can view own data" ON candidates
  FOR SELECT USING (
    token = current_setting('request.headers', true)::json->>'x-candidate-token'
  );

CREATE POLICY "Users can insert own organization data" ON candidates
  FOR INSERT WITH CHECK (
    job_post_id IN (
      SELECT id FROM job_posts 
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update own organization data" ON candidates
  FOR UPDATE USING (
    job_post_id IN (
      SELECT id FROM job_posts 
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own organization data" ON candidates
  FOR DELETE USING (
    job_post_id IN (
      SELECT id FROM job_posts 
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

-- Schedules
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON schedules
  FOR SELECT USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert own organization data" ON schedules
  FOR INSERT WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update own organization data" ON schedules
  FOR UPDATE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete own organization data" ON schedules
  FOR DELETE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

-- Schedule Options
ALTER TABLE schedule_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON schedule_options
  FOR SELECT USING (
    schedule_id IN (
      SELECT id FROM schedules 
      WHERE candidate_id IN (
        SELECT id FROM candidates 
        WHERE job_post_id IN (
          SELECT id FROM job_posts 
          WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
        )
      )
    )
  );

CREATE POLICY "Users can insert own organization data" ON schedule_options
  FOR INSERT WITH CHECK (
    schedule_id IN (
      SELECT id FROM schedules 
      WHERE candidate_id IN (
        SELECT id FROM candidates 
        WHERE job_post_id IN (
          SELECT id FROM job_posts 
          WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
        )
      )
    )
  );

CREATE POLICY "Users can update own organization data" ON schedule_options
  FOR UPDATE USING (
    schedule_id IN (
      SELECT id FROM schedules 
      WHERE candidate_id IN (
        SELECT id FROM candidates 
        WHERE job_post_id IN (
          SELECT id FROM job_posts 
          WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
        )
      )
    )
  );

CREATE POLICY "Users can delete own organization data" ON schedule_options
  FOR DELETE USING (
    schedule_id IN (
      SELECT id FROM schedules 
      WHERE candidate_id IN (
        SELECT id FROM candidates 
        WHERE job_post_id IN (
          SELECT id FROM job_posts 
          WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
        )
      )
    )
  );

-- Timeline Events
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON timeline_events
  FOR SELECT USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert own organization data" ON timeline_events
  FOR INSERT WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update own organization data" ON timeline_events
  FOR UPDATE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete own organization data" ON timeline_events
  FOR DELETE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

-- Emails
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON emails
  FOR SELECT USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert own organization data" ON emails
  FOR INSERT WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update own organization data" ON emails
  FOR UPDATE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete own organization data" ON emails
  FOR DELETE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

-- Comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON comments
  FOR SELECT USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert own organization data" ON comments
  FOR INSERT WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update own organization data" ON comments
  FOR UPDATE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Users can delete own organization data" ON comments
  FOR DELETE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    ) AND created_by = auth.uid()
  );

-- Scorecards
ALTER TABLE scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON scorecards
  FOR SELECT USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert own organization data" ON scorecards
  FOR INSERT WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update own organization data" ON scorecards
  FOR UPDATE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete own organization data" ON scorecards
  FOR DELETE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

-- Resume Files
ALTER TABLE resume_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON resume_files
  FOR SELECT USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert own organization data" ON resume_files
  FOR INSERT WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update own organization data" ON resume_files
  FOR UPDATE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete own organization data" ON resume_files
  FOR DELETE USING (
    candidate_id IN (
      SELECT id FROM candidates 
      WHERE job_post_id IN (
        SELECT id FROM job_posts 
        WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      )
    )
  );

-- Application Submissions
ALTER TABLE application_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization data" ON application_submissions
  FOR SELECT USING (
    job_post_id IN (
      SELECT id FROM job_posts 
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own organization data" ON application_submissions
  FOR INSERT WITH CHECK (
    job_post_id IN (
      SELECT id FROM job_posts 
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update own organization data" ON application_submissions
  FOR UPDATE USING (
    job_post_id IN (
      SELECT id FROM job_posts 
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own organization data" ON application_submissions
  FOR DELETE USING (
    job_post_id IN (
      SELECT id FROM job_posts 
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

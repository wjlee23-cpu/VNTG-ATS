-- ============================================
-- RecruitOps 완전한 데이터베이스 스키마
-- ============================================
-- 이 파일은 모든 마이그레이션을 통합한 완전한 스키마입니다.
-- 새 프로젝트를 시작할 때 이 파일 하나만 실행하면 됩니다.
-- 
-- 기존 프로젝트에 적용하는 경우:
-- - 001_initial_schema.sql
-- - 002_phase2_features.sql  
-- - 003_phase3_resume_parsing.sql
-- 순서대로 실행하세요.
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Phase 1: MVP 기본 테이블
-- ============================================

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
  -- Phase 3: 이력서 관련 필드
  resume_file_url TEXT,
  parsed_data JSONB DEFAULT '{}'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  skills TEXT[],
  experience JSONB DEFAULT '[]'::jsonb,
  parsed_at TIMESTAMP WITH TIME ZONE,
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
  type TEXT NOT NULL CHECK (type IN (
    'system_log', 
    'schedule_created', 
    'schedule_confirmed', 
    'stage_changed',
    'email',
    'comment',
    'scorecard',
    'approval'
  )),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Phase 2: 협업 강화 기능
-- ============================================

-- Emails table (이메일 동기화)
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE,
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

-- Comments table (코멘트 및 멘션)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_user_ids UUID[] DEFAULT '{}',
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scorecards table (면접 평가표)
CREATE TABLE scorecards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  criteria_scores JSONB DEFAULT '{}'::jsonb,
  strengths TEXT,
  weaknesses TEXT,
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(schedule_id, interviewer_id)
);

-- ============================================
-- Phase 3: 이력서 파싱 및 ATS 완성
-- ============================================

-- Resume Files table
CREATE TABLE resume_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'doc', 'docx')),
  file_size BIGINT,
  parsing_status TEXT NOT NULL DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
  parsed_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application Submissions table
CREATE TABLE application_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  resume_file_id UUID REFERENCES resume_files(id) ON DELETE SET NULL,
  parsing_status TEXT NOT NULL DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
  parsed_data JSONB DEFAULT '{}'::jsonb,
  cover_letter TEXT,
  source TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 인덱스
-- ============================================

-- Phase 1 인덱스
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

-- Phase 2 인덱스
CREATE INDEX idx_emails_candidate_id ON emails(candidate_id);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_synced_at ON emails(synced_at DESC);
CREATE INDEX idx_emails_direction ON emails(direction);

CREATE INDEX idx_comments_candidate_id ON comments(candidate_id);
CREATE INDEX idx_comments_created_by ON comments(created_by);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_mentioned_user_ids ON comments USING GIN(mentioned_user_ids);

CREATE INDEX idx_scorecards_schedule_id ON scorecards(schedule_id);
CREATE INDEX idx_scorecards_candidate_id ON scorecards(candidate_id);
CREATE INDEX idx_scorecards_interviewer_id ON scorecards(interviewer_id);
CREATE INDEX idx_scorecards_submitted_at ON scorecards(submitted_at DESC);

-- Phase 3 인덱스
CREATE INDEX idx_candidates_parsed_at ON candidates(parsed_at DESC);
CREATE INDEX idx_candidates_skills ON candidates USING GIN(skills);

CREATE INDEX idx_resume_files_candidate_id ON resume_files(candidate_id);
CREATE INDEX idx_resume_files_parsing_status ON resume_files(parsing_status);
CREATE INDEX idx_resume_files_created_at ON resume_files(created_at DESC);

CREATE INDEX idx_application_submissions_job_post_id ON application_submissions(job_post_id);
CREATE INDEX idx_application_submissions_candidate_id ON application_submissions(candidate_id);
CREATE INDEX idx_application_submissions_email ON application_submissions(email);
CREATE INDEX idx_application_submissions_parsing_status ON application_submissions(parsing_status);
CREATE INDEX idx_application_submissions_submitted_at ON application_submissions(submitted_at DESC);

-- ============================================
-- 트리거 함수
-- ============================================

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

CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
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
-- 자동화 트리거 함수
-- ============================================

-- Scorecard 작성 시 Timeline Event 생성
CREATE OR REPLACE FUNCTION create_scorecard_timeline_event()
RETURNS TRIGGER AS $$
BEGIN
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

-- Email 동기화 시 Timeline Event 생성
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
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_timeline_event_trigger
  AFTER INSERT ON emails
  FOR EACH ROW
  EXECUTE FUNCTION create_email_timeline_event();

-- Comment 생성 시 Timeline Event 생성
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

-- 이력서 파싱 완료 시 Candidates 업데이트
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
  IF NEW.parsing_status = 'completed' AND NEW.parsed_data IS NOT NULL AND jsonb_typeof(NEW.parsed_data) = 'object' THEN
    parsed_name := NEW.parsed_data->>'name';
    parsed_email := NEW.parsed_data->>'email';
    parsed_phone := NEW.parsed_data->>'phone';
    parsed_education := COALESCE(NEW.parsed_data->'education', '[]'::jsonb);
    parsed_skills := ARRAY(SELECT jsonb_array_elements_text(NEW.parsed_data->'skills'));
    parsed_experience := COALESCE(NEW.parsed_data->'experience', '[]'::jsonb);
    
    UPDATE candidates
    SET
      parsed_data = NEW.parsed_data,
      education = parsed_education,
      skills = parsed_skills,
      experience = parsed_experience,
      parsed_at = NOW()
    WHERE id = NEW.candidate_id
      AND (parsed_at IS NULL OR parsed_at < NEW.updated_at);
    
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

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- RLS 활성화
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_submissions ENABLE ROW LEVEL SECURITY;

-- Organizations 정책
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Users 정책
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Processes 정책
CREATE POLICY "Users can view processes in their organization"
  ON processes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage processes in their organization"
  ON processes FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Job posts 정책
CREATE POLICY "Users can view job posts in their organization"
  ON job_posts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage job posts in their organization"
  ON job_posts FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Candidates 정책
CREATE POLICY "Users can view candidates in their organization"
  ON candidates FOR SELECT
  USING (
    job_post_id IN (
      SELECT id FROM job_posts WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage candidates in their organization"
  ON candidates FOR ALL
  USING (
    job_post_id IN (
      SELECT id FROM job_posts WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Schedules 정책
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

-- Schedule options 정책
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

-- Timeline events 정책
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

-- Emails 정책
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

-- Comments 정책
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

-- Scorecards 정책
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

-- Resume files 정책
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

-- Application submissions 정책
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

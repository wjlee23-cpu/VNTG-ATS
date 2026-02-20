-- ============================================
-- RecruitOps 완전한 데이터베이스 설정
-- 기존 테이블 삭제 → 새 스키마 생성 → 더미 데이터 삽입
-- ============================================
-- 이 파일을 Supabase 대시보드 > SQL Editor에서 실행하세요.
-- ============================================

-- ============================================
-- 1단계: 기존 테이블 및 관련 객체 모두 삭제
-- ============================================

-- RLS 정책 삭제
DROP POLICY IF EXISTS "Users can view own organization data" ON application_submissions;
DROP POLICY IF EXISTS "Users can insert own organization data" ON application_submissions;
DROP POLICY IF EXISTS "Users can update own organization data" ON application_submissions;
DROP POLICY IF EXISTS "Users can delete own organization data" ON application_submissions;

DROP POLICY IF EXISTS "Users can view own organization data" ON resume_files;
DROP POLICY IF EXISTS "Users can insert own organization data" ON resume_files;
DROP POLICY IF EXISTS "Users can update own organization data" ON resume_files;
DROP POLICY IF EXISTS "Users can delete own organization data" ON resume_files;

DROP POLICY IF EXISTS "Users can view own organization data" ON scorecards;
DROP POLICY IF EXISTS "Users can insert own organization data" ON scorecards;
DROP POLICY IF EXISTS "Users can update own organization data" ON scorecards;
DROP POLICY IF EXISTS "Users can delete own organization data" ON scorecards;

DROP POLICY IF EXISTS "Users can view own organization data" ON comments;
DROP POLICY IF EXISTS "Users can insert own organization data" ON comments;
DROP POLICY IF EXISTS "Users can update own organization data" ON comments;
DROP POLICY IF EXISTS "Users can delete own organization data" ON comments;

DROP POLICY IF EXISTS "Users can view own organization data" ON emails;
DROP POLICY IF EXISTS "Users can insert own organization data" ON emails;
DROP POLICY IF EXISTS "Users can update own organization data" ON emails;
DROP POLICY IF EXISTS "Users can delete own organization data" ON emails;

DROP POLICY IF EXISTS "Users can view own organization data" ON timeline_events;
DROP POLICY IF EXISTS "Users can insert own organization data" ON timeline_events;
DROP POLICY IF EXISTS "Users can update own organization data" ON timeline_events;
DROP POLICY IF EXISTS "Users can delete own organization data" ON timeline_events;

DROP POLICY IF EXISTS "Users can view own organization data" ON schedule_options;
DROP POLICY IF EXISTS "Users can insert own organization data" ON schedule_options;
DROP POLICY IF EXISTS "Users can update own organization data" ON schedule_options;
DROP POLICY IF EXISTS "Users can delete own organization data" ON schedule_options;

DROP POLICY IF EXISTS "Users can view own organization data" ON schedules;
DROP POLICY IF EXISTS "Users can insert own organization data" ON schedules;
DROP POLICY IF EXISTS "Users can update own organization data" ON schedules;
DROP POLICY IF EXISTS "Users can delete own organization data" ON schedules;

DROP POLICY IF EXISTS "Users can view own organization data" ON candidates;
DROP POLICY IF EXISTS "Users can insert own organization data" ON candidates;
DROP POLICY IF EXISTS "Users can update own organization data" ON candidates;
DROP POLICY IF EXISTS "Users can delete own organization data" ON candidates;
DROP POLICY IF EXISTS "Candidates can view own data" ON candidates;

DROP POLICY IF EXISTS "Users can view own organization data" ON job_posts;
DROP POLICY IF EXISTS "Users can insert own organization data" ON job_posts;
DROP POLICY IF EXISTS "Users can update own organization data" ON job_posts;
DROP POLICY IF EXISTS "Users can delete own organization data" ON job_posts;

DROP POLICY IF EXISTS "Users can view own organization data" ON processes;
DROP POLICY IF EXISTS "Users can insert own organization data" ON processes;
DROP POLICY IF EXISTS "Users can update own organization data" ON processes;
DROP POLICY IF EXISTS "Users can delete own organization data" ON processes;

DROP POLICY IF EXISTS "Users can view own organization data" ON users;
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

DROP POLICY IF EXISTS "Users can view own organization data" ON organizations;
DROP POLICY IF EXISTS "Users can insert own organization data" ON organizations;
DROP POLICY IF EXISTS "Users can update own organization data" ON organizations;
DROP POLICY IF EXISTS "Users can delete own organization data" ON organizations;

-- 테이블 삭제 (외래키 제약 때문에 역순으로)
DROP TABLE IF EXISTS application_submissions CASCADE;
DROP TABLE IF EXISTS resume_files CASCADE;
DROP TABLE IF EXISTS scorecards CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS emails CASCADE;
DROP TABLE IF EXISTS timeline_events CASCADE;
DROP TABLE IF EXISTS schedule_options CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS job_posts CASCADE;
DROP TABLE IF EXISTS processes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- 함수 삭제
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================
-- 2단계: 새 스키마 생성
-- ============================================

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 텍스트 검색용

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

-- Scorecards (면접 평가표) - Phase 2
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

-- Resume Files (이력서 파일) - Phase 3
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

-- 인덱스 생성
CREATE INDEX idx_organizations_created_at ON organizations(created_at DESC);
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_processes_organization_id ON processes(organization_id);
CREATE INDEX idx_job_posts_organization_id ON job_posts(organization_id);
CREATE INDEX idx_job_posts_process_id ON job_posts(process_id);
CREATE INDEX idx_candidates_job_post_id ON candidates(job_post_id);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_token ON candidates(token);
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_schedules_candidate_id ON schedules(candidate_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_scheduled_at ON schedules(scheduled_at);
CREATE INDEX idx_schedules_interviewer_ids ON schedules USING GIN(interviewer_ids);
CREATE INDEX idx_schedule_options_schedule_id ON schedule_options(schedule_id);
CREATE INDEX idx_schedule_options_status ON schedule_options(status);
CREATE INDEX idx_timeline_events_candidate_id ON timeline_events(candidate_id);
CREATE INDEX idx_timeline_events_created_at ON timeline_events(created_at DESC);
CREATE INDEX idx_timeline_events_type ON timeline_events(type);
CREATE INDEX idx_emails_candidate_id ON emails(candidate_id);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_synced_at ON emails(synced_at DESC);
CREATE INDEX idx_comments_candidate_id ON comments(candidate_id);
CREATE INDEX idx_comments_created_by ON comments(created_by);
CREATE INDEX idx_comments_mentioned_user_ids ON comments USING GIN(mentioned_user_ids);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);
CREATE INDEX idx_scorecards_schedule_id ON scorecards(schedule_id);
CREATE INDEX idx_scorecards_candidate_id ON scorecards(candidate_id);
CREATE INDEX idx_scorecards_interviewer_id ON scorecards(interviewer_id);
CREATE INDEX idx_resume_files_candidate_id ON resume_files(candidate_id);
CREATE INDEX idx_resume_files_parsing_status ON resume_files(parsing_status);
CREATE INDEX idx_application_submissions_job_post_id ON application_submissions(job_post_id);
CREATE INDEX idx_application_submissions_candidate_id ON application_submissions(candidate_id);
CREATE INDEX idx_application_submissions_status ON application_submissions(status);

-- 자동 업데이트 함수
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

-- RLS 설정 (모든 테이블)
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

-- RLS 정책 생성 (간단한 버전 - 개발용)
-- 실제 운영 환경에서는 더 세밀한 정책이 필요합니다.
CREATE POLICY "Enable all for service role" ON organizations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON processes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON job_posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON candidates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON schedule_options FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON timeline_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON emails FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON scorecards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON resume_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON application_submissions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 3단계: 더미 데이터 삽입
-- ============================================

-- 조직 생성
INSERT INTO organizations (name)
VALUES ('VNTG Tech')
ON CONFLICT DO NOTHING;

-- 더미 데이터 생성 (PL/pgSQL 블록)
DO $$
DECLARE
  org_id UUID;
  process_id UUID;
  job_post_ids UUID[];
  candidate_ids UUID[];
  schedule_ids UUID[];
  i INTEGER;
  j INTEGER;
BEGIN
  -- 조직 ID 가져오기
  SELECT id INTO org_id FROM organizations WHERE name = 'VNTG Tech' LIMIT 1;
  
  IF org_id IS NULL THEN
    INSERT INTO organizations (name) VALUES ('VNTG Tech') RETURNING id INTO org_id;
  END IF;

  -- 프로세스 생성
  INSERT INTO processes (organization_id, name, stages)
  VALUES (
    org_id,
    '기본 채용 프로세스',
    '[
      {"id": "stage-1", "name": "서류 전형", "order": 1, "interviewers": []},
      {"id": "stage-2", "name": "1차 면접", "order": 2, "interviewers": []},
      {"id": "stage-3", "name": "2차 면접", "order": 3, "interviewers": []},
      {"id": "stage-4", "name": "최종 면접", "order": 4, "interviewers": []},
      {"id": "stage-5", "name": "최종 합격", "order": 5, "interviewers": []}
    ]'::jsonb
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO process_id;

  IF process_id IS NULL THEN
    SELECT id INTO process_id FROM processes WHERE organization_id = org_id AND name = '기본 채용 프로세스' LIMIT 1;
  END IF;

  -- 채용 공고 생성 (8개)
  INSERT INTO job_posts (organization_id, title, description, process_id)
  VALUES
    (org_id, 'Senior Product Designer', 'Senior Product Designer 포지션에 대한 상세 설명입니다.', process_id),
    (org_id, 'Product Manager', 'Product Manager 포지션에 대한 상세 설명입니다.', process_id),
    (org_id, 'UX Researcher', 'UX Researcher 포지션에 대한 상세 설명입니다.', process_id),
    (org_id, 'Frontend Developer', 'Frontend Developer 포지션에 대한 상세 설명입니다.', process_id),
    (org_id, 'Backend Developer', 'Backend Developer 포지션에 대한 상세 설명입니다.', process_id),
    (org_id, 'Full Stack Developer', 'Full Stack Developer 포지션에 대한 상세 설명입니다.', process_id),
    (org_id, 'Data Engineer', 'Data Engineer 포지션에 대한 상세 설명입니다.', process_id),
    (org_id, 'DevOps Engineer', 'DevOps Engineer 포지션에 대한 상세 설명입니다.', process_id)
  ON CONFLICT DO NOTHING;

  SELECT ARRAY_AGG(id) INTO job_post_ids FROM job_posts WHERE organization_id = org_id;

  -- 후보자 생성 (30명)
  FOR i IN 1..30 LOOP
    INSERT INTO candidates (
      job_post_id, name, email, phone, status, current_stage_id, token, parsed_data, created_at
    )
    VALUES (
      job_post_ids[((i - 1) % array_length(job_post_ids, 1)) + 1],
      CASE (i - 1) % 20
        WHEN 0 THEN 'Sarah Kim' WHEN 1 THEN 'James Lee' WHEN 2 THEN 'Emma Park'
        WHEN 3 THEN 'Michael Choi' WHEN 4 THEN 'Lisa Jung' WHEN 5 THEN 'David Kim'
        WHEN 6 THEN 'Sophia Park' WHEN 7 THEN 'Daniel Lee' WHEN 8 THEN 'Olivia Kim'
        WHEN 9 THEN 'Ryan Park' WHEN 10 THEN 'Grace Lee' WHEN 11 THEN 'Kevin Choi'
        WHEN 12 THEN 'Amy Yoon' WHEN 13 THEN 'Tom Kim' WHEN 14 THEN 'Jessica Park'
        WHEN 15 THEN 'Chris Lee' WHEN 16 THEN 'Maria Kim' WHEN 17 THEN 'John Park'
        WHEN 18 THEN 'Emily Choi' ELSE 'Alex Lee'
      END,
      'candidate' || i || '@example.com',
      '010-' || LPAD((RANDOM() * 10000)::INT::TEXT, 4, '0') || '-' || LPAD((RANDOM() * 10000)::INT::TEXT, 4, '0'),
      CASE (i - 1) % 5 WHEN 0 THEN 'pending' WHEN 1 THEN 'in_progress' WHEN 2 THEN 'confirmed' WHEN 3 THEN 'rejected' ELSE 'issue' END,
      CASE (i - 1) / 6 WHEN 0 THEN 'stage-1' WHEN 1 THEN 'stage-2' WHEN 2 THEN 'stage-3' WHEN 3 THEN 'stage-4' ELSE 'stage-5' END,
      gen_random_uuid(),
      jsonb_build_object('match_score', 70 + (RANDOM() * 30)::INT),
      NOW() - (INTERVAL '1 day' * (30 - ((i - 1) % 30)))
    )
    RETURNING id INTO candidate_ids[i];
  END LOOP;

  -- 면접 일정 생성 (15개)
  FOR i IN 1..15 LOOP
    INSERT INTO schedules (
      candidate_id, stage_id, scheduled_at, duration_minutes, status, interviewer_ids, candidate_response, beverage_preference
    )
    VALUES (
      candidate_ids[((i - 1) % 30) + 1],
      CASE (i - 1) % 3 WHEN 0 THEN 'stage-2' WHEN 1 THEN 'stage-3' ELSE 'stage-4' END,
      NOW() + (INTERVAL '1 day' * ((RANDOM() * 14)::INT + 1)) + (INTERVAL '1 hour' * (10 + (RANDOM() * 6)::INT)),
      CASE (i - 1) % 3 WHEN 0 THEN 30 WHEN 1 THEN 60 ELSE 90 END,
      CASE (i - 1) % 4 WHEN 0 THEN 'pending' WHEN 1 THEN 'confirmed' WHEN 2 THEN 'rejected' ELSE 'completed' END,
      ARRAY[]::UUID[],
      CASE (i - 1) % 3 WHEN 0 THEN 'accepted' WHEN 1 THEN 'rejected' ELSE 'pending' END,
      CASE (i - 1) % 5 WHEN 0 THEN 'coffee' WHEN 1 THEN 'tea' WHEN 2 THEN 'water' WHEN 3 THEN 'juice' ELSE 'none' END
    )
    RETURNING id INTO schedule_ids[i];
  END LOOP;

  -- 면접 일정 옵션 생성 (각 일정당 3개)
  FOR i IN 1..15 LOOP
    FOR j IN 1..3 LOOP
      INSERT INTO schedule_options (schedule_id, scheduled_at, status)
      VALUES (
        schedule_ids[i],
        (SELECT scheduled_at FROM schedules WHERE id = schedule_ids[i]) + (INTERVAL '1 hour' * ((j - 2) * 2)),
        CASE WHEN j = 2 THEN 'selected' ELSE 'pending' END
      );
    END LOOP;
  END LOOP;

  -- 타임라인 이벤트 생성 (후보자당 3-6개)
  FOR i IN 1..30 LOOP
    FOR j IN 1..(3 + (RANDOM() * 4)::INT) LOOP
      INSERT INTO timeline_events (candidate_id, type, content, created_by, created_at)
      VALUES (
        candidate_ids[i],
        CASE (j - 1) % 4 WHEN 0 THEN 'system_log' WHEN 1 THEN 'schedule_created' WHEN 2 THEN 'schedule_confirmed' ELSE 'stage_changed' END,
        jsonb_build_object('message', '이벤트 발생'),
        NULL,
        NOW() - (INTERVAL '1 day' * (30 - (i * 2 + j)))
      );
    END LOOP;
  END LOOP;
END $$;

-- 생성된 데이터 확인
SELECT 
  (SELECT COUNT(*) FROM organizations) as organizations,
  (SELECT COUNT(*) FROM processes) as processes,
  (SELECT COUNT(*) FROM job_posts) as job_posts,
  (SELECT COUNT(*) FROM candidates) as candidates,
  (SELECT COUNT(*) FROM schedules) as schedules,
  (SELECT COUNT(*) FROM schedule_options) as schedule_options,
  (SELECT COUNT(*) FROM timeline_events) as timeline_events;

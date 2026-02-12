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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ============================================
-- 피그마 디자인 기반 필드 추가 마이그레이션
-- Jobs, JD Requests, Calendar, Offers 기능 확장
-- ============================================

-- ============================================
-- 1. job_posts 테이블 확장
-- ============================================

ALTER TABLE job_posts
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS salary_min INTEGER,
ADD COLUMN IF NOT EXISTS salary_max INTEGER,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS match_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS employment_type TEXT CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship')),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'closed'));

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_job_posts_category ON job_posts(category);
CREATE INDEX IF NOT EXISTS idx_job_posts_location ON job_posts(location);
CREATE INDEX IF NOT EXISTS idx_job_posts_status ON job_posts(status);

-- ============================================
-- 2. jd_requests 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS jd_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_jd_requests_organization_id ON jd_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_jd_requests_status ON jd_requests(status);
CREATE INDEX IF NOT EXISTS idx_jd_requests_requested_by ON jd_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_jd_requests_submitted_at ON jd_requests(submitted_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_jd_requests_updated_at BEFORE UPDATE ON jd_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. schedules 테이블 확장
-- ============================================

ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS interview_type TEXT CHECK (interview_type IN ('technical', 'portfolio', 'hr_screening', 'cultural_fit', 'final')),
ADD COLUMN IF NOT EXISTS meeting_platform TEXT CHECK (meeting_platform IN ('google_meet', 'zoom', 'teams', 'other')),
ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_schedules_interview_type ON schedules(interview_type);
CREATE INDEX IF NOT EXISTS idx_schedules_meeting_platform ON schedules(meeting_platform);

-- ============================================
-- 4. offers 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  offer_salary INTEGER NOT NULL,
  offer_currency TEXT DEFAULT 'KRW' CHECK (offer_currency IN ('KRW', 'USD', 'EUR')),
  offer_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  offer_response_at TIMESTAMPTZ,
  offer_status TEXT NOT NULL DEFAULT 'pending' CHECK (offer_status IN ('pending', 'accepted', 'rejected', 'negotiating')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_offers_candidate_id ON offers(candidate_id);
CREATE INDEX IF NOT EXISTS idx_offers_organization_id ON offers(organization_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(offer_status);
CREATE INDEX IF NOT EXISTS idx_offers_offer_sent_at ON offers(offer_sent_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Row Level Security (RLS) 설정
-- ============================================

-- jd_requests RLS
ALTER TABLE jd_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization jd_requests" ON jd_requests
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert own organization jd_requests" ON jd_requests
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own organization jd_requests" ON jd_requests
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete own organization jd_requests" ON jd_requests
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- offers RLS
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization offers" ON offers
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert own organization offers" ON offers
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own organization offers" ON offers
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete own organization offers" ON offers
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

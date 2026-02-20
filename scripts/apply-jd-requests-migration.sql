-- ============================================
-- jd_requests 테이블 생성 마이그레이션
-- Supabase 대시보드 > SQL Editor에서 실행하세요
-- ============================================

-- ============================================
-- 1. jd_requests 테이블 생성
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

-- ============================================
-- 2. 인덱스 추가
-- ============================================

CREATE INDEX IF NOT EXISTS idx_jd_requests_organization_id ON jd_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_jd_requests_status ON jd_requests(status);
CREATE INDEX IF NOT EXISTS idx_jd_requests_requested_by ON jd_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_jd_requests_submitted_at ON jd_requests(submitted_at DESC);

-- ============================================
-- 3. updated_at 자동 업데이트 트리거
-- ============================================

-- update_updated_at_column 함수가 없으면 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS update_jd_requests_updated_at ON jd_requests;
CREATE TRIGGER update_jd_requests_updated_at BEFORE UPDATE ON jd_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. 외래키 이름 명시 (쿼리에서 사용하는 이름과 일치)
-- ============================================

-- requested_by 외래키가 올바른 이름으로 생성되었는지 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'jd_requests_requested_by_fkey'
    AND conrelid = 'jd_requests'::regclass
  ) THEN
    -- 기존 외래키가 다른 이름으로 있을 수 있으므로 확인 후 재생성
    ALTER TABLE jd_requests
    DROP CONSTRAINT IF EXISTS jd_requests_requested_by_fkey;
    
    ALTER TABLE jd_requests
    ADD CONSTRAINT jd_requests_requested_by_fkey 
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 5. Row Level Security (RLS) 설정
-- ============================================

ALTER TABLE jd_requests ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (중복 방지)
DROP POLICY IF EXISTS "Users can view own organization jd_requests" ON jd_requests;
DROP POLICY IF EXISTS "Users can insert own organization jd_requests" ON jd_requests;
DROP POLICY IF EXISTS "Users can update own organization jd_requests" ON jd_requests;
DROP POLICY IF EXISTS "Users can delete own organization jd_requests" ON jd_requests;

-- RLS 정책 생성
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

-- ============================================
-- 완료 메시지
-- ============================================

SELECT 'jd_requests 테이블이 성공적으로 생성되었습니다!' as message;

-- ============================================
-- 후보자 관리 시스템 개선 마이그레이션
-- 생성일: 2026-02-23
-- ============================================

-- ============================================
-- 1. Candidates 테이블에 아카이브 필드 추가
-- ============================================

-- archived 필드 추가
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- archive_reason 필드 추가
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- archived 인덱스 추가 (필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_candidates_archived ON candidates(archived);

-- archived와 status 복합 인덱스 (아카이브 필터링 시 성능 향상)
CREATE INDEX IF NOT EXISTS idx_candidates_archived_status ON candidates(archived, status);

-- ============================================
-- 2. 전형별 평가 시스템: stage_evaluations 테이블 생성
-- ============================================

-- Stage Evaluations (전형별 평가)
CREATE TABLE IF NOT EXISTS stage_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  evaluator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'pass', 'fail')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_stage_evaluations_candidate_id ON stage_evaluations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_stage_evaluations_stage_id ON stage_evaluations(stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_evaluations_evaluator_id ON stage_evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_stage_evaluations_result ON stage_evaluations(result);
CREATE INDEX IF NOT EXISTS idx_stage_evaluations_candidate_stage ON stage_evaluations(candidate_id, stage_id);

-- updated_at 자동 업데이트 트리거 함수 확인 및 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_stage_evaluations_updated_at ON stage_evaluations;
CREATE TRIGGER update_stage_evaluations_updated_at
  BEFORE UPDATE ON stage_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. Timeline Events 타입 확장
-- ============================================

-- timeline_events.type에 새로운 타입 추가
-- 기존 CHECK 제약 조건을 제거하고 새로운 제약 조건 추가
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
  'approval',
  'stage_evaluation',
  'archive'
));

-- ============================================
-- 4. RLS 정책 설정
-- ============================================

-- RLS 정책 활성화
ALTER TABLE stage_evaluations ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Users can view own organization stage evaluations" ON stage_evaluations;
DROP POLICY IF EXISTS "Users can insert own organization stage evaluations" ON stage_evaluations;
DROP POLICY IF EXISTS "Users can update own organization stage evaluations" ON stage_evaluations;
DROP POLICY IF EXISTS "Users can delete own organization stage evaluations" ON stage_evaluations;

-- RLS 정책: 자신의 조직 데이터만 조회 가능
CREATE POLICY "Users can view own organization stage evaluations" ON stage_evaluations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN job_posts jp ON c.job_post_id = jp.id
      JOIN users u ON u.organization_id = jp.organization_id
      WHERE c.id = stage_evaluations.candidate_id
        AND u.id = auth.uid()
    )
  );

-- RLS 정책: 자신의 조직 데이터만 삽입 가능
CREATE POLICY "Users can insert own organization stage evaluations" ON stage_evaluations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN job_posts jp ON c.job_post_id = jp.id
      JOIN users u ON u.organization_id = jp.organization_id
      WHERE c.id = stage_evaluations.candidate_id
        AND u.id = auth.uid()
    )
  );

-- RLS 정책: 자신의 조직 데이터만 수정 가능
CREATE POLICY "Users can update own organization stage evaluations" ON stage_evaluations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN job_posts jp ON c.job_post_id = jp.id
      JOIN users u ON u.organization_id = jp.organization_id
      WHERE c.id = stage_evaluations.candidate_id
        AND u.id = auth.uid()
    )
  );

-- RLS 정책: 자신의 조직 데이터만 삭제 가능
CREATE POLICY "Users can delete own organization stage evaluations" ON stage_evaluations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN job_posts jp ON c.job_post_id = jp.id
      JOIN users u ON u.organization_id = jp.organization_id
      WHERE c.id = stage_evaluations.candidate_id
        AND u.id = auth.uid()
    )
  );

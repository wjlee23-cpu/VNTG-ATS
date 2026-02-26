-- ============================================
-- Candidates 테이블에 아카이브 필드 추가
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

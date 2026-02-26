-- ============================================
-- Candidates 테이블에 AI 요약 및 연봉 필드 추가
-- ============================================

-- AI 요약 필드 추가
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- 연봉 필드 추가 (텍스트 형식)
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS current_salary TEXT;

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS expected_salary TEXT;

-- 코멘트 추가
COMMENT ON COLUMN candidates.ai_summary IS 'AI가 생성한 지원서 요약';
COMMENT ON COLUMN candidates.current_salary IS '현재 연봉 (텍스트 형식)';
COMMENT ON COLUMN candidates.expected_salary IS '희망 연봉 (텍스트 형식)';

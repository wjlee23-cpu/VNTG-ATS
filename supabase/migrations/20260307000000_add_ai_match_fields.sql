-- ============================================
-- Candidates 테이블에 AI 매칭 분석 필드 추가
-- ============================================
-- 
-- 실행 방법:
-- 1. Supabase 대시보드 > SQL Editor > New query
-- 2. 아래 전체 SQL을 복사하여 붙여넣기
-- 3. "Run" 버튼 클릭
-- 4. 실행 후: Settings > API > Refresh Schema Cache (필수!)
-- ============================================

-- 1. AI 요약 필드 추가
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- 2. AI 매칭 점수 추가 (0-100)
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100);

-- 3. AI 강점 리스트 추가 (배열)
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS ai_strengths TEXT[];

-- 4. AI 보완점 리스트 추가 (배열)
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS ai_weaknesses TEXT[];

-- 5. AI 분석 상태 추가
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS ai_analysis_status TEXT 
  DEFAULT 'pending' 
  CHECK (ai_analysis_status IN ('pending', 'processing', 'completed', 'failed'));

-- 6. 컬럼 코멘트 추가
COMMENT ON COLUMN candidates.ai_summary IS 'AI가 생성한 지원서 요약 및 JD-이력서 매칭 분석 요약';
COMMENT ON COLUMN candidates.ai_score IS 'AI가 분석한 JD-이력서 매칭 점수 (0-100)';
COMMENT ON COLUMN candidates.ai_strengths IS 'AI가 분석한 지원자 강점 리스트';
COMMENT ON COLUMN candidates.ai_weaknesses IS 'AI가 분석한 지원자 보완점 리스트';
COMMENT ON COLUMN candidates.ai_analysis_status IS 'AI 분석 상태: pending(대기), processing(분석중), completed(완료), failed(실패)';

-- 7. 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_candidates_ai_analysis_status ON candidates(ai_analysis_status);
CREATE INDEX IF NOT EXISTS idx_candidates_ai_score ON candidates(ai_score);

-- ============================================
-- 실행 완료 후 확인 쿼리 (선택사항)
-- ============================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns
-- WHERE table_name = 'candidates' 
--   AND column_name LIKE 'ai_%'
-- ORDER BY column_name;
-- ============================================

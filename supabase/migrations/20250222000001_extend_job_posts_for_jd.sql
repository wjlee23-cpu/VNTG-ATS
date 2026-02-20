-- ============================================
-- job_posts 테이블 확장: JD Request 연동 및 전형별 담당자 관리
-- ============================================

-- job_posts에 jd_request_id 추가 (승인된 JD Request와 연결)
ALTER TABLE job_posts
ADD COLUMN IF NOT EXISTS jd_request_id UUID REFERENCES jd_requests(id) ON DELETE SET NULL;

-- job_posts에 stage_assignees 추가 (각 전형별 담당자 정보)
-- JSONB 형식: { "stage_id": ["user_id1", "user_id2"], ... }
ALTER TABLE job_posts
ADD COLUMN IF NOT EXISTS stage_assignees JSONB DEFAULT '{}'::jsonb;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_job_posts_jd_request_id ON job_posts(jd_request_id);

-- jd_requests 테이블에 외래키 이름 명시 (쿼리에서 사용하는 이름과 일치)
-- 이미 생성되어 있을 수 있으므로, 없으면 생성
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'jd_requests_requested_by_fkey'
  ) THEN
    ALTER TABLE jd_requests
    ADD CONSTRAINT jd_requests_requested_by_fkey 
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

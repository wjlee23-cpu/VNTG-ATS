-- ============================================
-- job_posts 테이블 확장: 프로세스 단계 활성화/비활성화
-- ============================================

-- job_posts에 enabled_stages 추가 (활성화된 단계 ID 배열)
-- JSONB 형식: ["stage-1", "stage-2", "stage-3", ...]
-- NULL인 경우 모든 단계가 활성화된 것으로 간주 (하위 호환성)
ALTER TABLE job_posts
ADD COLUMN IF NOT EXISTS enabled_stages JSONB;

-- 인덱스 추가 (JSONB 쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_job_posts_enabled_stages ON job_posts USING GIN (enabled_stages);

-- 코멘트 추가
COMMENT ON COLUMN job_posts.enabled_stages IS '활성화된 프로세스 단계 ID 배열. NULL이면 모든 단계 활성화 (기본값)';

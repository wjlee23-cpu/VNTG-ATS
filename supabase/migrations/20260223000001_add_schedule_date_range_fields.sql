-- 면접 일정 날짜 범위 자동 확장을 위한 필드 추가
-- schedules 테이블에 원본 날짜 범위 및 재시도 횟수 필드 추가

-- schedules 테이블 수정
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS original_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_schedules_original_date_range ON schedules(original_start_date, original_end_date);
CREATE INDEX IF NOT EXISTS idx_schedules_retry_count ON schedules(retry_count);

-- 코멘트 추가 (필드 설명)
COMMENT ON COLUMN schedules.original_start_date IS '최초 관리자가 선택한 시작 날짜 (날짜 범위 확장 시 기준점)';
COMMENT ON COLUMN schedules.original_end_date IS '최초 관리자가 선택한 종료 날짜 (날짜 범위 확장 시 기준점)';
COMMENT ON COLUMN schedules.retry_count IS '날짜 범위 확장 재시도 횟수 (최대 5회)';

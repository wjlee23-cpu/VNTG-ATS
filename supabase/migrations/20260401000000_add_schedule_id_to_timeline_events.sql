-- ============================================
-- Timeline Events: schedule_id 컬럼 추가
-- 목적:
-- - "면접 일정 자동화" 타임라인을 schedule_id 기준으로 1개의 카드로 업서트(갱신)하기 위함
-- - 같은 schedule_id/type 조합에 대해 중복 이벤트가 계속 쌓이는 것을 DB 레벨에서 방지
-- ============================================

-- 1) schedule_id 컬럼 추가 (NULL 허용: 기존 데이터 호환)
ALTER TABLE timeline_events
  ADD COLUMN IF NOT EXISTS schedule_id UUID;

-- 2) schedules 테이블과의 FK 연결 (스케줄이 삭제되면 감사 로그는 남겨야 하므로 SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timeline_events_schedule_id_fkey'
  ) THEN
    ALTER TABLE timeline_events
      ADD CONSTRAINT timeline_events_schedule_id_fkey
      FOREIGN KEY (schedule_id)
      REFERENCES schedules(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) 업서트 대상 유니크 제약(인덱스) 추가
-- - schedule_id가 NULL인 레거시 이벤트에는 영향이 없도록 부분 인덱스로 구성
-- - type별로 1개만 유지 (예: schedule_created 카드 1개)
CREATE UNIQUE INDEX IF NOT EXISTS ux_timeline_events_candidate_schedule_type
  ON timeline_events (candidate_id, schedule_id, type)
  WHERE schedule_id IS NOT NULL;

-- 4) 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_timeline_events_candidate_schedule
  ON timeline_events (candidate_id, schedule_id)
  WHERE schedule_id IS NOT NULL;


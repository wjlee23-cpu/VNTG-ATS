-- ============================================
-- Timeline Events: schedule_id FK 제거
-- 목적:
-- - schedules를 "완전 삭제"해도 timeline_events의 schedule_id는 유지되어
--   동일한 '면접 일정 자동화 카드'를 계속 업데이트(감사 추적)할 수 있어야 합니다.
-- - 따라서 schedule_id는 '논리적 참조'로만 사용하고 FK 제약은 두지 않습니다.
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timeline_events_schedule_id_fkey'
  ) THEN
    ALTER TABLE timeline_events
      DROP CONSTRAINT timeline_events_schedule_id_fkey;
  END IF;
END $$;


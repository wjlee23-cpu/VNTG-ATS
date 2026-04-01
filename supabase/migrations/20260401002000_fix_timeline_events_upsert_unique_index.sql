-- ============================================
-- Fix: timeline_events upsert용 유니크 인덱스 교체
-- 배경:
-- - Supabase upsert(onConflict)는 "일반 UNIQUE 제약/인덱스"를 필요로 합니다.
-- - 기존에 부분(Partial) UNIQUE 인덱스(WHERE schedule_id IS NOT NULL)를 만들면
--   onConflict 대상으로 인식되지 않아 upsert가 실패할 수 있습니다.
--
-- 해결:
-- - 부분 UNIQUE 인덱스를 제거하고, 일반 UNIQUE 인덱스로 교체합니다.
-- - Postgres UNIQUE는 NULL을 서로 다르게 취급하므로,
--   schedule_id가 NULL인 레거시 이벤트는 여러 개 있어도 UNIQUE 위반이 발생하지 않습니다.
-- ============================================

-- 1) 기존 부분 UNIQUE 인덱스 제거
DROP INDEX IF EXISTS ux_timeline_events_candidate_schedule_type;

-- 2) 일반 UNIQUE 인덱스 생성 (upsert onConflict 타겟)
CREATE UNIQUE INDEX IF NOT EXISTS ux_timeline_events_candidate_schedule_type
  ON timeline_events (candidate_id, schedule_id, type);

-- 3) 보조 인덱스(조회 최적화)는 유지하되, 부분 조건은 제거해도 무방합니다.
DROP INDEX IF EXISTS idx_timeline_events_candidate_schedule;
CREATE INDEX IF NOT EXISTS idx_timeline_events_candidate_schedule
  ON timeline_events (candidate_id, schedule_id);


-- ============================================
-- Timeline Events 타입 확장
-- Activity Timeline 완전 구현을 위한 새로운 이벤트 타입 추가
-- ============================================

-- timeline_events.type에 새로운 타입 추가
-- 기존 CHECK 제약 조건을 제거하고 새로운 제약 조건 추가

-- 기존 제약 조건 제거
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'timeline_events'::regclass 
    AND conname = 'timeline_events_type_check'
  ) THEN
    ALTER TABLE timeline_events DROP CONSTRAINT timeline_events_type_check;
  END IF;
END $$;

-- 새로운 제약 조건 추가
ALTER TABLE timeline_events
ADD CONSTRAINT timeline_events_type_check 
CHECK (type IN (
  'system_log', 
  'schedule_created', 
  'schedule_confirmed', 
  'stage_changed', 
  'email', 
  'email_received',
  'comment', 
  'comment_created',
  'comment_updated',
  'scorecard', 
  'scorecard_created',
  'approval',
  'stage_evaluation',
  'archive',
  'interviewer_response',
  'schedule_regenerated',
  'position_changed'
));

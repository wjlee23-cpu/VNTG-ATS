-- ============================================
-- Timeline Events 타입 확장: schedule_deleted 추가
-- 목적:
-- - 면접 일정이 "완전 삭제"되었을 때 Activity Timeline에 별도 이벤트로 남겨 혼동을 줄입니다.
-- ============================================

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

-- 새로운 제약 조건 추가 (schedule_deleted 포함)
ALTER TABLE timeline_events
ADD CONSTRAINT timeline_events_type_check 
CHECK (type IN (
  'system_log', 
  'schedule_created', 
  'schedule_confirmed', 
  'schedule_deleted',
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


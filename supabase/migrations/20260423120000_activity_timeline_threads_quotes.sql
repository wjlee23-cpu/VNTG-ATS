-- ============================================
-- Activity Timeline: 스레드(답장) 루트 + 인용 타입
-- - comments에 타임라인 행 또는 이메일에 매달리는 스레드 전용 FK 추가
-- - timeline_events.type에 activity_quote 추가
-- ============================================

-- 1) comments: 스레드 루트 (타임라인 이벤트 XOR 이메일)
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS activity_thread_root_timeline_event_id UUID,
  ADD COLUMN IF NOT EXISTS activity_thread_root_email_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comments_activity_thread_root_timeline_fkey'
  ) THEN
    ALTER TABLE comments
      ADD CONSTRAINT comments_activity_thread_root_timeline_fkey
      FOREIGN KEY (activity_thread_root_timeline_event_id)
      REFERENCES timeline_events(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comments_activity_thread_root_email_fkey'
  ) THEN
    ALTER TABLE comments
      ADD CONSTRAINT comments_activity_thread_root_email_fkey
      FOREIGN KEY (activity_thread_root_email_id)
      REFERENCES emails(id)
      ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_activity_thread_root_exclusive;
ALTER TABLE comments
  ADD CONSTRAINT comments_activity_thread_root_exclusive
  CHECK (
    NOT (
      activity_thread_root_timeline_event_id IS NOT NULL
      AND activity_thread_root_email_id IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_comments_thread_timeline
  ON comments (activity_thread_root_timeline_event_id)
  WHERE activity_thread_root_timeline_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_thread_email
  ON comments (activity_thread_root_email_id)
  WHERE activity_thread_root_email_id IS NOT NULL;

COMMENT ON COLUMN comments.activity_thread_root_timeline_event_id IS '액티비티 타임라인 행에 대한 스레드 답장 루트(timeline_events.id)';
COMMENT ON COLUMN comments.activity_thread_root_email_id IS '합성 이메일 타임라인 행에 대한 스레드 루트(emails.id)';

-- 2) timeline_events.type: activity_quote (인용하여 메인 타임라인에 남김)
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

ALTER TABLE timeline_events
  ADD CONSTRAINT timeline_events_type_check
  CHECK (type IN (
    'system_log',
    'schedule_created',
    'schedule_confirmed',
    'schedule_deleted',
    'schedule_regenerated',
    'schedule_rescheduled',
    'schedule_manually_edited',
    'schedule_option_manually_added',
    'schedule_force_confirmed',
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
    'position_changed',
    'activity_quote'
  ));

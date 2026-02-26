-- 면접 일정 조율 알고리즘 개선 및 수동 조율 기능을 위한 필드 추가
-- schedules 테이블에 재조율 및 수동 조율 관련 필드 추가
-- schedule_options 테이블에 수동 추가 옵션 관련 필드 추가
-- workflow_status에 'needs_rescheduling' 상태 추가

-- schedules 테이블 수정
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS needs_rescheduling BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rescheduling_reason TEXT,
  ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_override_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- schedule_options 테이블 수정
ALTER TABLE schedule_options
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- workflow_status CHECK 제약 조건 수정 (기존 제약 조건 제거 후 재생성)
-- 먼저 기존 제약 조건 찾기 및 제거
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- 기존 CHECK 제약 조건 찾기
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'schedules'::regclass
    AND contype = 'c'
    AND conname LIKE '%workflow_status%';
  
  -- 제약 조건이 있으면 제거
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE schedules DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;
END $$;

-- 새로운 workflow_status CHECK 제약 조건 추가 (needs_rescheduling 포함)
ALTER TABLE schedules
  ADD CONSTRAINT schedules_workflow_status_check 
  CHECK (workflow_status IN ('pending_interviewers', 'pending_candidate', 'confirmed', 'cancelled', 'needs_rescheduling'));

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_schedules_needs_rescheduling ON schedules(needs_rescheduling) WHERE needs_rescheduling = TRUE;
CREATE INDEX IF NOT EXISTS idx_schedules_manual_override ON schedules(manual_override) WHERE manual_override = TRUE;
CREATE INDEX IF NOT EXISTS idx_schedule_options_is_manual ON schedule_options(is_manual) WHERE is_manual = TRUE;

-- 코멘트 추가 (필드 설명)
COMMENT ON COLUMN schedules.needs_rescheduling IS '재조율이 필요한지 여부 (확정 후 일정 변경 필요 시)';
COMMENT ON COLUMN schedules.rescheduling_reason IS '재조율 사유 (면접관 사정, 후보자 사정, 회의실 문제 등)';
COMMENT ON COLUMN schedules.manual_override IS '수동 조율로 생성/수정되었는지 여부';
COMMENT ON COLUMN schedules.manual_override_by IS '수동 조율을 수행한 사용자 ID';
COMMENT ON COLUMN schedule_options.is_manual IS '수동으로 추가된 옵션인지 여부';
COMMENT ON COLUMN schedule_options.added_by IS '옵션을 추가한 사용자 ID';

-- timeline_events 타입 확장 (기존 마이그레이션 확인 필요)
-- 20260225000000_extend_timeline_event_types.sql에서 이미 확장되었을 수 있음
-- 하지만 새로운 타입들을 추가하기 위해 확인 후 추가
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- 기존 CHECK 제약 조건 찾기
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'timeline_events'::regclass
    AND contype = 'c'
    AND conname LIKE '%type%';
  
  -- 제약 조건이 있으면 제거
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE timeline_events DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;
  
  -- 새로운 타입 포함하여 제약 조건 재생성
  ALTER TABLE timeline_events
    ADD CONSTRAINT timeline_events_type_check
    CHECK (type IN (
      'system_log', 
      'schedule_created', 
      'schedule_confirmed', 
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
      'position_changed'
    ));
END $$;

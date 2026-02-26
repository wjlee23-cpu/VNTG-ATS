-- 인터뷰 스케줄링 자동화를 위한 필드 추가
-- schedules 테이블에 구글 캘린더 연동 및 워크플로우 상태 필드 추가
-- schedule_options 테이블에 구글 캘린더 이벤트 ID 및 면접관 응답 필드 추가

-- schedules 테이블 수정
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS interviewer_responses JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS workflow_status TEXT CHECK (workflow_status IN ('pending_interviewers', 'pending_candidate', 'confirmed', 'cancelled'));

-- schedule_options 테이블 수정
ALTER TABLE schedule_options
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS interviewer_responses JSONB DEFAULT '{}'::jsonb;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_schedules_google_event_id ON schedules(google_event_id);
CREATE INDEX IF NOT EXISTS idx_schedules_workflow_status ON schedules(workflow_status);
CREATE INDEX IF NOT EXISTS idx_schedule_options_google_event_id ON schedule_options(google_event_id);

-- 코멘트 추가 (필드 설명)
COMMENT ON COLUMN schedules.google_event_id IS '확정된 일정의 구글 캘린더 이벤트 ID';
COMMENT ON COLUMN schedules.interviewer_responses IS '면접관별 수락 상태: { "interviewerId": "accepted" | "declined" | "tentative" | "needsAction" }';
COMMENT ON COLUMN schedules.workflow_status IS '자동화 워크플로우 상태: pending_interviewers, pending_candidate, confirmed, cancelled';
COMMENT ON COLUMN schedule_options.google_event_id IS '각 옵션별 block 일정의 구글 캘린더 이벤트 ID';
COMMENT ON COLUMN schedule_options.interviewer_responses IS '면접관별 수락 상태 (각 옵션별)';

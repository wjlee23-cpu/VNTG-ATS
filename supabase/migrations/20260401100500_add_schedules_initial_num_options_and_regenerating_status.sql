-- schedules에 최초 옵션 개수(initial_num_options) 저장 + 재생성 락을 위한 workflow_status 확장
-- 목적:
-- - 자동 재생성 시 옵션 개수를 "최초 생성 값"으로 고정
-- - 동시 웹훅 호출 시 workflow_status='regenerating'으로 잠금(락) 처리 가능하게 함

-- 1) 최초 옵션 개수 컬럼 추가
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS initial_num_options INTEGER;

COMMENT ON COLUMN schedules.initial_num_options IS '자동화 최초 생성 시 일정 옵션 개수(재생성 시 이 값을 사용)';

-- 2) workflow_status CHECK 제약 조건에 regenerating 상태 추가
-- 기존 제약 조건 이름이 환경마다 다를 수 있어, 패턴 매칭으로 찾아 제거 후 재생성합니다.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'schedules'::regclass
    AND contype = 'c'
    AND conname LIKE '%workflow_status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE schedules DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;
END $$;

-- needs_rescheduling 마이그레이션이 적용된 경우/아닌 경우 모두 커버하기 위해 가능한 상태들을 넓게 포함합니다.
-- (이미 존재하는 값들은 모두 허용하며, 새로 'regenerating'을 추가합니다.)
ALTER TABLE schedules
  ADD CONSTRAINT schedules_workflow_status_check
  CHECK (
    workflow_status IN (
      'pending_interviewers',
      'pending_candidate',
      'confirmed',
      'cancelled',
      'needs_rescheduling',
      'regenerating'
    )
  );


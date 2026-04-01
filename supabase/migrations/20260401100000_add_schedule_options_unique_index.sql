-- schedule_options 중복 방지 유니크 인덱스 추가
-- 목적:
-- - 동시 웹훅/버그 등 어떤 이유로든 동일 schedule_id + scheduled_at 조합이 중복 생성되지 않게 DB 레벨에서 차단
-- 안전:
-- - 기존 데이터에 중복이 이미 존재하면 자동 삭제/수정하지 않고, 명확한 에러로 마이그레이션을 중단합니다.
--   (데이터 삭제/정리는 운영 정책에 따라 수동으로 진행해야 합니다.)

DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT schedule_id, scheduled_at, COUNT(*) AS cnt
    FROM schedule_options
    GROUP BY schedule_id, scheduled_at
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'schedule_options에 (schedule_id, scheduled_at) 중복 데이터가 %건 존재합니다. 유니크 인덱스를 만들기 전에 중복을 정리해주세요.',
      dup_count;
  END IF;
END $$;

-- 유니크 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS ux_schedule_options_schedule_id_scheduled_at
  ON schedule_options (schedule_id, scheduled_at);


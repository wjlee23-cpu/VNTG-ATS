-- Google Calendar events.watch 매핑 컬럼 추가
-- 웹훅 수신 시 어떤 schedule_options에 해당하는지 역매핑하기 위함

ALTER TABLE schedule_options
  ADD COLUMN IF NOT EXISTS watch_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS watch_resource_id TEXT,
  ADD COLUMN IF NOT EXISTS watch_token TEXT,
  ADD COLUMN IF NOT EXISTS watch_expiration TIMESTAMPTZ;

-- 웹훅 헤더 매핑을 빠르게 하기 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_schedule_options_watch_channel_id
  ON schedule_options (watch_channel_id);

CREATE INDEX IF NOT EXISTS idx_schedule_options_watch_resource_id
  ON schedule_options (watch_resource_id);

CREATE INDEX IF NOT EXISTS idx_schedule_options_watch_token
  ON schedule_options (watch_token);

-- 컬럼 설명
COMMENT ON COLUMN schedule_options.watch_channel_id IS 'Google Calendar watch 채널 ID (X-Goog-Channel-ID 매핑)';
COMMENT ON COLUMN schedule_options.watch_resource_id IS 'Google Calendar watch resourceId (X-Goog-Resource-ID 또는 내부 매핑)';
COMMENT ON COLUMN schedule_options.watch_token IS 'Google Calendar watch token (X-Goog-Channel-Token 매핑)';
COMMENT ON COLUMN schedule_options.watch_expiration IS 'watch 만료 시각';


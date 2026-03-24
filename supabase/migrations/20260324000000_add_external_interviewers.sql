-- 비가입 면접관(외부 이메일) 개인 저장 풀
CREATE TABLE IF NOT EXISTS external_interviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_external_interviewers_user_id
  ON external_interviewers(user_id);

CREATE INDEX IF NOT EXISTS idx_external_interviewers_email
  ON external_interviewers(email);

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS external_interviewer_emails TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN schedules.external_interviewer_emails IS '비가입 면접관 이메일 목록';

-- Phase 2: 협업 강화 기능 추가
-- Timeline & Scorecard, Email Sync, Comments 기능

-- 1. Timeline Events 타입 확장
-- 기존 타입에 email, comment, scorecard, approval 추가
ALTER TABLE timeline_events 
  DROP CONSTRAINT IF EXISTS timeline_events_type_check;

ALTER TABLE timeline_events
  ADD CONSTRAINT timeline_events_type_check 
  CHECK (type IN (
    'system_log', 
    'schedule_created', 
    'schedule_confirmed', 
    'stage_changed',
    'email',
    'comment',
    'scorecard',
    'approval'
  ));

-- 2. Emails 테이블 (이메일 동기화)
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE, -- 이메일 서버의 고유 ID
  subject TEXT,
  body TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Comments 테이블 (코멘트 및 멘션)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_user_ids UUID[] DEFAULT '{}', -- 멘션된 사용자 ID 배열
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- 대댓글 지원
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Scorecards 테이블 (면접 평가표)
CREATE TABLE scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  criteria_scores JSONB DEFAULT '{}'::jsonb, -- 세부 평가 항목 (예: {"technical": 4, "communication": 5})
  strengths TEXT,
  weaknesses TEXT,
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(schedule_id, interviewer_id) -- 면접당 면접관당 하나의 평가표만
);

-- 인덱스 추가
CREATE INDEX idx_emails_candidate_id ON emails(candidate_id);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_synced_at ON emails(synced_at DESC);
CREATE INDEX idx_emails_direction ON emails(direction);

CREATE INDEX idx_comments_candidate_id ON comments(candidate_id);
CREATE INDEX idx_comments_created_by ON comments(created_by);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
-- 멘션 검색을 위한 GIN 인덱스
CREATE INDEX idx_comments_mentioned_user_ids ON comments USING GIN(mentioned_user_ids);

CREATE INDEX idx_scorecards_schedule_id ON scorecards(schedule_id);
CREATE INDEX idx_scorecards_candidate_id ON scorecards(candidate_id);
CREATE INDEX idx_scorecards_interviewer_id ON scorecards(interviewer_id);
CREATE INDEX idx_scorecards_submitted_at ON scorecards(submitted_at DESC);

-- updated_at 트리거 추가
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scorecards_updated_at BEFORE UPDATE ON scorecards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 활성화
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecards ENABLE ROW LEVEL SECURITY;

-- RLS 정책: Emails
-- 조직 내 사용자는 후보자의 이메일을 조회/생성 가능
CREATE POLICY "Users can view emails in their organization"
  ON emails FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage emails in their organization"
  ON emails FOR ALL
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- RLS 정책: Comments
-- 조직 내 사용자는 후보자의 코멘트를 조회/생성/수정 가능
CREATE POLICY "Users can view comments in their organization"
  ON comments FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create comments in their organization"
  ON comments FOR INSERT
  WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (created_by = auth.uid());

-- RLS 정책: Scorecards
-- 조직 내 사용자는 평가표를 조회 가능
-- 면접관은 자신이 참여한 면접의 평가표를 작성 가능
CREATE POLICY "Users can view scorecards in their organization"
  ON scorecards FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Interviewers can create scorecards for their interviews"
  ON scorecards FOR INSERT
  WITH CHECK (
    interviewer_id = auth.uid()
    AND schedule_id IN (
      SELECT id FROM schedules WHERE auth.uid() = ANY(interviewer_ids)
    )
  );

CREATE POLICY "Interviewers can update their own scorecards"
  ON scorecards FOR UPDATE
  USING (interviewer_id = auth.uid());

-- Timeline Events 업데이트 정책 추가 (기존에 없었음)
CREATE POLICY "Users can update timeline events in their organization"
  ON timeline_events FOR UPDATE
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Scorecard 작성 시 자동으로 Timeline Event 생성하는 함수
CREATE OR REPLACE FUNCTION create_scorecard_timeline_event()
RETURNS TRIGGER AS $$
BEGIN
  -- 평가표가 제출되었을 때만 타임라인 이벤트 생성
  IF NEW.submitted_at IS NOT NULL AND (OLD.submitted_at IS NULL OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at) THEN
    INSERT INTO timeline_events (
      candidate_id,
      type,
      content,
      created_by
    ) VALUES (
      NEW.candidate_id,
      'scorecard',
      jsonb_build_object(
        'scorecard_id', NEW.id,
        'schedule_id', NEW.schedule_id,
        'interviewer_id', NEW.interviewer_id,
        'overall_rating', NEW.overall_rating,
        'criteria_scores', NEW.criteria_scores,
        'strengths', NEW.strengths,
        'weaknesses', NEW.weaknesses
      ),
      NEW.interviewer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scorecard_timeline_event_trigger
  AFTER UPDATE ON scorecards
  FOR EACH ROW
  WHEN (NEW.submitted_at IS NOT NULL)
  EXECUTE FUNCTION create_scorecard_timeline_event();

-- Email 동기화 시 자동으로 Timeline Event 생성하는 함수
CREATE OR REPLACE FUNCTION create_email_timeline_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO timeline_events (
    candidate_id,
    type,
    content,
    created_by
  ) VALUES (
    NEW.candidate_id,
    'email',
    jsonb_build_object(
      'email_id', NEW.id,
      'subject', NEW.subject,
      'direction', NEW.direction,
      'from_email', NEW.from_email,
      'to_email', NEW.to_email,
      'sent_at', NEW.sent_at,
      'received_at', NEW.received_at
    ),
    NULL -- 이메일은 시스템이 동기화하므로 created_by는 NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_timeline_event_trigger
  AFTER INSERT ON emails
  FOR EACH ROW
  EXECUTE FUNCTION create_email_timeline_event();

-- Comment 생성 시 자동으로 Timeline Event 생성하는 함수
CREATE OR REPLACE FUNCTION create_comment_timeline_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO timeline_events (
    candidate_id,
    type,
    content,
    created_by
  ) VALUES (
    NEW.candidate_id,
    'comment',
    jsonb_build_object(
      'comment_id', NEW.id,
      'content', NEW.content,
      'mentioned_user_ids', NEW.mentioned_user_ids,
      'parent_comment_id', NEW.parent_comment_id
    ),
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_timeline_event_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_timeline_event();

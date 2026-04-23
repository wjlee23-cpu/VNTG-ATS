-- ============================================
-- Activity Timeline: Reactions (Emoji)
-- - 각 타임라인 이벤트에 이모지 리액션을 계정별 1개 토글로 저장
-- - 여러 이모지/무제한 조합 가능, 동일 이모지는 (event,user,emoji) 유니크로 1개만
-- ============================================

-- 1) reactions table
CREATE TABLE IF NOT EXISTS public.timeline_event_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_event_id uuid NOT NULL REFERENCES public.timeline_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) unique constraint: same user can react once per emoji per event
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timeline_event_reactions_unique_event_user_emoji'
  ) THEN
    ALTER TABLE public.timeline_event_reactions
      ADD CONSTRAINT timeline_event_reactions_unique_event_user_emoji
      UNIQUE (timeline_event_id, user_id, emoji);
  END IF;
END $$;

-- 3) indexes
CREATE INDEX IF NOT EXISTS idx_timeline_event_reactions_event
  ON public.timeline_event_reactions (timeline_event_id);

CREATE INDEX IF NOT EXISTS idx_timeline_event_reactions_user
  ON public.timeline_event_reactions (user_id);

COMMENT ON TABLE public.timeline_event_reactions IS '타임라인 이벤트 이모지 리액션 (계정별 토글)';
COMMENT ON COLUMN public.timeline_event_reactions.emoji IS '이모지 문자열 (예: 👍)';

-- 4) RLS
ALTER TABLE public.timeline_event_reactions ENABLE ROW LEVEL SECURITY;

-- 읽기: 같은 조직의 후보자 타임라인에 접근 가능한 사용자만
-- - 정책: timeline_events -> candidates -> job_posts.organization_id == users.organization_id
DROP POLICY IF EXISTS "timeline_event_reactions_select_same_org" ON public.timeline_event_reactions;
CREATE POLICY "timeline_event_reactions_select_same_org"
  ON public.timeline_event_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.timeline_events te
      JOIN public.candidates c ON c.id = te.candidate_id
      JOIN public.job_posts jp ON jp.id = c.job_post_id
      JOIN public.users u ON u.id = auth.uid()
      WHERE te.id = timeline_event_reactions.timeline_event_id
        AND u.organization_id = jp.organization_id
    )
  );

-- 추가: 본인(user_id=auth.uid())만 추가 가능 + 같은 조직 범위
DROP POLICY IF EXISTS "timeline_event_reactions_insert_own" ON public.timeline_event_reactions;
CREATE POLICY "timeline_event_reactions_insert_own"
  ON public.timeline_event_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.timeline_events te
      JOIN public.candidates c ON c.id = te.candidate_id
      JOIN public.job_posts jp ON jp.id = c.job_post_id
      JOIN public.users u ON u.id = auth.uid()
      WHERE te.id = timeline_event_reactions.timeline_event_id
        AND u.organization_id = jp.organization_id
    )
  );

-- 삭제: 본인만 삭제 가능 + 같은 조직 범위
DROP POLICY IF EXISTS "timeline_event_reactions_delete_own" ON public.timeline_event_reactions;
CREATE POLICY "timeline_event_reactions_delete_own"
  ON public.timeline_event_reactions
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.timeline_events te
      JOIN public.candidates c ON c.id = te.candidate_id
      JOIN public.job_posts jp ON jp.id = c.job_post_id
      JOIN public.users u ON u.id = auth.uid()
      WHERE te.id = timeline_event_reactions.timeline_event_id
        AND u.organization_id = jp.organization_id
    )
  );


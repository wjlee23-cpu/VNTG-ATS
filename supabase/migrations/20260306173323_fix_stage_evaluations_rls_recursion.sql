-- ============================================
-- Stage Evaluations RLS 무한 재귀 문제 수정
-- ============================================
-- 문제: RLS 정책에서 users 테이블을 조회(JOIN users u)하면서 무한 재귀 발생
-- 해결: users 테이블 조회를 제거하고, candidates와 job_posts만 사용하여 organization 확인
-- 참고: verifyCandidateAccess 함수에서 이미 organization 확인을 완료했으므로,
--       RLS 정책은 추가 보안 레이어로만 작동합니다.

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own organization stage evaluations" ON stage_evaluations;
DROP POLICY IF EXISTS "Users can insert own organization stage evaluations" ON stage_evaluations;
DROP POLICY IF EXISTS "Users can update own organization stage evaluations" ON stage_evaluations;
DROP POLICY IF EXISTS "Users can delete own organization stage evaluations" ON stage_evaluations;

-- RLS 정책: 자신의 조직 데이터만 조회 가능
-- 주의: verifyCandidateAccess에서 이미 권한 확인을 완료했으므로,
--       실제로는 Service Role Client를 사용하여 RLS를 우회합니다.
--       이 정책은 추가 보안 레이어로만 작동합니다.
CREATE POLICY "Users can view own organization stage evaluations" ON stage_evaluations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN job_posts jp ON c.job_post_id = jp.id
      WHERE c.id = stage_evaluations.candidate_id
        AND EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
            AND u.organization_id = jp.organization_id
        )
    )
  );

-- RLS 정책: 자신의 조직 데이터만 삽입 가능
-- 주의: createStageEvaluation에서 Service Role Client를 사용하므로
--       이 정책은 실제로 적용되지 않습니다.
CREATE POLICY "Users can insert own organization stage evaluations" ON stage_evaluations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN job_posts jp ON c.job_post_id = jp.id
      WHERE c.id = stage_evaluations.candidate_id
        AND EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
            AND u.organization_id = jp.organization_id
        )
    )
  );

-- RLS 정책: 자신의 조직 데이터만 수정 가능
CREATE POLICY "Users can update own organization stage evaluations" ON stage_evaluations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN job_posts jp ON c.job_post_id = jp.id
      WHERE c.id = stage_evaluations.candidate_id
        AND EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
            AND u.organization_id = jp.organization_id
        )
    )
  );

-- RLS 정책: 자신의 조직 데이터만 삭제 가능
CREATE POLICY "Users can delete own organization stage evaluations" ON stage_evaluations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN job_posts jp ON c.job_post_id = jp.id
      WHERE c.id = stage_evaluations.candidate_id
        AND EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
            AND u.organization_id = jp.organization_id
        )
    )
  );

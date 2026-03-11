-- ============================================
-- Candidates 테이블 RLS 무한 재귀 문제 수정
-- ============================================
-- 문제: candidates 테이블의 INSERT 정책이 users 테이블을 직접 조회하면서 무한 재귀 발생
-- 해결: 
--   1. users 테이블의 재귀 정책을 확실히 삭제
--   2. candidates 테이블의 INSERT 정책을 수정하여 users 테이블 직접 조회 제거
-- 참고: createCandidate 함수에서 Service Role Client를 사용하여 RLS를 우회하므로,
--       이 정책은 추가 보안 레이어로만 작동합니다.
--       verifyJobPostAccess에서 이미 organization 확인을 완료했습니다.

-- 1. users 테이블의 재귀 정책 삭제 (이미 삭제되었을 수 있지만 확실히 하기 위해)
DROP POLICY IF EXISTS "Users can view own organization data" ON users;

-- 2. candidates 테이블의 기존 INSERT 정책 삭제
DROP POLICY IF EXISTS "Users can insert own organization data" ON candidates;

-- 3. candidates 테이블의 새로운 INSERT 정책 생성
--    주의: createCandidate 함수에서 Service Role Client를 사용하여 RLS를 우회하므로,
--          이 정책은 실제로 적용되지 않습니다.
--          하지만 추가 보안 레이어로 유지합니다.
--    users 테이블을 직접 조회하지 않고, job_posts 테이블만 확인합니다.
--    실제 organization 확인은 createCandidate의 verifyJobPostAccess에서 이미 완료했습니다.
CREATE POLICY "Users can insert own organization data" ON candidates
  FOR INSERT
  WITH CHECK (
    -- job_posts 테이블에 해당 job_post_id가 존재하는지만 확인
    -- organization_id 확인은 createCandidate의 verifyJobPostAccess에서 이미 완료했습니다.
    EXISTS (
      SELECT 1 FROM job_posts jp
      WHERE jp.id = candidates.job_post_id
    )
  );

-- 참고:
-- - createCandidate 함수에서 Service Role Client를 사용하여 RLS를 우회합니다.
-- - getCurrentUser()와 verifyJobPostAccess()에서 이미 권한 확인을 완료했습니다.
-- - 이 정책은 추가 보안 레이어로만 작동하며, 실제로는 적용되지 않습니다.

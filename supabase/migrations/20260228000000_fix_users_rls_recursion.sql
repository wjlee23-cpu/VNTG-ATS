-- ============================================
-- Users 테이블 RLS 무한 재귀 문제 수정
-- ============================================
-- 문제: "Users can view own organization data" 정책이 users 테이블을 다시 조회하여 무한 재귀 발생
-- 해결: 문제가 되는 정책을 완전히 삭제
-- 참고: "Users can view own data" 정책이 이미 있어서 자신의 데이터는 볼 수 있습니다.
--       같은 조직의 다른 사용자들을 보려면 서비스 역할 키를 사용하거나, 
--       애플리케이션 레벨에서 처리해야 합니다.

-- 문제가 되는 정책 삭제 (무한 재귀 원인)
DROP POLICY IF EXISTS "Users can view own organization data" ON users;

-- 참고: 
-- - 기존 "Users can view own data" 정책(id = auth.uid())은 그대로 유지됩니다.
-- - 개발 환경에서는 lib/supabase/server.ts에서 Service Role Key를 사용하여 RLS를 우회합니다.
-- - 프로덕션에서는 필요시 애플리케이션 레벨에서 조직별 사용자 조회를 처리합니다.

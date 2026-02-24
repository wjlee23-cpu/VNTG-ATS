-- 모든 지원자의 이메일 주소를 테스트용 이메일로 일괄 변경
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

-- ⚠️ 주의: 이 쿼리는 모든 지원자의 이메일을 변경합니다.
-- 테스트 환경에서만 사용하세요.

UPDATE candidates
SET email = 'blee6291@gmail.com'
WHERE id IS NOT NULL; -- 모든 레코드 업데이트

-- 변경된 레코드 수 확인
SELECT COUNT(*) as updated_count
FROM candidates
WHERE email = 'blee6291@gmail.com';

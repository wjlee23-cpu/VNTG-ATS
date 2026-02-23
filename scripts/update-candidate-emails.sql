-- 모든 후보자의 이메일을 blee6291@gmail.com으로 업데이트
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

UPDATE candidates
SET email = 'blee6291@gmail.com'
WHERE email LIKE 'candidate%@example.com'
   OR email != 'blee6291@gmail.com';

-- 업데이트된 레코드 수 확인
SELECT 
  COUNT(*) as total_candidates,
  COUNT(CASE WHEN email = 'blee6291@gmail.com' THEN 1 END) as updated_candidates
FROM candidates;

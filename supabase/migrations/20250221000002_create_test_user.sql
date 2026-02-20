-- 테스트 사용자 생성
-- 현재 로그인한 사용자를 users 테이블에 추가하거나
-- 테스트용 사용자를 생성합니다.

-- 방법 1: 현재 로그인한 사용자가 있다면, 해당 사용자의 ID를 사용하여 users 테이블에 추가
-- 아래 쿼리에서 'YOUR_AUTH_USER_ID'를 실제 auth.users의 ID로 변경하세요.

-- INSERT INTO users (id, email, organization_id, role)
-- SELECT 
--   id,
--   email,
--   (SELECT id FROM organizations WHERE name = 'VNTG Tech' LIMIT 1),
--   'admin'
-- FROM auth.users
-- WHERE id NOT IN (SELECT id FROM users)
-- LIMIT 1;

-- 방법 2: 모든 auth.users 사용자를 users 테이블에 추가
INSERT INTO users (id, email, organization_id, role)
SELECT 
  au.id,
  au.email,
  (SELECT id FROM organizations WHERE name = 'VNTG Tech' LIMIT 1),
  'admin'
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM users)
ON CONFLICT (id) DO UPDATE
SET organization_id = (SELECT id FROM organizations WHERE name = 'VNTG Tech' LIMIT 1);

-- 현재 로그인한 사용자를 users 테이블에 추가
-- 모든 auth.users 사용자를 VNTG Tech 조직에 연결

-- 모든 auth.users 사용자를 users 테이블에 추가
INSERT INTO users (id, email, organization_id, role)
SELECT 
  au.id,
  au.email,
  (SELECT id FROM organizations WHERE name = 'VNTG Tech' LIMIT 1),
  'admin'
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM users)
ON CONFLICT (id) DO UPDATE
SET 
  organization_id = (SELECT id FROM organizations WHERE name = 'VNTG Tech' LIMIT 1),
  role = 'admin';

-- 결과 확인
SELECT 
  u.id,
  u.email,
  u.organization_id,
  o.name as organization_name
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id;

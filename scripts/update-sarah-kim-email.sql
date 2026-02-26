-- Sarah Kim 후보자의 이메일을 wjlee23@vntgcorp.com으로 변경
UPDATE candidates
SET email = 'wjlee23@vntgcorp.com'
WHERE name = 'Sarah Kim'
  AND email LIKE 'candidate%@example.com';

-- 변경 결과 확인
SELECT id, name, email, phone, status, current_stage_id, created_at
FROM candidates
WHERE name = 'Sarah Kim';

-- ============================================
-- Users 프로필 필드 추가 (name, avatar_url)
-- ============================================
-- 목적:
-- - Activity Timeline에서 작성자 정보를(이름/프로필 사진) 표시하기 위함
-- - OAuth(구글) 로그인 시 가져오는 avatar_url을 users 테이블에 저장하기 위함
--
-- 안전:
-- - 컬럼 추가만 수행 (데이터 삭제/드롭 없음)

ALTER TABLE users
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 기존 사용자들 name이 비어있다면 이메일 앞부분으로 채움 (표시용)
UPDATE users
SET name = COALESCE(name, split_part(email, '@', 1))
WHERE name IS NULL;


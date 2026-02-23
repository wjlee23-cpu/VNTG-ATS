-- 기존 테이블 및 관련 객체 모두 삭제
-- 외래키 제약 조건 때문에 순서가 중요합니다.

-- RLS 정책 삭제
DROP POLICY IF EXISTS "Users can view own organization data" ON application_submissions;
DROP POLICY IF EXISTS "Users can insert own organization data" ON application_submissions;
DROP POLICY IF EXISTS "Users can update own organization data" ON application_submissions;
DROP POLICY IF EXISTS "Users can delete own organization data" ON application_submissions;

DROP POLICY IF EXISTS "Users can view own organization data" ON resume_files;
DROP POLICY IF EXISTS "Users can insert own organization data" ON resume_files;
DROP POLICY IF EXISTS "Users can update own organization data" ON resume_files;
DROP POLICY IF EXISTS "Users can delete own organization data" ON resume_files;

DROP POLICY IF EXISTS "Users can view own organization data" ON scorecards;
DROP POLICY IF EXISTS "Users can insert own organization data" ON scorecards;
DROP POLICY IF EXISTS "Users can update own organization data" ON scorecards;
DROP POLICY IF EXISTS "Users can delete own organization data" ON scorecards;

DROP POLICY IF EXISTS "Users can view own organization data" ON comments;
DROP POLICY IF EXISTS "Users can insert own organization data" ON comments;
DROP POLICY IF EXISTS "Users can update own organization data" ON comments;
DROP POLICY IF EXISTS "Users can delete own organization data" ON comments;

DROP POLICY IF EXISTS "Users can view own organization data" ON emails;
DROP POLICY IF EXISTS "Users can insert own organization data" ON emails;
DROP POLICY IF EXISTS "Users can update own organization data" ON emails;
DROP POLICY IF EXISTS "Users can delete own organization data" ON emails;

DROP POLICY IF EXISTS "Users can view own organization data" ON timeline_events;
DROP POLICY IF EXISTS "Users can insert own organization data" ON timeline_events;
DROP POLICY IF EXISTS "Users can update own organization data" ON timeline_events;
DROP POLICY IF EXISTS "Users can delete own organization data" ON timeline_events;

DROP POLICY IF EXISTS "Users can view own organization data" ON schedule_options;
DROP POLICY IF EXISTS "Users can insert own organization data" ON schedule_options;
DROP POLICY IF EXISTS "Users can update own organization data" ON schedule_options;
DROP POLICY IF EXISTS "Users can delete own organization data" ON schedule_options;

DROP POLICY IF EXISTS "Users can view own organization data" ON schedules;
DROP POLICY IF EXISTS "Users can insert own organization data" ON schedules;
DROP POLICY IF EXISTS "Users can update own organization data" ON schedules;
DROP POLICY IF EXISTS "Users can delete own organization data" ON schedules;

DROP POLICY IF EXISTS "Users can view own organization data" ON candidates;
DROP POLICY IF EXISTS "Users can insert own organization data" ON candidates;
DROP POLICY IF EXISTS "Users can update own organization data" ON candidates;
DROP POLICY IF EXISTS "Users can delete own organization data" ON candidates;
DROP POLICY IF EXISTS "Candidates can view own data" ON candidates;

DROP POLICY IF EXISTS "Users can view own organization data" ON job_posts;
DROP POLICY IF EXISTS "Users can insert own organization data" ON job_posts;
DROP POLICY IF EXISTS "Users can update own organization data" ON job_posts;
DROP POLICY IF EXISTS "Users can delete own organization data" ON job_posts;

DROP POLICY IF EXISTS "Users can view own organization data" ON processes;
DROP POLICY IF EXISTS "Users can insert own organization data" ON processes;
DROP POLICY IF EXISTS "Users can update own organization data" ON processes;
DROP POLICY IF EXISTS "Users can delete own organization data" ON processes;

DROP POLICY IF EXISTS "Users can view own organization data" ON users;
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

DROP POLICY IF EXISTS "Users can view own organization data" ON organizations;
DROP POLICY IF EXISTS "Users can insert own organization data" ON organizations;
DROP POLICY IF EXISTS "Users can update own organization data" ON organizations;
DROP POLICY IF EXISTS "Users can delete own organization data" ON organizations;

-- 테이블 삭제 (외래키 제약 때문에 역순으로)
DROP TABLE IF EXISTS application_submissions CASCADE;
DROP TABLE IF EXISTS resume_files CASCADE;
DROP TABLE IF EXISTS scorecards CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS emails CASCADE;
DROP TABLE IF EXISTS timeline_events CASCADE;
DROP TABLE IF EXISTS schedule_options CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS job_posts CASCADE;
DROP TABLE IF EXISTS processes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- 함수 삭제
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
